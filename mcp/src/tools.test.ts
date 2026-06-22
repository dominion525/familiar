import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TOOLS } from "./tools.js";

// An absolute path that is guaranteed to exist for the duration of the test
// run — this very test file. Used to exercise execute_js_file.path schemas
// that now require the path to point to an existing readable file.
const EXISTING_ABSOLUTE_FILE = fileURLToPath(import.meta.url);

describe("TOOLS", () => {
  it("registers all 32 actions", () => {
    expect(TOOLS).toHaveLength(32);
  });

  it("has unique tool names", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has a non-empty description for every tool", () => {
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it("namespaces every tool with the familiar_ prefix", () => {
    for (const tool of TOOLS) {
      expect(tool.name).toMatch(/^familiar_/);
    }
  });
});

describe("TOOLS runArgs", () => {
  type Case = {
    name: string;
    input: Record<string, unknown>;
    expected: string[];
  };

  const cases: Case[] = [
    // No-arg
    { name: "familiar_list_tabs", input: {}, expected: [] },
    { name: "familiar_new_tab", input: {}, expected: [] },
    { name: "familiar_new_incognito_tab", input: {}, expected: [] },

    // WindowRef only
    { name: "familiar_active_tab", input: { windowId: "1" }, expected: ["1"] },
    { name: "familiar_window_mode", input: { windowId: "1" }, expected: ["1"] },

    // TabRef only
    {
      name: "familiar_close_tab",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "familiar_is_loading",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "familiar_get_tab_url",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "familiar_reload",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "familiar_go_back",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "familiar_go_forward",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "familiar_stop",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "familiar_wait_for_load",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "familiar_get_html",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },

    // TabRef + URL / expression / path
    {
      name: "familiar_navigate",
      input: { windowId: "1", tabId: "2", url: "https://example.com" },
      expected: ["1", "2", "https://example.com"],
    },
    {
      name: "familiar_execute_js",
      input: { windowId: "1", tabId: "2", expression: "document.title" },
      expected: ["1", "2", "document.title"],
    },
    {
      name: "familiar_execute_js_file",
      input: { windowId: "1", tabId: "2", path: "/tmp/snippet.js" },
      expected: ["1", "2", "/tmp/snippet.js"],
    },

    // TabRef + selector/expression + maxSeconds (number → string)
    {
      name: "familiar_wait_for_selector",
      input: {
        windowId: "1",
        tabId: "2",
        selector: ".banner",
        maxSeconds: 30,
      },
      expected: ["1", "2", ".banner", "30"],
    },
    {
      name: "familiar_wait_for_function",
      input: {
        windowId: "1",
        tabId: "2",
        expression: "window.__ready === true",
        maxSeconds: 30,
      },
      expected: ["1", "2", "window.__ready === true", "30"],
    },

    // TabRefWithSelector only
    {
      name: "familiar_get_text",
      input: { windowId: "1", tabId: "2", selector: "h1" },
      expected: ["1", "2", "h1"],
    },
    {
      name: "familiar_get_value",
      input: { windowId: "1", tabId: "2", selector: "#email" },
      expected: ["1", "2", "#email"],
    },
    {
      name: "familiar_exists",
      input: { windowId: "1", tabId: "2", selector: ".banner" },
      expected: ["1", "2", ".banner"],
    },
    {
      name: "familiar_query_all",
      input: { windowId: "1", tabId: "2", selector: ".item" },
      expected: ["1", "2", ".item"],
    },
    {
      name: "familiar_click",
      input: { windowId: "1", tabId: "2", selector: "button.submit" },
      expected: ["1", "2", "button.submit"],
    },
    {
      name: "familiar_clear",
      input: { windowId: "1", tabId: "2", selector: "#email" },
      expected: ["1", "2", "#email"],
    },
    {
      name: "familiar_submit",
      input: { windowId: "1", tabId: "2", selector: "form#login" },
      expected: ["1", "2", "form#login"],
    },
    {
      name: "familiar_scroll_into_view",
      input: { windowId: "1", tabId: "2", selector: ".footer" },
      expected: ["1", "2", ".footer"],
    },

    // TabRefWithSelector + extras
    {
      name: "familiar_get_attribute",
      input: { windowId: "1", tabId: "2", selector: "a.link", name: "href" },
      expected: ["1", "2", "a.link", "href"],
    },
    {
      name: "familiar_fill",
      input: {
        windowId: "1",
        tabId: "2",
        selector: "#email",
        value: "user@example.com",
      },
      expected: ["1", "2", "#email", "user@example.com"],
    },
    {
      name: "familiar_select_option",
      input: {
        windowId: "1",
        tabId: "2",
        selector: "select#country",
        value: "JP",
      },
      expected: ["1", "2", "select#country", "JP"],
    },
    {
      name: "familiar_set_checked",
      input: {
        windowId: "1",
        tabId: "2",
        selector: "#agree",
        checked: true,
      },
      expected: ["1", "2", "#agree", "true"],
    },
    {
      name: "familiar_press_key",
      input: {
        windowId: "1",
        tabId: "2",
        selector: "#search",
        key: "Enter",
      },
      expected: ["1", "2", "#search", "Enter"],
    },
  ];

  it.each(cases)("$name builds expected args", ({ name, input, expected }) => {
    const t = TOOLS.find((tool) => tool.name === name);
    expect(t, `tool "${name}" not registered`).toBeDefined();
    expect(t?.runArgs(input)).toEqual(expected);
  });

  it("covers every registered tool", () => {
    const tested = new Set(cases.map((c) => c.name));
    const missing = TOOLS.map((t) => t.name).filter((n) => !tested.has(n));
    expect(missing, `untested tools: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("TOOLS inputSchema validation", () => {
  function schemaFor(name: string) {
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) throw new Error(`tool "${name}" not registered`);
    return z.object(tool.inputSchema);
  }

  it("coerces numeric (non-negative integer) windowId/tabId to string (LLM-friendly)", () => {
    const result = schemaFor("familiar_navigate").parse({
      windowId: 1,
      tabId: 2,
      url: "https://example.com",
    });
    expect(result.windowId).toBe("1");
    expect(result.tabId).toBe("2");
  });

  it.each([
    null,
    undefined,
    [1, 2],
    { id: 1 },
    -1,
    1.5,
  ])("windowId rejects non-(string|nonneg-int) value: %s", (value) => {
    expect(() =>
      schemaFor("familiar_navigate").parse({
        windowId: value,
        tabId: "2",
        url: "https://example.com",
      }),
    ).toThrow();
  });

  it("familiar_execute_js_file.path rejects relative paths", () => {
    expect(() =>
      schemaFor("familiar_execute_js_file").parse({
        windowId: "1",
        tabId: "2",
        path: "relative/path.js",
      }),
    ).toThrow();
  });

  it("familiar_execute_js_file.path rejects paths containing '..'", () => {
    expect(() =>
      schemaFor("familiar_execute_js_file").parse({
        windowId: "1",
        tabId: "2",
        path: "/tmp/../etc/passwd",
      }),
    ).toThrow();
  });

  it("familiar_execute_js_file.path rejects non-existent absolute paths", () => {
    expect(() =>
      schemaFor("familiar_execute_js_file").parse({
        windowId: "1",
        tabId: "2",
        path: "/nonexistent/path/that/should/not/exist.js",
      }),
    ).toThrow();
  });

  it("familiar_execute_js_file.path accepts an existing absolute file path", () => {
    expect(() =>
      schemaFor("familiar_execute_js_file").parse({
        windowId: "1",
        tabId: "2",
        path: EXISTING_ABSOLUTE_FILE,
      }),
    ).not.toThrow();
  });

  it.each([
    "text=Submit",
    "xpath=//button",
    "label=Email",
    "TEXT=Submit",
    "Xpath=//button",
    "Label=Email",
    "TeXt=Submit",
  ])("familiar_wait_for_selector.selector rejects non-CSS prefix %s (case-insensitive)", (selector) => {
    expect(() =>
      schemaFor("familiar_wait_for_selector").parse({
        windowId: "1",
        tabId: "2",
        selector,
        maxSeconds: 10,
      }),
    ).toThrow();
  });

  it("familiar_wait_for_selector.selector accepts a plain CSS selector", () => {
    expect(() =>
      schemaFor("familiar_wait_for_selector").parse({
        windowId: "1",
        tabId: "2",
        selector: ".banner",
        maxSeconds: 10,
      }),
    ).not.toThrow();
  });

  it("familiar_wait_for_selector.maxSeconds caps at 300", () => {
    expect(() =>
      schemaFor("familiar_wait_for_selector").parse({
        windowId: "1",
        tabId: "2",
        selector: ".x",
        maxSeconds: 301,
      }),
    ).toThrow();
    expect(() =>
      schemaFor("familiar_wait_for_selector").parse({
        windowId: "1",
        tabId: "2",
        selector: ".x",
        maxSeconds: 300,
      }),
    ).not.toThrow();
  });

  it("familiar_wait_for_function.maxSeconds caps at 300", () => {
    expect(() =>
      schemaFor("familiar_wait_for_function").parse({
        windowId: "1",
        tabId: "2",
        expression: "true",
        maxSeconds: 301,
      }),
    ).toThrow();
  });
});

describe("TOOLS read-side structuredContent (parseStdout)", () => {
  const READ_TOOLS = [
    "familiar_get_text",
    "familiar_get_attribute",
    "familiar_get_value",
  ];

  for (const name of READ_TOOLS) {
    describe(name, () => {
      const tool = TOOLS.find((t) => t.name === name);

      it("declares an outputSchema and parseStdout", () => {
        expect(tool?.outputSchema).toBeDefined();
        expect(tool?.parseStdout).toBeDefined();
      });

      it("maps the 'not_found' sentinel to { found: false }", () => {
        expect(tool?.parseStdout?.("not_found")).toEqual({ found: false });
      });

      it("wraps any other stdout in { found: true, value }", () => {
        expect(tool?.parseStdout?.("hello world")).toEqual({
          found: true,
          value: "hello world",
        });
      });

      it("preserves an empty-string value (distinct from not_found)", () => {
        expect(tool?.parseStdout?.("")).toEqual({ found: true, value: "" });
      });
    });
  }
});

describe("TOOLS timeoutMs", () => {
  it("familiar_wait_for_load uses fixed 60s + buffer (65s total)", () => {
    const t = TOOLS.find((tool) => tool.name === "familiar_wait_for_load");
    expect(t?.timeoutMs?.({})).toBe(65_000);
  });

  it("familiar_wait_for_selector derives timeout from maxSeconds + buffer", () => {
    const t = TOOLS.find((tool) => tool.name === "familiar_wait_for_selector");
    expect(t?.timeoutMs?.({ maxSeconds: 30 })).toBe(35_000);
    expect(t?.timeoutMs?.({ maxSeconds: 120 })).toBe(125_000);
  });

  it("familiar_wait_for_function derives timeout from maxSeconds + buffer", () => {
    const t = TOOLS.find((tool) => tool.name === "familiar_wait_for_function");
    expect(t?.timeoutMs?.({ maxSeconds: 60 })).toBe(65_000);
  });

  it("tools without an inner wait leave timeoutMs undefined", () => {
    const noTimeoutTools = [
      "familiar_list_tabs",
      "familiar_navigate",
      "familiar_get_html",
      "familiar_click",
    ];
    for (const name of noTimeoutTools) {
      const t = TOOLS.find((tool) => tool.name === name);
      expect(t?.timeoutMs, `${name}.timeoutMs`).toBeUndefined();
    }
  });
});
