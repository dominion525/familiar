# @dominion525/familiar-mcp

[![npm version](https://img.shields.io/npm/v/@dominion525/familiar-mcp)](https://www.npmjs.com/package/@dominion525/familiar-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

familiar 用 MCP server — macOS の本物の Google Chrome を AppleScript 経由で操作する。

> これは [README.md](README.md) の日本語訳です。差分が出た場合は英語版に従ってください。

## できること

MCP 対応クライアント (Claude Code / Claude Desktop / Cursor / Codex CLI など) から、AppleScript (Apple Events) 経由で macOS の本物の Google Chrome を操作する 32 種類の tool を呼べる:

- **タブ / ウィンドウ** (7): `list_tabs`, `new_tab`, `new_incognito_tab`, `close_tab`, `active_tab`, `window_mode`, `is_loading`
- **ナビゲーション** (6): `navigate`, `get_tab_url`, `reload`, `go_back`, `go_forward`, `stop`
- **待機** (3): `wait_for_load`, `wait_for_selector`, `wait_for_function`
- **コンテンツ / スクリプティング** (3): `get_html`, `execute_js`, `execute_js_file`
- **読み取り** (5): `get_text`, `get_attribute`, `get_value`, `exists`, `query_all`
- **操作** (8): `click`, `fill`, `clear`, `select_option`, `set_checked`, `press_key`, `submit`, `scroll_into_view`

ユーザー本人がサインイン済みの Chrome を Apple Events 経由で動かす (別ブラウザインスタンスを起こすのではない) ため、ページから見えるのは通常の Chrome セッションそのまま — WebDriver や DevTools 制御 channel は追加されない。ただしサイト側のアクセス制御は依然として効くので、特定サイトへのアクセスを保証するものではない。DevTools Protocol も Playwright も別ドライバも使わない。

tool ごとの signature・引数・戻り値の形・セレクタ戦略はリポジトリ内の [`reference-browser.md`](https://github.com/dominion525/familiar/blob/main/skills/familiar/reference-browser.md) (制御系) と [`reference-actions.md`](https://github.com/dominion525/familiar/blob/main/skills/familiar/reference-actions.md) (要素操作) を参照。

## 前提条件

- macOS + Google Chrome
- Chrome の「Apple Event からの JavaScript の使用を許可」を有効化 (表示 → 開発/管理 → Apple Event からの JavaScript の使用を許可)。これがないと scripting / DOM 操作系 tool は失敗する
- 初回実行時にオートメーション権限を求められたら、操作元のターミナル/アプリに対して承認する

## インストール

この npm package は MCP client が起動するもの。client 自体の設定は次節。

### npx 経由 (ローカルインストール不要)

`npx` が要求時に最新版を取得して実行する:

```
npx @dominion525/familiar-mcp@latest
```

これで server が起動し、stdin で JSON-RPC メッセージを待ち受ける状態になる (Ctrl+C で終了)。MCP client がこの server を自動で起動するので、通常は手動で実行する必要はない。

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

以下の例はすべて `npx @dominion525/familiar-mcp@latest` を前提とする。ローカルビルドを使う場合は、`npx` / `@dominion525/familiar-mcp@latest` を `node /absolute/path/to/familiar/mcp/dist/index.js` に置き換える。

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

その他の MCP 対応 client (Cline / Windsurf / Antigravity、VS Code 拡張 (GitHub Copilot Chat / Continue 等) など) は、上の Cursor / Claude Desktop の例と同じ JSON 形式で接続する。設定ファイルの場所は各 client の MCP 設定ドキュメントを参照。

</details>

## macOS 権限

AppleScript で動くツール群が Chrome と話せるようにするため、最初に一度だけ 2 つの権限設定が必要:

| 権限 | 設定場所 | 用途 |
|---|---|---|
| Apple Event からの JavaScript の使用を許可 | Chrome → 表示 → 開発/管理 → Apple Event からの JavaScript の使用を許可 | ページ内で JavaScript を走らせる tool (読み取り / 操作 / コンテンツ / JS 待機系) に必要。タブ / ウィンドウ / ナビゲーション / 履歴 / loading 状態系は AppleScript ネイティブで、この設定は不要 |
| オートメーション → Google Chrome | システム設定 → プライバシーとセキュリティ → オートメーション → (MCP server を起動するアプリ) → Google Chrome | `osascript` が初めて Chrome に話しかけるときに macOS が確認する。**macOS はオートメーション権限を親プロセスに付与する** ので、`familiar-mcp` ではなく MCP client を実際に起動するアプリ (通常は Terminal / VS Code / Cursor / Claude Desktop) に対して承認する。サインイン済みの Chrome を操作する権限を渡すので、信頼できる MCP host にだけ承認する |

OS の権限確認ダイアログが自動で出ない場合は、MCP server を起動するのと同じターミナルから一度これを実行:

```
osascript -e 'tell application "Google Chrome" to get version'
```

この呼び出しで、開いている Chrome ウィンドウの有無に依存せず、現在の親プロセスに対して確認ダイアログが出る。承認すれば以降の MCP 呼び出しは再確認なしで動く。

## トラブルシューティング

| 症状 | 対応 |
|---|---|
| `osascript ... failed (non_zero_exit): ... JavaScript is turned off` | Chrome → 表示 → 開発/管理 → 「Apple Event からの JavaScript の使用を許可」を有効化 |
| `Not authorized to send Apple events to "Google Chrome"` | システム設定 → プライバシーとセキュリティ → オートメーション で、親プロセス (Terminal / VS Code / Cursor 等) に Google Chrome へのオートメーション権限を付与 |

## セキュリティ

### server 自体について

- **ローカル**で動作する。Node.js server は呼び出し側の MCP client と stdio (JSON-RPC) でのみ通信し、自分から外部接続を発生させることはない
- テレメトリ・アナリティクスなし — server から外部に何かを送信することはない

### MCP client に公開される能力

URL や selector を受け取る tool は通常の Chrome ブラウザ活動 (network 要求・ユーザーの cookie 送信など) を引き起こす。とりわけ `execute_js` と `execute_js_file` は **ページ内で任意の JavaScript を実行する** ので、これらの tool を付与された MCP client は次を実行できる:

- ユーザーがサインイン済みの任意ページの DOM と cookie の読み取り
- ユーザーの代わりに form 送信・ナビゲーション・fetch / XHR の発火
- セッション状態の操作

MCP client への信頼は、その client にあなたの認証済みブラウザセッションへのアクセスを渡すのと同等として扱うこと。

### 監査

- AppleScript 層はこの npm package では `dist/familiar.applescript` として同梱されている。開発ソースは [`skills/familiar/familiar.applescript`](https://github.com/dominion525/familiar/blob/main/skills/familiar/familiar.applescript) にあり、build 時にそのままコピーされる。Chrome に何が送られているかは直接そのファイルを読んで確認できる
- オープンソース・MIT ライセンス。MCP server (`mcp/src/`) と AppleScript 層、すべてのソースコードがリポジトリにある

## アーキテクチャ

```
MCP client (Claude Code / Cursor / ...)
        ↓ stdio (JSON-RPC, MCP protocol)
   familiar-mcp server (Node.js)
        ↓ child_process.execFile("osascript", ["familiar.applescript", ACTION, ...args])
   AppleScript (Apple Events)
        ↓ tell application "Google Chrome" / do JavaScript
   Google Chrome (ユーザー本人がサインイン済みの実ブラウザ)
        ↓
   Page DOM
```

主要な設計判断:

- 1 つの `familiar.applescript` file が MCP server と Claude Code skill の両方の裏側になる。両経路で挙動同一
- すべての操作が `windowId + tabId` で特定の tab を狙う。MCP server は Chrome の active tab に依存しない — ユーザーが他のタブで作業中でも安全に使える
- ツール呼び出しごとに新しい `osascript` プロセスを spawn する (永続 helper なし)。実装は簡素な代わりに、呼び出しごとにプロセス起動のオーバーヘッドが乗る

## 関連プロジェクト

「ユーザー本人がサインイン済みの実 Chrome を、小さく集約された tool セットで動かしたい」というケースに familiar-mcp が適している。隣接領域で trade-off の異なる project:

- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) — Chrome を DevTools Protocol 経由で。familiar-mcp にない Lighthouse / performance trace 系の tool あり。デフォルトでは既存ブラウザではなく debug port を持つ新規 Chrome を起こす (既存の Chrome endpoint への attach は設定可能)
- [Playwright MCP](https://github.com/microsoft/playwright-mcp) — Playwright 経由でクロスブラウザ (Chromium / Firefox / WebKit)。headless やクロスブラウザ自動化が必要なときに。デフォルトではサインイン済みのブラウザセッションを使わない (Playwright は persistent profile に対応)
- [safari-mcp](https://github.com/achiya-automation/safari-mcp) — 同じ発想 (Apple Events 経由でユーザー本人がサインイン済みの実ブラウザを操作) の Safari 版。tool セットがはるかに大きく、AppleScript だけでは届かない範囲を補う Safari Extension も同梱

## MCP を使わず Claude Code skill として使う

MCP server を起動する代わりとして、同じ 32 actions が同じリポジトリの `skills/familiar/` に Claude Code skill / plugin として置いてある (`SKILL.md` が auto-activation を駆動)。skill / plugin インストール経路は [リポジトリの README](https://github.com/dominion525/familiar) を参照。

## ライセンス

MIT — [LICENSE](LICENSE) を参照。
