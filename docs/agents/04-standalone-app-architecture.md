# Standalone App Architecture

Status: backbone extraction pass. Usable for orientation, not final-grade.

## Purpose

This page documents how the Electron standalone app works, how it loads Social Stream source files, and where it differs from the Chrome extension.

For the focused source-window lifecycle and app-vs-extension parity matrix, use `04-standalone-app-source-windows.md`.

## Source Anchors

- `ssapp/main.js`
- `ssapp/preload.js`
- `ssapp/preload-mock.js`
- `ssapp/state.js`
- `ssapp/index.html`
- `ssapp/renderer.js`
- `ssapp/resources/electron-*-handler.js`
- `ssapp/resources/kick-ws-client.js`
- `ssapp/tiktok/connection-manager.js`
- `ssapp/tests/electron/*`

Do not use `ssapp/resources/social_stream_fallback` as source documentation material during normal extraction. The project instructions say Social Stream source edits and runtime source-of-truth work belong in `C:\Users\steve\Code\social_stream`; the fallback folder is disposable build/update output.

## Runtime Shape

The standalone app is an Electron app that wraps SSN workflows and provides extension-like APIs to Social Stream source pages. It is not just a static copy of the extension. The important layers are:

- `main.js`: Electron main process, window creation, app menu/actions, source-root loading, local source validation, state backup/repair, IPC, OAuth handler wiring, and app-specific platform helpers.
- `preload.js`: secure bridge exposed to pages as `window.ninjafy` when context isolation is enabled, plus fallback direct assignment when it is not.
- `state.js`: renderer-side state model for sources, groups, global settings, migration from older localStorage settings, WebSocket support detection, and session binding.
- `renderer.js` / `index.html`: app UI for managing source windows, groups, sessions, and source behavior.
- `resources/electron-*-handler.js`: OAuth and platform-specific app handlers.
- `resources/kick-ws-client.js`, `tiktok/*`, `tiktok-signing/*`: app-side platform connection support.

## Source Loading

`main.js` contains helpers for loading Social Stream source files from local folders or zip imports. Confirmed behavior:

- A valid Social Stream source root must include `manifest.json`, `background.html`, `popup.html`, `sources/twitch.js`, and a manifest with `content_scripts`.
- Folder import validates the chosen root before storing it.
- Zip import extracts to an app data location, searches for the preferred GitHub zip root, validates it, stores the local source path, and reloads.
- Source paths can be represented as file URLs, so path/file URL conversion helpers are part of the app behavior.
- Clearing a saved local source path removes `localSourcePath`, clears the runtime source argument, and queues a toast.

Support implication: if app source loading fails, verify the selected folder is the actual Social Stream repo/root, not a parent folder, zip wrapper folder, or generated fallback bundle.

## Preload Bridge

`preload.js` exposes `window.ninjafy` as the app's extension-compatibility bridge. This lets Social Stream source code call app-provided APIs instead of Chrome extension APIs.

Confirmed bridge areas:

- Authenticated `sendMessage` path through IPC using an app auth token.
- `getAuthToken`, injected-script flags, and source-window config helpers.
- `onSendToTab`, `onPostMessage`, `onWebSocketMessage`, and device-list callbacks.
- File stream helpers, save dialogs, append-to-file behavior, and TTS helpers.
- No-CORS/fetch helpers such as Rumble JSON fetch support.
- OAuth methods for YouTube, Twitch, Facebook, Velora, Kick, and VPZone.
- Media upload helpers.
- Kick WebSocket start/stop/status/event methods.
- `ssappLocale`, `ssappFallback`, `ssappEnvironment`, and `ssappCustomJs` exposures.

Support implication: when a workflow works in Chrome but not in the standalone app, check whether it depends on a browser extension API, a login/cookie context, or an app preload bridge method.

## State And Persistence

`state.js` stores the app UI/runtime state in localStorage under `socialStreamState`. It serializes `sources` and `groups` maps and restores them on startup.

Confirmed global fields include:

- `betaMode`
- TikTok mode fields such as `forceTikTokClassic`, `preferTikTokLegacy`, `tiktokModeExplicitlySelected`, and `lastTikTokMode`
- YouTube auto-add and cleanup settings
- current page/root order
- source session bindings

`state.js` also migrates older localStorage `settings` into source entries. It detects WebSocket support by checking known targets and by inspecting the Social Stream manifest content scripts for `websocket/<target>.js`.

`main.js` has additional settings preservation logic. It gathers cached state candidates from disk backups, electron-store backups, and localStorage backups; scores candidates; avoids overwriting richer settings with partial settings; and mirrors cached state to localStorage keys such as `settings`, `streamID`, `password`, `state`, `ssninja_stream_id`, and `ssninja_state`.

Support implication: settings loss is an app-specific high-priority documentation area because state can exist in several backup/mirror locations.

## Session Binding

The app remembers source-to-session associations through `sessionBindings` in global state. It builds keys from source details such as target, group, username, channel, video ID, URL, or explicit key. Auto/default/blank sessions are not remembered.

This matters when documenting:

- Why a source opens into a remembered session.
- Why default/blank sessions may not be restored.
- How moving sources between groups or changing URLs can affect remembered sessions.

## App Vs Extension Differences

Key differences to keep explicit in support docs:

- The Chrome extension runs in the user's browser session. The app runs in Electron and may hit sign-in or embedded-browser restrictions that Chrome does not.
- The extension uses `chrome.storage.sync` plus `chrome.storage.local`. The app uses localStorage, electron-store backup, disk backup files, and app repair logic.
- The extension depends on MV3 service worker plus a hidden background page. The app depends on Electron main/preload/renderer IPC.
- The app can load source code from local folders/zips; the extension uses packaged extension files.
- OAuth and platform auth can be app-specific and may not match the Chrome extension path.

## Extraction Notes

Deeper passes should inspect:

- Exact IPC channels between `main.js`, `preload.js`, and renderer/source windows.
- OAuth handler behavior by platform.
- TikTok mode selection, signing fallback, and regression tests.
- Settings repair tests under `ssapp/tests/electron/*`.
- User-facing source window lifecycle in `renderer.js`.
