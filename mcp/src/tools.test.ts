import { describe, expect, it } from "vitest";
import { TOOLS } from "./tools.js";

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
});

describe("TOOLS runArgs", () => {
  type Case = {
    name: string;
    input: Record<string, unknown>;
    expected: string[];
  };

  const cases: Case[] = [
    // No-arg
    { name: "list_tabs", input: {}, expected: [] },
    { name: "new_tab", input: {}, expected: [] },
    { name: "new_incognito_tab", input: {}, expected: [] },

    // WindowRef only
    { name: "active_tab", input: { windowId: "1" }, expected: ["1"] },
    { name: "window_mode", input: { windowId: "1" }, expected: ["1"] },

    // TabRef only
    {
      name: "close_tab",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "is_loading",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "get_tab_url",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "reload",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "go_back",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "go_forward",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "stop",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "wait_for_load",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },
    {
      name: "get_html",
      input: { windowId: "1", tabId: "2" },
      expected: ["1", "2"],
    },

    // TabRef + URL / expression / path
    {
      name: "navigate",
      input: { windowId: "1", tabId: "2", url: "https://example.com" },
      expected: ["1", "2", "https://example.com"],
    },
    {
      name: "execute_js",
      input: { windowId: "1", tabId: "2", expression: "document.title" },
      expected: ["1", "2", "document.title"],
    },
    {
      name: "execute_js_file",
      input: { windowId: "1", tabId: "2", path: "/tmp/snippet.js" },
      expected: ["1", "2", "/tmp/snippet.js"],
    },

    // TabRef + selector/expression + maxSeconds (number → string)
    {
      name: "wait_for_selector",
      input: {
        windowId: "1",
        tabId: "2",
        selector: ".banner",
        maxSeconds: 30,
      },
      expected: ["1", "2", ".banner", "30"],
    },
    {
      name: "wait_for_function",
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
      name: "get_text",
      input: { windowId: "1", tabId: "2", selector: "h1" },
      expected: ["1", "2", "h1"],
    },
    {
      name: "get_value",
      input: { windowId: "1", tabId: "2", selector: "#email" },
      expected: ["1", "2", "#email"],
    },
    {
      name: "exists",
      input: { windowId: "1", tabId: "2", selector: ".banner" },
      expected: ["1", "2", ".banner"],
    },
    {
      name: "query_all",
      input: { windowId: "1", tabId: "2", selector: ".item" },
      expected: ["1", "2", ".item"],
    },
    {
      name: "click",
      input: { windowId: "1", tabId: "2", selector: "button.submit" },
      expected: ["1", "2", "button.submit"],
    },
    {
      name: "clear",
      input: { windowId: "1", tabId: "2", selector: "#email" },
      expected: ["1", "2", "#email"],
    },
    {
      name: "submit",
      input: { windowId: "1", tabId: "2", selector: "form#login" },
      expected: ["1", "2", "form#login"],
    },
    {
      name: "scroll_into_view",
      input: { windowId: "1", tabId: "2", selector: ".footer" },
      expected: ["1", "2", ".footer"],
    },

    // TabRefWithSelector + extras
    {
      name: "get_attribute",
      input: { windowId: "1", tabId: "2", selector: "a.link", name: "href" },
      expected: ["1", "2", "a.link", "href"],
    },
    {
      name: "fill",
      input: {
        windowId: "1",
        tabId: "2",
        selector: "#email",
        value: "user@example.com",
      },
      expected: ["1", "2", "#email", "user@example.com"],
    },
    {
      name: "select_option",
      input: {
        windowId: "1",
        tabId: "2",
        selector: "select#country",
        value: "JP",
      },
      expected: ["1", "2", "select#country", "JP"],
    },
    {
      name: "set_checked",
      input: {
        windowId: "1",
        tabId: "2",
        selector: "#agree",
        checked: true,
      },
      expected: ["1", "2", "#agree", "true"],
    },
    {
      name: "press_key",
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
