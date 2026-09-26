# Standalone App IPC Reference

Status: deep extraction pass on 2026-07-22 from `ssapp/main.js`, `ssapp/preload.js`, `ssapp/resources/*.js`. Channel list is source-backed; payloads are summarized, not schema-validated. ~90 `ipcMain.on` + `ipcMain.handle` channels, almost all registered inside `createWindow` (`main.js:7398-13159`) — see `../issues/ISSUE-001-duplicate-ipc-registration-on-window-recreate.md` for the re-registration defect.

## Purpose

Use this page when you need an ipcMain channel name, its direction, or its handler location. Direction is from the renderer's perspective: `send`/`sendSync` = fire-and-forget or sync-return, `invoke` = request/response via `ipcMain.handle`.

## Window And Tab Management

| Channel | Reg. at `main.js` | Purpose |
| --- | --- | --- |
| `createWindow` | `:12541` (on; sync via sendSync) | Create/reuse a source capture window; returns tabID. |
| `showWindow` | `:6957` | Toggle source-window visibility. |
| `checkWindowExists` | `:6988` | Existence check for a tabID. |
| `closeWindow` | `:7003` (handle), `:12582` (on) | Close a source window. |
| `reloadWindow` | `:12565` | Reload a source window. |
| `muteWindow` | `:12799` | Mute/unmute source-window audio. |
| `clearWindowCache` / `clearAllCache` | `:12650` / `:12788` | Cache clearing per window or global. |
| `getTabs` | `:12935` | List tracked tabs/windows. |
| `sendToTab` / `sendToTab-async` | `:12916` / `:12823` | Route a message into a specific source window (dock send path). |
| `sendInputToTab` | `:13047-13157` | CDP-based input injection into a source window. |
| `getSources` | `:13159` | desktopCapturer sources (screen/window capture). |
| `getPerformanceMetrics` | `:12858` | Per-window performance metrics. |

## Background ↔ Popup ↔ Source Messaging

| Channel | Reg. at `main.js` | Purpose |
| --- | --- | --- |
| `backgroundLoaded` | `:8133` | Background iframe ready signal. |
| `fromBackground` / `fromBackgroundResponse` | `:8179` / `:8497` | Background → main → target routing. |
| `fromPopup` / `fromPopupResponse` | `:8525` / `:8567` | Popup iframe messaging. |
| `fromBackgroundPopupResponse` | `:8463` | Combined background/popup responses. |
| `postMessage` | `:9077` | Generic `ninjafy.sendMessage` entry (`preload.js:457-476`). |
| `PPTHotkey` | `:8577` | Push-to-talk hotkey relay. |
| `storageSave` / `storageGet` / `storageGetAsync` | `:8288` / `:8411` / `:8450` | chrome.storage emulation for iframes. |
| `store-set` / `store-get` | `:7184` / `:7200` | electron-store key/value access. |

## Dialogs And Files

| Channel | Reg. at `main.js` | Purpose |
| --- | --- | --- |
| `prompt` / `confirm` / `alert` | `:7398` / `:7489` / `:7560` | Custom dialog windows (prompt.html). |
| `showOpenDialog` / `show-save-dialog` | `:7518` / `:6539` | Native file pickers. |
| `read-from-file` / `write-to-file` / `append-to-file` | `:6556` / `:8141` / `:8163` | Approved-path file IO. |
| `ssapp:choose-ticker-file` | `:6416` | Ticker file selection. |
| `ssapp:get/select/clear/read-custom-js-file` | `:6727-6745` | Custom-JS file management. |

## Sessions And Environment

| Channel | Reg. at `main.js` | Purpose |
| --- | --- | --- |
| `getSessions`, `createSession`, `switchSession`, `deleteSession`, `renameSession` | `:7030-7160` | Named session (partition/profile) management. |
| `exportAllSessionData` / `importAllSessionData` / `getStorageDataForImport` | `:7030-7160` | Session data portability. |
| `socialstream:resolve-file-url` / `socialstream:read-file` / `socialstream:resolve-cache-url` | `:3713-3754` | Social Stream asset resolution (see `social-stream-loading.md`). |
| `ssapp:get-environment` | `:3786` | Environment/flags snapshot for renderer. |
| `ssapp:set-language` | `:3822` | UI language. |
| `ssapp:get-source-window-config` | `:3838` | Per-source window config. |
| `get-injected-script-flag` | `:6412` | Whether window got the injected-script marker. |
| `getVersion` / `getAppVersion` | `:12543` / `:9339` | Version strings. |
| `zoom` | `:9349` | Window zoom. |
| `startupPrefs:get/set/reset` | `:16634-16667` | Startup-preferences window backing store. |
| `ssapp:sources-activity` | `:1736` | Source activity feed for UI. |

## Network, Proxy, And Command Routing

| Channel | Reg. at `main.js` | Purpose |
| --- | --- | --- |
| `nodefetch` | `:9708` / `:9733` | Main-proxied fetch (CORS bypass). |
| `nodepost` / `nodeput` / `streaming-nodepost` | `:9754` / `:9771` / `:9789` | Main-proxied POST/PUT, incl. streaming. |
| `rumble-fetch-json` | `:9592` | Rumble-specific proxied JSON. |
| `signIn` | `:10002` / `:10006` | Opens sign-in window flow. |
| `ssapp:background-command` | `:9689` (handler `:9605`) | Stream Deck / control-API command router into renderer (`handleStreamDeckSourceCommand`). |

## Platform OAuth Handlers (`ssapp/resources/*-handler.js`)

| Channel family | Handler file | Notes |
| --- | --- | --- |
| `youtube-oauth`, `youtube-oauth-exchange`, `youtube-oauth-refresh`, `youtube-owner-auth-start/-confirm/-list/-clear`, `youtube-owner-broadcasts` | `electron-youtube-handler.js:923-970` | YouTube Data API + owner discovery. |
| `twitch-oauth` | `electron-twitch-handler.js:340` | |
| `kick-oauth` | `electron-kick-handler.js:386` | |
| `facebook-oauth`, `facebook-oauth-exchange` | `electron-facebook-handler.js:370-379` | |
| `spotify-oauth`, `spotifyOAuth` | `electron-spotify-handler.js:151-152` | |
| `velora-oauth`, `vpzone-oauth`, `media-upload` | respective handler files | Smaller integrations. |

## TikTok

| Channel | Reg. at `main.js` | Purpose |
| --- | --- | --- |
| `createTikTokConnection` / `disconnectTikTokConnection` | `:17848` / `:18013` | Start/stop the main-process TikTok connector. |
| `authenticateTikTok`, `clearTikTokAuthSession`, `getTikTokSignInStatus`, `tiktok-login` | `:18040-18251` | TikTok cookie/OAuth sign-in (`tiktok-auth.js`). |
| `promptTikTokCookies`, `getTikTokCookies` | `:17799-18425` range | Cookie capture helpers. |
| `tiktokShowSigningWindow` / `tiktokSigningWindowCommand` | `:18077` / `:18093` | Local signer window control. |
| `tiktokGenerateSigningParameters` | `:18253` | Generate/validate signing params (fetch validation `validateTikTokFetch` `:17460`). |
| `sendTikTokMessage` | `:18425` | Send chat via connector — known defect with virtual tab IDs, see `../issues/ISSUE-003-sendtiktokmessage-virtual-tab-id.md`. |
| `set-force-tiktok-classic` | `:17418` | Global classic-mode toggle. |

## Kick WS

| Channel | Reg. at `main.js` | Purpose |
| --- | --- | --- |
| `kick-ws-connect` / `kick-ws-disconnect` | `:18469` / `:18630` | Main-process Kick WebSocket client (`resources/kick-ws-client.js`). |

## AI Features (in-app, not the agent surface)

| Channel | Reg. at `main.js` | Purpose |
| --- | --- | --- |
| `stt:get-capabilities` / `stt:transcribe` / `stt:get-diagnostics` | `:15440-15471` | Whisper STT worker. |
| `tts` | `:15471` | Kokoro TTS worker. |

## Local Media Server

`local-media:select|list|get|remove|status|start|stop|set-port|flow-url|media-url|reveal|rotate-token` — registered in `resources/electron-local-media-server.js:514-568`.

## Do Not Overclaim

- Payload shapes above are summarized from call sites; validate against the handler before writing a new caller.
- Registration order and duplicates are affected by ISSUE-001; do not assume idempotent re-registration is safe.
