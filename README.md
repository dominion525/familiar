# familiar
Control your real macOS Chrome via AppleScript — no DevTools Protocol, no Playwright.

A Claude Code skill that drives Google Chrome on macOS through AppleScript (Apple
Events). It uses your everyday browser instead of a headless/automated one, so pages
behind bot/WAF defenses tend to treat it as a normal user.

日本語版は [README.ja.md](README.ja.md) を参照してください。

## What it does

Everything is tab-scoped (windowId + tabId); it never relies on the "active tab".

- `list_tabs` / `new_tab` / `new_incognito_tab` / `close_tab` — tab management (new_tab uses a normal window, new_incognito_tab an incognito one)
- `active_tab` / `window_mode` / `is_loading` — inspect active tab / window mode / tab loading state
- `navigate` / `get_tab_url` — navigation
- `reload` / `go_back` / `go_forward` / `stop` — history & reload control
- `wait_for_load` / `wait_for_selector` / `wait_for_function` — wait for page load / element / a JS condition
- `get_html` — get the current DOM as HTML
- `get_text` / `get_attribute` / `get_value` / `exists` / `query_all` — read element text / attribute / value / presence / all matches
- `click` / `fill` / `clear` / `select_option` / `set_checked` / `press_key` / `submit` / `scroll_into_view` — interact with elements and forms
- `execute_js` / `execute_js_file` — run arbitrary JavaScript (use the file form for complex scripts)

Selectors accept CSS (default), `text=`, `xpath=`, and `label=` forms.

## Prerequisites

- macOS with Google Chrome
- Enable Chrome's "Allow JavaScript from Apple Events"
  (View → Developer → Allow JavaScript from Apple Events)
- Approve the Automation permission prompt on first run

## Install

### Claude Code plugin

```
/plugin marketplace add dominion525/familiar
/plugin install familiar@familiar
```

For local development / testing:

```
/plugin marketplace add /path/to/familiar
/plugin install familiar@familiar
```

### Vercel Skills (agent-skills)

```
npx skills add dominion525/familiar
```

This places the skill under `~/.agents/skills/familiar/`. Any client that follows the
[agent-skills spec](https://agentskills.io/specification) (Claude Code, Cursor, and
others) picks it up automatically. The registry is at https://skills.sh.

### MCP server

The `mcp/` directory contains an MCP server implementation (TypeScript) that
exposes the same 32 actions to any MCP-compatible client (Claude Code, Claude
Desktop, Cursor, Codex CLI, and others). See [mcp/README.md](mcp/README.md) for
install and configuration.

### Standalone (no install)

The script also runs standalone, without installing the skill:

```
osascript skills/familiar/familiar.applescript list_tabs
```

See `skills/familiar/SKILL.md` for full usage.

## License

MIT
