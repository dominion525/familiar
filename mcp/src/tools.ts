import { z } from "zod";

// `inputSchema` carries the raw Zod shape (key → ZodType). InputOf<TShape>
// turns that shape into the validated input object type, so each tool's
// runArgs / timeoutMs callbacks receive their inputs typed exactly per their
// own schema rather than as Record<string, unknown>.
type ZodRawShape = Record<string, z.ZodTypeAny>;
type InputOf<TShape extends ZodRawShape> = z.infer<z.ZodObject<TShape>>;

export type ToolDef<TShape extends ZodRawShape = ZodRawShape> = {
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
  /**
   * Optional MCP outputSchema declaring the shape of structuredContent. When
   * present, the dispatch layer passes the parsed result through this schema
   * so MCP clients get a typed object instead of a raw sentinel string.
   */
  outputSchema?: ZodRawShape;
  /**
   * Optional translator from raw osascript stdout to a structured object that
   * conforms to outputSchema. Set together with outputSchema. Used to bridge
   * the current AppleScript-side sentinel returns (e.g. "not_found") to a
   * structured { found, value } so the LLM can distinguish "element absent"
   * from "element present with the literal value 'not_found'".
   * (Full disambiguation will land when the AppleScript side is updated to
   * emit structured returns directly — tracked in tasks/todo.md.)
   */
  parseStdout?(stdout: string): Record<string, unknown>;
};

// Shared output shape for read-side tools (get_text / get_attribute / get_value).
const ReadResult = {
  found: z.boolean().describe("True if the element was found, false otherwise"),
  value: z
    .string()
    .optional()
    .describe("The element's value; present only when found is true"),
};

function parseReadResult(stdout: string): { found: boolean; value?: string } {
  return stdout === "not_found"
    ? { found: false }
    : { found: true, value: stdout };
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

// windowId / tabId are coerced from any input so that LLMs which emit them as
// numbers (a common slip-up) still pass Zod validation. The AppleScript side
// expects strings on the command line.
const WindowRef = {
  windowId: z.coerce.string().describe("Chrome window id"),
};

const TabRef = {
  ...WindowRef,
  tabId: z.coerce.string().describe("Chrome tab id"),
};

const TabRefWithSelector = {
  ...TabRef,
  selector: z
    .string()
    .describe(
      'Element selector. Supports CSS (default), "text=<exact visible text>", "xpath=<xpath>", and "label=<label text>". See reference-actions.md for resolution details.',
    ),
};

// AppleScript-side `wait_for_load` polls document.readyState for up to 60s.
const WAIT_FOR_LOAD_INNER_MS = 60_000;
// Buffer added to every wait-style action so the osascript kill-timer always
// outlives the AppleScript-side wait.
const TIMEOUT_BUFFER_MS = 5_000;
// Upper bound for caller-supplied maxSeconds; matches what's practical to
// stage in a single MCP tool call without monopolizing osascript.
const MAX_WAIT_SECONDS = 300;

export const TOOLS: ToolDef[] = [
  // Control plane: tabs / windows
  defineTool({
    name: "list_tabs",
    description:
      'Enumerate every open Chrome tab across every window. The starting point for tab-scoped actions: most other tools need a windowId/tabId pair, which comes from this output (or from new_tab / new_incognito_tab). Returns one line per tab: "<windowId>,<tabId>,<title>,<url>". Native — works even when "Allow JavaScript from Apple Events" is off.',
    inputSchema: {},
    runArgs: () => [],
  }),
  defineTool({
    name: "new_tab",
    description:
      'Open a new tab in a normal (non-incognito) Chrome window and return its "<windowId>,<tabId>". Launches Chrome if needed. For an incognito context use new_incognito_tab. Follow with navigate to load a URL.',
    inputSchema: {},
    runArgs: () => [],
  }),
  defineTool({
    name: "new_incognito_tab",
    description:
      'Like new_tab but targets an incognito window. Use when isolation from the user\'s normal browsing profile matters. State is shared across all incognito windows and discarded when the last incognito window closes. Returns "<windowId>,<tabId>".',
    inputSchema: {},
    runArgs: () => [],
  }),
  defineTool({
    name: "close_tab",
    description:
      "Close the specified tab. Pair with new_tab / new_incognito_tab to clean up tabs opened by the task. No value returned.",
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),
  defineTool({
    name: "active_tab",
    description:
      'Return the active (front) tab of one window as "<windowId>,<tabId>". Use when you need the tab the user is looking at right now in a specific window — list_tabs returns every tab, active_tab narrows to one. Native.',
    inputSchema: WindowRef,
    runArgs: (input) => [input.windowId],
  }),
  defineTool({
    name: "window_mode",
    description:
      'Return "normal" or "incognito" for the given window. Useful before reading storage or cookies, since incognito windows have isolated state. Native.',
    inputSchema: WindowRef,
    runArgs: (input) => [input.windowId],
  }),
  defineTool({
    name: "is_loading",
    description:
      'One-shot check of whether the tab is currently loading. Returns "true" or "false". Use this when you only need to peek at the loading state (e.g. skip a step if mid-navigation); to actually block until ready, use wait_for_load. Native (no JS required).',
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),

  // Control plane: navigation
  defineTool({
    name: "navigate",
    description:
      "Set the tab's URL. Returns once navigation has started; does NOT block until the page finishes loading. Standard pattern: navigate → wait_for_load (DOM ready), or navigate → wait_for_selector (a known element appears). No value returned.",
    inputSchema: {
      ...TabRef,
      url: z.string().describe("URL to navigate to"),
    },
    runArgs: (input) => [input.windowId, input.tabId, input.url],
  }),
  defineTool({
    name: "get_tab_url",
    description:
      "Return the tab's current URL. Useful after navigate to confirm the final URL (after redirects), or to read the user's current URL before acting. Native.",
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),
  defineTool({
    name: "reload",
    description:
      "Reload the tab. Follow with wait_for_load when the next step depends on a freshly-loaded DOM. No value returned. Native.",
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),
  defineTool({
    name: "go_back",
    description:
      "Navigate back in the tab's history. No-op if there is no back history. Follow with wait_for_load if the next step needs the previous page's DOM ready. No value returned. Native.",
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),
  defineTool({
    name: "go_forward",
    description:
      "Navigate forward in the tab's history. No-op if there is no forward history. Follow with wait_for_load if the next step needs the forward page's DOM ready. No value returned. Native.",
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),
  defineTool({
    name: "stop",
    description:
      "Stop the tab's in-progress loading. No value returned. Native.",
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),

  // Control plane: waiting
  defineTool({
    name: "wait_for_load",
    description:
      'Block until document.readyState reaches "complete" (polled every 0.5s, up to 60s). The standard follow-up to navigate / reload / go_back / go_forward when the next step needs a finished DOM. For a more specific signal (a particular element appearing), use wait_for_selector. Returns "complete" or "timeout".',
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
    timeoutMs: () => WAIT_FOR_LOAD_INNER_MS + TIMEOUT_BUFFER_MS,
  }),
  defineTool({
    name: "wait_for_selector",
    description:
      'Block until a specific element appears (CSS selector polled up to maxSeconds). Use for SPA / lazy-loaded content where wait_for_load reports "complete" before the element exists. Takes a CSS selector ONLY (no text= / xpath= / label= prefixes — those are rejected at the schema layer). For non-CSS conditions, use wait_for_function. Returns "found" or "timeout".',
    inputSchema: {
      ...TabRef,
      selector: z
        .string()
        .refine(
          (s) => !/^(text=|xpath=|label=)/.test(s),
          "wait_for_selector takes a CSS selector only. For text= / xpath= / label= conditions, use wait_for_function.",
        )
        .describe(
          "CSS selector to wait for (text= / xpath= / label= prefixes are rejected)",
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
    name: "wait_for_function",
    description:
      'Block until an arbitrary JavaScript expression becomes truthy (polled up to maxSeconds). Use when the condition cannot be expressed as a selector — e.g. "window.__appReady === true" or "document.querySelectorAll(\'.row\').length >= 10". If a CSS selector alone is the condition, prefer wait_for_selector (cheaper and less error-prone). Evaluated as Boolean(expr); a thrown error counts as false, so probing not-yet-defined properties is safe. Pass an expression, not a statement (no top-level `return`). Returns "true" or "timeout".',
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
    name: "get_html",
    description:
      "Return the live DOM as document.documentElement.outerHTML. Use for whole-page extraction or when the structure matters; for a single element's text/attribute, get_text / get_attribute / query_all are much smaller. May return up to 10 MiB. Note: outerHTML does NOT include shadow trees — for shadow-DOM content use execute_js to traverse explicitly. For lazy-loaded content, wait_for_selector first.",
    inputSchema: TabRef,
    runArgs: (input) => [input.windowId, input.tabId],
  }),
  defineTool({
    name: "execute_js",
    description:
      "Run short inline JavaScript in the page and return the LAST evaluated expression as text (completion value, like the DevTools console). Multiple statements are fine; end with an expression — a top-level `return` does not work. Inline strings must survive AppleScript escaping, so for anything with quotes, newlines, or special characters, use execute_js_file instead.",
    inputSchema: {
      ...TabRef,
      expression: z.string().describe("JavaScript expression"),
    },
    runArgs: (input) => [input.windowId, input.tabId, input.expression],
  }),
  defineTool({
    name: "execute_js_file",
    description:
      "Read JavaScript from a UTF-8 file on the local filesystem (absolute path to an existing file) and run it in the page. Sidesteps AppleScript escaping entirely — prefer this for multi-line scripts, anything with quotes, or anything with special characters. Returns the completion value (multiple statements are fine; end with an expression).",
    inputSchema: {
      ...TabRef,
      path: z
        .string()
        .startsWith("/", "Path must be absolute (start with /)")
        .describe("Absolute path to the JS file"),
    },
    runArgs: (input) => [input.windowId, input.tabId, input.path],
  }),

  // Element plane: reads
  defineTool({
    name: "get_text",
    description:
      "Read one element's trimmed visible text (innerText, falling back to textContent). Returns structuredContent `{ found, value }`: value is the element's text when found is true; found is false if the selector matched nothing. The most common read action for headings, labels, status messages. For input values use get_value, for attributes use get_attribute, for multiple elements use query_all.",
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
    outputSchema: ReadResult,
    parseStdout: parseReadResult,
  }),
  defineTool({
    name: "get_attribute",
    description:
      "Read a named attribute (href, src, data-*, aria-*, etc.) of one element. Returns structuredContent `{ found, value }`: value is the attribute value (empty string if the attribute is missing on a matched element); found is false if no element matched. For visible text use get_text; for input current value use get_value.",
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
    name: "get_value",
    description:
      "Read the current value of an input / textarea / select. Returns structuredContent `{ found, value }`: value is the field value (empty string if the field has none, distinct from absence); found is false if no element matched. Reads what fill set, what the user typed, or what a framework bound to the field.",
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
    outputSchema: ReadResult,
    parseStdout: parseReadResult,
  }),
  defineTool({
    name: "exists",
    description:
      'Check whether an element is present without reading anything from it. Returns "true" or "false" — never "not_found". Use for quick yes/no checks. If you want to wait for it to appear, use wait_for_selector instead of polling exists.',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
  }),
  defineTool({
    name: "query_all",
    description:
      'Collect the trimmed text of every matching element as a JSON array, e.g. ["First","Second"]. Use for list / table-row / search-result extraction. Empty result is "[]". With CSS or xpath= selectors, returns every match; text= / label= yield at most one element. get_text returns only the first match.',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
  }),

  // Element plane: interaction
  defineTool({
    name: "click",
    description:
      'Scroll an element into view (centered) and call .click() on it. Use for buttons, links, and most clickable UI. To toggle a checkbox/radio to a specific state use set_checked instead (click flips, set_checked sets). Returns "true" or "not_found".',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
  }),
  defineTool({
    name: "fill",
    description:
      'Set the value of an input / textarea via the native value setter, then dispatch input + change events. The native setter ensures modern UI frameworks detect the update. For <select> use select_option, for checkbox/radio use set_checked. Returns "true" or "not_found".',
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
    name: "clear",
    description:
      'Empty an input / textarea. Equivalent to fill with "". Returns "true" or "not_found".',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
  }),
  defineTool({
    name: "select_option",
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
    name: "set_checked",
    description:
      'Set a checkbox or radio to true (checked) or false (unchecked) via the native setter, then fire input + change. Prefer over click when you need a known state regardless of current state. Returns "true" or "not_found".',
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
    name: "press_key",
    description:
      'Focus the element and dispatch synthetic keydown / keypress / keyup events for the key. Use for keyboard interactions like Enter (submit a search box), Escape (close a modal), ArrowDown (move through a menu). This does NOT type text — use fill for that. Events are isTrusted=false, so strict bot-detection sites may ignore them. Returns "true" or "not_found".',
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
    name: "submit",
    description:
      'Submit the form the element belongs to (or the element itself if it is a <form>). Uses requestSubmit() so HTML5 validation and submit handlers run, falling back to submit() when unsupported. Often more reliable than clicking the submit button. Returns "true", "no_form" if the element was not in a form, or "not_found".',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
  }),
  defineTool({
    name: "scroll_into_view",
    description:
      'Scroll the element into view (centered). click already scrolls before clicking, so this is mainly for: making the element visible to the user, triggering lazy-load that activates on viewport entry, or staging a visual screenshot. Returns "true" or "not_found".',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [input.windowId, input.tabId, input.selector],
  }),
];
