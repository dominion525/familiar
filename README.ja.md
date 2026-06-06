# familiar
macOS の本物の Chrome を AppleScript で操作する — DevTools Protocol も Playwright も不要。

macOS 上の Google Chrome を AppleScript (Apple Events) 経由で操作する Claude Code
スキルです。headless ブラウザではなく普段づかいの本物の Chrome をそのまま動かすため、
bot/WAF 対策のあるページでも通常のユーザーとして扱われやすいのが特徴です。

English version: [README.md](README.md)

## できること

タブ単位 (windowId + tabId) で操作します。「アクティブタブ」には依存しません。

- `list_tabs` / `new_tab` / `new_incognito_tab` / `close_tab` — タブ管理（new_tab は通常ウィンドウ、new_incognito_tab はシークレット）
- `active_tab` / `window_mode` / `is_loading` — アクティブタブ / ウィンドウモード / 読み込み状態を取得
- `navigate` / `get_tab_url` — ナビゲーション
- `reload` / `go_back` / `go_forward` / `stop` — 履歴・リロード操作
- `wait_for_load` / `wait_for_selector` — 読み込み・要素出現の待機
- `get_html` — 現在の DOM の HTML を取得
- `execute_js` / `execute_js_file` — 任意 JavaScript の実行（複雑なものはファイル経由）

## 前提条件

- macOS + Google Chrome
- Chrome の「Apple Event からの JavaScript の使用を許可」を有効化
  （表示 → 開発/管理 → Apple Event からの JavaScript の使用を許可）
- 初回実行時にオートメーションの許可を求められたら承認する

## インストール（Claude Code プラグインとして）

```
/plugin marketplace add dominion525/familiar
/plugin install familiar@familiar
```

ローカルで開発・動作確認する場合:

```
/plugin marketplace add /path/to/familiar
/plugin install familiar@familiar
```

プラグインをインストールしなくても、スクリプト単体で実行できます:

```
osascript skills/familiar/familiar.applescript list_tabs
```

スキルの使い方の詳細は `skills/familiar/SKILL.ja.md`（日本語訳）を参照してください。

## 出自

このスキルは `aleister` リポジトリの phantasm（WAF 回避 HTML 収集 CLI）で使っていた
ブラウザ制御部分を、汎用的に使えるよう分離・独立させたものです。Docker 内からホストの
Chrome を叩くための portal（Named Pipe 中継）や Ruby ラッパーは、ホスト直実行では
不要なため持ち込んでいません。

## ライセンス

MIT
