# familiar — AppleScript で macOS の Chrome を操作する（日本語訳）

> これは [SKILL.md](SKILL.md) の日本語訳です。Claude Code のスキルローダーが読むのは
> 英語の `SKILL.md` だけで、このファイルは参照されません（人間向けの参考訳）。

macOS 上の本物の Google Chrome を AppleScript (Apple Events) 経由で操作します。
DevTools Protocol も Playwright も別ドライバも使わず、ユーザーが普段づかいしている
ブラウザをそのまま操作するため、headless/自動化ブラウザを弾くページでも通常のユーザーと
して扱われやすいです。

## スクリプトの場所

このスキルは `SKILL.md` と同じ場所に `familiar.applescript` を同梱します。`osascript`
にフルパスを渡して呼び出します。以下の例ではそのフルパスを `$SCRIPT` に格納している
前提です。代表的な配置:

- Claude Code プラグイン: `${CLAUDE_PLUGIN_ROOT}/skills/familiar/familiar.applescript`
- Vercel Skills（`npx skills add`）: 通常は `$HOME/.agents/skills/familiar/familiar.applescript`

## 前提条件

- macOS + Google Chrome
- Chrome の「Apple Event からの JavaScript の使用を許可」を有効化
  （表示 → 開発/管理 → Apple Event からの JavaScript の使用を許可）
- 初回実行時にオートメーション権限を求められたら、操作元のターミナル/アプリに対して承認する
  （システム設定 → プライバシーとセキュリティ → オートメーション）

## 基本モデル

- すべての操作は **windowId + tabId**（`WID TID`）で特定のタブを対象にします。
  「アクティブタブ」に依存しないため、ユーザーが他のタブで作業中でも安全に実行できます。
- 操作前にフロントのアプリを保存し、操作後にフォーカスを復元します。
- ペース配分は呼び出し側が行います。スクリプトは固定の sleep を持ちません。待機が必要な
  ときは明示的な待機アクション（`wait_for_load` / `wait_for_selector` / `wait_for_function`）を使います。
- アクションは結果を**テキスト**で返します（終了ステータスではない）。要素アクションは
  セレクタが一致しないとき例外を投げず `not_found` を返します。

## アクション

実行形式: `osascript "$SCRIPT" ACTION [ARGS...]`（`$SCRIPT` は上の「スクリプトの場所」で示したフルパス）

制御系 — 詳細は [reference-browser.ja.md](reference-browser.ja.md):

```
list_tabs                          全タブを windowId,tabId,title,url で列挙
new_tab                            通常ウィンドウにタブを開く → "windowId,tabId"
new_incognito_tab                  シークレットウィンドウにタブを開く → "windowId,tabId"
close_tab WID TID                  タブを閉じる
active_tab WID                     ウィンドウのアクティブタブ → "windowId,tabId"
window_mode WID                    "normal" | "incognito"
is_loading WID TID                 "true" | "false"（ネイティブ、JS 不要）
navigate WID TID URL               タブの URL を設定（ナビ開始までしか待たない）
get_tab_url WID TID                タブの現在 URL
reload / go_back / go_forward / stop  WID TID    履歴・リロード操作
wait_for_load WID TID              readyState を最大 60 秒待つ → "complete" | "timeout"
wait_for_selector WID TID SEL N    CSS セレクタを最大 N 秒待つ → "found" | "timeout"
wait_for_function WID TID EXPR N   JS 式を最大 N 秒待つ → "true" | "timeout"
get_html WID TID                   現在の DOM を outerHTML で取得
execute_js WID TID EXPR            インライン JS 式を実行 → その値
execute_js_file WID TID PATH       ファイルの JS を実行 → その値
```

操作系 — 詳細とセレクタ戦略は [reference-actions.ja.md](reference-actions.ja.md):

```
get_text WID TID SEL               要素のトリム済みテキスト → text | "not_found"
get_attribute WID TID SEL NAME     属性値（無ければ ""）| "not_found"
get_value WID TID SEL              input/textarea/select の値 | "not_found"
exists WID TID SEL                 "true" | "false"
query_all WID TID SEL              全一致のトリム済みテキストの JSON 配列
click WID TID SEL                  中央へスクロール + クリック → "true" | "not_found"
fill WID TID SEL VALUE             input に値を設定（FW が検知）→ "true" | "not_found"
clear WID TID SEL                  input を空にする → "true" | "not_found"
select_option WID TID SEL VALUE    <option> を value/text で選択 → "true" | "no_option" | "not_found"
set_checked WID TID SEL BOOL       チェックの ON/OFF → "true" | "not_found"
press_key WID TID SEL KEY          合成 keydown/press/up → "true" | "not_found"
submit WID TID SEL                 要素のフォームを送信 → "true" | "no_form" | "not_found"
scroll_into_view WID TID SEL       要素を中央表示 → "true" | "not_found"
```

`new_tab` / `new_incognito_tab` は Chrome が起動していなければ起動し、新規ウィンドウを作る場合は
初期タブを使い回すため空タブを残しません。用が済んだら、タブを残す意図がない限り `close_tab` と
対で使ってください。

## セレクタ

`SEL` 引数は以下のいずれかの形式を取ります（接頭辞なし = CSS）:

```
CSS（既定）       button.submit, #email, [data-id='42']
text=...         可視テキストの完全一致
xpath=...        XPath で一致
label=...        <label> または aria-label からフォーム部品を特定
```

`wait_for_selector` だけは例外で **CSS セレクタ専用**です。解決の詳細（`text=` は最も内側の完全
一致を返す、等）は [reference-actions.ja.md](reference-actions.ja.md) を参照してください。

## 例

ページを開いて読む:

```bash
# 環境に応じてどちらかを使う:
SCRIPT="$CLAUDE_PLUGIN_ROOT/skills/familiar/familiar.applescript"    # Claude Code プラグイン
# SCRIPT="$HOME/.agents/skills/familiar/familiar.applescript"        # Vercel Skills（npx skills add）

result=$(osascript "$SCRIPT" new_tab)
WID=$(echo "$result" | cut -d',' -f1)
TID=$(echo "$result" | cut -d',' -f2)

osascript "$SCRIPT" navigate "$WID" "$TID" "https://example.com"
osascript "$SCRIPT" wait_for_load "$WID" "$TID"
osascript "$SCRIPT" get_html "$WID" "$TID" > page.html

osascript "$SCRIPT" close_tab "$WID" "$TID"
```

フォームを入力・送信して結果を読む:

```bash
osascript "$SCRIPT" wait_for_selector "$WID" "$TID" "form#login" 30
osascript "$SCRIPT" fill "$WID" "$TID" "#email" "user@example.com"
osascript "$SCRIPT" fill "$WID" "$TID" "#password" "secret"
osascript "$SCRIPT" set_checked "$WID" "$TID" "#remember" true
osascript "$SCRIPT" click "$WID" "$TID" "text=Sign in"

osascript "$SCRIPT" wait_for_selector "$WID" "$TID" ".welcome" 30
osascript "$SCRIPT" get_text "$WID" "$TID" ".welcome"
```

## 複雑な JavaScript — execute_js_file を使う

`execute_js` は JavaScript をシェル引数として渡すため、クォート・`$`・バックスラッシュがシェルと
AppleScript のエスケープを通り抜ける必要があります。短い式に限って使ってください。クォート・
複数行・特殊文字を含むものは、JS をファイルへ書き出して `execute_js_file` を使います:

```bash
cat > /tmp/snippet.js <<'EOF'
const items = [...document.querySelectorAll('.product[data-id]')];
JSON.stringify(items.map(el => el.dataset.id))
EOF
osascript "$SCRIPT" execute_js_file "$WID" "$TID" /tmp/snippet.js
```

`execute javascript` は**最後に評価した式の値**（completion value、DevTools コンソールと同じ）を
返します。末尾を式で終えてください（複数文でも可）。トップレベルの素の `return` は機能せず
`missing value` になるので、末尾は `return` を付けず式のまま置きます。詳しくは
[reference-browser.ja.md](reference-browser.ja.md) を参照してください。
