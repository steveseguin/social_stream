# Video Broadcast Platform Sources

Status: quick/heavy source pass from current `sources/*.js`, public supported-site lookup, and manifest matrices on 2026-06-24.

Use this page for smaller video, audio, broadcast, and platform chat sources that are mostly rendered-page or chat-only DOM parsers.

This page covers:

- Mixlr
- NicoVideo
- NonOLive
- OpenStreamingPlatform
- Owncast
- PeerTube
- Restream.io Chat
- Steam Broadcasts
- Trovo
- Truffle.vip
- TwitCasting
- Vimeo
- YouNow
- Zap.stream

## Core Boundary

These sources are mostly rendered chat capture. They are not the richer WebSocket/API source-page workflows unless a platform-specific source page says otherwise.

Safe answer:

```text
This source captures rendered chat from the platform page or chat-only page. Use the exact supported URL, keep the chat visible and loaded, then test with a new message after SSN connects. Rich events, Q&A, upstream source labels, and send-back vary by source.
```

Do not assume:

- full platform API access
- moderation events
- complete donation/subscription/event support
- official app parity
- send-back support just because `focusChat` exists
- old chat history will always be imported

## Source Matrix

| Platform | Files | Public/Manifest Setup | Captures | Extras | First Checks |
| --- | --- | --- | --- | --- | --- |
| Mixlr | `sources/mixlr.js` | Public setup uses `https://*.mixlr.com/events/*`; public notes warn paywall/limited support. | Profile image, name, message. | Payload `type: "mixlr"`; no rich donation/event path found. | Confirm event URL, access/paywall state, chat loaded, and new message after source loads. |
| NicoVideo | `sources/nicovideo.js` | Public and manifest use `https://live.nicovideo.jp/watch/*`. | User name and comment text from live comment rows. | `focusChat` removes iframes before focusing the comment box in inspected source. | Confirm live watch URL and current comment UI; be careful with iframe/page-layout changes. |
| NonOLive | `sources/nonolive.js` | Public notes say partial support and no popout needed; manifest matches `https://www.nonolive.com/*`. | Name and message, including inline images when not in text-only mode. | Donation variable exists but rant/donation extraction is commented out in inspected source. | Treat as partial rendered chat capture; do not promise donation support. |
| OpenStreamingPlatform | `sources/openstreamingplatform.js` | Manifest row uses demo chat-only URL `https://demo.openstreamingplatform.com/view/*chatOnly=True*`; no public card mapping found in this pass. | Chat username and message from OSP chat rows. | Name text has parenthesized content stripped. | Confirm exact `chatOnly=True` URL; treat as manifest/source evidence until public routing is reconciled. |
| Owncast | `sources/owncast.js` | Public says normal Owncast page or embedded read/write chat URL; manifest includes `https://watch.owncast.online/*` and `https://live.simontv.org/*`. | Name and message. | Badge images/SVGs are captured; avatar is intentionally blank in current payload. | Confirm source URL shape and visible `#chat-container`; old rows may be skipped by index logic. |
| PeerTube | `sources/peertube.js` | Public says use livechat plugin room URLs; manifest includes plugin router and room query URL forms. | Converse/PeerTube livechat author, message, and avatar when not generic SVG data. | If no access token and no chat content, source can prompt the user to sign in on the PeerTube site. | Confirm livechat plugin room URL and login state on that instance. |
| Restream.io Chat | `sources/restream.js` | Public setup uses `https://chat.restream.io/chat`; manifest matches `https://chat.restream.io/*`. | Aggregated chat name, name color, avatar, and message. | Can include `sourceImg` for upstream platform icon; type remains `restream`. | Ask whether the issue is Restream chat capture or upstream-platform identity; verify Restream chat page is open. |
| Steam Broadcasts | `sources/steam.js` | Public and manifest use `https://steamcommunity.com/broadcast/chatonly/*`; manifest uses `all_frames`. | Chat name, message, and avatar fetched through Steam miniprofile lookup. | `focusChat` targets the `ChatOnly` iframe textarea. | Confirm chat-only URL and frame loaded; avatar fetch can fail separately from message capture. |
| Trovo | `sources/trovo.js` | Manifest matches `https://trovo.live/chat/*` with `document_start` and `all_frames`; no public card mapping found in this pass. | Name, name color, avatar, message, and badge images. | Avatar URL is rewritten from small/webp style to larger jpg-style URL; `nosubcolor` setting can suppress name color. | Treat as manifest/source evidence until public card routing is reconciled; verify exact chat URL. |
| Truffle.vip | `sources/truffle.js` | Public and manifest use `https://chat.truffle.vip/chat/*`. | Name, name color, message, badges, optional Twitch avatar. | Payload `type` can be `truffle`, `twitch`, or `youtube` based on platform icon; duplicate suppression by user/message. | Do not assume all Truffle messages arrive as `type: "truffle"`. Check upstream platform icon behavior. |
| TwitCasting | `sources/twitcasting.js` | Public says use `twitcasting.tv` pages; manifest includes `https://*.twitcasting.tv/*` and `https://twitcasting.tv/*`. | Comment avatar, name, and message. | Basic rendered chat payload `type: "twitcasting"`. | Confirm correct TwitCasting page and comment list; no rich event path found. |
| Vimeo | `sources/vimeo.js` | Public says Vimeo event/live-chat pages; manifest covers live and event URL shapes with `all_frames`. | Chat author, message, avatar, and Q&A item text. | Q&A/sidebar rows set `question: true`; avatar may be converted to a data URL before forwarding. | Ask whether the user expects chat or Q&A; verify the interaction sidebar is open. |
| YouNow | `sources/younow.js` | Public and manifest use `https://www.younow.com/*`. | Avatar, name, message, and badge images. | Basic rendered chat payload `type: "younow"`. | Confirm live page and chat row rendering; no viewer/donation path found in this pass. |
| Zap.stream | `sources/zapstream.js` | Public and manifest use `https://zap.stream/*`. | Avatar, name, and message. | Basic rendered chat payload `type: "zapstream"`. | Confirm page/chat URL and new rendered row after SSN connects. |

## Common Behavior

- These source files send SSN payloads through the content-script message bridge with platform-specific `type` values.
- Most expose `getSource` and `focusChat`.
- In this pass, none exposed a source-level `SEND_MESSAGE` handler.
- Most only reliably capture new rendered rows after the source is connected.
- Most are sensitive to current DOM class names and chat URL shapes.
- Standalone app support needs actual source-window validation because Electron login/cookies/frame behavior can differ from Chrome.

## Rich Or Unusual Behavior

| Feature | Source-Backed Notes |
| --- | --- |
| Vimeo Q&A | Vimeo can capture Q&A/sidebar items and set `question: true`; this is not full webinar/event analytics. |
| Truffle upstream type | Truffle can emit `type: "twitch"` or `type: "youtube"` when the source icon indicates those platforms. |
| Restream source icon | Restream can include `sourceImg` for the upstream platform icon while keeping `type: "restream"`. |
| Owncast badges | Owncast captures badge images/SVGs, but current payload leaves `chatimg` blank. |
| PeerTube login prompt | PeerTube can prompt sign-in when the livechat room is not accessible. |
| Trovo badges/name color | Trovo captures badge images and name color unless `nosubcolor` disables color. |
| NonOLive donations | A donation variable exists, but donation extraction is commented out in inspected source. |
| Steam avatar lookup | Steam fetches avatars through miniprofile lookup; message capture and avatar capture can fail independently. |

## First Support Checks

1. Exact URL shape:
   - Steam needs `steamcommunity.com/broadcast/chatonly/*`.
   - PeerTube needs a livechat plugin room URL.
   - OpenStreamingPlatform uses the demo `chatOnly=True` URL in the manifest.
   - Trovo uses `trovo.live/chat/*`.
2. Whether the user is in the Chrome extension, standalone app, Firefox, or a hosted page only.
3. Whether chat is visible and a new row was sent after SSN connected.
4. Whether the user expects plain chat, Q&A, badges, upstream source identity, donations, avatars, or send-back.
5. Whether login/paywall/access restrictions block chat rendering, especially Mixlr and PeerTube.
6. Whether screenshots/logs include private event URLs, usernames, avatars, or chat text that should be redacted.

## Safe Answer Patterns

### Site Is Listed

```text
It is listed as a rendered chat source. Use the exact supported URL and keep the chat panel visible. If you need Q&A, badges, upstream source labels, or other rich fields, check the source-specific notes because plain chat support does not prove those extras.
```

### User Wants Send-Back

```text
I would not promise send-back for this source from this grouped pass. Several scripts can focus the chat box, but no source-level send-message handler was verified here.
```

### Vimeo Q&A

```text
Vimeo can mark some sidebar/Q&A rows with question: true, but that is still rendered sidebar capture. It is not a full Vimeo event analytics API.
```

### Truffle Or Restream Source Identity

```text
Truffle and Restream can expose upstream platform identity in different ways. Truffle may change the payload type to twitch or youtube, while Restream keeps type restream and may include a source icon.
```

## Do Not Promise Yet

- Trovo as a public supported-site card until public-card routing is reconciled.
- OpenStreamingPlatform as a general OSP support promise beyond the manifest demo chat-only URL.
- NonOLive donations.
- Vimeo event analytics, attendee data, or full moderation support.
- Restream send-back to upstream platforms.
- Steam avatar reliability if the miniprofile lookup fails.
- App parity for any platform in this group without source-window validation.

## Extraction Gaps

- Live/browser validation for each source in this group.
- App source-window validation for exact source URLs, iframe behavior, and login/cookie state.
- Public support reconciliation for Trovo and OpenStreamingPlatform.
- Controlled payload samples for Vimeo Q&A, Truffle upstream type, Restream `sourceImg`, Owncast badges, PeerTube login-gated chat, and Steam avatar lookup.
- Source-control/send-back validation against background handlers before answering send-message questions.
