#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AppleScriptError, runAction } from "./applescript.js";
import { TOOLS } from "./tools.js";

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
        const args = tool.runArgs(input as Record<string, unknown>);
        const result = await runAction(tool.name, args);
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

const transport = new StdioServerTransport();
await server.connect(transport);
