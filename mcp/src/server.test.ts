import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppleScriptError } from "./applescript.js";
import { TOOLS } from "./tools.js";

const { registerToolSpy, runActionMock } = vi.hoisted(() => ({
  registerToolSpy: vi.fn(),
  runActionMock: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    registerTool = registerToolSpy;
  },
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

// createServer registers every TOOL via registerToolSpy, so the spy
// accumulates calls across tests if not reset. beforeEach resets the spy
// and re-registers, making each test self-contained (a future second
// createServer in another test cannot leak count assertions either way).
beforeEach(async () => {
  registerToolSpy.mockReset();
  const { createServer } = await import("./server.js");
  createServer();
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

describe("createServer (registerTool wiring)", () => {
  it("registers every TOOL via registerTool", () => {
    expect(registerToolSpy).toHaveBeenCalledTimes(TOOLS.length);
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

describe("tool dispatch (direct callback)", () => {
  beforeEach(() => {
    runActionMock.mockReset();
  });

  it("dispatches familiar_list_tabs with no args and returns text content", async () => {
    runActionMock.mockResolvedValue("wid1,tid1,Title,https://example.com");
    const result = await getToolCallback("familiar_list_tabs")({});

    // runAction receives the bare AppleScript action name (prefix stripped).
    expect(runActionMock).toHaveBeenCalledWith("list_tabs", [], {
      timeoutMs: undefined,
    });
    expect(result).toEqual({
      content: [{ type: "text", text: "wid1,tid1,Title,https://example.com" }],
    });
  });

  it("dispatches familiar_navigate with positional args from named input", async () => {
    runActionMock.mockResolvedValue("");
    await getToolCallback("familiar_navigate")({
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

  it("derives timeoutMs from maxSeconds for familiar_wait_for_load", async () => {
    runActionMock.mockResolvedValue("complete");
    await getToolCallback("familiar_wait_for_load")({
      windowId: "1",
      tabId: "2",
      maxSeconds: 60,
    });

    expect(runActionMock).toHaveBeenCalledWith(
      "wait_for_load",
      ["1", "2", "60"],
      { timeoutMs: 65_000 },
    );
  });

  it("derives timeoutMs from maxSeconds for familiar_wait_for_selector", async () => {
    runActionMock.mockResolvedValue("found");
    await getToolCallback("familiar_wait_for_selector")({
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

  it("returns isError + AppleScriptError message + structuredContent {kind, action}", async () => {
    runActionMock.mockRejectedValue(
      new AppleScriptError(
        "osascript click failed (non_zero_exit): boom",
        "click",
        ["1", "2", "#x"],
        "non_zero_exit",
      ),
    );
    const result = (await getToolCallback("familiar_click")({
      windowId: "1",
      tabId: "2",
      selector: "#x",
    })) as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
      structuredContent?: { kind: string; action?: string };
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("boom");
    expect(result.structuredContent).toEqual({
      kind: "non_zero_exit",
      action: "click",
    });
  });

  it("returns isError + structuredContent {kind: 'unknown'} for non-AppleScriptError throws", async () => {
    runActionMock.mockRejectedValue(new Error("network failure"));
    const result = (await getToolCallback("familiar_list_tabs")({})) as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
      structuredContent?: { kind: string };
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect(result.structuredContent).toEqual({ kind: "unknown" });
  });

  it("stringifies non-string throwables in the error content", async () => {
    runActionMock.mockRejectedValue("plain string error");
    const result = await getToolCallback("familiar_list_tabs")({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("plain string error");
  });

  it("returns structuredContent for familiar_get_text when the element is found", async () => {
    runActionMock.mockResolvedValue('{"found":true,"value":"Hello World"}');
    const result = (await getToolCallback("familiar_get_text")({
      windowId: "1",
      tabId: "2",
      selector: "h1",
    })) as {
      content: Array<{ type: string; text: string }>;
      structuredContent?: { found: boolean; value?: string };
    };

    expect(result.structuredContent).toEqual({
      found: true,
      value: "Hello World",
    });
    expect(JSON.parse(result.content[0].text)).toEqual({
      found: true,
      value: "Hello World",
    });
  });

  it("returns structuredContent { found: false } for familiar_get_text when not_found", async () => {
    runActionMock.mockResolvedValue('{"found":false}');
    const result = (await getToolCallback("familiar_get_text")({
      windowId: "1",
      tabId: "2",
      selector: ".missing",
    })) as {
      structuredContent?: { found: boolean; value?: string };
    };

    expect(result.structuredContent).toEqual({ found: false });
  });

  it("returns structuredContent { exists: true } for familiar_exists when 'true'", async () => {
    runActionMock.mockResolvedValue("true");
    const result = (await getToolCallback("familiar_exists")({
      windowId: "1",
      tabId: "2",
      selector: ".banner",
    })) as {
      content: Array<{ type: string; text: string }>;
      structuredContent?: { exists: boolean };
    };

    expect(result.structuredContent).toEqual({ exists: true });
    expect(JSON.parse(result.content[0].text)).toEqual({ exists: true });
  });

  it("returns structuredContent { exists: false } for familiar_exists when 'false'", async () => {
    runActionMock.mockResolvedValue("false");
    const result = (await getToolCallback("familiar_exists")({
      windowId: "1",
      tabId: "2",
      selector: ".missing",
    })) as {
      structuredContent?: { exists: boolean };
    };

    expect(result.structuredContent).toEqual({ exists: false });
  });
});
