# @dominion525/familiar-mcp

familiar 用 MCP server — macOS の本物の Google Chrome を AppleScript 経由で操作する。

> これは [mcp/README.md](README.md) の日本語訳です。差分が出た場合は英語版に従ってください。

これは [familiar](https://github.com/dominion525/familiar) の MCP server 版です。
Claude Code 用の skill / plugin 版は同じリポの `skills/familiar/` にあり、
どちらの経路も同じ `familiar.applescript` を呼びます。

## できること

MCP 対応クライアント（Claude Code / Claude Desktop / Cursor / Codex CLI など）が、AppleScript (Apple Events) 経由で macOS の本物の Google Chrome を駆動できる 32 tool を得る:

- **タブ / ウィンドウ** (7): `list_tabs`, `new_tab`, `new_incognito_tab`, `close_tab`, `active_tab`, `window_mode`, `is_loading`
- **ナビゲーション** (6): `navigate`, `get_tab_url`, `reload`, `go_back`, `go_forward`, `stop`
- **待機** (3): `wait_for_load`, `wait_for_selector`, `wait_for_function`
- **コンテンツ / スクリプティング** (3): `get_html`, `execute_js`, `execute_js_file`
- **読み取り** (5): `get_text`, `get_attribute`, `get_value`, `exists`, `query_all`
- **操作** (8): `click`, `fill`, `clear`, `select_option`, `set_checked`, `press_key`, `submit`, `scroll_into_view`

ユーザー本人がサインイン済みの本物の Chrome を操作する（新規 headless browser ではない）ため、headless / 自動化ブラウザを弾く bot / WAF 対策のあるページでも、通常のユーザーとして扱われやすい。DevTools Protocol も Playwright も別ドライバも使わない。

## 前提条件

- macOS + Google Chrome
- Chrome の「Apple Event からの JavaScript の使用を許可」を有効化
  （表示 → 開発/管理 → Apple Event からの JavaScript の使用を許可）
- 初回実行時にオートメーション権限を求められたら、操作元のターミナル/アプリに対して承認する

## インストール

### npx 経由（推奨）

```
npx @dominion525/familiar-mcp@latest
```

### ソースから

```
git clone https://github.com/dominion525/familiar
cd familiar/mcp
npm install
npm run build
```

server のエントリポイントは `mcp/dist/index.js`。

## MCP client の設定

以下の例はすべて `npx @dominion525/familiar-mcp@latest` を前提とします。ローカルビルドを使う場合は、
`npx` / `@dominion525/familiar-mcp@latest` を `node /absolute/path/to/familiar/mcp/dist/index.js`
に置き換えてください。

### Claude Code

```
claude mcp add familiar -- npx @dominion525/familiar-mcp@latest
```

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` を編集:

```json
{
  "mcpServers": {
    "familiar": {
      "command": "npx",
      "args": ["@dominion525/familiar-mcp@latest"]
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json` を編集:

```json
{
  "mcpServers": {
    "familiar": {
      "command": "npx",
      "args": ["@dominion525/familiar-mcp@latest"]
    }
  }
}
```

### Codex CLI

`~/.codex/config.toml` を編集:

```toml
[mcp_servers.familiar]
command = "npx"
args = ["@dominion525/familiar-mcp@latest"]
```

### Cline / Windsurf / Antigravity

それぞれのツールが MCP 設定パネルを持っており、上の Cursor 例と同じ JSON 形式を受け付けます。

### VS Code（GitHub Copilot Chat / Continue ほか）

各拡張機能が独自の MCP 設定を持つので、拡張機能のドキュメントを参照してください。

## Claude Code skill との関係

`skills/familiar/` は同じ 32 actions を Claude Code plugin として提供し（`SKILL.md` の
description で auto-activation）、この MCP server は同じ actions を任意の MCP 対応 client
から利用できるようにします。両者とも同じ `familiar.applescript` を呼び出すので、挙動は
同一です。

## License

MIT
