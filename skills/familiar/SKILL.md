---
name: familiar
description: Use when you specifically need to drive the user's own everyday Google Chrome on macOS via AppleScript (Apple Events) — not a fresh headless/automated browser, and not the DevTools Protocol or Playwright. Especially for pages behind bot/WAF defenses that block automated browsers, since this is the real signed-in Chrome. Covers open/close tabs (incl. incognito), navigate, wait for load/selector, extract page HTML or element text/attributes, click elements, fill and submit forms, and run arbitrary JavaScript.
compatibility: macOS only. Requires Google Chrome with "Allow JavaScript from Apple Events" enabled (View → Developer → Allow JavaScript from Apple Events) and Automation permission approved on first run.
---

# familiar — control macOS Chrome via AppleScript

Drive a real Google Chrome on macOS through AppleScript (Apple Events). No DevTools
Protocol, no Playwright, no separate driver — it operates the user's actual browser,
so pages that block headless/automated browsers generally treat it as a normal user.

## Script path

This skill ships `familiar.applescript` alongside this `SKILL.md`. Invoke it with
`osascript`, passing the absolute path. The examples below assume the path is stored
in `$SCRIPT`. Common locations:

- Claude Code plugin: `${CLAUDE_PLUGIN_ROOT}/skills/familiar/familiar.applescript`
- Vercel Skills (`npx skills add`): typically `$HOME/.agents/skills/familiar/familiar.applescript`

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
- Actions return their result as **text** (not via exit status). Most element actions return
  `not_found` when the selector matches nothing, rather than raising — except `exists`
  (reports `false`) and `query_all` (returns `[]`).

## Actions

Run as: `osascript "$SCRIPT" ACTION [ARGS...]` — `$SCRIPT` is the absolute path described in "Script path" above.

This index lists signatures and return values. For exact behavior, selector resolution, and
edge cases — and whenever an action returns `not_found` / `no_form` / `no_option` / `timeout`
and you are unsure why — read the linked reference rather than guessing. Notation below:
`"literal"` = an exact string the action prints; `<value>` = a dynamic value.

Control plane — full specs in [reference-browser.md](reference-browser.md):

```
list_tabs                          → lines of "<wid>,<tid>,<title>,<url>"
new_tab                            open a tab in a normal window → "<wid>,<tid>"
new_incognito_tab                  open a tab in an incognito window → "<wid>,<tid>"
close_tab WID TID                  close a tab (no output)
active_tab WID                     a window's active tab → "<wid>,<tid>"
window_mode WID                    → "normal" | "incognito"
is_loading WID TID                 → "true" | "false" (native, no JS)
navigate WID TID URL               set the tab's URL; briefly waits for nav to begin (no
                                   output) — follow with wait_for_load
get_tab_url WID TID                → <url>
reload / go_back / go_forward / stop  WID TID    history & reload control (no output)
wait_for_load WID TID              poll readyState up to 60s → "complete" | "timeout"
wait_for_selector WID TID SEL N    poll a CSS selector up to N s → "found" | "timeout"
wait_for_function WID TID EXPR N   poll a JS expression up to N s → "true" | "timeout"
get_html WID TID                   the live DOM as outerHTML → <html>
execute_js WID TID EXPR            run an inline JS expression → <value>
execute_js_file WID TID PATH       run JS from a file → <value>
```

Element plane — full specs and selector strategy in [reference-actions.md](reference-actions.md):

```
get_text WID TID SEL               element's trimmed text → <text> | "not_found"
get_attribute WID TID SEL NAME     attribute value ("" if absent) → <value> | "not_found"
get_value WID TID SEL              input/textarea/select value → <value> | "not_found"
exists WID TID SEL                 → "true" | "false"
query_all WID TID SEL              JSON array of every match's trimmed text → <json> ("[]" if none)
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
# Pick the path that matches your install:
SCRIPT="${CLAUDE_PLUGIN_ROOT}/skills/familiar/familiar.applescript"    # Claude Code plugin
# SCRIPT="$HOME/.agents/skills/familiar/familiar.applescript"          # Vercel Skills (npx skills add)

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

## Complex JavaScript

`execute_js` takes the JavaScript as a shell argument (quotes, `$`, and backslashes must
survive shell + AppleScript escaping), so use it only for short expressions. For anything with
quotes, multiple lines, or special characters, write the JS to a file and use
`execute_js_file`.

Key gotcha: `execute javascript` returns the value of the **last evaluated expression** (its
completion value, like the DevTools console). End the script with an expression — a top-level
`return` does not work (`missing value`). See
[reference-browser.md](reference-browser.md) for the file-based pattern and a worked example.
