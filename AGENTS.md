# familiar — エージェント向けガイド

このリポジトリで作業する AI コーディングエージェント向けのガイドです。人間向けの概要は
[README.md](README.md) / [README.ja.md](README.ja.md) を参照してください。

## プロジェクト概要

macOS 上の本物の Google Chrome を AppleScript (Apple Events) 経由で操作する Claude Code
スキル / プラグインです。DevTools Protocol も Playwright も別ドライバも使わず、ユーザーが
普段づかいしている Chrome をそのまま操作します。狙いは、headless / 自動化ブラウザを弾く
bot / WAF 対策のあるページでも、通常のユーザーとして扱われやすくすることです。

## リポジトリ構成

- `skills/familiar/familiar.applescript` … スクリプト本体（操作のコア）
- `skills/familiar/SKILL.md` … スキル定義。スキルローダーが読む英語の本体（自動発動のトリガー）
- `skills/familiar/SKILL.ja.md` … 日本語の参考訳（ローダーは読まない）
- `.claude-plugin/plugin.json` … プラグイン manifest
- `.claude-plugin/marketplace.json` … マーケットプレイス定義
- `README.md` / `README.ja.md` … 英語 / 日本語の README

## 開発・検証

- AppleScript はコンパイル不要。`osascript` でテキストのまま直接実行する。
- 構文チェックは `osacompile -o /dev/null skills/familiar/familiar.applescript` で行う
  （実行はせず構文だけ確認できる）。
- 実際の動作確認には実 Chrome が必要で、CI では回せない。
- 前提として、Chrome の「Apple Event からの JavaScript の使用を許可」を有効化し、初回実行時の
  オートメーション権限を承認しておく必要がある。
- スクリプトの呼び出し形式は
  `osascript skills/familiar/familiar.applescript ACTION [ARGS...]`。

## 規約

- ドキュメントの言語方針: `SKILL.md` / `README.md` は英語、日本語版は `*.ja.md` とする。
- コミットメッセージは日本語で書く。

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
