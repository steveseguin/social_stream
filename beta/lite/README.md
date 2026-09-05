# Social Stream Ninja Lite (Web-only mode)

A lightweight web page that replaces the extension workflow by connecting to chat sources directly from the browser and relaying events to `dock.html` via the existing iframe message bus.

## Features

- One-page experience for managing chat relays.
- Session generator with clipboard-ready dock link.
- YouTube Data API polling plus an optional low-latency streaming mode.
- Direct Twitch chat integration via `tmi.js`.
- Kick chat via public metadata lookup plus direct WebSocket subscription.
- A proxy-based TikTok integration exists, but its card is currently hidden by the Lite stylesheet.
- Activity log for connection and transport events.
- Explicit OBS dock mode (`?view=dock`) with source and session settings available.
- Experimental standalone Browser Source (`?view=overlay`) with local capture/display, transparent output, and Escape-to-configure controls. It does not relay to other session overlays.

## Getting Started

For the user-facing walkthrough, open [Setup guide and troubleshooting](./guide.html). Regular overlays and activity popouts need Lite running in a tab or OBS dock. Standalone overlay mode runs its own capture instead.

1. Serve the project as usual (local dev server or deployed site) and open `lite/index.html`.
2. Generate or enter a session ID, then click **Save session ID** if you want to override the auto-generated value. Keep the session handy for the matching `dock.html` overlay URL.
3. Sign in for YouTube or Twitch, or configure Kick using **Options**, then connect. Signed-in YouTube/Twitch users can disconnect and reconnect without signing out.
4. Open `dock.html?session=YOUR_ID` in another tab/window or OBS browser source to receive the forwarded messages.

The overlay URL is visible and selectable if clipboard access is blocked. Overlay tweaks change that URL; copy it again into OBS after changing them. Session edits apply on **Save session ID** or Enter, not when leaving the input.

Avoid capturing the same channel twice in one session through Lite, the extension, or the desktop app. The generated link uses the default password; custom password/server setups should use the full app's connection controls.

### OAuth and self-hosting

The standard hosted Lite page uses the built-in provider configuration. Self-hosting OAuth requires compatible application/redirect configuration; it is not enough to copy the page to another domain. The current code builds redirect URIs from the page URL without query or fragment:

- **YouTube**: `https://your-domain/lite/index.html`
- **Twitch**: `https://your-domain/lite/index.html`

Twitch returns an access token to this page. YouTube uses the hosted `sso.socialstream.ninja/youtube` bridge for code exchange and refresh, with a legacy `ytauth` fallback. These are implementation details, not services users need to configure for the standard hosted page.

## Current Limitations / Next Steps

- The iframe bridge supplies overlay transport. An iframe load or a local Activity entry is not an acknowledgement from the destination overlay; verify delivery with a test message in the overlay itself.
- The Twitch integration defaults to the authenticated channel unless a custom channel name is provided.
- YouTube refresh tokens are supported through the hosted auth bridge; Twitch still requires re-auth once the implicit-flow token expires.
- Kick depends on public metadata endpoints or the Social Stream Kick bridge cache to resolve chatroom IDs, so some channels may still need manual advanced overrides.

### TikTok LIVE via proxy

The standard Lite UI currently hides this card. The following describes the integration in the code, not an available control in the standard panel. Proxy availability has not been verified.

The TikTok plugin relies on a small Socket.IO proxy that speaks the TikTok Chat Reader wire format. To use it:

1. Run a TikTok Chat Reader–compatible proxy yourself (any Node.js 18 environment works: local machine, VPS, Docker, etc.), or use the hosted default at `https://tiktok.socialstream.ninja:8089`.
2. In the TikTok card inside Web-only mode, paste the proxy URL into **Proxy server URL** and click **Connect**.

Harden CORS or authentication as needed if exposing your own proxy publicly.

## Directory Overview

```
lite/
|-- index.html           # Lite control panel entry point
|-- styles.css           # Minimal styling for the one-page UI
|-- app.js               # Core controller (sessions, plugins, activity)
|-- utils/
|   |-- dockMessenger.js # Dock iframe bridge helper
|   |-- emoteManager.js  # Emote loading/parsing helpers
|   |-- helpers.js       # Common helpers (IDs, formatting)
|   `-- storage.js       # Namespaced localStorage helpers
|-- vendor/              # Bundled client libraries (tmi.js, Socket.IO, TikTok connector)
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

## Local validation

Run `node scripts/lite-obs-modes-regressions.cjs` for the standalone capture path, reload behavior, OAuth view restoration, and dock configuration. These are browser fixtures, not a live OBS authentication certification.

Run `node scripts/lite-ui-regressions.cjs` for onboarding, session links, reconnect controls, and mobile/popout/OBS layouts. Run `node scripts/lite-emote-rendering-regressions.cjs` for rich chat rendering, and `node --test tests/review-critical-regressions.test.cjs` for the shared regression suite. Browser checks use local fixtures and block external network requests; they do not establish live provider availability.
