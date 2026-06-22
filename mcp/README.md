# @dominion525/familiar-mcp

[![npm version](https://img.shields.io/npm/v/@dominion525/familiar-mcp)](https://www.npmjs.com/package/@dominion525/familiar-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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

<details>
<summary><b>From source</b></summary>

```
git clone https://github.com/dominion525/familiar
cd familiar/mcp
npm install
npm run build
```

The server entry point is `mcp/dist/index.js`.

</details>

## Configure your MCP client

All examples below assume `npx @dominion525/familiar-mcp@latest`. For a local build, replace `npx` / `@dominion525/familiar-mcp@latest` with `node /absolute/path/to/familiar/mcp/dist/index.js`.

<details>
<summary><b>Claude Code</b></summary>

```
claude mcp add familiar -- npx @dominion525/familiar-mcp@latest
```

</details>

<details>
<summary><b>Claude Desktop</b></summary>

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

</details>

<details>
<summary><b>Cursor</b></summary>

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

</details>

<details>
<summary><b>Codex CLI</b></summary>

Edit `~/.codex/config.toml`:

```toml
[mcp_servers.familiar]
command = "npx"
args = ["@dominion525/familiar-mcp@latest"]
```

</details>

<details>
<summary><b>Other MCP clients</b></summary>

Any MCP-compatible client (Cline, Windsurf, Antigravity, VS Code extensions like GitHub Copilot Chat or Continue, etc.) connects via the same JSON shape used in the Cursor and Claude Desktop examples above. Refer to each tool's MCP configuration documentation for the exact location.

</details>

## macOS permissions

Two permissions need to be set up once before the AppleScript-backed tools can talk to Chrome:

| Permission | Where | Why |
|---|---|---|
| Allow JavaScript from Apple Events | Chrome → View → Developer → Allow JavaScript from Apple Events | Required for any tool that runs JavaScript in the page (everything except the bare tab / window listing actions) |
| Automation → Google Chrome | System Settings → Privacy & Security → Automation → (the app spawning the MCP server) → Google Chrome | macOS asks the first time `osascript` talks to Chrome. **macOS grants Automation permission to the parent process**, not to `familiar-mcp` itself, so approve it for the app that actually runs your MCP client (typically Terminal, VS Code, Cursor, or Claude Desktop) |

If the OS permission prompt never appears, run this once from the same terminal that spawns the MCP server:

```
osascript -e 'tell application "Google Chrome" to get URL of active tab of window 1'
```

That call surfaces the prompt for the current parent process. Once approved, subsequent MCP calls work without re-prompting.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `osascript ... failed (non_zero_exit): ... JavaScript is turned off` | Enable "Allow JavaScript from Apple Events" in Chrome → View → Developer |
| `Not authorized to send Apple events to "Google Chrome"` | Grant Automation → Google Chrome to the parent process (Terminal / VS Code / Cursor / etc.) under System Settings → Privacy & Security → Automation |

## Security

- Runs **locally** on your Mac. Communicates only over stdio (JSON-RPC) with the calling MCP client. No remote connections initiated by this server.
- No telemetry, no analytics, no data sent off-device.
- The AppleScript layer is a single readable file ([`skills/familiar/familiar.applescript`](https://github.com/dominion525/familiar/blob/main/skills/familiar/familiar.applescript)) — audit it directly to verify what gets sent to Chrome.
- Open source, MIT-licensed. Every line of both the MCP server (`mcp/src/`) and the AppleScript layer is in the repository.

## Architecture

```
MCP client (Claude Code / Cursor / ...)
        ↓ stdio (JSON-RPC, MCP protocol)
   familiar-mcp server (Node.js)
        ↓ child_process.execFile("osascript", ["familiar.applescript", ACTION, ...args])
   AppleScript (Apple Events)
        ↓ tell application "Google Chrome" / do JavaScript
   Google Chrome (the user's actual signed-in browser)
        ↓
   Page DOM
```

Key design choices:

- One `familiar.applescript` file backs both the MCP server and the Claude Code skill. Behavior is identical across both paths.
- Every operation targets a specific tab by `windowId + tabId`. The MCP server never relies on Chrome's active tab — safe to use while the user works in other tabs.
- Each tool call spawns a fresh `osascript` process (no persistent helper). Simpler to reason about, slightly slower (~80ms per call) than persistent-process designs.

## Related projects

When you want a small, focused tool set that drives **the user's actual signed-in Chrome**, familiar-mcp is the fit. Adjacent projects with different trade-offs:

- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) — Chrome via the DevTools Protocol. Has Lighthouse and performance-tracing tools that familiar-mcp doesn't. Spawns a fresh Chrome with a debug port rather than using your existing browser session.
- [Playwright MCP](https://github.com/microsoft/playwright-mcp) — cross-browser (Chromium / Firefox / WebKit) via Playwright. Use when you need headless or cross-browser automation. Does not use your signed-in browser session.
- [safari-mcp](https://github.com/achiya-automation/safari-mcp) — same general idea (real signed-in browser via Apple Events) for Safari instead of Chrome. Larger tool surface; includes a Safari Extension for capabilities AppleScript alone can't reach.

## Use as a Claude Code skill instead

Don't want to run an MCP server? The same 32 actions are available as a Claude Code skill / plugin under `skills/familiar/` in the same repository (with `SKILL.md` driving auto-activation when Claude Code recognizes a matching request). See the [repository README](https://github.com/dominion525/familiar) for the skill / plugin install path.

## License

MIT — see [LICENSE](LICENSE).
