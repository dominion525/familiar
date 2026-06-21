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
- `wait_for_load` / `wait_for_selector` / `wait_for_function` — 読み込み・要素出現・JS 条件の待機
- `get_html` — 現在の DOM の HTML を取得
- `get_text` / `get_attribute` / `get_value` / `exists` / `query_all` — 要素のテキスト / 属性 / 値 / 存在 / 全一致を取得
- `click` / `fill` / `clear` / `select_option` / `set_checked` / `press_key` / `submit` / `scroll_into_view` — 要素・フォームの操作
- `execute_js` / `execute_js_file` — 任意 JavaScript の実行（複雑なものはファイル経由）

セレクタは CSS（既定）/ `text=` / `xpath=` / `label=` の形式に対応します。

## 前提条件

- macOS + Google Chrome
- Chrome の「Apple Event からの JavaScript の使用を許可」を有効化
  （表示 → 開発/管理 → Apple Event からの JavaScript の使用を許可）
- 初回実行時にオートメーションの許可を求められたら承認する

## インストール

### Claude Code プラグイン

```
/plugin marketplace add dominion525/familiar
/plugin install familiar@familiar
```

ローカルで開発・動作確認する場合:

```
/plugin marketplace add /path/to/familiar
/plugin install familiar@familiar
```

### Vercel Skills（agent-skills）

```
npx skills add dominion525/familiar
```

スキルが `~/.agents/skills/familiar/` に展開され、
[agent-skills spec](https://agentskills.io/specification) に準拠したクライアント
（Claude Code / Cursor など）が自動で読み込みます。レジストリは https://skills.sh。

### スタンドアロン（インストール不要）

スキルをインストールしなくても、スクリプト単体で実行できます:

```
osascript skills/familiar/familiar.applescript list_tabs
```

スキルの使い方の詳細は `skills/familiar/SKILL.ja.md`（日本語訳）を参照してください。

## ライセンス

MIT
