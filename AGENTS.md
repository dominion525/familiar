# familiar — Agent Guide

A guide for AI coding agents working on this repository. For a human-oriented overview, see
[README.md](README.md) / [README.ja.md](README.ja.md).

## Project overview

A Claude Code skill / plugin that drives the real Google Chrome on macOS via AppleScript (Apple
Events). It uses neither the DevTools Protocol, Playwright, nor any other separate driver — it
operates the Chrome the user already runs every day. The goal is to be treated as a regular user
even on pages with bot / WAF defenses that block headless / automated browsers.

## Repository layout

- `skills/familiar/familiar.applescript` — the script itself (operational core)
- `skills/familiar/SKILL.md` — the skill definition. This is the English body read by the skill
  loader (the auto-activation trigger). Keep it as a thin index and push details into the
  reference files (progressive disclosure).
- `skills/familiar/SKILL.ja.md` — Japanese reference translation (not read by the loader)
- `skills/familiar/reference-browser.md` / `reference-browser.ja.md` — detailed spec for the
  control surface (tab / window, navigation, waits, content / script)
- `skills/familiar/reference-actions.md` / `reference-actions.ja.md` — detailed spec for the
  retrieval and interaction actions plus selector strategy (CSS / `text=` / `xpath=` / `label=`)
- `.claude-plugin/plugin.json` — plugin manifest
- `.claude-plugin/marketplace.json` — marketplace definition
- `README.md` / `README.ja.md` — English / Japanese README
- `AGENTS.md` / `AGENTS.ja.md` — English / Japanese agent guide

## Development and verification

- AppleScript does not need compilation. Run it as-is via `osascript`.
- For a syntax check, use `osacompile -o /dev/null skills/familiar/familiar.applescript`
  (compiles for syntax only, does not execute).
- Real verification requires a live Chrome and cannot be done in CI.
- Prerequisite: enable "Allow JavaScript from Apple Events" in Chrome and accept the automation
  permission prompt on first run.
- Invocation form: `osascript skills/familiar/familiar.applescript ACTION [ARGS...]`.
- For the MCP server (`mcp/`), install the pre-commit hooks once after cloning: `npx lefthook install` at the repo root (after `cd mcp && npm install`). The hooks run Biome, tsc, and Vitest in parallel on staged changes under `mcp/`.

## Conventions

- Documentation language policy: `SKILL.md` / `README.md` / `AGENTS.md` are written in English;
  Japanese translations live in `*.ja.md`. The English file is authoritative; the `*.ja.md`
  variant is a reference translation kept in sync.
- PR titles, descriptions, and commit messages are written in English.

## Known pitfalls

- `execute_js` / `execute_js_file` return the value of the **last evaluated expression**
  (completion value). When a result is needed, end with an expression (multiple statements are
  fine). A top-level `return` does not work and yields `missing value`, so do not use it.
- Every operation targets a specific tab by windowId + tabId (`WID TID`). The design never
  relies on the active tab.
- `new_tab` opens a tab in a regular window (appended to the frontmost regular window; if there
  is none, a new one is created). Incognito is split out as `new_incognito_tab`. Both reuse the
  initial tab when creating a new window, so no empty tab is left behind.
- Running multiple Chrome instances at once can cause target-window mix-ups or races that
  surface as cryptic errors.
