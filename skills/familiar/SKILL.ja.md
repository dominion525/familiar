# familiar — AppleScript で macOS の Chrome を操作する（日本語訳）

> これは [SKILL.md](SKILL.md) の日本語訳です。Claude Code のスキルローダーが読むのは
> 英語の `SKILL.md` だけで、このファイルは参照されません（人間向けの参考訳）。

macOS 上の本物の Google Chrome を AppleScript (Apple Events) 経由で操作します。
DevTools Protocol も Playwright も別ドライバも使わず、ユーザーが普段づかいしている
ブラウザをそのまま操作するため、headless/自動化ブラウザを弾くページでも通常のユーザーと
して扱われやすいです。

スクリプトはこのファイルと同じ場所
`${CLAUDE_PLUGIN_ROOT}/skills/familiar/familiar.applescript` にあります。
`osascript` で呼び出します。

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
  ときは明示的な待機アクション（`wait_for_load` / `wait_for_selector`）を使い、追加の遅延は
  呼び出し側で入れてください。

## アクション

実行形式: `osascript "$CLAUDE_PLUGIN_ROOT/skills/familiar/familiar.applescript" ACTION [ARGS...]`

タブ管理:

```bash
# 全タブを windowId,tabId,title,url の形式で1行ずつ出力
osascript "$SCRIPT" list_tabs

# 通常ウィンドウにタブを開く（最前面の通常ウィンドウ、無ければ新規）。"windowId,tabId" を出力
osascript "$SCRIPT" new_tab

# シークレットウィンドウにタブを開く（あれば再利用、なければ作成）。
# シークレットの Cookie は空から始まり、ウィンドウを閉じると消えます。"windowId,tabId" を出力
osascript "$SCRIPT" new_incognito_tab

# タブを閉じる
osascript "$SCRIPT" close_tab "$WID" "$TID"

# ウィンドウのアクティブタブを "windowId,tabId" で取得
osascript "$SCRIPT" active_tab "$WID"

# ウィンドウのモード（normal / incognito）を取得
osascript "$SCRIPT" window_mode "$WID"

# タブが読み込み中か。"true"|"false" を返す（ネイティブ、JS 不要）
osascript "$SCRIPT" is_loading "$WID" "$TID"
```

`new_tab` / `new_incognito_tab` は Chrome が起動していなければ自動的に起動し、新規ウィンドウを
作る場合はその初期タブを使い回すため、空タブを残しません。

ナビゲーション:

```bash
osascript "$SCRIPT" navigate "$WID" "$TID" "https://example.com"
osascript "$SCRIPT" get_tab_url "$WID" "$TID"

# 履歴・リロード操作（戻り値なし）
osascript "$SCRIPT" reload "$WID" "$TID"
osascript "$SCRIPT" go_back "$WID" "$TID"
osascript "$SCRIPT" go_forward "$WID" "$TID"
osascript "$SCRIPT" stop "$WID" "$TID"
```

待機:

```bash
# document.readyState == "complete" まで待つ（最大60秒）。"complete"|"timeout" を返す
osascript "$SCRIPT" wait_for_load "$WID" "$TID"

# CSS セレクタが一致するまで待つ（最大待機秒数を指定）。"found"|"timeout" を返す
osascript "$SCRIPT" wait_for_selector "$WID" "$TID" "a.some-class" 30
```

コンテンツ取得 / スクリプト実行:

```bash
# 現在の DOM の生 HTML。遅延描画や Shadow DOM はセレクタを待つか JS で実体化してから取得
osascript "$SCRIPT" get_html "$WID" "$TID"

# 短い JavaScript 式をインラインで実行。結果はテキストで返る
osascript "$SCRIPT" execute_js "$WID" "$TID" "document.title"

# ファイルから読み込んだ JavaScript を実行（下記「複雑な JavaScript」を参照）
osascript "$SCRIPT" execute_js_file "$WID" "$TID" /tmp/snippet.js
```

## 典型的な流れ

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

## 複雑な JavaScript — execute_js_file を使う

`execute_js` は JavaScript をシェル引数として渡すため、クォート・`$`・バックスラッシュが
シェルと AppleScript のエスケープを通り抜ける必要があります。短い式（`document.title`、
`location.href` 等）に限って使ってください。クォート・複数行・特殊文字を含むものは、JS を
ファイルへ書き出して `execute_js_file` を使うとエスケープを完全に回避できます:

```bash
cat > /tmp/snippet.js <<'EOF'
const items = [...document.querySelectorAll('.product[data-id]')];
JSON.stringify(items.map(el => el.dataset.id))
EOF
osascript "$SCRIPT" execute_js_file "$WID" "$TID" /tmp/snippet.js
```

`execute javascript` は**最後に評価した式の値**（completion value、DevTools コンソールと
同じ）を返します。結果が欲しいときは末尾を式で終えてください。複数文でも問題ありません。
トップレベルの素の `return` は機能せず `missing value` になるので、末尾は `return` を付けずに
式のまま置きます。

`wait_for_selector` はセレクタ内のシングルクォート/バックスラッシュを内部でエスケープする
ので、`[data-x='y']` のような属性セレクタも安全に渡せます。

## 注意

- 用途が終わったら、ユーザーのためにタブを残す意図がない限り `new_tab` / `new_incognito_tab` を
  `close_tab` と対で使ってください。
