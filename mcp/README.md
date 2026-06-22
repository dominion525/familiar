# @dominion525/familiar-mcp

MCP server for familiar — control the user's real macOS Chrome via AppleScript.

This is the MCP-server variant of [familiar](https://github.com/dominion525/familiar). The Claude Code skill / plugin variant lives in the same repo under `skills/familiar/` (with `SKILL.md` driving auto-activation), and both paths invoke the same `familiar.applescript` — so behavior is identical.

## What it does

A MCP-compatible client (Claude Code, Claude Desktop, Cursor, Codex CLI, etc.) gets 32 tools that drive the user's real Google Chrome on macOS via AppleScript (Apple Events):

- **Tabs / windows** (7): `list_tabs`, `new_tab`, `new_incognito_tab`, `close_tab`, `active_tab`, `window_mode`, `is_loading`
- **Navigation** (6): `navigate`, `get_tab_url`, `reload`, `go_back`, `go_forward`, `stop`
- **Waiting** (3): `wait_for_load`, `wait_for_selector`, `wait_for_function`
- **Content / scripting** (3): `get_html`, `execute_js`, `execute_js_file`
- **Read** (5): `get_text`, `get_attribute`, `get_value`, `exists`, `query_all`
- **Interaction** (8): `click`, `fill`, `clear`, `select_option`, `set_checked`, `press_key`, `submit`, `scroll_into_view`

Because it operates the user's actual signed-in Chrome via Apple Events (rather than spawning a fresh headless browser process), the browser fingerprint is whatever Chrome normally reports — useful when working with sites that block headless browsers, though site-specific access controls still apply. No DevTools Protocol, no Playwright, no separate driver.

For per-tool signatures, parameters, return shapes, and selector strategy, see [`reference-browser.md`](https://github.com/dominion525/familiar/blob/main/skills/familiar/reference-browser.md) (control plane) and [`reference-actions.md`](https://github.com/dominion525/familiar/blob/main/skills/familiar/reference-actions.md) (element actions) in the repository.

## Prerequisites

- macOS with Google Chrome
- Chrome's "Allow JavaScript from Apple Events" enabled (View → Developer → Allow JavaScript from Apple Events). Without this, the scripting and DOM-interaction tools will fail
- Automation permission approved for the controlling terminal/app on first run

## Install

The npm package is what your MCP client invokes. The client itself is configured in the next section.

### Via npx (no local install)

`npx` fetches and runs the latest version on demand:

```
npx @dominion525/familiar-mcp@latest
```

This starts the server and waits for JSON-RPC messages on stdin (Ctrl+C to exit). MCP clients spawn this automatically; you do not normally run it by hand.

### From source

```
git clone https://github.com/dominion525/familiar
cd familiar/mcp
npm install
npm run build
```

The server entry point is `mcp/dist/index.js`.

## Configure your MCP client

All examples below assume `npx @dominion525/familiar-mcp@latest`. For a local build, replace `npx` / `@dominion525/familiar-mcp@latest` with `node /absolute/path/to/familiar/mcp/dist/index.js`.

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

### Other MCP clients

Any MCP-compatible client (Cline, Windsurf, Antigravity, VS Code extensions like GitHub Copilot Chat or Continue, etc.) connects via the same JSON shape used in the Cursor and Claude Desktop examples above. Refer to each tool's MCP configuration documentation for the exact location.

## License

MIT
