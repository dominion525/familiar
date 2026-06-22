# @dominion525/familiar-mcp

MCP server for familiar — control the user's real macOS Chrome via AppleScript.

This is the MCP-server variant of [familiar](https://github.com/dominion525/familiar).
The Claude Code skill / plugin variant lives in the same repo under `skills/familiar/`,
and both paths invoke the same `familiar.applescript`.

## Prerequisites

- macOS with Google Chrome
- Chrome's "Allow JavaScript from Apple Events" enabled
  (View → Developer → Allow JavaScript from Apple Events)
- Automation permission approved for the controlling terminal/app on first run

## Install

### From source (current)

```
git clone https://github.com/dominion525/familiar
cd familiar/mcp
npm install
npm run build
```

The server entry point is `mcp/dist/index.js`.

### Via npx (after npm publish)

```
npx @dominion525/familiar-mcp@latest
```

## Configure your MCP client

All examples below assume `npx @dominion525/familiar-mcp@latest`. For a local build, replace
`npx` / `@dominion525/familiar-mcp@latest` with `node /absolute/path/to/familiar/mcp/dist/index.js`.

### Claude Code

```
claude mcp add familiar -- npx @dominion525/familiar-mcp@latest
```

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "familiar": {
      "command": "npx",
      "args": ["@dominion525/familiar-mcp@latest"]
    }
  }
}
```

### Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "familiar": {
      "command": "npx",
      "args": ["@dominion525/familiar-mcp@latest"]
    }
  }
}
```

### Codex CLI

Edit `~/.codex/config.toml`:

```toml
[mcp_servers.familiar]
command = "npx"
args = ["@dominion525/familiar-mcp@latest"]
```

### Cline / Windsurf / Antigravity

Each tool exposes an MCP settings panel that accepts the same JSON shape as the
Cursor example above.

### VS Code (GitHub Copilot Chat, Continue, etc.)

Each extension has its own MCP configuration; refer to the extension docs.

## How it relates to the Claude Code skill

`skills/familiar/` provides the same 32 actions as a Claude Code plugin (with
`SKILL.md` driving auto-activation), while this MCP server makes the same actions
available to any MCP-compatible client. Behavior is identical because both paths
shell out to the same `familiar.applescript`.

## License

MIT
