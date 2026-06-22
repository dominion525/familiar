import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AppleScriptError } from "./applescript.js";

// Mock only the AppleScript runner — the rest of the stack (McpServer, Zod
// validation, JSON-RPC routing via InMemoryTransport, Client request/response
// handling) runs for real. That is the point of a contract test: verify the
// contract end-to-end without touching osascript.
const runActionMock = vi.hoisted(() => vi.fn());

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

let client: Client;

beforeAll(async () => {
  const { createServer } = await import("./server.js");
  const server = createServer();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  client = new Client(
    { name: "test-client", version: "0.0.0" },
    { capabilities: {} },
  );
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
});

afterEach(() => {
  runActionMock.mockReset();
});

type TextContent = { type: "text"; text: string };

describe("MCP contract (in-memory transport)", () => {
  it("lists all 32 tools via tools/list, every name familiar_-prefixed", async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(32);
    const names = result.tools.map((t) => t.name);
    for (const expected of [
      "familiar_list_tabs",
      "familiar_navigate",
      "familiar_click",
      "familiar_execute_js",
    ]) {
      expect(names).toContain(expected);
    }
    for (const name of names) {
      expect(name).toMatch(/^familiar_/);
    }
  });

  it("dispatches tools/call to runAction and returns text content", async () => {
    runActionMock.mockResolvedValue("wid1,tid1,Title,https://example.com");
    const result = await client.callTool({
      name: "familiar_list_tabs",
      arguments: {},
    });

    // The MCP name carries the prefix, but runAction sees the bare action name.
    expect(runActionMock).toHaveBeenCalledWith("list_tabs", [], {
      timeoutMs: undefined,
    });
    expect(result.content).toEqual([
      { type: "text", text: "wid1,tid1,Title,https://example.com" },
    ]);
  });

  it("returns isError content for an unknown tool name", async () => {
    const result = await client.callTool({
      name: "familiar_no_such_tool",
      arguments: {},
    });
    expect(result.isError).toBe(true);
  });

  it("returns isError content when input fails Zod validation (missing field)", async () => {
    const result = await client.callTool({
      name: "familiar_navigate",
      arguments: {},
    });
    // Only assert the contract (isError + text content present). The exact
    // wording comes from Zod / the SDK and changes across minor versions.
    expect(result.isError).toBe(true);
    const content = result.content as TextContent[];
    expect(content[0].type).toBe("text");
    expect(content[0].text.length).toBeGreaterThan(0);
  });

  it("returns isError content when input exceeds the maxSeconds cap", async () => {
    const result = await client.callTool({
      name: "familiar_wait_for_selector",
      arguments: {
        windowId: "1",
        tabId: "2",
        selector: ".x",
        maxSeconds: 999,
      },
    });
    expect(result.isError).toBe(true);
    const content = result.content as TextContent[];
    expect(content[0].type).toBe("text");
    expect(content[0].text.length).toBeGreaterThan(0);
  });

  it("coerces numeric windowId/tabId to string at the schema layer", async () => {
    runActionMock.mockResolvedValue("");
    await client.callTool({
      name: "familiar_navigate",
      arguments: {
        windowId: 1,
        tabId: 2,
        url: "https://example.com",
      },
    });

    expect(runActionMock).toHaveBeenCalledWith(
      "navigate",
      ["1", "2", "https://example.com"],
      { timeoutMs: undefined },
    );
  });

  it("returns structuredContent for familiar_get_text (found case)", async () => {
    runActionMock.mockResolvedValue("Hello World");
    const result = await client.callTool({
      name: "familiar_get_text",
      arguments: { windowId: "1", tabId: "2", selector: "h1" },
    });

    expect(result.structuredContent).toEqual({
      found: true,
      value: "Hello World",
    });
  });

  it("returns structuredContent { found: false } for familiar_get_text on not_found", async () => {
    runActionMock.mockResolvedValue("not_found");
    const result = await client.callTool({
      name: "familiar_get_text",
      arguments: { windowId: "1", tabId: "2", selector: ".missing" },
    });

    expect(result.structuredContent).toEqual({ found: false });
  });

  it("returns isError + structuredContent {kind, action} when runAction throws AppleScriptError", async () => {
    runActionMock.mockRejectedValue(
      new AppleScriptError(
        "osascript click failed (non_zero_exit): boom",
        "click",
        ["1", "2", "#x"],
        "non_zero_exit",
      ),
    );

    const result = await client.callTool({
      name: "familiar_click",
      arguments: { windowId: "1", tabId: "2", selector: "#x" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as TextContent[];
    expect(content[0].type).toBe("text");
    expect(content[0].text).toContain("boom");
    expect(result.structuredContent).toEqual({
      kind: "non_zero_exit",
      action: "click",
    });
  });

  it("returns isError + structuredContent {kind: 'unknown'} for non-AppleScriptError throws", async () => {
    runActionMock.mockRejectedValue(new Error("network failure"));

    const result = await client.callTool({
      name: "familiar_list_tabs",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({ kind: "unknown" });
  });
});
