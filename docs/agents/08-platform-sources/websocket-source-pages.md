# WebSocket And API Source Pages

Status: heavy grouped pass started on 2026-06-24. This page documents source pages under `sources/websocket/` that connect to platform sockets, APIs, relays, or custom source services.

Use this page when a user asks about `sources/websocket/*.html`, richer source modes, socket/API source setup, source-page auth, or whether a WebSocket page is the same thing as a normal chat overlay.

## Source Anchors

- `sources/websocket/bilibili.html`, `sources/websocket/bilibili.js`
- `sources/websocket/irc.html`, `sources/websocket/irc.js`
- `sources/websocket/joystick.html`, `sources/websocket/joystick.js`
- `sources/websocket/nostr.html`, `sources/websocket/nostr.js`
- `sources/websocket/socialstreamchat.html`, `sources/websocket/socialstreamchat.js`
- `sources/websocket/stageten.html`, `sources/websocket/stageten.js`
- `sources/websocket/streamlabs.html`, `sources/websocket/streamlabs.js`
- `sources/websocket/velora.html`, `sources/websocket/velora.js`
- `sources/websocket/vpzone.html`, `sources/websocket/vpzone.js`
- Covered in platform pages: `sources/websocket/youtube.*`, `twitch.*`, `kick.*`, `rumble.*`, and `facebook.*`
- Shared source-page assets: `sources/websocket/*.css`, `sources/websocket/emotes.json`, `sources/websocket/custom_emotes.json`
- Source control docs: `manifest.json`, `08-platform-sources/source-file-processing-matrix.md`, `08-platform-sources/platform-capability-matrix.md`

## What These Pages Are

WebSocket/API source pages are capture surfaces. They are not OBS overlays, and they are not the same as `dock.html` or `featured.html`.

The common pattern is:

1. The user opens a source page such as `sources/websocket/velora.html`.
2. The page collects source-specific setup such as a room ID, channel ID, token, OAuth sign-in, or socket endpoint.
3. The page connects to a platform socket/API, receives platform events, and normalizes them into SSN message objects.
4. The paired content script or in-page bridge sends those objects to SSN with `chrome.runtime.sendMessage`, `window.ninjafy`, or a postMessage fallback.
5. Some pages also respond to SSN send-back requests through `SEND_MESSAGE`.

For support, always separate:

- Source side: the WebSocket/API source page must be connected.
- Receiving side: dock, featured, overlays, API clients, or tool pages must use the same SSN session.
- Auth side: OAuth, token, room, and channel setup can fail even when the receiving pages are fine.

## Shared Bridge Behavior

Most source pages implement some combination of:

| Bridge Feature | Meaning |
| --- | --- |
| `getSource` | Returns the source type used by SSN send-back routing, such as `bilibili`, `irc`, `joystick`, `vpzone`, or `velora`. |
| `focusChat` | Focuses the page's chat input when the source page has one. Some read-only/event-only pages return false. |
| `getSettings` | Pulls extension settings such as `textonlymode`, event hiding, or viewer-count settings. |
| `SEND_MESSAGE` | Attempts to send a chat message back through the platform/socket/API. This depends on source support, auth, and connection state. |
| `wssStatus` | Some pages emit connection status payloads so support tooling can show source health. |

Do not infer send-chat support from the page existing. Confirm the page has `SEND_MESSAGE` handling and a working platform send path.

## Source Page Matrix

| Page Pair | Main Setup | Captures | Send-Back | Support Notes |
| --- | --- | --- | --- | --- |
| `bilibili.html` / `bilibili.js` | Bilibili room ID; optional cookie/auth for sending | Chat, gifts, super chat, user-enter, follower updates, live/offline status | Yes, via `SEND_BILIBILI_MESSAGE` when credentials/session allow it | Uses Bilibili room APIs, socket packets, and a content-script bridge. If receive works but send fails, check cookie/auth and platform-side permission first. |
| `irc.html` / `irc.js` | IRC server/channel/user fields in the page | IRC messages normalized through `IRCMessage` | Yes, via `SEND_IRC_MESSAGE` | `getSource` returns `irc`; `focusChat` targets `messageInput`. Useful for custom IRC-style workflows. |
| `joystick.html` / `joystick.js` | Joystick bot client ID/secret, OAuth or external app auth, channel slug/ID | Chat messages, user presence, stream online/offline, follows, token/tip style donation events | Yes, when socket is connected/subscribed and channel ID is known | Requires bot credentials for the gateway socket. Authorize starts on `joystick.tv`; token, REST, and cable use `api.joystick.tv`. Token/REST calls should use the extension background fetch or desktop `window.ninjafy.fetchJoystickJson` bridge because normal hosted-page fetch can hit CORS. Stream settings can hydrate channel ID, source name/image, live state, and follower count, but current Joystick docs do not expose live viewer count. OAuth token storage/refresh is local to the source page. |
| `nostr.html` / `nostr.js` | Nostr relay/filter setup in the page | Nostr events forwarded as source messages | No documented send-back in the bridge | `getSource` deliberately returns false and `focusChat` returns false. Treat it as read-only unless source-checking proves otherwise. |
| `socialstreamchat.html` / `socialstreamchat.js` | Social Stream chat room ID and optional token | Chat/event envelopes from `chat.socialstream.ninja` | Page has local send logic, but the extension bridge does not advertise `SEND_MESSAGE` handling in the inspected script | Internal/custom source path. It can mint a guest token for rooms that allow it; auth failures usually mean room token/permission setup, not overlay failure. |
| `stageten.html` / `stageten.js` | StageTEN channel ID | PubNub chat messages from public chat access credentials | Page has local send logic; extension `SEND_MESSAGE` handling was not present in the inspected bridge | Fetches public chat access from StageTEN's plugin-service GraphQL endpoint and refreshes PubNub tokens. CORS failures are a known page-level setup issue. |
| `streamlabs.html` / `streamlabs.js` | Streamlabs Socket API token; optional webhook URL; optional auto-connect | Donation/subscription/follow/raid/merch and other alert socket events | No platform chat send-back; this is alert/event ingestion | Relays one or more normalized event messages and can optionally POST to a webhook. It is separate from alert-box DOM capture. |
| `velora.html` / `velora.js` | Velora OAuth PKCE or app auth bridge; stored access/refresh token | Chat, follow, subscribe, gift subscription, volts, raids, channel points, viewer updates | Yes, via API send path when signed in and connected | Uses official Velora event/API paths with token refresh. `viewer_update` depends on viewer-count/hype settings. |
| `vpzone.html` / `vpzone.js` | VPZone channel, WebSocket URL, OAuth or token/developer mode | Chat, mapped events such as followers/subscribers/gifts/raids, viewer updates | Yes, when signed in/tokened and channel is known | Has both extension bridge and app/OAuth bridge paths. `focusChat` returns false because it is source-control oriented rather than a native chat input page. |

## Covered Elsewhere

These WebSocket/API pages already have dedicated platform docs:

| Page Pair | Use |
| --- | --- |
| `youtube.html` / `youtube.js` / `youtube.css` | See `youtube.md` for YouTube Data API, chat polling/streaming, subscriber/follower style events, send-chat, and moderation paths. |
| `twitch.html` / `twitch.js` | See `twitch.md` for IRC/EventSub, chat sending, follows, raids, channel points, subscriptions, ads, and moderation paths. |
| `kick.html` / `kick.js` / `kick.css` | See `kick.md` for Kick OAuth bridge, chat, rewards, subscriptions, followers, send-chat, and moderation paths. |
| `rumble.html` / `rumble.js` | See `rumble.md` for Rumble Live Stream API URL behavior and read-only support boundaries. |
| `facebook.html` / `facebook.js` | See `facebook.md` for Facebook DOM vs managed Page/Graph API behavior. |

## Shared Assets

| Asset | Role |
| --- | --- |
| `emotes.json` | Large source-page emote data used by WebSocket/API pages that render or normalize emote metadata. |
| `custom_emotes.json` | Additional/custom emote data used by source pages. |
| `websocket-responsive.css` | Shared responsive source-page layout styling. |
| `youtube.css`, `kick.css`, `velora.css` | Platform-specific source-page styling. |

Treat JSON/CSS assets as paired source-page resources. They do not capture chat by themselves.

## Support Answer Patterns

### "Which WebSocket source URL do I open?"

Use `13-reference/surface-url-cheatsheet.md` for exact URL routing, then this page for setup and caveats.

Common hosted forms:

```text
https://socialstream.ninja/sources/websocket/bilibili.html
https://socialstream.ninja/sources/websocket/irc.html
https://socialstream.ninja/sources/websocket/joystick.html
https://socialstream.ninja/sources/websocket/streamlabs.html
https://socialstream.ninja/sources/websocket/velora.html
https://socialstream.ninja/sources/websocket/vpzone.html?channel=USERNAME
```

### "Dock is blank after I opened a WebSocket source page."

Check in this order:

1. The source page is connected and shows a connected status.
2. The receiving page is on the same SSN session as the extension/app.
3. Required OAuth/token/channel/room fields are present.
4. Browser/app console has no CORS, token, 401/403, socket, or extension-context errors.
5. The source page is not merely an event/token setup page waiting for a real platform event.

### "Can it reply/send chat?"

Answer by source:

- Bilibili, IRC, Joystick, Velora, and VPZone have inspected send-back paths, but they still depend on auth, connection state, and platform permissions.
- Streamlabs is alert/event ingestion, not chat send-back.
- Nostr is read-only in the inspected bridge.
- Social Stream Chat and StageTEN have local page send functions, but their inspected extension bridges did not expose a `SEND_MESSAGE` route. Source-check before promising API/dock send-back.
- YouTube, Twitch, Kick, Rumble, and Facebook send behavior must be answered from their platform docs.

### "Why does WebSocket mode show different events than DOM mode?"

That is expected. DOM mode sees rendered page content. WebSocket/API source pages receive socket/API events and can expose metadata that never appears in the DOM, but they can also miss visual-only cards, badges, or platform UI details that the DOM page renders.

## App And Extension Boundaries

- The browser extension path usually uses `chrome.runtime.sendMessage`.
- The standalone app can add app bridge helpers such as `window.ninjafy` or `window.__ssapp` for OAuth/source-window flows.
- A page working in Chrome does not prove it works in the Electron app; app source-window auth, session partition, and bridge behavior must be checked separately.
- Secrets in URL query/hash, localStorage, OAuth tokens, webhook URLs, and API tokens must be redacted from support screenshots.

## Extraction Gaps

Needed future passes:

- Line-level validation for every `SEND_MESSAGE` path and source-page `getSource` response.
- Exact hosted/public source URL list and popup-generated source links.
- App parity validation for Joystick, Velora, VPZone, Kick, Twitch, YouTube, Facebook, and Rumble source pages.
- Controlled socket/API payload samples for Bilibili, IRC, Joystick, Streamlabs, StageTEN, Velora, VPZone, Nostr, and Social Stream Chat.
- Live/browser validation for CORS, token refresh, reconnect behavior, and localStorage cleanup.
