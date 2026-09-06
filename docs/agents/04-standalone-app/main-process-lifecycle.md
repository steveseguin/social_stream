# Standalone App Main Process Lifecycle

Status: deep extraction pass on 2026-07-22 from `ssapp/main.js` (~18,650 lines; the entire main process), `ssapp/preload.js`, `ssapp/preload-mock.js`, `ssapp/resources/*.js`. Source-backed with line anchors; not runtime-tested.

## Purpose

Use this page for app startup order, window types and their lifecycle, tray/headless behavior, single-instance rules, and shutdown. For how Social Stream pages get loaded into those windows, use `social-stream-loading.md`. For channel-level messaging, use `ipc-reference.md`.

## Source Anchors

- `ssapp/main.js`
- `ssapp/bootstrap.js`
- `ssapp/preload.js`, `ssapp/preload-mock.js`, `ssapp/preload-kasada.js`
- `ssapp/resources/electron-control-api.js`, `ssapp/resources/electron-local-media-server.js`
- `ssapp/stt-worker.js`, `ssapp/tts-worker.js`, `ssapp/websocket-monitor.js`, `ssapp/error-reporter.js`

## Startup Sequence

1. `bootstrap.js` dispatches `--ssapp-mcp` directly to the stdio adapter; every other launch loads `main.js` normally.
2. Single-instance lock at `ssapp/main.js:5200`; second instances are effectively ignored (`second-instance` handler at `main.js:14120`).
3. Portable-mode userData redirect applied early (`main.js:73`, `main.js:14166-14172`; logic in `ssapp/resources/portable-data-paths.js:58-170`).
4. `app.whenReady()` at `main.js:14913`:
   - Loads cached state (`savedSync.json` recovery chain, see `packaging-updates-and-state.md`).
   - Resolves `--filesource` dev flag (`main.js:7283-7374`).
   - Starts the local media server (`resources/electron-local-media-server.js`).
   - Applies Chrome UA override and header rewriting (`main.js:14923-14964`).
   - Calls `createWindow(Argv, false, true)` (`main.js:15151`).
   - Starts the control API server (`main.js:15153`; see `control-api-and-mcp.md`).
   - Optionally starts STT/TTS workers (`main.js:15189-15392`).
   - Optionally starts the WS relay server on port 3000 if `cachedState.wsServer` (`main.js:15054`).

Support implication: startup side effects (media server, control API, workers) all hang off `whenReady`; a crash before `main.js:15151` means no main window and usually no useful renderer logs.

## Window Types

| Window | Created at | Visibility | Notes |
| --- | --- | --- | --- |
| Main control window | `main.js:7646-7670` (`createWindow`) | Visible | Loads ssapp `index.html` (883 KB shell). Preload `preload.js`, partition `persist:abc` or `persist:session-<name>`. Bounds saved/restored (`main.js:7611-7643`). Close intercepted (`main.js:8602-8611`) → tray or quit. |
| Source capture windows | `originalCreateWindowHandler` `main.js:10921`; window `main.js:11069-11077` | Hidden by default | Tracked in `browserViews` map keyed by tabID (`main.js:11088-11089`). Visibility toggled via `showInactive`/`stealthHideView` (`main.js:11097-11121`). Per-platform partitions `persist:<platform>` or `persist:custom-*` (`main.js:10977-11002`). Optional auto-close on navigation (`main.js:11126-11206`). |
| TikTok virtual tabs | `main.js:17941-17990` | No real window | Registered in `browserViews` with ID `900000 + wssID` so dock/send paths treat the main-process TikTok connector like a tab. |
| Sign-in windows | `handleSignInRequest` `main.js:9918`, window `main.js:10361` | Visible | Emits `window-closed-<tabID>` (`main.js:10905`). |
| Overlay/popout windows | `setWindowOpenHandler` `main.js:7821`, window `main.js:7900` | Visible | dock.html, featured.html, cohost.html etc. opened via `window.open` from pages; framed/transparent options; `chathistory` redirected to local `chathistory.html` (`main.js:7828`). |
| TikTok signing window | `ensureTikTokSigningWindow` `main.js:17711` | Hidden by default | Loaded to `https://livecenter.tiktok.com/realtime` (`main.js:2585`); executes TikTok's own signing JS. |
| Dialog/utility windows | `createCustomDialog` `main.js:6298` (prompt.html); CLI help `main.js:5136`; startup prefs `main.js:16580` | Visible on demand | Custom replacements for renderer `prompt`/`confirm`/`alert`. |

## Tray, Headless, And Close Behavior

- Tray created in `createMenu` (`main.js:17398-17403`). Close-to-tray flag at `main.js:5109-5116`, `minimizeToTray` at `main.js:15912`.
- Headless mode (`--ssapp-headless-control`) forces all windows hidden (`main.js:1879-1886`, `main.js:1932-1945`).
- `window-all-closed` quits on non-macOS (`main.js:14125`). macOS `activate` re-runs `createWindow` (`main.js:15746-15752`) — see `../issues/ISSUE-001-duplicate-ipc-registration-on-window-recreate.md` for the handler-duplication defect this causes.

## Background Services In Main

| Service | Port/Entry | Notes |
| --- | --- | --- |
| Control API (HTTP) | `127.0.0.1:17777` default, explicit opt-in | Tokenless same-machine AI/automation adapter. Headless mode does not enable it. Details in `control-api-and-mcp.md`. |
| WS relay server | port 3000, `main.js:5409-5604` | `ws`-based room relay mimicking the VDO.Ninja protocol (`/join/<room>/<in>/<out>`). Binds all interfaces, no auth — intentional for LAN overlays but worth knowing. Toggle via tray/menu (`main.js:17004-17011`). |
| Local media server | `127.0.0.1:3001` default, `resources/electron-local-media-server.js:11-12,188,212` | Serves user-selected local media to pages; token-rotated URLs. |
| STT worker | `stt-worker.js`, spawned `main.js:15189-15392` | Whisper via `@huggingface/transformers`; models in `userData/models/whisper` (`main.js:15213`). |
| TTS worker | `tts-worker.js` | Kokoro (`Kokoro-82M-ONNX/`). |
| Error reporter | `error-reporter.js:5` | Posts to a Cloudflare worker; opt-in; redacts TikTok keys (`error-reporter.js:53,74-78`). |

## Shutdown

`before-quit` at `main.js:14132-14158` shuts down TTS/STT workers, the local media server, and the control API router. `browserViews` cleaned at `main.js:8647-8672`. IPC listeners removed at `main.js:8614-8642`.

## Do Not Overclaim

- The app has **no auto-updater**; update UX is a version banner + manual download. See `packaging-updates-and-state.md`.
- Source windows existing ≠ capture healthy; hidden windows still run (`backgroundThrottling:false`).
- Known defects tracked in `../issues/`: ISSUE-001 (duplicate IPC registration on recreate), ISSUE-002 (dead `onbeforeunload` hide-instead-of-close).

## Follow-Up Extraction Needs

- Runtime evidence for headless + control API boot order.
- Global hotkey registration matrix (`main.js:13186-13219`) — which keys, which platforms.
