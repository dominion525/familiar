# familiar — エージェント向けガイド

> これは参考訳です。正は英語版の [AGENTS.md](AGENTS.md)。差分が出た場合は英語版に従ってください。

このリポジトリで作業する AI コーディングエージェント向けのガイドです。人間向けの概要は
[README.md](README.md) / [README.ja.md](README.ja.md) を参照してください。

## プロジェクト概要

macOS 上の本物の Google Chrome を AppleScript (Apple Events) 経由で操作する Claude Code
スキル / プラグインです。DevTools Protocol も Playwright も別ドライバも使わず、ユーザーが
普段づかいしている Chrome をそのまま操作します。狙いは、headless / 自動化ブラウザを弾く
bot / WAF 対策のあるページでも、通常のユーザーとして扱われやすくすることです。

## リポジトリ構成

- `skills/familiar/familiar.applescript` … スクリプト本体（操作のコア）
- `skills/familiar/SKILL.md` … スキル定義。スキルローダーが読む英語の本体（自動発動のトリガー）。
  薄い索引として保ち、詳細は reference に逃がす（段階的開示）
- `skills/familiar/SKILL.ja.md` … 日本語の参考訳（ローダーは読まない）
- `skills/familiar/reference-browser.md` / `reference-browser.ja.md` … 制御系（タブ/ウィンドウ・
  ナビゲーション・待機・コンテンツ/スクリプト）の詳細仕様
- `skills/familiar/reference-actions.md` / `reference-actions.ja.md` … 取得系・操作系の詳細仕様 +
  セレクタ戦略（CSS / `text=` / `xpath=` / `label=`）
- `.claude-plugin/plugin.json` … プラグイン manifest
- `.claude-plugin/marketplace.json` … マーケットプレイス定義
- `README.md` / `README.ja.md` … 英語 / 日本語の README
- `AGENTS.md` / `AGENTS.ja.md` … 英語 / 日本語のエージェント向けガイド

## 開発・検証

- AppleScript はコンパイル不要。`osascript` でテキストのまま直接実行する。
- 構文チェックは `osacompile -o /dev/null skills/familiar/familiar.applescript` で行う
  （実行はせず構文だけ確認できる）。
- 実際の動作確認には実 Chrome が必要で、CI では回せない。
- 前提として、Chrome の「Apple Event からの JavaScript の使用を許可」を有効化し、初回実行時の
  オートメーション権限を承認しておく必要がある。
- スクリプトの呼び出し形式は
  `osascript skills/familiar/familiar.applescript ACTION [ARGS...]`。
- MCP server (`mcp/`) を開発する際は、`cd mcp && npm install` の後、リポルートで
  `npx lefthook install` を一度実行して pre-commit hook を設置する。hook は staged
  された `mcp/` 配下のファイルに対して Biome / tsc / Vitest を並列で走らせる。
- Smoke test の注意: `data:` URL で配信するページは、Chrome の data URL セキュリティ制限により
  inline `<script>` ブロックと inline event handler 属性 (`onclick="..."`) を実行**しない**。
  data URL に対して `click` や `set_checked` 等の動作を検証するときは、action 自身が書く
  DOM state (例: `document.getElementById('check-1').checked`) を assert すること。実行されない
  inline JS の副作用に頼らない。inline script の実行が必要なら、ローカルファイル (`file://`) や
  ローカル http server から配信する。

## 規約

- ドキュメントの言語方針: `SKILL.md` / `README.md` / `AGENTS.md` は英語、日本語版は `*.ja.md`
  とする。英語版が正、`*.ja.md` は参考訳として同期する。
- PR のタイトル・本文・コミットメッセージは英語で書く。

## 既知のハマりどころ

- `execute_js` / `execute_js_file` は最後に評価した式の値（completion value）を返す。結果が
  欲しいときは末尾を式で終える（複数文でも可）。トップレベルの `return` は機能せず
  `missing value` になるので使わない。
- すべての操作は windowId + tabId（`WID TID`）で対象タブを指定する。「アクティブタブ」には
  依存しない設計。
- `new_tab` は通常ウィンドウにタブを開く（最前面の通常ウィンドウに追加、無ければ新規作成）。
  シークレットは `new_incognito_tab` に分離。どちらも新規ウィンドウ作成時は初期タブを使い回し、
  空タブを残さない。
- 複数の Chrome を同時に起動していると、対象ウィンドウの取り違えや競合で不可解なエラーが起きることがある。
