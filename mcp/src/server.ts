import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AppleScriptError, runAction } from "./applescript.js";
import { TOOLS } from "./tools.js";

/**
 * Prefix carried on every MCP-exposed tool name. Stripped before forwarding
 * to the AppleScript side, whose action names are bare (`list_tabs`, etc.).
 * Keeping the prefix tool-side namespaces familiar's tools when several MCP
 * servers are mounted in the same Claude Code session.
 */
const TOOL_NAME_PREFIX = "familiar_";

/**
 * Build a fully-configured McpServer with every familiar tool registered.
 *
 * The server is returned without a transport; callers attach the transport
 * appropriate to their runtime (StdioServerTransport for the CLI runner,
 * InMemoryTransport for in-process contract tests, etc.).
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "familiar-mcp",
    version: "0.1.0",
  });

  for (const tool of TOOLS) {
    const actionName = tool.name.startsWith(TOOL_NAME_PREFIX)
      ? tool.name.slice(TOOL_NAME_PREFIX.length)
      : tool.name;
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
      },
      async (input) => {
        try {
          const validated = input as Record<string, unknown>;
          const args = tool.runArgs(validated);
          const timeoutMs = tool.timeoutMs?.(validated);
          const stdout = await runAction(actionName, args, { timeoutMs });
          if (tool.parseStdout) {
            const structured = tool.parseStdout(stdout);
            return {
              content: [{ type: "text", text: JSON.stringify(structured) }],
              structuredContent: structured,
            };
          }
          return { content: [{ type: "text", text: stdout }] };
        } catch (error) {
          // Surface AppleScriptError's classification as structuredContent so
          // the LLM can branch on `kind` (timeout → retry, max_buffer → narrow
          // the query, non_zero_exit → give up) without regex-scraping the
          // message text. The MCP SDK skips outputSchema validation when
          // isError is true (mcp.js:validateToolOutput), so this is safe even
          // for tools that declare a typed outputSchema.
          if (error instanceof AppleScriptError) {
            return {
              content: [{ type: "text", text: error.message }],
              structuredContent: {
                kind: error.kind,
                action: error.action,
              },
              isError: true,
            };
          }
          return {
            content: [{ type: "text", text: String(error) }],
            structuredContent: { kind: "unknown" as const },
            isError: true,
          };
        }
      },
    );
  }

  return server;
}
