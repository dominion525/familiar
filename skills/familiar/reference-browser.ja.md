# リファレンス: ブラウザ制御（日本語訳）

> [reference-browser.md](reference-browser.md) の日本語訳です。スキルローダーが読むのは
> 英語版だけで、このファイルは人間向けの参考訳です。

制御系アクション（タブ/ウィンドウ・ナビゲーション・待機・コンテンツ/スクリプト）の詳細仕様。
要素操作（click/fill・取得・セレクタ）は [reference-actions.ja.md](reference-actions.ja.md)、
概要は [SKILL.ja.md](SKILL.ja.md) を参照。

実行形式: `osascript "$SCRIPT" ACTION [ARGS...]`
（`$SCRIPT` は `familiar.applescript` のフルパス。Claude Code プラグイン / Vercel Skills 配下の
代表的な配置は [SKILL.ja.md](SKILL.ja.md) 「スクリプトの場所」を参照）

タブ単位のアクションはすべて `WID TID`（windowId, tabId）を取ります。ネイティブ系は
「Apple Event からの JavaScript の使用を許可」が無効でも動きますが、JS 系には有効化が必要です。

## タブ / ウィンドウ

```bash
osascript "$SCRIPT" list_tabs
```
全ウィンドウの全タブを `windowId,tabId,title,url` の形式で 1 行ずつ出力。ネイティブ。

```bash
osascript "$SCRIPT" new_tab
```
最前面の**通常**ウィンドウ（無ければ新規作成）にタブを開き `windowId,tabId` を出力。Chrome が
起動していなければ起動する。ウィンドウを新規作成する場合は初期タブを使い回すため、空タブを残さない。

```bash
osascript "$SCRIPT" new_incognito_tab
```
`new_tab` と同じだが**シークレット**ウィンドウが対象。シークレットの Cookie は空から始まり、
ウィンドウを閉じると消える。`windowId,tabId` を出力。

```bash
osascript "$SCRIPT" close_tab "$WID" "$TID"
```
タブを閉じる。戻り値なし。

```bash
osascript "$SCRIPT" active_tab "$WID"
```
ウィンドウのアクティブタブを `windowId,tabId` で出力。ネイティブ。

```bash
osascript "$SCRIPT" window_mode "$WID"
```
ウィンドウのモード `normal` / `incognito` を出力。ネイティブ。

```bash
osascript "$SCRIPT" is_loading "$WID" "$TID"
```
タブが読み込み中かを `true` / `false` で出力。ネイティブ（JS 不要）。`document.readyState` を
ポーリングする `wait_for_load` とは別物。

## ナビゲーション

```bash
osascript "$SCRIPT" navigate "$WID" "$TID" "https://example.com"
```
タブの URL を設定し、ナビゲーションが*始まる*まで短時間（最大約 3 秒、`document.readyState` が
`complete` から外れるまで）待つ。読み込み完了は待た**ない** — 続けて `wait_for_load` や
`wait_for_selector` を使うこと。戻り値なし。

```bash
osascript "$SCRIPT" get_tab_url "$WID" "$TID"
```
タブの現在 URL を出力。ネイティブ。

```bash
osascript "$SCRIPT" reload "$WID" "$TID"
osascript "$SCRIPT" go_back "$WID" "$TID"
osascript "$SCRIPT" go_forward "$WID" "$TID"
osascript "$SCRIPT" stop "$WID" "$TID"
```
履歴・リロード操作。ネイティブ。戻り値なし。`go_back` / `go_forward` はその方向に履歴が無ければ
何もしない。

## 待機

スクリプトは固定の sleep を持たず、ペース配分は呼び出し側が行う。明示的に待つにはこれらを使う。

```bash
osascript "$SCRIPT" wait_for_load "$WID" "$TID" 60
```
`document.readyState` を 0.5 秒ごと・最大 `MAX_WAIT` 秒ポーリング。`complete` / `timeout` を返す。

```bash
osascript "$SCRIPT" wait_for_selector "$WID" "$TID" "a.some-class" 30
```
CSS セレクタが一致するまで最大 `MAX_WAIT` 秒ポーリング。`found` / `timeout` を返す。セレクタ内の
クォート/バックスラッシュは内部でエスケープするので `[data-x='y']` も安全。これは **CSS セレクタ
専用**（`text=` / `xpath=` / `label=` は使えない）。

```bash
osascript "$SCRIPT" wait_for_function "$WID" "$TID" "window.__ready === true" 30
```
任意の JavaScript 式が truthy になるまで最大 `MAX_WAIT` 秒ポーリング。`true` / `timeout` を返す。
式は `Boolean(...)` として評価され、例外は false 扱い（未定義プロパティの参照も安全）。文ではなく
式を渡すこと。

## コンテンツ / スクリプト

```bash
osascript "$SCRIPT" get_html "$WID" "$TID"
```
現在の DOM を `document.documentElement.outerHTML` で返す。遅延描画や Shadow DOM は、セレクタを
待つか JS で実体化してから取得する。

```bash
osascript "$SCRIPT" execute_js "$WID" "$TID" "document.title"
```
インラインで渡した JavaScript 式を実行し、値をテキストで返す。JS をシェル引数として渡すため
クォート/`$`/バックスラッシュがシェルと AppleScript のエスケープを通り抜ける必要があり、短い式
専用。

```bash
osascript "$SCRIPT" execute_js_file "$WID" "$TID" /tmp/snippet.js
```
ファイル（UTF-8）から JavaScript を読み込んで実行。シェル/AppleScript のエスケープを完全に回避
できるので、クォート・複数行・特殊文字を含むものはこちらを使う。

### 完了値（重要）

`execute javascript` は**最後に評価した式の値**（completion value、DevTools コンソールと同じ）を
返す。末尾を式で終えること（複数文でも可）。トップレベルの素の `return` は機能せず
`missing value` になるので、末尾は `return` を付けず式のまま置く。

```bash
cat > /tmp/snippet.js <<'EOF'
const items = [...document.querySelectorAll('.product[data-id]')];
JSON.stringify(items.map(el => el.dataset.id))
EOF
osascript "$SCRIPT" execute_js_file "$WID" "$TID" /tmp/snippet.js
```
