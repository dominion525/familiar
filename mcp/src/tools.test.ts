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
  it("list_tabs returns []", () => {
    const t = TOOLS.find((t) => t.name === "list_tabs");
    expect(t?.runArgs({})).toEqual([]);
  });

  it("navigate returns [windowId, tabId, url]", () => {
    const t = TOOLS.find((t) => t.name === "navigate");
    expect(
      t?.runArgs({
        windowId: "1",
        tabId: "2",
        url: "https://example.com",
      }),
    ).toEqual(["1", "2", "https://example.com"]);
  });

  it("set_checked stringifies boolean", () => {
    const t = TOOLS.find((t) => t.name === "set_checked");
    expect(
      t?.runArgs({
        windowId: "1",
        tabId: "2",
        selector: "#x",
        checked: true,
      }),
    ).toEqual(["1", "2", "#x", "true"]);
  });

  it("wait_for_selector stringifies maxSeconds", () => {
    const t = TOOLS.find((t) => t.name === "wait_for_selector");
    expect(
      t?.runArgs({
        windowId: "1",
        tabId: "2",
        selector: ".banner",
        maxSeconds: 30,
      }),
    ).toEqual(["1", "2", ".banner", "30"]);
  });
});
