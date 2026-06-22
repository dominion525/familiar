# reference: browser control

Detailed specs for the control-plane actions (tabs/windows, navigation, waiting,
content/scripting). For element interaction (click/fill, reads, selectors) see
[reference-actions.md](reference-actions.md). For the overview see [SKILL.md](SKILL.md).

Run as: `osascript "$SCRIPT" ACTION [ARGS...]` where `$SCRIPT` is the absolute path
to `familiar.applescript` (see [SKILL.md](SKILL.md) "Script path" for common locations
under Claude Code plugins and Vercel Skills).

Every tab-scoped action takes `WID TID` (windowId, tabId). Native actions work even when
"Allow JavaScript from Apple Events" is off; JS-backed actions need it on.

## Tabs / windows

```bash
osascript "$SCRIPT" list_tabs
```
Lists every tab across every window, one per line as `windowId,tabId,title,url`. Native.

```bash
osascript "$SCRIPT" new_tab
```
Opens a tab in the front-most **normal** window (creates one if none exists) and prints
`windowId,tabId`. Launches Chrome if it is not running. When it creates a window it reuses
that window's initial tab, so no blank tab is left behind.

```bash
osascript "$SCRIPT" new_incognito_tab
```
Same as `new_tab` but targets an **incognito** window. Incognito cookies start empty and
vanish when the window closes. Prints `windowId,tabId`.

```bash
osascript "$SCRIPT" close_tab "$WID" "$TID"
```
Closes the tab. No value returned.

```bash
osascript "$SCRIPT" active_tab "$WID"
```
Prints the window's active tab as `windowId,tabId`. Native.

```bash
osascript "$SCRIPT" window_mode "$WID"
```
Prints the window's mode: `normal` or `incognito`. Native.

```bash
osascript "$SCRIPT" is_loading "$WID" "$TID"
```
Prints `true` or `false` for whether the tab is currently loading. Native (works without
JS), unlike `wait_for_load` which polls `document.readyState`.

## Navigation

```bash
osascript "$SCRIPT" navigate "$WID" "$TID" "https://example.com"
```
Sets the tab's URL, then waits briefly (up to ~3s) for navigation to *begin* (until
`document.readyState` leaves `complete`). It does **not** wait for the page to finish — follow
with `wait_for_load` and/or `wait_for_selector`. No value returned.

```bash
osascript "$SCRIPT" get_tab_url "$WID" "$TID"
```
Prints the tab's current URL. Native.

```bash
osascript "$SCRIPT" reload "$WID" "$TID"
osascript "$SCRIPT" go_back "$WID" "$TID"
osascript "$SCRIPT" go_forward "$WID" "$TID"
osascript "$SCRIPT" stop "$WID" "$TID"
```
History/reload control. Native. No value returned. `go_back`/`go_forward` are no-ops when
there is no history in that direction.

## Waiting

The script uses no fixed sleeps; pacing is caller-driven. Use these to wait explicitly.

```bash
osascript "$SCRIPT" wait_for_load "$WID" "$TID" 60
```
Polls `document.readyState` every 0.5s, up to `MAX_WAIT` seconds. Returns `complete` or
`timeout`.

```bash
osascript "$SCRIPT" wait_for_selector "$WID" "$TID" "a.some-class" 30
```
Polls until a CSS selector matches, up to `MAX_WAIT` seconds. Returns `found` or `timeout`.
Quotes/backslashes in the selector are escaped internally, so `[data-x='y']` is safe. This
takes a **CSS selector only** (not the `text=`/`xpath=`/`label=` forms).

```bash
osascript "$SCRIPT" wait_for_function "$WID" "$TID" "window.__ready === true" 30
```
Polls a raw JavaScript expression until it is truthy, up to `MAX_WAIT` seconds. Returns
`true` or `timeout`. The expression is evaluated as `Boolean(...)`; a thrown error counts as
false (so probing a not-yet-defined property is safe). Pass an expression, not a statement.

## Content / scripting

```bash
osascript "$SCRIPT" get_html "$WID" "$TID"
```
Returns the live DOM as `document.documentElement.outerHTML`. For lazy/Shadow content, wait
for a selector or run JS to realize it first.

```bash
osascript "$SCRIPT" execute_js "$WID" "$TID" "document.title"
```
Runs a JavaScript expression passed inline and returns its value as text. Because the JS is a
shell argument, quotes/`$`/backslashes must survive shell + AppleScript escaping — use this
only for short expressions.

```bash
osascript "$SCRIPT" execute_js_file "$WID" "$TID" /tmp/snippet.js
```
Reads JavaScript from a file (UTF-8) and runs it. This sidesteps all shell/AppleScript
escaping — prefer it for anything with quotes, multiple lines, or special characters.

### Completion value (important)

`execute javascript` returns the value of the **last evaluated expression** (its completion
value, like the DevTools console). End the script with an expression — multiple statements are
fine. A top-level `return` does not work and yields `missing value`; leave the final
expression without `return`.

```bash
cat > /tmp/snippet.js <<'EOF'
const items = [...document.querySelectorAll('.product[data-id]')];
JSON.stringify(items.map(el => el.dataset.id))
EOF
osascript "$SCRIPT" execute_js_file "$WID" "$TID" /tmp/snippet.js
```
