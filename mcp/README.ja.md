# @dominion525/familiar-mcp

[![npm version](https://img.shields.io/npm/v/@dominion525/familiar-mcp)](https://www.npmjs.com/package/@dominion525/familiar-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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

<details>
<summary><b>ソースから</b></summary>

```
git clone https://github.com/dominion525/familiar
cd familiar/mcp
npm install
npm run build
```

server のエントリポイントは `mcp/dist/index.js`。

</details>

## MCP client の設定

以下の例はすべて `npx @dominion525/familiar-mcp@latest` を前提とします。ローカルビルドを使う場合は、`npx` / `@dominion525/familiar-mcp@latest` を `node /absolute/path/to/familiar/mcp/dist/index.js` に置き換えてください。

<details>
<summary><b>Claude Code</b></summary>

```
claude mcp add familiar -- npx @dominion525/familiar-mcp@latest
```

</details>

<details>
<summary><b>Claude Desktop</b></summary>

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

</details>

<details>
<summary><b>Cursor</b></summary>

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

</details>

<details>
<summary><b>Codex CLI</b></summary>

`~/.codex/config.toml` を編集:

```toml
[mcp_servers.familiar]
command = "npx"
args = ["@dominion525/familiar-mcp@latest"]
```

</details>

<details>
<summary><b>その他の MCP client</b></summary>

その他の MCP 対応 client（Cline / Windsurf / Antigravity、VS Code 拡張 (GitHub Copilot Chat / Continue 等) など）は、上の Cursor / Claude Desktop の例と同じ JSON 形式で接続する。設定ファイルの場所は各 client の MCP 設定ドキュメントを参照。

</details>

## macOS 権限

AppleScript-backed なツール群が Chrome と話せるようにするため、最初に一度だけ 2 つの権限設定が必要:

| 権限 | 設定場所 | 用途 |
|---|---|---|
| Apple Event からの JavaScript の使用を許可 | Chrome → 表示 → 開発/管理 → Apple Event からの JavaScript の使用を許可 | ページ内で JavaScript を走らせる tool すべてに必要（タブ / ウィンドウの一覧取得系を除く） |
| オートメーション → Google Chrome | システム設定 → プライバシーとセキュリティ → オートメーション → (MCP server を起動するアプリ) → Google Chrome | `osascript` が初めて Chrome に話しかけるときに macOS が確認する。**macOS はオートメーション権限を親プロセスに付与する** ので、`familiar-mcp` ではなく MCP client を実際に起動するアプリ（通常は Terminal / VS Code / Cursor / Claude Desktop）に対して承認する |

OS の権限確認ダイアログが自動で出ない場合は、MCP server を起動するのと同じターミナルから一度これを実行:

```
osascript -e 'tell application "Google Chrome" to get URL of active tab of window 1'
```

この呼び出しで現在の親プロセスに対して確認ダイアログが出る。承認すれば以降の MCP 呼び出しは再確認なしで動く。

## トラブルシューティング

| 症状 | 対応 |
|---|---|
| `osascript ... failed (non_zero_exit): ... JavaScript is turned off` | Chrome → 表示 → 開発/管理 → 「Apple Event からの JavaScript の使用を許可」を有効化 |
| `Not authorized to send Apple events to "Google Chrome"` | システム設定 → プライバシーとセキュリティ → オートメーション で、親プロセス（Terminal / VS Code / Cursor 等）に Google Chrome へのオートメーション権限を付与 |

## セキュリティ

- **ローカル**で動作し、呼び出し側の MCP client と stdio (JSON-RPC) でのみ通信する。この server から外部接続を発生させることはない
- テレメトリ・アナリティクス・端末外へのデータ送信なし
- AppleScript 層は単一の読み解ける file ([`skills/familiar/familiar.applescript`](https://github.com/dominion525/familiar/blob/main/skills/familiar/familiar.applescript))。Chrome に何が送られているか直接確認できる
- オープンソース・MIT ライセンス。MCP server (`mcp/src/`) と AppleScript 層、すべてのソースコードがリポにある

## アーキテクチャ

```
MCP client (Claude Code / Cursor / ...)
        ↓ stdio (JSON-RPC, MCP protocol)
   familiar-mcp server (Node.js)
        ↓ child_process.execFile("osascript", ["familiar.applescript", ACTION, ...args])
   AppleScript (Apple Events)
        ↓ tell application "Google Chrome" / do JavaScript
   Google Chrome（ユーザー本人がサインイン済みの実ブラウザ）
        ↓
   Page DOM
```

主要な設計判断:

- 1 つの `familiar.applescript` file が MCP server と Claude Code skill の両方の裏側になる。両経路で挙動同一
- すべての操作が `windowId + tabId` で特定の tab を狙う。MCP server は Chrome の active tab に依存しない — ユーザーが他のタブで作業中でも安全に使える
- ツール呼び出しごとに新しい `osascript` プロセスを spawn（永続 helper なし）。実装は簡素、persistent-process 型より各呼び出しが少し遅い（~80ms）

## 関連プロジェクト

「ユーザー本人がサインイン済みの実 Chrome を、小さく集約された tool セットで動かしたい」というケースに familiar-mcp がフィットする。隣接領域で trade-off の異なる project:

- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) — Chrome を DevTools Protocol 経由で。familiar-mcp に無い Lighthouse / performance trace 系の tool あり。既存ブラウザではなく debug port を持つ新規 Chrome を起こす
- [Playwright MCP](https://github.com/microsoft/playwright-mcp) — Playwright 経由でクロスブラウザ (Chromium / Firefox / WebKit)。headless やクロスブラウザ自動化が必要なときに。サインイン済みのブラウザセッションは使わない
- [safari-mcp](https://github.com/achiya-automation/safari-mcp) — 同じ発想（Apple Events 経由でユーザー本人がサインイン済みの実ブラウザを操作）の Safari 版。tool セットがはるかに大きく、AppleScript だけでは届かない範囲を補う Safari Extension も同梱

## MCP を使わず Claude Code skill として使う

MCP server を立てたくない場合、同じ 32 actions は同じリポの `skills/familiar/` に Claude Code skill / plugin として置いてある（`SKILL.md` が auto-activation を駆動）。skill / plugin インストール経路は [リポジトリの README](https://github.com/dominion525/familiar) を参照。

## ライセンス

MIT — [LICENSE](LICENSE) を参照。
