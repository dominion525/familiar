import { z } from "zod";

const WindowRef = {
  windowId: z.string().describe("Chrome window id"),
};

const TabRef = {
  ...WindowRef,
  tabId: z.string().describe("Chrome tab id"),
};

const TabRefWithSelector = {
  ...TabRef,
  selector: z
    .string()
    .describe(
      'Element selector. Supports CSS (default), "text=<exact visible text>", "xpath=<xpath>", and "label=<label text>". See reference-actions.md for resolution details.',
    ),
};

export type ToolInputShape = Record<string, z.ZodTypeAny>;

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: ToolInputShape;
  runArgs: (input: Record<string, unknown>) => string[];
};

export const TOOLS: ToolDef[] = [
  // Control plane: tabs / windows
  {
    name: "list_tabs",
    description:
      'List all open Chrome tabs across all windows. Returns one tab per line as "<windowId>,<tabId>,<title>,<url>". Native; works even when "Allow JavaScript from Apple Events" is off.',
    inputSchema: {},
    runArgs: () => [],
  },
  {
    name: "new_tab",
    description:
      'Open a new tab in a normal Chrome window (creates one if no normal window exists). Launches Chrome if not running. Returns "<windowId>,<tabId>". When it creates a new window it reuses the initial tab so no blank tab is left behind.',
    inputSchema: {},
    runArgs: () => [],
  },
  {
    name: "new_incognito_tab",
    description:
      'Open a new tab in an incognito Chrome window (creates one if none exists). Incognito cookies start empty and vanish when the window closes. Returns "<windowId>,<tabId>".',
    inputSchema: {},
    runArgs: () => [],
  },
  {
    name: "close_tab",
    description: "Close the specified tab. No value returned.",
    inputSchema: TabRef,
    runArgs: (input) => [String(input.windowId), String(input.tabId)],
  },
  {
    name: "active_tab",
    description:
      'Return the active tab of the given window as "<windowId>,<tabId>". Native.',
    inputSchema: WindowRef,
    runArgs: (input) => [String(input.windowId)],
  },
  {
    name: "window_mode",
    description: 'Return the window\'s mode: "normal" or "incognito". Native.',
    inputSchema: WindowRef,
    runArgs: (input) => [String(input.windowId)],
  },
  {
    name: "is_loading",
    description:
      'Return "true" or "false" for whether the tab is currently loading. Native (no JS required), unlike wait_for_load which polls document.readyState.',
    inputSchema: TabRef,
    runArgs: (input) => [String(input.windowId), String(input.tabId)],
  },

  // Control plane: navigation
  {
    name: "navigate",
    description:
      "Navigate the tab to a URL. Briefly waits for navigation to begin (up to ~3s) but does NOT wait for the page to finish — follow with wait_for_load and/or wait_for_selector. No value returned.",
    inputSchema: {
      ...TabRef,
      url: z.string().describe("URL to navigate to"),
    },
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.url),
    ],
  },
  {
    name: "get_tab_url",
    description: "Return the tab's current URL. Native.",
    inputSchema: TabRef,
    runArgs: (input) => [String(input.windowId), String(input.tabId)],
  },
  {
    name: "reload",
    description: "Reload the tab. Native. No value returned.",
    inputSchema: TabRef,
    runArgs: (input) => [String(input.windowId), String(input.tabId)],
  },
  {
    name: "go_back",
    description:
      "Navigate back in the tab's history. Native. No value returned. No-op if there is no history to go back to.",
    inputSchema: TabRef,
    runArgs: (input) => [String(input.windowId), String(input.tabId)],
  },
  {
    name: "go_forward",
    description:
      "Navigate forward in the tab's history. Native. No value returned. No-op if there is no history to go forward to.",
    inputSchema: TabRef,
    runArgs: (input) => [String(input.windowId), String(input.tabId)],
  },
  {
    name: "stop",
    description: "Stop the tab's current loading. Native. No value returned.",
    inputSchema: TabRef,
    runArgs: (input) => [String(input.windowId), String(input.tabId)],
  },

  // Control plane: waiting
  {
    name: "wait_for_load",
    description:
      'Poll document.readyState every 0.5s up to 60s. Returns "complete" or "timeout".',
    inputSchema: TabRef,
    runArgs: (input) => [String(input.windowId), String(input.tabId)],
  },
  {
    name: "wait_for_selector",
    description:
      'Poll until a CSS selector matches, up to maxSeconds. Returns "found" or "timeout". Takes a CSS selector ONLY (not text=/xpath=/label= forms).',
    inputSchema: {
      ...TabRef,
      selector: z.string().describe("CSS selector to wait for"),
      maxSeconds: z
        .number()
        .int()
        .positive()
        .describe("Maximum seconds to poll"),
    },
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.selector),
      String(input.maxSeconds),
    ],
  },
  {
    name: "wait_for_function",
    description:
      'Poll a JavaScript expression until it is truthy, up to maxSeconds. Returns "true" or "timeout". The expression is evaluated as Boolean(...); a thrown error counts as false (safe for probing not-yet-defined properties). Pass an expression, not a statement.',
    inputSchema: {
      ...TabRef,
      expression: z
        .string()
        .describe("JavaScript expression evaluated as Boolean(...)"),
      maxSeconds: z
        .number()
        .int()
        .positive()
        .describe("Maximum seconds to poll"),
    },
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.expression),
      String(input.maxSeconds),
    ],
  },

  // Control plane: content / scripting
  {
    name: "get_html",
    description:
      "Return the tab's live DOM as document.documentElement.outerHTML. May return up to 10 MiB. For lazy/Shadow content, wait for a selector or run JS to realize it first.",
    inputSchema: TabRef,
    runArgs: (input) => [String(input.windowId), String(input.tabId)],
  },
  {
    name: "execute_js",
    description:
      "Run a JavaScript expression inline and return its value as text. Use for SHORT expressions only (quotes/$/backslashes must survive shell + AppleScript escaping). For anything with quotes, multiple lines, or special characters, use execute_js_file. The returned value is the LAST evaluated expression (completion value, like the DevTools console). A top-level `return` does not work.",
    inputSchema: {
      ...TabRef,
      expression: z.string().describe("JavaScript expression"),
    },
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.expression),
    ],
  },
  {
    name: "execute_js_file",
    description:
      "Read JavaScript from a UTF-8 file and run it. Sidesteps all shell/AppleScript escaping — prefer for anything with quotes, multiple lines, or special characters. Returns the completion value of the script.",
    inputSchema: {
      ...TabRef,
      path: z.string().describe("Absolute path to the JS file"),
    },
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.path),
    ],
  },

  // Element plane: reads
  {
    name: "get_text",
    description:
      'Return the element\'s trimmed visible text (innerText, falling back to textContent), or "not_found".',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.selector),
    ],
  },
  {
    name: "get_attribute",
    description:
      'Return the named attribute\'s value, an empty string if the attribute is absent, or "not_found" if no element matched.',
    inputSchema: {
      ...TabRefWithSelector,
      name: z.string().describe("Attribute name (e.g. href, src, data-id)"),
    },
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.selector),
      String(input.name),
    ],
  },
  {
    name: "get_value",
    description:
      'Return the value of an input/textarea/select (empty string if it has none), or "not_found".',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.selector),
    ],
  },
  {
    name: "exists",
    description:
      'Return "true" or "false" for whether the element exists. Never returns "not_found" — absence is reported as "false".',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.selector),
    ],
  },
  {
    name: "query_all",
    description:
      'Return a JSON array string of the trimmed text of every matching element, e.g. ["First","Second"]. An empty result is "[]". For xpath= returns all matched nodes; for CSS returns all querySelectorAll matches; text=/label= yield at most one element.',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.selector),
    ],
  },

  // Element plane: interaction
  {
    name: "click",
    description:
      'Scroll the element into view (centered) and call .click(). Returns "true" or "not_found".',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.selector),
    ],
  },
  {
    name: "fill",
    description:
      'Focus the input/textarea and set its value through the native value setter, then fire "input" and "change". Using the native setter is what lets frameworks like React/Vue detect the change. Returns "true" or "not_found".',
    inputSchema: {
      ...TabRefWithSelector,
      value: z.string().describe("Value to fill"),
    },
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.selector),
      String(input.value),
    ],
  },
  {
    name: "clear",
    description:
      'Like fill with an empty string: focus the element, set value to "" via the native setter, fire "input"/"change". Returns "true" or "not_found".',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.selector),
    ],
  },
  {
    name: "select_option",
    description:
      'Select an <option> by its value, falling back to its visible text. Sets the value via the native setter and fires "input"/"change". Returns "true", "no_option" if nothing matched, or "not_found".',
    inputSchema: {
      ...TabRefWithSelector,
      value: z.string().describe("Option value or visible text to select"),
    },
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.selector),
      String(input.value),
    ],
  },
  {
    name: "set_checked",
    description:
      'Set a checkbox/radio\'s checked state via the native setter and fire "input"/"change". Returns "true" or "not_found".',
    inputSchema: {
      ...TabRefWithSelector,
      checked: z.boolean().describe("Desired checked state"),
    },
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.selector),
      String(input.checked),
    ],
  },
  {
    name: "press_key",
    description:
      'Focus the element and dispatch synthetic keydown/keypress/keyup for the key. Named keys: Enter, Tab, Escape, Backspace, Delete, ArrowUp/Down/Left/Right, space. Otherwise a single character is used as-is. Events are isTrusted=false; strict handlers may ignore them, and this does NOT type text into the field (use fill for that). Returns "true" or "not_found".',
    inputSchema: {
      ...TabRefWithSelector,
      key: z
        .string()
        .describe("Key name (Enter/Tab/Escape/...) or single character"),
    },
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.selector),
      String(input.key),
    ],
  },
  {
    name: "submit",
    description:
      'Submit the form the element belongs to (or the element itself if it is a <form>). Uses requestSubmit() so submit handlers and validation run (falls back to submit()). Returns "true", "no_form" if no form was found, or "not_found".',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.selector),
    ],
  },
  {
    name: "scroll_into_view",
    description:
      'Scroll the element into view, centered. Returns "true" or "not_found".',
    inputSchema: TabRefWithSelector,
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.selector),
    ],
  },
];
