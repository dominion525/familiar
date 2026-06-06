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

# Open a tab in a normal window (adds to the front-most normal window, or
# creates one if none exists). Prints "windowId,tabId".
osascript "$SCRIPT" new_tab

# Open a tab in an incognito window (reuses one if present, else creates it).
# Prints "windowId,tabId".
osascript "$SCRIPT" new_incognito_tab

# Close a tab
osascript "$SCRIPT" close_tab "$WID" "$TID"

# Get a window's active tab as "windowId,tabId"
osascript "$SCRIPT" active_tab "$WID"

# Get a window's mode ("normal" or "incognito")
osascript "$SCRIPT" window_mode "$WID"

# Is a tab currently loading? Returns "true"|"false" (native, works without JS)
osascript "$SCRIPT" is_loading "$WID" "$TID"
```

Navigation:

```bash
osascript "$SCRIPT" navigate "$WID" "$TID" "https://example.com"
osascript "$SCRIPT" get_tab_url "$WID" "$TID"

# History / reload control (no value returned)
osascript "$SCRIPT" reload "$WID" "$TID"
osascript "$SCRIPT" go_back "$WID" "$TID"
osascript "$SCRIPT" go_forward "$WID" "$TID"
osascript "$SCRIPT" stop "$WID" "$TID"
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
const items = [...document.querySelectorAll('.product[data-id]')];
JSON.stringify(items.map(el => el.dataset.id))
EOF
osascript "$SCRIPT" execute_js_file "$WID" "$TID" /tmp/snippet.js
```

`execute javascript` returns the value of the **last evaluated expression** (the
completion value, like the DevTools console). End the script with an expression to
get a result — a multi-statement script is fine. A bare top-level `return` does not
work and yields `missing value`, so leave the final expression without `return`.

When generating the JS programmatically, write the file with your editor tool (which
needs no shell escaping) rather than building a long inline string.

`wait_for_selector` escapes single quotes/backslashes in the selector internally, so
attribute selectors like `[data-x='y']` are safe to pass.

## Normal vs incognito tabs

`new_tab` opens in a normal (non-incognito) window: it adds a tab to the front-most
normal window, or creates a new normal window if none exists. `new_incognito_tab`
targets an incognito window instead, reusing an existing one or creating it (incognito
cookies start empty and vanish when the window closes). When either action creates a
new window, it reuses that window's initial tab so no blank tab is left behind. Chrome
is launched automatically if it is not running.

## Notes

- Always pair `new_tab` with `close_tab` when you are done, unless you intend to leave
  the tab open for the user.
- `get_html` returns the live DOM; for content rendered after load (lazy/Shadow DOM),
  wait for a selector first, or run JS to materialize it before reading.
