# Special-Case Platform And Helper Sources

Status: source-backed quick/heavy pass from current source files, manifest rows, and existing platform docs on 2026-06-24.

## Purpose

Use this page for source files that were easy to misroute in the file matrix because they are not a clean fit for the larger grouped platform pages.

This includes:

- normal rendered-page capture files that also have separate WebSocket/API source pages,
- helper/demo files that are loaded by manifest rows but are not chat parsers,
- top-level helper copies that are not manifest-loaded in the current build,
- platform pages where the payload source identity differs from the file or public site name.

## Source Anchors

- `manifest.json`
- `sources/joystick.js`
- `sources/velora.js`
- `sources/vercel.js`
- `sources/verticalpixelzone.js`
- `sources/vpzone.js`
- `sources/inject/vpzone-ws.js`
- `sources/x.js`
- `sources/static/x.js`
- `sources/youtube_comments.js`
- `sources/youtube_static.js`
- `sources/static/youtube_static.js`
- `08-platform-sources/websocket-source-pages.md`
- `08-platform-sources/manual-static-and-helper-sources.md`
- `08-platform-sources/youtube.md`

## Routing Rule

| Question Type | Start With |
| --- | --- |
| Joystick, Velora, or VPZone normal website/chat page capture | This page, then the exact top-level source file. |
| Joystick, Velora, or VPZone source-page/API/socket setup | `websocket-source-pages.md`. |
| X live chat or broadcast chat capture | This page and `sources/x.js`. |
| X static post/manual grab capture | `manual-static-and-helper-sources.md` and `sources/static/x.js`. |
| YouTube live chat | `youtube.md` and `sources/youtube.js`. |
| YouTube static comments/watch-page helper | `manual-static-and-helper-sources.md`, `youtube.md`, and the exact helper file. |
| Vercel demo launcher session access | This page and `sources/vercel.js`; it is a helper, not a platform chat source. |

## Source Matrix

| Source | Manifest/Load Path | What It Captures Or Does | Source Identity | Support Notes |
| --- | --- | --- | --- | --- |
| Joystick DOM chat | `sources/joystick.js` on `https://joystick.tv/u/*/chat` | Watches `#chat-messages` for new `.chat-message` rows. Extracts name, message, streamer badge, notice rows, bot rows, and focuses `input[flow-id="chat-message-text-input"]`. | Payload `type: "joystick"` and `getSource` returns `joystick`. | This is rendered-page capture. Joystick bot Gateway/OAuth/send-back belongs to `sources/websocket/joystick.*` and `websocket-source-pages.md`. |
| Velora rendered site | `sources/velora.js` on `https://velora.tv/*` | Watches rendered chat rows, extracts badges before the username button, messages, name color, donation/Volts text, channel-points style "says" events, subscription rows, and viewer counts when viewer-count/hype settings are enabled. | Payload `type: "velora"` and `getSource` returns `velora`. | This DOM path is separate from the Velora OAuth/API source page. Do not promise send-back from the DOM script; send-back belongs to the source-page API path. |
| Vercel demo launcher | `sources/vercel.js` on `https://maestro-launcher.vercel.app/` | Requests the current SSN stream/session ID from the extension, prompts the user unless `sharestreamid` is already allowed, writes the ID into `#roomId`, and calls the page's `updatedChatID` hook if present. | No chat payload source. | Treat as a demo/helper bridge for session access. It is not chat capture and not a supported social platform parser. |
| Vertical Pixel Zone | `sources/verticalpixelzone.js` on `https://verticalpixelzone.com/*` | Attempts to watch a rendered chat container and extracts avatar, `.message-username`, and `.message-text-inner` content. Focuses `.input > input[type="text"][name^="chat_"]`. | `getSource` returns `verticalpixelzone`, but emitted payload `type` is `arena` in the inspected file. | Source identity mismatch is important for filters and support answers. The active observer selector looks fragile and needs live validation before promising current support. |
| VPZone rendered site | `sources/vpzone.js` on `vpzone.tv` domains, paired with `sources/inject/vpzone-ws.js` | Uses the main-world WebSocket interceptor when frames are available and falls back to rendered DOM rows. Captures chat, follow/subscription/raid/gift/clip/system events, joined/left rows, badges, Twitch-origin badges, avatars, and viewer counts when allowed by settings and page data. | Payload `type: "vpzone"` and `getSource` returns `vpzone`. | The injected WS capture is source-of-truth when active and suppresses duplicate DOM emission. The separate `sources/websocket/vpzone.*` source page has OAuth/token setup and send-back paths. |
| X live/broadcast chat | `sources/x.js` on X/Twitter chat/live/livechat and broadcast URL patterns | Watches X chat containers built around avatar/testid nodes. Extracts display name, username, avatar, message, name color, and viewer counts when viewer-count/hype settings are enabled. Can reload a not-live retry screen after a delay. | Payload `type: "x"` or `type: "twitter"` when `detweet` is enabled; `getSource` follows the same setting. | This is the live/chat path. Static X post grabbing, auto-grab, promoted-content blocking, and manual buttons are in `sources/static/x.js`. |
| YouTube live-chat helper copy | `sources/youtube_comments.js`; no current manifest refs in the matrix | Processes `yt-live-chat-*` rows and watch-page chat iframe rows, including messages, Super Chats, stickers, memberships, badges, and avatars. It intentionally does not answer `getSource` so it does not override `sources/youtube.js`. | Emits payload `type: "youtube"` when directly loaded. | Treat as unmanifested helper/legacy support unless a caller directly loads it. Normal YouTube live chat routing starts in `youtube.md` and `sources/youtube.js`. |
| YouTube static helper top-level copy | `sources/youtube_static.js`; no current manifest refs in the matrix | Adds static comment send buttons, YouTube watch-page layout helpers, paid-promotion hiding, and audio output picker behavior similar to `sources/static/youtube_static.js`. Source comment marks it as a temporary copy added in March 2026. | Emits payload `type: "youtube"` for selected static comments. Unlike `sources/static/youtube_static.js`, this top-level copy answers `getSource` as `youtube`. | Treat as a temporary/unmanifested helper copy unless directly loaded. The manifest-loaded static helper is `sources/static/youtube_static.js`; normal live chat is `sources/youtube.js`. |

## Mode Boundaries

Joystick, Velora, and VPZone each have two different kinds of support:

| Platform | Rendered Site Script | Source Page / API Script |
| --- | --- | --- |
| Joystick | `sources/joystick.js` captures visible chat rows on `joystick.tv/u/*/chat`. | `sources/websocket/joystick.*` handles bot GatewayChannel auth, event normalization, and send-back. |
| Velora | `sources/velora.js` captures rendered chat and selected DOM activity rows on `velora.tv/*`. | `sources/websocket/velora.*` handles OAuth/API events, token refresh, viewer updates, and send-back. |
| VPZone | `sources/vpzone.js` captures rendered rows and consumes intercepted VPZone WebSocket frames from the actual VPZone site. | `sources/websocket/vpzone.*` handles source-page channel/token/OAuth setup, API/socket events, viewer updates, and send-back. |

For support answers, ask which mode the user is using before troubleshooting. A working website capture does not prove the source-page API path is configured, and a connected source page does not prove the normal website DOM parser is healthy.

## Send-Back And Focus Rules

| Source | `focusChat` | Send-Back |
| --- | --- | --- |
| `sources/joystick.js` | Focuses the Joystick chat input. | No source-level `SEND_MESSAGE` path verified in this file. Use `sources/websocket/joystick.*` for send-back. |
| `sources/velora.js` | Focuses the Velora contenteditable chat input. | No source-level `SEND_MESSAGE` path verified in this file. Use `sources/websocket/velora.*` for send-back. |
| `sources/vercel.js` | Not a chat source. | Not applicable. |
| `sources/verticalpixelzone.js` | Focuses a chat input selector. | No source-level `SEND_MESSAGE` path verified in this file. |
| `sources/vpzone.js` | Focuses VPZone's rendered chat input when found. | No source-level `SEND_MESSAGE` path verified in this top-level file. Use `sources/websocket/vpzone.*` for source-page send-back. |
| `sources/x.js` | Focuses the X chat composer when found. | No source-level `SEND_MESSAGE` path verified in this file. |
| `sources/youtube_comments.js` | Focuses `div#input`. | It is an unmanifested helper and intentionally does not answer `getSource`. Use `youtube.md` for current YouTube send behavior. |
| `sources/youtube_static.js` | Does not use focus for live chat. | Static comment helper only; do not treat as YouTube live send-back. |

## Support Answer Patterns

| Question | Short Answer |
| --- | --- |
| "Joystick works on the website but not the WebSocket source page." | Separate the modes. `sources/joystick.js` is rendered chat capture; `sources/websocket/joystick.*` needs bot credentials/OAuth and GatewayChannel connection. |
| "Velora chat appears but I cannot send replies." | The DOM source captures rendered rows. Reply/send-back is a Velora source-page/API feature and depends on OAuth, token state, and channel permissions. |
| "VPZone duplicates messages." | Check whether `sources/inject/vpzone-ws.js` is active and whether `sources/vpzone.js` suppresses DOM rows after the first intercepted WebSocket frame. |
| "Vertical Pixel Zone says source verticalpixelzone but filters see arena." | The inspected file returns `verticalpixelzone` for `getSource` but emits payload `type: "arena"`. Source filters and overlays can see the payload type. |
| "Why does X show as Twitter?" | The `detweet` setting changes X source identity from `x` to `twitter`. Check that setting before debugging filters or custom CSS. |
| "Why does `youtube_comments.js` or top-level `youtube_static.js` not run?" | They are not manifest-loaded in the current matrix. Treat them as helper/legacy/direct-load files and start normal YouTube troubleshooting with `youtube.md`. |
| "What does the Vercel Demo source do?" | It shares the SSN session ID with the demo launcher after user approval. It does not capture chat. |

## Extraction Caveats

- This pass was source inspection only, not live browser testing.
- `sources/verticalpixelzone.js` has a payload/source identity mismatch and fragile-looking observer selectors; validate live before making strong support claims.
- `sources/youtube_static.js` is explicitly marked in source comments as a temporary copy. It should not be treated as the canonical static helper while `sources/static/youtube_static.js` is the manifest-loaded helper.
- `sources/youtube_comments.js` may still be useful as historical context, but no current manifest row loads it.
- Joystick, Velora, and VPZone source-page send-back claims must stay routed through `websocket-source-pages.md`, not the rendered website scripts.
