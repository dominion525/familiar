# reference: element actions

Detailed specs for element reads and interaction, plus the selector strategy. For the
control plane (tabs/windows, navigation, waiting, scripting) see
[reference-browser.md](reference-browser.md). For the overview see [SKILL.md](SKILL.md).

Run as: `osascript "$SCRIPT" ACTION "$WID" "$TID" SELECTOR [VALUE]` where `$SCRIPT`
is the absolute path to `familiar.applescript` (see [SKILL.md](SKILL.md) "Script path"
for common locations under Claude Code plugins and Vercel Skills).

All actions here run JavaScript, so Chrome's "Allow JavaScript from Apple Events" must be on.
When no element matches the selector, the action returns the string `not_found` rather than
raising — check the returned string instead of relying on exit status.

## Selectors

Every `SELECTOR` argument accepts one of these forms. The prefix decides how it is resolved;
with no prefix it is a CSS selector.

```
CSS (default)   button.submit, #email, [data-id='42']
text=...        match by exact trimmed visible text
xpath=...       match by XPath
label=...       match a form control via its <label> or aria-label
```

Resolution details:

- **CSS** — `document.querySelector(sel)` (first match).
- **`text=`** — scans `body *` for elements whose trimmed `textContent` exactly equals the
  text, and returns the **innermost** match (the deepest element that itself contains the
  text, not an ancestor wrapping it). Exact match only — no substring/partial.
- **`xpath=`** — the first node of the XPath result.
- **`label=`** — finds a `<label>` whose trimmed text equals the value, then resolves its
  control via `for=`/`id` or a nested `input`/`textarea`/`select`. Falls back to an element
  whose `aria-label` equals the value.

Only `query_all` returns multiple elements; every other action operates on the single
resolved element. For `query_all`, `xpath=` returns all matched nodes and CSS returns all
`querySelectorAll` matches, while `text=`/`label=` yield at most one element.

## Reads

```bash
osascript "$SCRIPT" get_text "$WID" "$TID" "h1"
```
Returns a JSON envelope: `{"found": true, "value": "..."}` with the element's trimmed visible
text (`innerText`, falling back to `textContent`), or `{"found": false}` when no element
matched. The envelope avoids the previous sentinel collision where a page element whose
visible text was literally `not_found` was misreported as missing.

```bash
osascript "$SCRIPT" get_attribute "$WID" "$TID" "a.link" "href"
```
Returns a JSON envelope: `{"found": true, "value": "..."}` with the attribute value (empty
string when the attribute is absent on the matched element), or `{"found": false}` when no
element matched.

```bash
osascript "$SCRIPT" get_value "$WID" "$TID" "#email"
```
Returns a JSON envelope: `{"found": true, "value": "..."}` with the form control's value
(empty string when the control has no value set), or `{"found": false}` when no element
matched.

```bash
osascript "$SCRIPT" exists "$WID" "$TID" ".banner"
```
Returns `true` or `false`. (Never `not_found` — absence is reported as `false`.)

```bash
osascript "$SCRIPT" query_all "$WID" "$TID" ".item"
```
Returns a JSON array string of the trimmed text of every matching element, e.g.
`["First","Second"]`. An empty result is `[]`.

## Interaction

```bash
osascript "$SCRIPT" click "$WID" "$TID" "button.submit"
```
Scrolls the element to center, then calls `.click()`. Returns `true` or `not_found`.

```bash
osascript "$SCRIPT" fill "$WID" "$TID" "#email" "user@example.com"
```
Focuses the input/textarea and sets its value through the native value setter, then fires
`input` and `change`. Going through the native setter is what lets frameworks (React, Vue,
etc.) detect the change — a plain `el.value = ...` is missed by them. Returns `true` or
`not_found`.

```bash
osascript "$SCRIPT" clear "$WID" "$TID" "#email"
```
Like `fill` with an empty string: focuses, sets value to `''` via the native setter, fires
`input`/`change`. Returns `true` or `not_found`.

```bash
osascript "$SCRIPT" select_option "$WID" "$TID" "select#country" "JP"
```
Selects an `<option>` by its `value`, falling back to its visible text. Sets the value via
the native setter and fires `input`/`change`. Returns `true`, `no_option` if nothing
matched, or `not_found`.

```bash
osascript "$SCRIPT" set_checked "$WID" "$TID" "#agree" true
```
Sets a checkbox/radio's checked state (`true`/`false`) via the native setter and fires
`input`/`change`. Returns `true` or `not_found`.

```bash
osascript "$SCRIPT" press_key "$WID" "$TID" "#search" "Enter"
```
Focuses the element and dispatches synthetic `keydown`/`keypress`/`keyup` for the key.
Named keys: `Enter`, `Tab`, `Escape`, `Backspace`, `Delete`, `ArrowUp`/`Down`/`Left`/`Right`,
space; otherwise a single character is used as-is. Returns `true` or `not_found`. Note: these
events are `isTrusted=false`, so handlers that require trusted input may ignore them, and this
does not type text into the field (use `fill` for that).

```bash
osascript "$SCRIPT" submit "$WID" "$TID" "form#login"
```
Submits the form the element belongs to (or the element itself if it is a `<form>`). Uses
`requestSubmit()` so submit handlers and validation run (falls back to `submit()`). Returns
`true`, `no_form` if no form was found, or `not_found`.

```bash
osascript "$SCRIPT" scroll_into_view "$WID" "$TID" ".footer"
```
Scrolls the element into view, centered. Returns `true` or `not_found`.

## Synthetic events caveat

All interaction here is driven from JavaScript, so the events are `isTrusted=false`. Pages
with strict bot/WAF handling may ignore such events. If a page rejects these, fall back to
`execute_js`/`execute_js_file` for custom logic; native OS-level input (`isTrusted=true`) is
intentionally not provided.
