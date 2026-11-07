# Auth And Sign-In

Status: heavy extraction pass started.

## Purpose

Document platform sign-in, OAuth, cookie/session, callback ports, and embedded-browser restrictions for SSN.

This page is source-backed for desktop app OAuth helper structure and support-derived for general platform blocking behavior. Platform-specific source pages still need intense passes for exact scopes and event availability.

## Source Anchors

- `ssapp/resources/electron-youtube-handler.js`
- `ssapp/resources/electron-twitch-handler.js`
- `ssapp/resources/electron-kick-handler.js`
- `ssapp/resources/electron-facebook-handler.js`
- `ssapp/resources/electron-spotify-handler.js`
- `ssapp/resources/electron-velora-handler.js`
- `ssapp/resources/electron-vpzone-handler.js`
- `ssapp/preload.js`
- `ssapp/main.js`
- `social_stream/sources/websocket/*.html`
- `social_stream/sources/websocket/*.js`
- `stevesbot/resources/instructions/social-stream-support.md`

## Core Rule

Always identify the auth surface before troubleshooting:

- Chrome extension using the user's existing browser login.
- Desktop app embedded/source window using an Electron session.
- Desktop app OAuth helper opening the system browser and listening on a local callback port.
- Desktop app local OAuth window, where supported by a handler.
- Platform API/WebSocket mode that requires scopes/tokens.

The same platform can behave differently across those surfaces.

## Desktop OAuth Helper Matrix

Source-checked handlers:

| Platform/helper | Callback ports | Callback path | Browser/window behavior | Notes |
| --- | --- | --- | --- | --- |
| YouTube | `8181`, then `8080` | `/sources/websocket/youtube.html` | Opens default browser with `shell.openExternal`. | Supports hosted auth URL or custom Google mode; exchanges/refreshes tokens through handler functions. |
| Twitch | `8181`, then `8080` | `/sources/websocket/twitch.html` | Opens default browser with `shell.openExternal`. | Uses implicit token flow; callback page posts hash token to local `/token`. |
| Kick | `8181`, then `8080` | `/sources/websocket/kick.html` | Can use external browser or a local OAuth window depending on payload. | Uses PKCE. Local window can reuse parent webContents session and optional preload/user-agent settings. |
| Facebook | `8181`, then `8080` | `/sources/websocket/facebook.html` | Opens external hosted auth flow and local loopback receives result. | Uses `auth.socialstream.ninja` by default. |
| Velora | `8181`, then `8080` | `/sources/websocket/velora.html` | Opens external hosted auth flow and local loopback receives result. | Uses `sso.socialstream.ninja` by default. |
| VPZone | `8181`, then `8080` | `/sources/websocket/vpzone.html` | Opens default browser with `shell.openExternal`. | Uses PKCE and exchanges the authorization code at `vpzone.tv`. |
| Spotify | `8888`, then `8080`, then `8181` | `/callback` or requested callback path | Default mode uses loopback and default browser; can fall back to intercept mode. | Spotify app redirect URIs should include the loopback URLs for the configured ports. |

Port conflict guidance:

- If the app shows a port conflict for YouTube/Twitch/Kick/Facebook/Velora/VPZone, check ports `8181` and `8080`.
- If Spotify auth fails, also check `8888`.
- Streamer.bot commonly uses `8080`, so it can block fallback auth.
- Do not claim there is a UI setting to change these ports unless source confirms it for that handler.

## What The Port Flow Does

For loopback OAuth handlers:

1. The app starts a temporary HTTP server on `127.0.0.1`.
2. It tries the configured ports in order.
3. It builds a redirect URI using the successful port.
4. It opens the auth URL in the default browser or local auth window.
5. The platform redirects back to the local callback URL.
6. The app verifies state/code/token payload and closes/cleans up the temporary server.
7. A 5-minute timeout is common across these handlers.

Failure points:

- Both callback ports are occupied.
- The default browser profile is not the logged-in profile.
- The platform rejects the redirect URI.
- State mismatch.
- User closes auth window.
- Platform returns an OAuth error.
- Firewall/security software blocks loopback.

## Extension Auth

The extension usually relies on the browser's current session and cookies. That makes it the safer recommendation when:

- The user can sign into the platform in Chrome but the app cannot.
- The platform has CAPTCHA or anti-bot checks in embedded browsers.
- The platform blocks "browser not supported" app contexts.
- The source is page/DOM based rather than API-token based.

Do not tell users to uninstall the extension to fix auth. Uninstalling can remove extension storage. Reload/update the extension instead.

## Desktop Embedded Auth

The app has mitigations for some embedded-browser issues:

- Header overrides and Electron header stripping hooks exist for activated windows.
- LinkedIn passkey initiation can be blocked for specific activated windows.
- Kick can choose a local OAuth window and optionally use preload/user-agent behavior.
- Startup flags can influence locale, local assets, TikTok classic mode, and multiple instances.

These mitigations do not guarantee platform login success. If the site is actively blocking embedded browsers, switch to extension or external-browser/WebSocket flow when available.

## Platform Notes

### YouTube / Google

Source-backed:

- Desktop helper uses loopback ports `8181` and `8080`.
- It can open a hosted Social Stream auth flow or custom Google auth mode.
- It has exchange and refresh handlers for OAuth tokens.

Support-derived:

- Google may reject embedded browser sign-in.
- Users may need the normal browser, extension, or WebSocket/API flow.

Need verification:

- Exact current YouTube source modes, gift/membership scopes, moderation behavior, and UI labels.

### Twitch

Source-backed:

- Desktop helper uses loopback ports `8181` and `8080`.
- Twitch token is returned in URL hash and posted to the local `/token` endpoint.

Support-derived:

- Users often need to press `Activate` after adding/signing in.
- Channel points/subscriptions/bans may require EventSub/WebSocket scopes rather than basic chat/IRC.

Need verification:

- Current EventSub scope matrix and event payloads.

### Kick

Source-backed:

- Desktop helper uses loopback ports `8181` and `8080`.
- Uses PKCE.
- Supports external and local auth-window modes.
- Local window can reuse the parent session and apply selected preload/user-agent settings.

Support-derived:

- CAPTCHA or human verification can block embedded login.
- Copying an external-browser auth URL into the correct browser profile may help when the default browser is wrong.

Need verification:

- Current Kick connection-mode UI and WebSocket source behavior.

### Facebook / Velora

Source-backed:

- Both use loopback ports `8181` and `8080`.
- Both rely on hosted Social Stream auth starts by default and return encoded result/error payloads to the local callback.

Need verification:

- Current source setup UI, required account/page permissions, and token persistence.

### Spotify

Source-backed:

- Spotify uses `8888`, `8080`, then `8181`.
- Loopback mode opens the default browser.
- If loopback ports are unavailable and fallback is enabled, it can use intercept mode.
- The handler expects Spotify app redirect URIs for the loopback callback URLs.

Support note:

- If Spotify auth fails, collect the attempted redirect URI and whether the user's Spotify app includes that redirect URL.

### VPZone

Source-backed:

- VPZone uses loopback ports `8181` and `8080`.
- It uses PKCE and exchanges code at `https://vpzone.tv/api/oauth/token`.
- Default scopes include profile, channel, and chat read.

Support-derived:

- Recent support records mention username casing/source-button issues; verify in source before publishing as final advice.

## Common User-Facing Troubleshooting Flow

1. Ask which surface is being used: extension or app.
2. Ask which platform and mode: Standard, WebSocket, EventSub/API, external browser, or local auth window.
3. Ask whether auth opens in the default browser or an app window.
4. If there is a port error, check the platform helper's ports.
5. If no port error appears, check whether the browser profile that opened is logged into the right account.
6. If embedded login is blocked, try the extension or external-browser flow.
7. After successful auth, stop and re-activate the source.
8. If the platform can send messages, test manual send in the platform before debugging SSN automation.

## Evidence To Collect

- Exact platform and source mode.
- Screenshot/error text.
- Whether the auth page opens in browser or app.
- Which port conflict message appears, if any.
- Whether Streamer.bot, another local server, Docker, or streaming tool is using `8080`, `8181`, or `8888`.
- Whether the user has multiple browser profiles.
- Whether extension capture works in Chrome.
- Whether clearing browser data or source reactivation changes behavior.

## Open Verification Tasks

- Check current UI labels for each auth mode.
- Build exact port-conflict user flow for each platform.
- Source-check token storage and refresh behavior per platform.
- Source-check which platforms require reactivation after auth.
- Add per-platform scope/event availability matrices.
