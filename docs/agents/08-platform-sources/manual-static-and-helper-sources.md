# Manual, Static, And Helper Sources

Status: source-backed quick/heavy pass for static source helpers, injected WebSocket interceptors, and media/helper scripts on 2026-06-24.

## Purpose

Use this page when a file in `sources/static/`, `sources/inject/`, or a helper-like `sources/*.js` row appears in the source matrix and the question is "is this a normal chat source?"

Many of these files are not routeable live chat parsers. Some add manual capture buttons, some patch page WebSockets for a paired content script, and some modify a platform page while the real chat source lives somewhere else.

## Source Anchors

- `manifest.json`
- `popup.html`
- `popup.js`
- `shared/config/settingsDefinitions.js`
- `sources/static/claude.js`
- `sources/static/threads.js`
- `sources/static/x.js`
- `sources/static/youtube_static.js`
- `sources/static/kick_chatroom_scout.js`
- `sources/static/twitch_points.js`
- `sources/inject/streamelements-ws.js`
- `sources/inject/vpzone-ws.js`
- `sources/inject/whatnot-ws.js`
- `sources/streamelements.js`
- `sources/vpzone.js`
- `sources/whatnot.js`
- `sources/autoreload.js`
- `sources/capturevideo.js`
- `sources/grabvideo.js`

## Routing Rule

| File Family | Treat As | Do Not Claim |
| --- | --- | --- |
| `sources/static/*` | Static/manual page helpers or optional platform extras. | Do not assume automatic live chat capture unless the file sends SSN payloads and exposes a routeable source. |
| `sources/inject/*` | Main-world WebSocket interceptors consumed by a paired content script. | Do not treat them as standalone source integrations. |
| `sources/capturevideo.js` / `grabvideo.js` | VDO.Ninja media publishing helpers/SDK experiments. | Do not treat them as chat capture files. |
| `sources/autoreload.js` | Personal/easter-egg reload helper. | Do not present it as a normal supported platform feature. |

For normal platform capture, route to the platform doc, `source-file-processing-matrix.md`, and the exact source file.

## Static Helper Matrix

| File | Manifest Load | Main Behavior | Settings/State | Support Notes |
| --- | --- | --- | --- | --- |
| `sources/static/claude.js` | `https://claude.ai/*` | When SSN is enabled, stores and overrides Claude's `--font-claude-message` CSS variable, then restores it when disabled. Answers `getSource` as `claude`. | Uses extension state and settings response. | This is mostly a Claude UI/font helper. It does not parse Claude messages into SSN chat payloads in the current pass. |
| `sources/static/threads.js` | `https://www.threads.net/*` | Adds manual send/block controls to Threads posts, decodes `l.threads.net` redirect links, extracts name/avatar/message/content image, and sends a selected post as type `threads`. | Uses extension state and `textonlymode`. | This is manual/static capture, not all-post automatic capture. The user must use the injected control. |
| `sources/static/x.js` | `https://x.com/*`, `https://www.x.com/*` | Adds an "Overlay Service" toggle, manual "Grab" buttons, Auto-grab Mode, optional posting focus, detweet branding, promoted-content blocking, and selected post/video capture helpers. Sends payload type `x` or `twitter`. | Popup setting `xcapture`; setting `detweet`; localStorage keys `enabledSSN`, `autoGrabTweets`, `allowposting`, `blockingAds`, `grabbedTweets`; optional `storeBSky` branch in source. | Advanced/static X capture depends on X DOM shape and local per-site state. It is separate from the normal X live/chat source file. |
| `sources/static/youtube_static.js` | `https://www.youtube.com/*` | Adds an `SS` button on YouTube watch pages for static comment capture, sends selected comments as type `youtube`, flips watch page layout, hides paid-promotion banners, and can show an in-page audio output picker. | Settings `flipYoutube`, `hidePaidPromotion`; popup UI setting `youtubeAudioPicker`; extension state; `textonlymode`. | This is not the normal YouTube live chat parser. Live chat capture is handled by `sources/youtube.js` and WebSocket/API source pages. |
| `sources/static/kick_chatroom_scout.js` | `https://kick.com/*`, `document_start` | Extracts Kick slugs while browsing, checks `https://kick-bridge.socialstream.ninja/kick/lookup`, and can seed `/kick/chatroom-cache` when a stored bridge token exists. | Setting `kickchatroomscout`; storage key `kickScoutBridgeToken`; internal rate limits and retry timers. | This improves Kick chatroom ID lookup/cache behavior. It does not capture or send chat messages. It intentionally does not answer `getSource`. |
| `sources/static/twitch_points.js` | `https://*.twitch.tv/*`, `document_start` | Collects Twitch channel points when enabled, moves a clip control, optionally mutes ad video, and can emit `Ad Alert` messages with event `ad_break` on ad start/end. | Settings `collecttwitchpoints`, `twichadmute`, `twichadannounce`; extension settings response. | This is a Twitch helper, not the Twitch chat parser. It intentionally does not answer `getSource` so it does not override `sources/twitch.js`. |

## Injected WebSocket Interceptors

These files are injected into the page's main JavaScript world because content scripts cannot always see page-owned WebSocket frames directly.

| Interceptor | Loaded By | What It Hooks | Consumer | Support Notes |
| --- | --- | --- | --- | --- |
| `sources/inject/streamelements-ws.js` | Injected by `sources/streamelements.js` as a web-accessible resource. | `window.WebSocket` connections whose URL includes `streamelements.com`; posts open, close, send, and message events with source `streamelements-ws-interceptor`. | `sources/streamelements.js` listens for the tag, parses Socket.IO `42` event frames, and emits StreamElements event payloads. | If StreamElements capture breaks, debug both the injected script load and the consumer parser. The interceptor alone does not emit SSN messages. |
| `sources/inject/vpzone-ws.js` | Manifest main-world content script on `vpzone.tv` domains. | `wss://chat*.vpzone.tv/...`; posts receive/send frames with channel and source `vpzone-ws-interceptor`. | `sources/vpzone.js` consumes `receive` frames and treats WS capture as source-of-truth, suppressing duplicate DOM row emission when active. | If VPZone duplicates appear, check whether WS capture is active and whether DOM fallback suppression is working. |
| `sources/inject/whatnot-ws.js` | Manifest main-world content script on Whatnot live/dashboard pages. | `wss://www.whatnot.com/...`; posts receive/send frames with source `whatnot-ws-interceptor`. | `sources/whatnot.js` consumes received frames, parses Whatnot WebSocket frames, and emits chat/event/commerce payloads. | If Whatnot events disappear, debug the main-world WebSocket hook and the paired `sources/whatnot.js` parser together. |

## Media And Utility Helpers

| File | Role | Settings/State | Support Notes |
| --- | --- | --- | --- |
| `sources/capturevideo.js` | Discord-channel VDO.Ninja auto-publisher. When `vdoninjadiscord` is enabled, it scans `video` elements, publishes them into a random `autopublish_*` VDO.Ninja room, adds view/copy indicators, and maintains a group scene link. It uses `captureStream` where available and has fallback media/canvas handling. | Setting `vdoninjadiscord`; random in-page room ID; Chrome storage/settings messages. | This is a media sharing helper, not chat capture. Failures are usually browser media API, Discord DOM, autoplay/audio, or VDO.Ninja connection issues. |
| `sources/grabvideo.js` | Standalone `VDONinjaSDK` implementation with `connect`, `joinRoom`, `publish`, `view`, and `disconnect` methods for VDO.Ninja/custom signaling modes. | SDK configuration, signaling URL, ICE/TURN config, encryption mode, room/stream IDs. | Treat as a helper library/experiment unless a caller imports it. It is not listed as a manifest content script. |
| `sources/autoreload.js` | Reload helper for URLs matching `https://*/*autoreloadwithsocialstream`. It reloads incomplete pages or pages where a Best Buy add-to-cart button is still disabled, and alerts when the button appears enabled. | URL marker only; runs regardless of extension enabled state. | This is explicitly an easter-egg/personal helper in source comments. Do not present it as general SSN platform support. |

## Support Answer Patterns

| Question | Short Answer |
| --- | --- |
| "Why does `youtube_static.js` not catch my live chat?" | It is for YouTube watch-page helpers and static comments. Use the YouTube live chat source path or WebSocket/API source page for live chat. |
| "Does Kick chatroom scout capture chat?" | No. It only helps discover/cache Kick chatroom IDs for bridge/WebSocket workflows. Chat capture still depends on the Kick source mode. |
| "Why did Twitch send an ad message but no chat?" | `sources/static/twitch_points.js` can emit ad-break helper events, but chat capture is handled by the Twitch source. Check Twitch popout/WebSocket setup separately. |
| "Is Claude support chat capture?" | In this pass, `sources/static/claude.js` is a Claude page font/helper script. Do not claim Claude message capture without checking the current source behavior. |
| "Why is X capture weird or duplicated?" | X static capture uses local toggles, manual/auto grab state, and X DOM selectors. Check `xcapture`, localStorage state, auto mode, and whether the normal X live/chat path is also active. |
| "Can the injected WS file work by itself?" | No. Interceptors post browser messages; the paired content script must consume and convert them into SSN payloads. |

## Extraction Caveats

- This pass was source inspection only, not live browser testing.
- The X and Threads DOM selectors are brittle because the platforms change markup frequently.
- `youtubeAudioPicker` is present in `popup.html`, popup beginner-mode selectors, and `sources/static/youtube_static.js`, but it was not found in `shared/config/settingsDefinitions.js` during this pass. Treat generated setting-index coverage accordingly.
- `storeBSky` appears as an optional branch in `sources/static/x.js`, but no generated setting definition was found in this pass.
- For final user-facing claims, verify the exact current manifest row, popup setting visibility, and live platform page behavior.
