# familiar
Control your real macOS Chrome via AppleScript — no DevTools Protocol, no Playwright.

A Claude Code skill that drives Google Chrome on macOS through AppleScript (Apple
Events). It uses your everyday browser instead of a headless/automated one, so pages
behind bot/WAF defenses tend to treat it as a normal user.

日本語版は [README.ja.md](README.ja.md) を参照してください。

## What it does

Everything is tab-scoped (windowId + tabId); it never relies on the "active tab".

- `list_tabs` / `new_tab` / `new_incognito_tab` / `close_tab` — tab management (new_tab uses a normal window, new_incognito_tab an incognito one)
- `active_tab` / `window_mode` — inspect a window's active tab / mode
- `navigate` / `get_tab_url` — navigation
- `reload` / `go_back` / `go_forward` / `stop` — history & reload control
- `wait_for_load` / `wait_for_selector` — wait for page load / element to appear
- `get_html` — get the current DOM as HTML
- `execute_js` / `execute_js_file` — run arbitrary JavaScript (use the file form for complex scripts)

## Prerequisites

- macOS with Google Chrome
- Enable Chrome's "Allow JavaScript from Apple Events"
  (View → Developer → Allow JavaScript from Apple Events)
- Approve the Automation permission prompt on first run

## Install (as a Claude Code plugin)

```
/plugin marketplace add dominion525/familiar
/plugin install familiar@familiar
```

For local development / testing:

```
/plugin marketplace add /path/to/familiar
/plugin install familiar@familiar
```

The script also runs standalone, without installing the plugin:

```
osascript skills/familiar/familiar.applescript list_tabs
```

See `skills/familiar/SKILL.md` for full usage.

## Origin

This skill is extracted from the browser-control part of the phantasm tool (a WAF-evading
HTML collector) in the `aleister` repository, repackaged for general-purpose use. The
Docker-to-host bridge (the portal Named-Pipe relay) and the Ruby wrapper are intentionally
left out — they are unnecessary when running directly on the host.

## License

MIT
