import { statSync } from "node:fs";
import { isAbsolute, normalize } from "node:path";
import { z } from "zod";
import { MAX_BUFFER } from "./applescript.js";

const MAX_BUFFER_MIB = Math.round(MAX_BUFFER / (1024 * 1024));

// `inputSchema` carries the raw Zod shape (key → ZodType). InputOf<TShape>
// turns that shape into the validated input object type, so each tool's
// runArgs / timeoutMs callbacks receive their inputs typed exactly per their
// own schema rather than as Record<string, unknown>.
type ZodRawShape = Record<string, z.ZodTypeAny>;
type InputOf<TShape extends ZodRawShape> = z.infer<z.ZodObject<TShape>>;

type ToolDefCommon<TShape extends ZodRawShape> = {
  name: string;
  description: string;
  inputSchema: TShape;
  // Method shorthand (not arrow property) makes runArgs / timeoutMs bivariant
  // in TShape, so a heterogeneous array of `ToolDef<SpecificShape>` can still
  // be assigned to `ToolDef<ZodRawShape>[]`. Without this the per-tool type
  // inference would be lost the moment we collect them into TOOLS.
  runArgs(input: InputOf<TShape>): string[];
  /**
   * Optional osascript kill-timeout in milliseconds, derived from the
   * validated input. Required for actions that wait inside AppleScript so the
   * outer kill-timer outlives the inner wait.
   */
  timeoutMs?(input: InputOf<TShape>): number;
};

/**
 * MCP outputSchema declares the shape of structuredContent. Accepts either a
 * raw shape (Record<string, ZodTypeAny>, wrapped by the SDK into z.object) or
 * a full Zod schema instance (z.object etc.) — the SDK's registerTool overload
 * accepts both via `ZodRawShapeCompat | AnySchema` (mcp.d.ts:150). Note: the
 * SDK's normalizeObjectSchema rejects z.discriminatedUnion, see ReadResult
 * comment for the workaround.
 */
type ToolOutputSchema = ZodRawShape | z.ZodTypeAny;

/**
 * ToolDef is a discriminated union: a tool either declares both outputSchema
 * and parseStdout (structured response) or declares neither (raw text). The
 * MCP SDK throws an "Output validation error" at runtime if outputSchema is
 * declared but the response carries no structuredContent (mcp.js:196), so
 * binding the two fields at the type layer prevents that drift at compile
 * time.
 *
 * parseStdout translates osascript stdout into the object that flows into
 * structuredContent. It exists as a bridge until the AppleScript side emits
 * structured returns directly (tracked in tasks/todo.md).
 */
export type ToolDef<TShape extends ZodRawShape = ZodRawShape> =
  | (ToolDefCommon<TShape> & {
      outputSchema: ToolOutputSchema;
      parseStdout(stdout: string): Record<string, unknown>;
    })
  | (ToolDefCommon<TShape> & {
      outputSchema?: undefined;
      parseStdout?: undefined;
    });

// Shared output schema for read-side tools
// (familiar_get_text / familiar_get_attribute / familiar_get_value).
//
// AppleScript side now emits a JSON envelope:
//   {"found": false}                   // element not found
//   {"found": true, "value": "..."}    // element found
// This replaces the previous bare-string return where "not_found" was both
// the sentinel for "no element matched" and a possible page text — a page
// element whose visible text was literally "not_found" used to be misclassified
// as missing. With the envelope, found and value are syntactically distinct
// from any possible page content.
//
// The MCP SDK's outputSchema layer only normalises raw shapes and ZodObject
// (zod-compat.js:normalizeObjectSchema returns undefined for
// discriminatedUnion / union / etc.), so the schema-side invariant "value is
// present iff found is true" cannot be enforced via z.discriminatedUnion at
// outputSchema. Instead:
//   1. outputSchema stays as a raw shape with value: optional<string>
//   2. parseReadResult's return type is a TypeScript discriminated union, so
//      a future parseStdout that returns {found: true} without value is a
//      compile-time error in this file
//   3. The description states the invariant for MCP clients reading the schema
const ReadResult = {
  found: z.boolean().describe("True if the element was found, false otherwise"),
  value: z
    .string()
    .optional()
    .describe("The element's value; present iff found is true"),
};

type ReadResultValue = { found: true; value: string } | { found: false };

function parseReadResult(stdout: string): ReadResultValue {
  // stdout is a JSON envelope produced by the AppleScript layer's
  // JSON.stringify call. A malformed payload throws SyntaxError, which the
  // dispatch catch in server.ts turns into an isError response with
  // structuredContent {kind: "unknown"} — surfacing as a real failure to the
  // LLM rather than a silent shape mismatch.
  const parsed = JSON.parse(stdout) as ReadResultValue;
  return parsed;
}

// Output schema for familiar_exists. Keeps the read-side surface of the MCP
// uniformly structured: every "did the element exist?" answer is a typed
// object instead of a raw "true"/"false" string the LLM has to parse.
const ExistsResult = {
  exists: z
    .boolean()
    .describe("True if at least one element matches the selector"),
};

function parseExistsResult(stdout: string): { exists: boolean } {
  return { exists: stdout === "true" };
}

/**
 * Identity helper used to register a tool while preserving the precise schema
 * shape for downstream type inference. Without it the call-site narrows
 * `TShape` to `ZodRawShape`, which collapses `input` back to a generic record.
 */
function defineTool<TShape extends ZodRawShape>(
  def: ToolDef<TShape>,
): ToolDef<TShape> {
  return def;
}

// windowId / tabId accept either a string or a non-negative integer (LLMs
// commonly emit Chrome IDs as numbers); both forms transform to the string
// that AppleScript expects on the command line. Rejecting null / arrays /
// objects here — instead of relying on z.coerce.string() which would silently
// stringify them to "null" / "1,2" / "[object Object]" — surfaces the bad
// input as a clear Zod error instead of an opaque Chrome-side failure.
const IdField = z
  .union([z.string(), z.number().int().nonnegative()])
  .transform(String);

const WindowRef = {
  windowId: IdField.describe("Chrome window id"),
};

const TabRef = {
  ...WindowRef,
  tabId: IdField.describe("Chrome tab id"),
};

const TabRefWithSelector = {
  ...TabRef,
  selector: z
    .string()
    .describe(
      'Element selector. Supports CSS (default), "text=<exact visible text>", "xpath=<xpath>", and "label=<label text>". See reference-actions.md for resolution details.',
    ),
};

// Buffer added to every wait-style action so the osascript kill-timer always
// outlives the AppleScript-side wait.
const TIMEOUT_BUFFER_MS = 5_000;
// Upper bound for caller-supplied maxSeconds; matches what's practical to
// stage in a single MCP tool call without monopolizing osascript.
const MAX_WAIT_SECONDS = 300;

export const TOOLS: ToolDef[] = [
  // Control plane: tabs / windows
  defineTool({
    name: "familiar_list_tabs",
    description:
      'Enumerate every open Chrome tab across every window. The starting point for tab-scoped actions: most other tools need a windowId/tabId pair, which comes from this output (or from familiar_new_tab / familiar_new_incognito_tab). Returns one line per tab: "<windowId>,<tabId>,<title>,<url>". Native — works even when "Allow JavaScript from Apple Events" is off.',
    inputSchema: {},
    runArgs: () => [],
  }),
  defineTool({
    name: "familiar_new_tab",
    description:
      'Open a new tab in a normal (non-incognito) Chrome window and return its "<windowId>,<tabId>". Launches Chrome if needed. For an incognito context use familiar_new_incognito_tab. Follow with familiar_navigate to load a URL.',
    inputSchema: {},
    runArgs: () => [],
  }),
  defineTool({
    name: "familiar_new_incognito_tab",
    description:
      'Like familiar_new_tab but targets an incognito window. Use when isolation from the user\'s normal browsing profile matters. State is shared across all incognito windows and discarded when the last incognito window closes. Returns "<windowId>,<tabId>".',
    inputSchema: {},
    runArgs: () => [],
  }),
  defineTool({
    name: "familiar_close_tab",
    description:
      "Close the specified tab. Pair with familiar_new_tab / familiar_new_incognito_tab to clean up tabs opened by the task. No value returned.",
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),
  defineTool({
    name: "familiar_active_tab",
    description:
      'Return the active (front) tab of one window as "<windowId>,<tabId>". Use when you need the tab the user is looking at right now in a specific window — familiar_list_tabs returns every tab, familiar_active_tab narrows to one. Native.',
    inputSchema: WindowRef,
    runArgs: (input) => [input.windowId],
  }),
  defineTool({
    name: "familiar_window_mode",
    description:
      'Return "normal" or "incognito" for the given window. Useful before reading storage or cookies, since incognito windows have isolated state. Native.',
    inputSchema: WindowRef,
    runArgs: (input) => [input.windowId],
  }),
  defineTool({
    name: "familiar_is_loading",
    description:
      'One-shot check of whether the tab is currently loading. Returns "true" or "false". Use this when you only need to peek at the loading state (e.g. skip a step if mid-navigation); to actually block until ready, use familiar_wait_for_load. Native (no JS required).',
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),

  // Control plane: navigation
  defineTool({
    name: "familiar_navigate",
    description:
      "Set the tab's URL. Returns once navigation has started; does NOT block until the page finishes loading. Standard pattern: familiar_navigate → familiar_wait_for_load (DOM ready), or familiar_navigate → familiar_wait_for_selector (a known element appears). No value returned.",
    inputSchema: {
      ...TabRef,
      url: z.string().describe("URL to navigate to"),
    },
    runArgs: (input) => [input.windowId, input.tabId, input.url],
  }),
  defineTool({
    name: "familiar_get_tab_url",
    description:
      "Return the tab's current URL. Useful after familiar_navigate to confirm the final URL (after redirects), or to read the user's current URL before acting. Native.",
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),
  defineTool({
    name: "familiar_reload",
    description:
      "Reload the tab. Follow with familiar_wait_for_load when the next step depends on a freshly-loaded DOM. No value returned. Native.",
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),
  defineTool({
    name: "familiar_go_back",
    description:
      "Navigate back in the tab's history. No-op if there is no back history. Follow with familiar_wait_for_load if the next step needs the previous page's DOM ready. No value returned. Native.",
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),
  defineTool({
    name: "familiar_go_forward",
    description:
      "Navigate forward in the tab's history. No-op if there is no forward history. Follow with familiar_wait_for_load if the next step needs the forward page's DOM ready. No value returned. Native.",
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),
  defineTool({
    name: "familiar_stop",
    description:
      "Stop the tab's in-progress loading. No value returned. Native.",
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),

  // Control plane: waiting
  defineTool({
    name: "familiar_wait_for_load",
    description:
      'Block until document.readyState reaches "complete" (polled every 0.5s, up to maxSeconds). The standard follow-up to familiar_navigate / familiar_reload / familiar_go_back / familiar_go_forward when the next step needs a finished DOM. For a more specific signal (a particular element appearing), use familiar_wait_for_selector. Returns "complete" or "timeout".',
    inputSchema: {
      ...TabRef,
      maxSeconds: z
        .number()
        .int()
        .positive()
        .max(MAX_WAIT_SECONDS)
        .describe("Maximum seconds to poll"),
    },
    runArgs: (input) => [input.windowId, input.tabId, String(input.maxSeconds)],
    timeoutMs: (input) => input.maxSeconds * 1000 + TIMEOUT_BUFFER_MS,
  }),
  defineTool({
    name: "familiar_wait_for_selector",
    description:
      'Block until a specific element appears (CSS selector polled up to maxSeconds). Use for SPA / lazy-loaded content where familiar_wait_for_load reports "complete" before the element exists. Takes a CSS selector ONLY (no text= / xpath= / label= prefixes — those are rejected at the schema layer). For non-CSS conditions, use familiar_wait_for_function. Returns "found" or "timeout".',
    inputSchema: {
      ...TabRef,
      selector: z
        .string()
        .refine(
          (s) => !/^(text=|xpath=|label=)/i.test(s),
          "familiar_wait_for_selector takes a CSS selector only. For text= / xpath= / label= conditions, use familiar_wait_for_function.",
        )
        .describe(
          "CSS selector to wait for (text= / xpath= / label= prefixes are rejected, case-insensitive)",
        ),
      maxSeconds: z
        .number()
        .int()
        .positive()
        .max(MAX_WAIT_SECONDS)
        .describe("Maximum seconds to poll"),
    },
    runArgs: (input) => [
      input.windowId,
      input.tabId,
      input.selector,
      String(input.maxSeconds),
    ],
    timeoutMs: (input) => input.maxSeconds * 1000 + TIMEOUT_BUFFER_MS,
  }),
  defineTool({
    name: "familiar_wait_for_function",
    description:
      'Block until an arbitrary JavaScript expression becomes truthy (polled up to maxSeconds). Use when the condition cannot be expressed as a selector — e.g. "window.__appReady === true" or "document.querySelectorAll(\'.row\').length >= 10". If a CSS selector alone is the condition, prefer familiar_wait_for_selector (cheaper and less error-prone). Evaluated as Boolean(expr); a thrown error counts as false, so probing not-yet-defined properties is safe. Pass an expression, not a statement (no top-level `return`). Returns "true" or "timeout".',
    inputSchema: {
      ...TabRef,
      expression: z
        .string()
        .describe("JavaScript expression evaluated as Boolean(...)"),
      maxSeconds: z
        .number()
        .int()
        .positive()
        .max(MAX_WAIT_SECONDS)
        .describe("Maximum seconds to poll"),
    },
    runArgs: (input) => [
      input.windowId,
      input.tabId,
      input.expression,
      String(input.maxSeconds),
    ],
    timeoutMs: (input) => input.maxSeconds * 1000 + TIMEOUT_BUFFER_MS,
  }),

  // Control plane: content / scripting
  defineTool({
    name: "familiar_get_html",
    description: `Return the live DOM as document.documentElement.outerHTML. Use for whole-page extraction or when the structure matters; for a single element's text/attribute, familiar_get_text / familiar_get_attribute / familiar_query_all are much smaller. May return up to ${MAX_BUFFER_MIB} MiB. Note: outerHTML does NOT include shadow trees — for shadow-DOM content use familiar_execute_js to traverse explicitly. For lazy-loaded content, familiar_wait_for_selector first.`,
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),
  defineTool({
    name: "familiar_execute_js",
    description:
      "Run short inline JavaScript in the page and return the LAST evaluated expression as text (completion value, like the DevTools console). Multiple statements are fine; end with an expression — a top-level `return` does not work. Inline strings must survive AppleScript escaping, so for anything with quotes, newlines, or special characters, use familiar_execute_js_file instead.",
    inputSchema: {
      ...TabRef,
      expression: z.string().describe("JavaScript expression"),
    },
    runArgs: (input) => [input.windowId, input.tabId, input.expression],
  }),
  defineTool({
    name: "familiar_execute_js_file",
    description:
      "Read JavaScript from a UTF-8 file on the local filesystem (absolute path to an existing file) and run it in the page. Sidesteps AppleScript escaping entirely — prefer this for multi-line scripts, anything with quotes, or anything with special characters. Returns the completion value (multiple statements are fine; end with an expression).",
    inputSchema: {
      ...TabRef,
      path: z
        .string()
        .refine(isAbsolute, "Path must be absolute (start with /)")
        .refine(
          (p) => normalize(p) === p,
          "Path must be canonical (no '..' or redundant '.')",
        )
        .refine((p) => {
          try {
            return statSync(p).isFile();
          } catch {
            return false;
          }
        }, "Path must point to an existing readable file")
        .describe("Absolute, canonical path to an existing JS file"),
    },
    runArgs: (input) => [input.windowId, input.tabId, input.path],
  }),

  // Element plane: reads
  defineTool({
    name: "familiar_get_text",
    description:
      "Read one element's trimmed visible text (innerText, falling back to textContent). Returns structuredContent `{ found, value }`: value is the element's text when found is true; found is false if the selector matched nothing. The most common read action for headings, labels, status messages. For input values use familiar_get_value, for attributes use familiar_get_attribute, for multiple elements use familiar_query_all.",
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
    outputSchema: ReadResult,
    parseStdout: parseReadResult,
  }),
  defineTool({
    name: "familiar_get_attribute",
    description:
      "Read a named attribute (href, src, data-*, aria-*, etc.) of one element. Returns structuredContent `{ found, value }`: value is the attribute value (empty string if the attribute is missing on a matched element); found is false if no element matched. For visible text use familiar_get_text; for input current value use familiar_get_value.",
    inputSchema: {
      ...TabRefWithSelector,
      name: z.string().describe("Attribute name (e.g. href, src, data-id)"),
    },
    runArgs: (input) => [
      input.windowId,
      input.tabId,
      input.selector,
      input.name,
    ],
    outputSchema: ReadResult,
    parseStdout: parseReadResult,
  }),
  defineTool({
    name: "familiar_get_value",
    description:
      "Read the current value of an input / textarea / select. Returns structuredContent `{ found, value }`: value is the field value (empty string if the field has none, distinct from absence); found is false if no element matched. Reads what familiar_fill set, what the user typed, or what a framework bound to the field.",
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
    outputSchema: ReadResult,
    parseStdout: parseReadResult,
  }),
  defineTool({
    name: "familiar_exists",
    description:
      "Check whether an element is present without reading anything from it. Returns structuredContent `{ exists: boolean }` — never absent. Use for quick yes/no checks. If you want to wait for it to appear, use familiar_wait_for_selector instead of polling familiar_exists.",
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
    outputSchema: ExistsResult,
    parseStdout: parseExistsResult,
  }),
  defineTool({
    name: "familiar_query_all",
    description:
      'Collect the trimmed text of every matching element as a JSON array, e.g. ["First","Second"]. Use for list / table-row / search-result extraction. Empty result is "[]". With CSS or xpath= selectors, returns every match; text= / label= yield at most one element. familiar_get_text returns only the first match.',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
  }),

  // Element plane: interaction
  defineTool({
    name: "familiar_click",
    description:
      'Scroll an element into view (centered) and call .click() on it. Use for buttons, links, and most clickable UI. To toggle a checkbox/radio to a specific state use familiar_set_checked instead (familiar_click flips, familiar_set_checked sets). Returns "true" or "not_found".',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
  }),
  defineTool({
    name: "familiar_fill",
    description:
      'Set the value of an input / textarea via the native value setter, then dispatch input + change events. The native setter ensures modern UI frameworks detect the update. For <select> use familiar_select_option, for checkbox/radio use familiar_set_checked. Returns "true" or "not_found".',
    inputSchema: {
      ...TabRefWithSelector,
      value: z.string().describe("Value to fill"),
    },
    runArgs: (input) => [
      input.windowId,
      input.tabId,
      input.selector,
      input.value,
    ],
  }),
  defineTool({
    name: "familiar_clear",
    description:
      'Empty an input / textarea. Equivalent to familiar_fill with "". Returns "true" or "not_found".',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
  }),
  defineTool({
    name: "familiar_select_option",
    description:
      'Pick an <option> in a <select>. Matches by `value` attribute first, then by visible text as a fallback. Fires input + change so framework bindings update. Returns "true", "no_option" if the select was found but had no matching option, or "not_found" if the select itself was not found.',
    inputSchema: {
      ...TabRefWithSelector,
      value: z.string().describe("Option value or visible text to select"),
    },
    runArgs: (input) => [
      input.windowId,
      input.tabId,
      input.selector,
      input.value,
    ],
  }),
  defineTool({
    name: "familiar_set_checked",
    description:
      'Set a checkbox or radio to true (checked) or false (unchecked) via the native setter, then fire input + change. Prefer over familiar_click when you need a known state regardless of current state. Returns "true" or "not_found".',
    inputSchema: {
      ...TabRefWithSelector,
      checked: z.boolean().describe("Desired checked state"),
    },
    runArgs: (input) => [
      input.windowId,
      input.tabId,
      input.selector,
      String(input.checked),
    ],
  }),
  defineTool({
    name: "familiar_press_key",
    description:
      'Focus the element and dispatch synthetic keydown / keypress / keyup events for the key. Use for keyboard interactions like Enter (submit a search box), Escape (close a modal), ArrowDown (move through a menu). This does NOT type text — use familiar_fill for that. Events are isTrusted=false, so strict bot-detection sites may ignore them. Returns "true" or "not_found".',
    inputSchema: {
      ...TabRefWithSelector,
      key: z
        .string()
        .describe(
          'Single character (e.g. "a", "5") or named key: Enter, Tab, Escape, Backspace, Delete, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, space',
        ),
    },
    runArgs: (input) => [
      input.windowId,
      input.tabId,
      input.selector,
      input.key,
    ],
  }),
  defineTool({
    name: "familiar_submit",
    description:
      'Submit the form the element belongs to (or the element itself if it is a <form>). Uses requestSubmit() so HTML5 validation and submit handlers run, falling back to submit() when unsupported. Often more reliable than familiar_click on the submit button. Returns "true", "no_form" if the element was not in a form, or "not_found".',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
  }),
  defineTool({
    name: "familiar_scroll_into_view",
    description:
      'Scroll the element into view (centered). familiar_click already scrolls before clicking, so this is mainly for: making the element visible to the user, triggering lazy-load that activates on viewport entry, or staging a visual screenshot. Returns "true" or "not_found".',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
  }),
];
