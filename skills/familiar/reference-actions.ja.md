# リファレンス: 要素操作（日本語訳）

> [reference-actions.md](reference-actions.md) の日本語訳です。スキルローダーが読むのは
> 英語版だけで、このファイルは人間向けの参考訳です。

要素の取得・操作の詳細仕様とセレクタ戦略。制御系（タブ/ウィンドウ・ナビゲーション・待機・
スクリプト）は [reference-browser.ja.md](reference-browser.ja.md)、概要は
[SKILL.ja.md](SKILL.ja.md) を参照。

実行形式: `osascript "$SCRIPT" ACTION "$WID" "$TID" SELECTOR [VALUE]`
（`$SCRIPT` は `familiar.applescript` のフルパス。Claude Code プラグイン / Vercel Skills 配下の
代表的な配置は [SKILL.ja.md](SKILL.ja.md) 「スクリプトの場所」を参照）

ここのアクションはすべて JavaScript を実行するので、Chrome の「Apple Event からの JavaScript の
使用を許可」が必要。要素が無い場合に例外は投げず、戻り値で報告する:

- `get_text` / `get_attribute` / `get_value` は JSON エンベロープ `{"found": true, "value": "..."}` または `{"found": false}` を返す
- `select_option` / `submit` は JSON エンベロープ `{"ok": true}` または `{"ok": false, "kind": "<理由>"}` を返す（`<理由>` は `not_found` / `no_option` / `no_form` のいずれか）
- `exists` は素の文字列 `true` または `false` を返す（`not_found` は返さない、不在は `false`）
- その他のアクション（`click` / `fill` / `clear` / `set_checked` / `press_key` / `scroll_into_view`）は素の文字列 `true` を成功時に、`not_found` を要素未一致時に返す

JSON エンベロープを返すアクションは、実ページ値（例: 要素テキストが文字どおり `"not_found"`）が不在 sentinel と衝突して区別できなくなる以前の問題を解消している。

## セレクタ

`SELECTOR` 引数は以下のいずれかの形式を取る。接頭辞で解決方法が決まり、接頭辞が無ければ CSS
セレクタ扱い。

```
CSS（既定）       button.submit, #email, [data-id='42']
text=...         可視テキストの完全一致（前後空白をトリム）
xpath=...        XPath で一致
label=...        <label> または aria-label からフォーム部品を特定
```

解決の詳細:

- **CSS** — `document.querySelector(sel)`（最初の一致）。
- **`text=`** — `body *` を走査し、トリム済み `textContent` がテキストと完全一致する要素のうち
  **最も内側**（テキストを内包する最深の要素。包んでいる祖先ではない）を返す。完全一致のみ
  （部分一致なし）。
- **`xpath=`** — XPath 結果の最初のノード。
- **`label=`** — テキストが一致する `<label>` を探し、`for=`/`id` か内側の
  `input`/`textarea`/`select` で部品を特定。見つからなければ `aria-label` が一致する要素に
  フォールバック。

複数要素を返すのは `query_all` だけで、他のアクションは解決した単一要素に対して動く。`query_all`
では `xpath=` は一致した全ノード、CSS は `querySelectorAll` の全一致を返し、`text=` / `label=` は
最大 1 要素。

## 取得

```bash
osascript "$SCRIPT" get_text "$WID" "$TID" "h1"
```
JSON エンベロープを返す: `{"found": true, "value": "..."}` に要素の可視テキスト
（`innerText`、無ければ `textContent`）のトリム結果が入る。要素が無い場合は `{"found": false}`。
エンベロープ化により、可視テキストが文字どおり `not_found` の要素が以前 sentinel と衝突して
「不在」として扱われていた問題を解消する。

```bash
osascript "$SCRIPT" get_attribute "$WID" "$TID" "a.link" "href"
```
JSON エンベロープを返す: `{"found": true, "value": "..."}` に属性値が入る（属性自体が要素に
無ければ空文字）。要素が無い場合は `{"found": false}`。

```bash
osascript "$SCRIPT" get_value "$WID" "$TID" "#email"
```
JSON エンベロープを返す: `{"found": true, "value": "..."}` にフォームコントロールの値が
入る（値が設定されていなければ空文字）。要素が無い場合は `{"found": false}`。

```bash
osascript "$SCRIPT" exists "$WID" "$TID" ".banner"
```
`true` / `false` を返す（`not_found` は返さない。不在は `false`）。

```bash
osascript "$SCRIPT" query_all "$WID" "$TID" ".item"
```
一致する全要素のトリム済みテキストを JSON 配列文字列で返す（例 `["First","Second"]`）。空なら `[]`。

## 操作

```bash
osascript "$SCRIPT" click "$WID" "$TID" "button.submit"
```
要素を中央へスクロールしてから `.click()`。`true` / `not_found`。

```bash
osascript "$SCRIPT" fill "$WID" "$TID" "#email" "user@example.com"
```
input/textarea にフォーカスし、native value setter で値を設定してから `input`/`change` を発火。
native setter を通すことでフレームワーク（React/Vue 等）が変更を検知できる（素の `el.value = ...`
は検知されない）。`true` / `not_found`。

```bash
osascript "$SCRIPT" clear "$WID" "$TID" "#email"
```
空文字での `fill` 相当。フォーカスし native setter で `''` を設定し `input`/`change` を発火。
`true` / `not_found`。

```bash
osascript "$SCRIPT" select_option "$WID" "$TID" "select#country" "JP"
```
`<option>` を `value` で選択（無ければ可視テキストで照合）。native setter で値を設定し
`input`/`change` を発火。JSON エンベロープを返す: 成功時 `{"ok": true}`、select は見つかったが
一致する option が無い場合 `{"ok": false, "kind": "no_option"}`、select 自体が見つからない場合
`{"ok": false, "kind": "not_found"}`。

```bash
osascript "$SCRIPT" set_checked "$WID" "$TID" "#agree" true
```
チェックボックス/ラジオの checked 状態（`true`/`false`）を native setter で設定し `input`/`change`
を発火。`true` / `not_found`。

```bash
osascript "$SCRIPT" press_key "$WID" "$TID" "#search" "Enter"
```
要素にフォーカスし、合成 `keydown`/`keypress`/`keyup` を発火。名前付きキー: `Enter`, `Tab`,
`Escape`, `Backspace`, `Delete`, `ArrowUp`/`Down`/`Left`/`Right`, スペース。それ以外は 1 文字を
そのまま使う。`true` / `not_found`。注意: これらは `isTrusted=false` なので、信頼された入力を要求
するハンドラには無視されうる。またフィールドへの文字入力はしない（入力は `fill` を使う）。

```bash
osascript "$SCRIPT" submit "$WID" "$TID" "form#login"
```
要素が属するフォーム（要素自身が `<form>` ならそれ）を送信。`requestSubmit()` を使うので submit
ハンドラとバリデーションが走る（無ければ `submit()` にフォールバック）。JSON エンベロープを返す:
成功時 `{"ok": true}`、要素がフォームに属していない場合 `{"ok": false, "kind": "no_form"}`、
要素が見つからない場合 `{"ok": false, "kind": "not_found"}`。

```bash
osascript "$SCRIPT" scroll_into_view "$WID" "$TID" ".footer"
```
要素を中央表示になるようスクロール。`true` / `not_found`。

## 合成イベントの注意

ここの操作はすべて JavaScript 由来なので、イベントは `isTrusted=false`。bot/WAF 対策が厳しい
ページではこうしたイベントが無視されることがある。弾かれる場合は `execute_js` /
`execute_js_file` で独自ロジックにフォールバックする。OS レベルの実入力（`isTrusted=true`）は
意図的に提供していない。
