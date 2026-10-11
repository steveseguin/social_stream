# Standalone App (ssapp) Deep Docs

Status: deep extraction pass on 2026-07-22 from the live `ssapp` repo (`C:\Users\steve\Code\ssapp`, a separate repository, not a subfolder of this one). Source-backed orientation with file:line anchors; not a replacement for in-app/e2e testing.

## Purpose

This folder holds the detailed Electron-app docs that `../04-standalone-app-architecture.md` and `../04-standalone-app-source-windows.md` explicitly deferred: main-process lifecycle, IPC reference, control API + MCP surface, packaging/state, and how Social Stream code is loaded and injected.

Path convention: anchors prefixed `ssapp/...` refer to the separate ssapp repository on disk (`C:\Users\steve\Code\ssapp`). Anchors without a prefix refer to this social_stream repository.

## Pages

| Page | Use it when |
| --- | --- |
| [Main Process Lifecycle](main-process-lifecycle.md) | Startup order, window types, tray/headless modes, shutdown, single-instance behavior. |
| [Social Stream Loading And Injection](social-stream-loading.md) | How the app resolves background/popup/source pages (remote → cache → fallback), injects content scripts, and emulates `chrome.runtime`. |
| [IPC Reference](ipc-reference.md) | Channel names, direction, and purpose for the ~90 ipcMain channels. |
| [Control API And MCP](control-api-and-mcp.md) | Opt-in same-machine HTTP API, MCP stdio server, SSE events, headless separation, and legacy `/exec` caveat. |
| [Packaging, Updates, And State](packaging-updates-and-state.md) | electron-builder targets, code signing, no auto-updater, savedSync.json/electron-store schema, portable mode. |

## Related docs outside this folder

- `../04-standalone-app-architecture.md` - layer map and source-root loading rules (backbone pass).
- `../04-standalone-app-source-windows.md` - source-state vs source-window mental model and app-vs-extension parity.
- `../08-platform-sources/tiktok-standalone-app.md` - TikTok connector modes, signing, fallbacks.
- `../08-platform-sources/tiktok-app-event-payload-map.md` - TikTok app event → SSN payload field mapping.
- `../../skills/control-social-stream/` - operational guidance and references for driving the app through its control API and MCP adapter.
- `../issues/` - bugs found during documentation passes, including ssapp defects.
