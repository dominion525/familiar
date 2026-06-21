import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppleScriptError } from "./applescript.js";

// Capture spies must be hoisted so the vi.mock factory below can reference them.
const { registerToolSpy, connectSpy, runActionMock } = vi.hoisted(() => ({
  registerToolSpy: vi.fn(),
  connectSpy: vi.fn().mockResolvedValue(undefined),
  runActionMock: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    registerTool = registerToolSpy;
    connect = connectSpy;
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn(),
}));

vi.mock("./applescript.js", async () => {
  const actual =
    await vi.importActual<typeof import("./applescript.js")>(
      "./applescript.js",
    );
  return {
    ...actual,
    runAction: runActionMock,
  };
});

// Importing index.ts triggers the McpServer construction, registerTool calls,
// and the awaited connect(). All of those go through the spies above.
beforeAll(async () => {
  await import("./index.js");
});

type ToolCallback = (input: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

function getToolCallback(name: string): ToolCallback {
  const call = registerToolSpy.mock.calls.find((c) => c[0] === name);
  if (!call) throw new Error(`tool "${name}" not registered`);
  return call[2] as ToolCallback;
}

describe("server bootstrap", () => {
  it("connects through StdioServerTransport exactly once", () => {
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it("registers all 32 tools via registerTool", () => {
    expect(registerToolSpy).toHaveBeenCalledTimes(32);
  });

  it("registers every tool with a description and Zod inputSchema", () => {
    for (const call of registerToolSpy.mock.calls) {
      const [, config] = call;
      expect(typeof config.description).toBe("string");
      expect(config.description.length).toBeGreaterThan(0);
      expect(config.inputSchema).toBeDefined();
    }
  });
});

describe("tool dispatch", () => {
  beforeEach(() => {
    runActionMock.mockReset();
  });

  it("dispatches list_tabs with no args and returns text content", async () => {
    runActionMock.mockResolvedValue("wid1,tid1,Title,https://example.com");
    const result = await getToolCallback("list_tabs")({});

    expect(runActionMock).toHaveBeenCalledWith("list_tabs", [], {
      timeoutMs: undefined,
    });
    expect(result).toEqual({
      content: [{ type: "text", text: "wid1,tid1,Title,https://example.com" }],
    });
  });

  it("dispatches navigate with positional args from named input", async () => {
    runActionMock.mockResolvedValue("");
    await getToolCallback("navigate")({
      windowId: "1",
      tabId: "2",
      url: "https://example.com",
    });

    expect(runActionMock).toHaveBeenCalledWith(
      "navigate",
      ["1", "2", "https://example.com"],
      { timeoutMs: undefined },
    );
  });

  it("passes fixed timeoutMs for wait_for_load (60s + buffer)", async () => {
    runActionMock.mockResolvedValue("complete");
    await getToolCallback("wait_for_load")({ windowId: "1", tabId: "2" });

    expect(runActionMock).toHaveBeenCalledWith("wait_for_load", ["1", "2"], {
      timeoutMs: 65_000,
    });
  });

  it("derives timeoutMs from maxSeconds for wait_for_selector", async () => {
    runActionMock.mockResolvedValue("found");
    await getToolCallback("wait_for_selector")({
      windowId: "1",
      tabId: "2",
      selector: ".banner",
      maxSeconds: 30,
    });

    expect(runActionMock).toHaveBeenCalledWith(
      "wait_for_selector",
      ["1", "2", ".banner", "30"],
      { timeoutMs: 35_000 },
    );
  });

  it("returns isError content with AppleScriptError's message", async () => {
    runActionMock.mockRejectedValue(
      new AppleScriptError(
        "osascript click failed (non_zero_exit): boom",
        "click",
        ["1", "2", "#x"],
        "non_zero_exit",
      ),
    );
    const result = await getToolCallback("click")({
      windowId: "1",
      tabId: "2",
      selector: "#x",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("boom");
  });

  it("returns isError content for non-AppleScriptError throws", async () => {
    runActionMock.mockRejectedValue(new Error("network failure"));
    const result = await getToolCallback("list_tabs")({});

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
  });

  it("stringifies non-string throwables in the error content", async () => {
    runActionMock.mockRejectedValue("plain string error");
    const result = await getToolCallback("list_tabs")({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("plain string error");
  });
});
