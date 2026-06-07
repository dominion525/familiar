---
name: familiar
description: Use when you need to drive a real Google Chrome browser on macOS — open or close tabs, navigate to URLs, wait for page load or a CSS selector, extract page HTML or element text/attributes, click elements and fill forms, or run arbitrary JavaScript — through AppleScript instead of the DevTools Protocol or Playwright. Especially useful for pages behind bot/WAF defenses where headless or automated browsers get blocked, since this drives the user's everyday Chrome.
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
- Pacing is caller-driven: the script uses no fixed sleeps. To wait, use the explicit
  wait actions (`wait_for_load`, `wait_for_selector`, `wait_for_function`).
- Actions return their result as **text** (not via exit status). Element actions return
  `not_found` when the selector matches nothing, rather than raising.

## Actions

Run as: `osascript "$CLAUDE_PLUGIN_ROOT/skills/familiar/familiar.applescript" ACTION [ARGS...]`

Control plane — full specs in [reference-browser.md](reference-browser.md):

```
list_tabs                          list every tab as windowId,tabId,title,url
new_tab                            open a tab in a normal window → "windowId,tabId"
new_incognito_tab                  open a tab in an incognito window → "windowId,tabId"
close_tab WID TID                  close a tab
active_tab WID                     a window's active tab → "windowId,tabId"
window_mode WID                    "normal" | "incognito"
is_loading WID TID                 "true" | "false" (native, no JS)
navigate WID TID URL               set the tab's URL (waits only for nav to begin)
get_tab_url WID TID                the tab's current URL
reload / go_back / go_forward / stop  WID TID    history & reload control
wait_for_load WID TID              poll readyState up to 60s → "complete" | "timeout"
wait_for_selector WID TID SEL N    poll a CSS selector up to N s → "found" | "timeout"
wait_for_function WID TID EXPR N   poll a JS expression up to N s → "true" | "timeout"
get_html WID TID                   the live DOM as outerHTML
execute_js WID TID EXPR            run an inline JS expression → its value
execute_js_file WID TID PATH       run JS from a file → its value
```

Element plane — full specs and selector strategy in [reference-actions.md](reference-actions.md):

```
get_text WID TID SEL               element's trimmed text → text | "not_found"
get_attribute WID TID SEL NAME     attribute value ("" if absent) | "not_found"
get_value WID TID SEL              input/textarea/select value | "not_found"
exists WID TID SEL                 "true" | "false"
query_all WID TID SEL              JSON array of every match's trimmed text
click WID TID SEL                  scroll into view + click → "true" | "not_found"
fill WID TID SEL VALUE             set an input's value (frameworks notice) → "true" | "not_found"
clear WID TID SEL                  empty an input → "true" | "not_found"
select_option WID TID SEL VALUE    pick an <option> by value/text → "true" | "no_option" | "not_found"
set_checked WID TID SEL BOOL       check/uncheck → "true" | "not_found"
press_key WID TID SEL KEY          synthetic keydown/press/up → "true" | "not_found"
submit WID TID SEL                 submit the element's form → "true" | "no_form" | "not_found"
scroll_into_view WID TID SEL       center the element → "true" | "not_found"
```

`new_tab`/`new_incognito_tab` launch Chrome if it is not running, and when they create a
window they reuse its initial tab so no blank tab is left behind. Pair them with `close_tab`
when done, unless you mean to leave the tab open for the user.

## Selectors

Every `SEL` argument accepts one of these forms (no prefix = CSS):

```
CSS (default)   button.submit, #email, [data-id='42']
text=...        match by exact trimmed visible text
xpath=...       match by XPath
label=...       match a form control via its <label> or aria-label
```

`wait_for_selector` is the exception — it takes a **CSS selector only**. See
[reference-actions.md](reference-actions.md) for resolution details (e.g. `text=` returns the
innermost exact match).

## Examples

Open a page and read it:

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

Fill and submit a form, then read the result:

```bash
osascript "$SCRIPT" wait_for_selector "$WID" "$TID" "form#login" 30
osascript "$SCRIPT" fill "$WID" "$TID" "#email" "user@example.com"
osascript "$SCRIPT" fill "$WID" "$TID" "#password" "secret"
osascript "$SCRIPT" set_checked "$WID" "$TID" "#remember" true
osascript "$SCRIPT" click "$WID" "$TID" "text=Sign in"

osascript "$SCRIPT" wait_for_selector "$WID" "$TID" ".welcome" 30
osascript "$SCRIPT" get_text "$WID" "$TID" ".welcome"
```

## Complex JavaScript — prefer execute_js_file

`execute_js` passes the JavaScript as a shell argument, so quotes, `$`, and backslashes must
survive shell + AppleScript escaping. Use it only for short expressions. For anything with
quotes, multiple lines, or special characters, write the JS to a file and use
`execute_js_file`:

```bash
cat > /tmp/snippet.js <<'EOF'
const items = [...document.querySelectorAll('.product[data-id]')];
JSON.stringify(items.map(el => el.dataset.id))
EOF
osascript "$SCRIPT" execute_js_file "$WID" "$TID" /tmp/snippet.js
```

`execute javascript` returns the value of the **last evaluated expression** (its completion
value, like the DevTools console), so end the script with an expression — a multi-statement
script is fine. A top-level `return` does not work (`missing value`); leave the final
expression without `return`. See [reference-browser.md](reference-browser.md) for more.
