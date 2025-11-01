# Social Stream Ninja Lite (Web-only mode)

A lightweight web page that replaces the extension workflow by connecting to chat sources directly from the browser and relaying events to `dock.html` via the existing iframe message bus.

## Features

- One-page experience for managing chat relays.
- Session generator with clipboard-ready dock link.
- Native YouTube Data API polling (OAuth implicit flow).
- Direct Twitch chat integration via `tmi.js` (OAuth implicit flow).
- Activity log for connection and transport events.

## Getting Started

1. Serve the project as usual (local dev server or deployed site) and open `lite/index.html`.
2. Generate or enter a session ID, then click **Start Relay**. Keep the session handy for the matching `dock.html` overlay URL.
3. For each provider, supply the OAuth client ID you want to use (defaults are pre-filled for convenience) and click **Connect**. On first run you will be redirected to grant permissions and automatically returned to the Lite page.
4. Open `dock.html?session=YOUR_ID` in another tab/window or OBS browser source to receive the forwarded messages.

### OAuth Redirect URIs

Add the Lite page URL as an authorized redirect URI in your developer console:

- **YouTube**: `https://your-domain/lite/index.html`
- **Twitch**: `https://your-domain/lite/index.html`

The implicit flow appends `#access_token=...` to this page, which the plugins capture on load.

## Current Limitations / Next Steps

- Only YouTube and Twitch are wired up today, but the plugin architecture supports adding more providers under `lite/plugins/`.
- WebRTC transport is not wired yet; the Lite page uses the existing iframe bridge to keep compatibility with overlays.
- The Twitch integration defaults to the authenticated channel unless a custom channel name is provided.
- Token refresh is not implemented (implicit flow tokens expire); the UI prompts for re-auth when required.

### TikTok LIVE via proxy

The TikTok plugin relies on a small Socket.IO proxy that speaks the TikTok Chat Reader wire format. A ready-to-run implementation lives in `lite/tiktok-proxy/`:

1. Install dependencies with `npm install` while inside that folder.
2. Start the service (`npm start`) and note the port (defaults to `http://localhost:8089`).
3. In the TikTok card inside Web-only mode, paste the proxy URL into **Proxy server URL** and click **Connect**.

You can deploy the proxy anywhere Node.js 18 is available (local machine, VPS, Docker, etc.). Harden CORS or authentication as needed if exposing it publicly.

## Directory Overview

```
lite/
|-- index.html          # Lite control panel entry point
|-- styles.css          # Minimal styling for the one-page UI
|-- app.js              # Core controller (sessions, plugins, activity)
|-- utils/
|   |-- dockMessenger.js # Dock iframe bridge helper
|   |-- helpers.js       # Common helpers (IDs, formatting)
|   `-- storage.js       # Namespaced localStorage helpers
|-- vendor/
|   `-- tmi.js # Bundled Twitch client fallback (avoids broken CDN dist/ links)    # Socket.IO bridge (see README for details)
`-- plugins/
    |-- basePlugin.js    # Shared card + lifecycle logic
    |-- youtubePlugin.js # YouTube Data API integration
    `-- twitchPlugin.js  # Twitch chat (tmi.js) integration
```

## Development Notes

- The page is built as ES modules without a bundler; load it via HTTP(S) so OAuth redirects succeed.
- `tmi.js` lives under `shared/vendor/` so the Lite site, extension, and Electron app all load the same copy; the npm package no longer ships `dist/` bundles on CDNs.
- Messages relayed to the dock follow the existing `overlayNinja` payload conventions (e.g., `type`, `chatname`, `chatmessage`).
- Append `?debug=1` to the Lite URL (persisted in local storage) to surface verbose relay logs in the browser console and activity feed; use `?debug=0` to turn it back off.
- Activity logging stays lightweight unless debug mode is enabled; adjust in `app.js` if you need deeper instrumentation.
