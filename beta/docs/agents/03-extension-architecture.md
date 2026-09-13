# Extension Architecture

Status: backbone extraction pass. Usable for orientation, not final-grade.

## Purpose

This page documents the Chrome extension runtime: manifest, service worker, background page, popup/settings UI, source/content scripts, storage, permissions, and message routing.

## Source Anchors

- `social_stream/manifest.json`
- `social_stream/service_worker.js`
- `social_stream/background.html`
- `social_stream/background.js`
- `social_stream/popup.html`
- `social_stream/popup.js`
- `social_stream/sources/**/*.js`
- `social_stream/providers/**/*`
- `social_stream/shared/**/*`
- `social_stream/settings/*`

## Runtime Shape

The extension is a Manifest V3 Chrome extension. The runtime is split across three main layers:

- `service_worker.js`: transient MV3 service worker that receives extension messages, checks extension state, opens or recovers the hidden background page, and queues messages while that page is loading.
- `background.html` plus `background.js`: long-running extension control page used for settings, sockets, routing, overlay/dock distribution, API handling, and platform integration behavior that should survive beyond a single content-script message.
- Source/content scripts: platform-specific scripts declared in `manifest.json` or loaded from the extension, usually under `sources/`, `providers/`, `shared/`, or `thirdparty/`.

`popup.html` and `popup.js` are the main user-facing extension popup. `settings/options.html` is the options UI declared in `manifest.json`.

## Manifest Facts

Confirmed from `manifest.json`:

- Current manifest version is MV3.
- `background.service_worker` points to `service_worker.js`.
- The extension action popup is `popup.html`.
- The options page is `settings/options.html`.
- Permissions include `webNavigation`, `notifications`, `storage`, `debugger`, `tabs`, `scripting`, `activeTab`, `tabCapture`, and `identity`.
- Web-accessible resources expose provider cores, shared utilities, vendor scripts, browser model files, workers, and selected UI/runtime assets to extension pages or injected scripts.
- Content scripts are mapped to many platform URL patterns. This manifest is the first source to check when a platform page is not being captured at all.
- CSP is restrictive and extension-local: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`.

## Service Worker Responsibilities

`service_worker.js` exists because MV3 needs a service worker entry point, but its own comments warn that a service worker can be stopped after a few minutes and local variables can be lost. The design therefore keeps durable routing work in `background.html` / `background.js`.

Confirmed responsibilities:

- Track `backgroundPageTabId` and whether the background page has loaded.
- Create or reuse a hidden pinned `background.html` tab with `chrome.tabs.create({ url: chrome.runtime.getURL("background.html"), active: false, pinned: true })`.
- Queue messages while the background page is loading.
- Retry background-page recovery with cooldown logic.
- Read extension on/off state from `chrome.storage.sync` first, then `chrome.storage.local`.
- Read a settings snapshot using `streamID`, `password`, and `state` from `chrome.storage.sync`, plus `settings` from `chrome.storage.local`.
- Route normal source messages to the background page.
- Permit a narrow set of settings/write commands even while the extension is disabled.
- Handle helper commands such as `checkBackgroundPage`, `injectCustomSource`, `openEventFlowEditor`, and `captureTabAudio`.
- On install/startup, open the background page unless stored state is false, then periodically check the background page.

## Background Page Responsibilities

`background.js` is the main extension brain. It loads or migrates settings, owns socket connections, processes incoming source messages, sends data to docks and overlays, and accepts some remote/API commands.

Confirmed responsibilities:

- Load `settings.json` override when present, otherwise load saved settings.
- In extension mode, read `streamID`, `password`, and `state` from `chrome.storage.sync`.
- In extension mode, read `settings` and `returningBeepHintShown` from `chrome.storage.local`.
- Migrate older storage layouts by moving `streamID`, `password`, and `state` into sync storage while keeping the larger `settings` object in local storage.
- Open the dock socket when `settings.server2` or `settings.server3` is enabled and the extension is on.
- Open the API socket when `settings.socketserver` is enabled and the extension is on.
- Use local WebSocket endpoint `ws://127.0.0.1:3000` when `localserver` is enabled, otherwise use hosted `wss://io.socialstream.ninja/dock` and `wss://io.socialstream.ninja/api`.
- Join the dock socket with `{ join: streamID, out: 4, in: 3 }`.
- Join the API socket with `{ join: streamID, out: 2, in: 1 }`.
- Handle inbound API actions such as `sendChat`, `sendEncodedChat`, `blockUser`, `eventFlowEvent`, and `extContent`.
- Send dock/overlay data through server fallback, VDO.Ninja/ninjaBridge paths, or VDO iframe `postMessage` fallback depending on settings and connection state.

## Storage Model

Confirmed current split:

- `chrome.storage.sync`: `streamID`, `password`, `state`
- `chrome.storage.local`: larger `settings` object and local-only flags such as `returningBeepHintShown`

This split matters for support answers. A user can have a valid session ID but broken local settings, or vice versa. It also matters when comparing Chrome extension behavior with the standalone app, which mirrors and repairs settings differently.

## Message Routing Summary

Typical extension flow:

1. A platform content script extracts a chat/event payload.
2. The content script sends it to the extension runtime.
3. `service_worker.js` verifies state and forwards or queues the message.
4. `background.html` / `background.js` processes settings, filters, commands, and integrations.
5. `background.js` sends the normalized output to dock, overlays, API clients, or P2P/server transports.

Important distinction: the service worker is a router/recovery layer; `background.js` is where most durable product behavior belongs.

## Extraction Notes

This pass focused on high-level architecture. Deeper passes should inspect:

- Exact `chrome.runtime.onMessage` command names and compatibility paths.
- Exact popup/settings save path in `popup.js` and `settings/*`.
- Platform-specific script injection rules and any source scripts that bypass the standard path.
- Which API inbound actions are stable public contract versus internal compatibility.
