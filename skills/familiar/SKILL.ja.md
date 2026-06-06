# familiar — AppleScript で macOS の Chrome を操作する（日本語暫定訳）

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
- 各 wait アクションに必要な分以外、**sleep やリトライは持ちません**。ナビゲーションの
  ペース配分や追加の待機は呼び出し側で制御してください。

## アクション

実行形式: `osascript "$CLAUDE_PLUGIN_ROOT/skills/familiar/familiar.applescript" ACTION [ARGS...]`

タブ管理:

```bash
# 全タブを windowId,tabId,title,url の形式で1行ずつ出力
osascript "$SCRIPT" list_tabs

# 通常ウィンドウにタブを開く（最前面の通常ウィンドウに追加、無ければ作成）。"windowId,tabId" を出力
osascript "$SCRIPT" new_tab

# シークレットウィンドウにタブを開く（あれば再利用、なければ作成）。"windowId,tabId" を出力
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
# 生 HTML（document.documentElement.outerHTML）
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

`execute_js` は JavaScript をシェル引数として渡すため、クォート・`$`・バックスラッシュ・
改行がシェルと AppleScript の両方のエスケープを通り抜ける必要があります。短く単純な式
（`document.title`、`location.href`、単一の `querySelector(...).innerText` 等）に限って
使ってください。

クォート・複数行・特殊文字を含むものは、**先に JS をファイルへ書き出して
`execute_js_file` を使う**とエスケープを完全に回避できます:

```bash
cat > /tmp/snippet.js <<'EOF'
const items = [...document.querySelectorAll('.product[data-id]')];
JSON.stringify(items.map(el => el.dataset.id))
EOF
osascript "$SCRIPT" execute_js_file "$WID" "$TID" /tmp/snippet.js
```

`execute javascript` は**最後に評価した式の値**を返します（DevTools コンソールと
同じ completion value の挙動）。結果が欲しいときはスクリプトの末尾を式で終えて
ください。複数文でも問題ありません。トップレベルに素の `return` を書くと機能せず
`missing value` になるので、末尾は `return` を付けずに式のまま置きます。

JS をプログラムで生成する場合は、長いインライン文字列を組み立てるのではなく、エディタ
ツール（シェルエスケープ不要）でファイルに書き出してください。

`wait_for_selector` はセレクタ内のシングルクォート/バックスラッシュを内部でエスケープ
するので、`[data-x='y']` のような属性セレクタも安全に渡せます。

## 通常タブとシークレットタブ

`new_tab` は通常（非シークレット）ウィンドウにタブを開きます。最前面の通常ウィンドウに
追加し、無ければ新規の通常ウィンドウを作成します。`new_incognito_tab` はシークレット
ウィンドウを対象にし、既存があれば再利用、無ければ作成します（シークレットの Cookie は
空から始まり、ウィンドウを閉じると消えます）。どちらのアクションも新規ウィンドウを作る
場合はその初期タブを使い回すため、空タブが残りません。Chrome が起動していなければ自動的に
起動します。

## 注意

- 用途が終わったら、ユーザーのためにタブを残す意図がない限り `new_tab` と `close_tab` を
  必ず対で使ってください。
- `get_html` は現在の DOM を返します。読み込み後にレンダリングされる内容（遅延描画や
  Shadow DOM）は、先にセレクタを待つか、JS で実体化してから取得してください。
