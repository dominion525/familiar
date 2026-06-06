---
name: familiar
description: Use when you need to drive a real Google Chrome browser on macOS — open or close tabs, navigate to URLs, wait for page load or a CSS selector, extract page HTML, or run arbitrary JavaScript — through AppleScript instead of the DevTools Protocol or Playwright. Especially useful for pages behind bot/WAF defenses where headless or automated browsers get blocked, since this drives the user's everyday Chrome.
---

# familiar — control macOS Chrome via AppleScript

Drive a real Google Chrome on macOS through AppleScript (Apple Events). No DevTools
Protocol, no Playwright, no separate driver — it operates the user's actual browser,
so pages that block headless/automated browsers generally treat it as a normal user.

The script lives next to this file at `${CLAUDE_PLUGIN_ROOT}/skills/familiar/familiar.applescript`.
Invoke it with `osascript`.

## Prerequisites

- macOS with Google Chrome installed.
- Chrome's "Allow JavaScript from Apple Events" must be enabled:
  View → Developer → Allow JavaScript from Apple Events.
- The first run may prompt for Automation permission (System Settings → Privacy &
  Security → Automation). Approve it for the controlling terminal/app.

## Core model

- Every operation targets a specific tab by **windowId + tabId** (`WID TID`). It never
  relies on the "active tab", so it is safe to run while the user works in other tabs.
- The script saves the frontmost app before acting and restores focus afterward.
- It contains **no sleeps or retries** beyond what each wait action needs — pace
  navigation and add delays from the caller side.

## Actions

Run as: `osascript "$CLAUDE_PLUGIN_ROOT/skills/familiar/familiar.applescript" ACTION [ARGS...]`

Tab management:

```bash
# List every tab as: windowId,tabId,title,url (one per line)
osascript "$SCRIPT" list_tabs

# Open a tab in an incognito window (reuses one if present, else creates it).
# Prints "windowId,tabId".
osascript "$SCRIPT" new_tab

# Close a tab
osascript "$SCRIPT" close_tab "$WID" "$TID"
```

Navigation:

```bash
osascript "$SCRIPT" navigate "$WID" "$TID" "https://example.com"
osascript "$SCRIPT" get_tab_url "$WID" "$TID"
```

Waiting:

```bash
# Wait until document.readyState == "complete" (up to 60s). Returns "complete"|"timeout".
osascript "$SCRIPT" wait_for_load "$WID" "$TID"

# Wait until a CSS selector matches (max wait in seconds). Returns "found"|"timeout".
osascript "$SCRIPT" wait_for_selector "$WID" "$TID" "a.some-class" 30
```

Content / scripting:

```bash
# Raw HTML (document.documentElement.outerHTML)
osascript "$SCRIPT" get_html "$WID" "$TID"

# Run a short JavaScript expression passed inline. Result is returned as text.
osascript "$SCRIPT" execute_js "$WID" "$TID" "document.title"

# Run JavaScript loaded from a file (see "Complex JavaScript" below).
osascript "$SCRIPT" execute_js_file "$WID" "$TID" /tmp/snippet.js
```

## Typical flow

```bash
SCRIPT="$CLAUDE_PLUGIN_ROOT/skills/familiar/familiar.applescript"

result=$(osascript "$SCRIPT" new_tab)
WID=$(echo "$result" | cut -d',' -f1)
TID=$(echo "$result" | cut -d',' -f2)

osascript "$SCRIPT" navigate "$WID" "$TID" "https://example.com"
osascript "$SCRIPT" wait_for_load "$WID" "$TID"
osascript "$SCRIPT" get_html "$WID" "$TID" > page.html

osascript "$SCRIPT" close_tab "$WID" "$TID"
```

## Complex JavaScript — prefer execute_js_file

`execute_js` passes the JavaScript as a shell argument, so quotes, `$`, backslashes,
and newlines must survive shell + AppleScript escaping. Use it only for short, simple
expressions (`document.title`, `location.href`, a single `querySelector(...).innerText`).

For anything with quotes, multiple lines, or special characters, **write the JS to a
file first and use `execute_js_file`** — this sidesteps all escaping:

```bash
cat > /tmp/snippet.js <<'EOF'
(() => {
  const items = [...document.querySelectorAll('.product[data-id]')];
  return JSON.stringify(items.map(el => el.dataset.id));
})()
EOF
osascript "$SCRIPT" execute_js_file "$WID" "$TID" /tmp/snippet.js
```

`execute javascript` evaluates an **expression** and returns its value — a bare
top-level `return` produces no result (`missing value`). Wrap any multi-statement
script in an IIFE (`(() => { ... })()`) so the function's `return` value is what
comes back.

When generating the JS programmatically, write the file with your editor tool (which
needs no shell escaping) rather than building a long inline string.

`wait_for_selector` escapes single quotes/backslashes in the selector internally, so
attribute selectors like `[data-x='y']` are safe to pass.

## Incognito behavior

`new_tab` prefers an existing incognito window and creates one if none exists. Cookies
start empty and vanish when the window closes. Chrome is launched automatically if it
is not running.

## Notes

- Always pair `new_tab` with `close_tab` when you are done, unless you intend to leave
  the tab open for the user.
- `get_html` returns the live DOM; for content rendered after load (lazy/Shadow DOM),
  wait for a selector first, or run JS to materialize it before reading.
