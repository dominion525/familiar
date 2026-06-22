# @dominion525/familiar-mcp

familiar 用 MCP server — macOS の本物の Google Chrome を AppleScript 経由で操作する。

> これは [README.md](README.md) の日本語訳です。差分が出た場合は英語版に従ってください。

これは [familiar](https://github.com/dominion525/familiar) の MCP server 版です。Claude Code 用の skill / plugin 版は同じリポの `skills/familiar/` にあり（`SKILL.md` で auto-activation）、どちらの経路も同じ `familiar.applescript` を呼ぶので挙動は同一。

## できること

MCP 対応クライアント（Claude Code / Claude Desktop / Cursor / Codex CLI など）が、AppleScript (Apple Events) 経由で macOS の本物の Google Chrome を駆動できる 32 tool を得る:

- **タブ / ウィンドウ** (7): `list_tabs`, `new_tab`, `new_incognito_tab`, `close_tab`, `active_tab`, `window_mode`, `is_loading`
- **ナビゲーション** (6): `navigate`, `get_tab_url`, `reload`, `go_back`, `go_forward`, `stop`
- **待機** (3): `wait_for_load`, `wait_for_selector`, `wait_for_function`
- **コンテンツ / スクリプティング** (3): `get_html`, `execute_js`, `execute_js_file`
- **読み取り** (5): `get_text`, `get_attribute`, `get_value`, `exists`, `query_all`
- **操作** (8): `click`, `fill`, `clear`, `select_option`, `set_checked`, `press_key`, `submit`, `scroll_into_view`

ユーザー本人がサインイン済みの Chrome を Apple Events 経由で動かす（新規 headless browser プロセスを起こすのではない）ため、ブラウザの fingerprint は Chrome が普段使っているものそのまま — headless browser を弾くサイトを操作するときに有用。ただし site 固有の access control はそのまま機能する。DevTools Protocol も Playwright も別ドライバも使わない。

tool ごとの signature・引数・戻り値の形・セレクタ戦略は repo 内の [`reference-browser.md`](https://github.com/dominion525/familiar/blob/main/skills/familiar/reference-browser.md)（制御系）と [`reference-actions.md`](https://github.com/dominion525/familiar/blob/main/skills/familiar/reference-actions.md)（要素操作）を参照。

## 前提条件

- macOS + Google Chrome
- Chrome の「Apple Event からの JavaScript の使用を許可」を有効化（表示 → 開発/管理 → Apple Event からの JavaScript の使用を許可）。これが無いと scripting / DOM 操作系 tool は失敗する
- 初回実行時にオートメーション権限を求められたら、操作元のターミナル/アプリに対して承認する

## インストール

この npm package は MCP client が起動するものです。client 自体の設定は次節。

### npx 経由（ローカルインストール不要）

`npx` が要求時に最新版を取得して実行する:

```
npx @dominion525/familiar-mcp@latest
```

これで server が起動し、stdin で JSON-RPC メッセージを待ち受ける状態になる（Ctrl+C で終了）。MCP client が自動で起動するので、通常は手動で叩く必要はない。

### ソースから

```
git clone https://github.com/dominion525/familiar
cd familiar/mcp
npm install
npm run build
```

server のエントリポイントは `mcp/dist/index.js`。

## MCP client の設定

以下の例はすべて `npx @dominion525/familiar-mcp@latest` を前提とします。ローカルビルドを使う場合は、`npx` / `@dominion525/familiar-mcp@latest` を `node /absolute/path/to/familiar/mcp/dist/index.js` に置き換えてください。

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

### その他の MCP client

その他の MCP 対応 client（Cline / Windsurf / Antigravity、VS Code 拡張 (GitHub Copilot Chat / Continue 等) など）は、上の Cursor / Claude Desktop の例と同じ JSON 形式で接続する。設定ファイルの場所は各 client の MCP 設定ドキュメントを参照。

## License

MIT
