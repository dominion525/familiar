import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AppleScriptError, runAction } from "./applescript.js";
import { TOOLS } from "./tools.js";

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
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async (input) => {
        try {
          const validated = input as Record<string, unknown>;
          const args = tool.runArgs(validated);
          const timeoutMs = tool.timeoutMs?.(validated);
          const result = await runAction(tool.name, args, { timeoutMs });
          return { content: [{ type: "text", text: result }] };
        } catch (error) {
          const message =
            error instanceof AppleScriptError ? error.message : String(error);
          return {
            content: [{ type: "text", text: message }],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}
