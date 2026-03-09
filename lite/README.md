# Social Stream Ninja Lite (Web-only mode)

A lightweight web page that replaces the extension workflow by connecting to chat sources directly from the browser and relaying events to `dock.html` via the existing iframe message bus.

## Features

- One-page experience for managing chat relays.
- Session generator with clipboard-ready dock link.
- YouTube Data API polling plus an optional low-latency streaming mode.
- Direct Twitch chat integration via `tmi.js`.
- Kick chat via public metadata lookup plus direct WebSocket subscription.
- TikTok LIVE support through the optional Socket.IO proxy.
- Activity log for connection and transport events.

## Getting Started

1. Serve the project as usual (local dev server or deployed site) and open `lite/index.html`.
2. Generate or enter a session ID, then click **Save session ID** if you want to override the auto-generated value. Keep the session handy for the matching `dock.html` overlay URL.
3. For each provider, fill in the platform-specific settings and click **Connect**. OAuth-based providers redirect back to the Lite page automatically after authorization.
4. Open `dock.html?session=YOUR_ID` in another tab/window or OBS browser source to receive the forwarded messages.

### OAuth Redirect URIs

Add the Lite page URL as an authorized redirect URI in your developer console:

- **YouTube**: `https://your-domain/lite/index.html`
- **Twitch**: `https://your-domain/lite/index.html`

Twitch returns an access token to this page, while YouTube now uses the hosted `ytauth` bridge for code exchange and refresh handling.

## Current Limitations / Next Steps

- WebRTC transport is not wired yet; the Lite page uses the existing iframe bridge to keep compatibility with overlays.
- The Twitch integration defaults to the authenticated channel unless a custom channel name is provided.
- YouTube refresh tokens are supported through the hosted auth bridge; Twitch still requires re-auth once the implicit-flow token expires.
- Kick depends on public metadata endpoints or the Social Stream Kick bridge cache to resolve chatroom IDs, so some channels may still need manual advanced overrides.

### TikTok LIVE via proxy

The TikTok plugin relies on a small Socket.IO proxy that speaks the TikTok Chat Reader wire format. A ready-to-run implementation lives in `lite/tiktok-proxy/`:

1. Install dependencies with `npm install` while inside that folder.
2. Start the service (`npm start`) and note the port (defaults to `http://localhost:8089`).
3. In the TikTok card inside Web-only mode, paste the proxy URL into **Proxy server URL** and click **Connect**.

You can deploy the proxy anywhere Node.js 18 is available (local machine, VPS, Docker, etc.). Harden CORS or authentication as needed if exposing it publicly.

## Directory Overview

```
lite/
|-- index.html           # Lite control panel entry point
|-- styles.css           # Minimal styling for the one-page UI
|-- app.js               # Core controller (sessions, plugins, activity)
|-- utils/
|   |-- dockMessenger.js # Dock iframe bridge helper
|   |-- helpers.js       # Common helpers (IDs, formatting)
|   `-- storage.js       # Namespaced localStorage helpers
`-- plugins/
    |-- basePlugin.js             # Shared card + lifecycle logic
    |-- youtubePlugin.js          # YouTube Data API integration
    |-- youtubeStreamingPlugin.js # YouTube streaming API integration
    |-- twitchPlugin.js           # Twitch chat (tmi.js) integration
    |-- kickPlugin.js             # Kick chat integration
    `-- tiktokPlugin.js           # TikTok proxy-backed integration

shared/
|-- utils/
|   |-- html.js          # Shared HTML sanitizers used by Lite + websocket sources
|   |-- scriptLoader.js  # Shared script loader helper
|   `-- twitchEmotes.js  # Shared Twitch emote helpers
`-- vendor/
    `-- tmi.js           # Bundled Twitch client fallback
```

## Development Notes

- The page is built as ES modules without a bundler; load it via HTTP(S) so OAuth redirects succeed.
- `tmi.js` lives under `shared/vendor/` so the Lite site, extension, and Electron app all load the same copy; the npm package no longer ships `dist/` bundles on CDNs.
- Ship the entire `shared/` directory alongside `lite/` when deploying so shared helpers (script loader, vendor libs, etc.) continue to load in dock + extension surfaces that the Lite UI embeds; the profanity list now lives directly in `libs/objects.js`, so there is no extra `shared/data/badwords.json` asset to host.
- Messages relayed to the dock follow the existing `overlayNinja` payload conventions (e.g., `type`, `chatname`, `chatmessage`).
- Append `?debug=1` to the Lite URL (persisted in local storage) to surface verbose relay logs in the browser console and activity feed; use `?debug=0` to turn it back off.
- Activity logging stays lightweight unless debug mode is enabled; adjust in `app.js` if you need deeper instrumentation.
