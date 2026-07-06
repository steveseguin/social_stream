# Popout And Chat-Only Sources

Status: heavy grouped source pass from current source files, manifest rows, and public site metadata on 2026-06-24.

Use this page for smaller supported platforms where the required setup is a popout, chat-only, or platform-specific chat URL. These are rendered DOM chat captures unless noted otherwise.

## Source Anchors

- `sources/beamstream.js`
- `sources/boltplus.js`
- `sources/chzzk.js`
- `sources/floatplane.js`
- `sources/goodgame.js`
- `sources/mixcloud.js`
- `sources/nimo.js`
- `sources/odysee.js`
- `sources/parti.js`
- `sources/picarto.js`
- `sources/piczel.js`
- `sources/rokfin.js`
- `sources/rutube.js`
- `sources/sooplive.js`
- `sources/vkvideo.js`
- `sources/vkplay.js`
- `manifest.json`
- `docs/js/sites.js`
- `docs/agents/08-platform-sources/supported-sites-lookup.md`

## Core Boundary

These sources usually do not work from the ordinary watch/profile page. The user must open the platform's chat-only or popout URL that matches the manifest.

Safe support wording:

```text
That source is a chat-only/popout capture. Open the exact supported chat URL, keep the chat panel active, reload after extension updates, and test with a new message. Rich events and send-back are source-specific and should not be assumed.
```

## Source Matrix

| Source | Required URL Pattern | Captures | Special Behavior | Main Caveats |
| --- | --- | --- | --- | --- |
| Beamstream | `https://beamstream.gg/*/chat` | Rows with `[property="sender.name"]`, `[property="body"]`, `[property="sender.avatar"]` | Can attach `contentimg` from media rows and `sourceImg` from `[property="service"]`; respects `settings.ignorealternatives` | Capture is tied to the `/chat` URL; source-service icon behavior needs live validation. |
| BoltPlus | `https://boltplus.tv/chatpopout/*` or `https://boltplus.tv/chatpopout?*` | `.chat-user-name`, `MuiAvatar` image, Draft-style `[data-text="true"]` text | Can attach a Giphy image as `contentimg` | DOM traversal depends on Material UI wrapper structure. |
| Chzzk | `https://chzzk.naver.com/live/*/chat` | Generated Chzzk live-chat item, name, text, badges | Donation amount parsing; 10-second startup backlog suppression; duplicate cache; anti-throttle helpers | Donation currency/unit parsing includes current page text; live validation is needed for exact payload text. |
| FloatPlane | `https://*.floatplane.com/popout/livechat` | `.chat-message-list` / `.LiveChatMessage`, `.chat-username`, `.chat-text` | Captures name color and text content | Public setup says keep the main window open; no tip/rich-event path in inspected source. |
| GoodGame.ru | `https://goodgame.ru/*/chat*`, `https://www.goodgame.ru/*/chat*` | `.chat-section` message blocks, `.user .nick`, `.message` | Text badges from `.icon[tooltip]`; avatar fallback selectors; sends through direct runtime or wrapped background fallback | Skips old rows on connection; public setup requires chat URL. |
| Mixcloud Live | `https://www.mixcloud.com/live/*/chat/` | Live chat rows with `data-testid="chatline"` or older `.mixcloud-live-chat-row-link` selectors | Extracts username from profile link; subscription rows can populate `hasDonation`; dedupes repeated JSON payloads | Selector paths support multiple layouts and need live validation. |
| Nimo.TV | `https://www.nimo.tv/popout/chat/*`, `https://dashboard.nimo.tv/popout/chat/*` | `.nimo-room__chatroom__message-item`, `.nm-message-nickname`, `.content` | Badge images from level/decoration selectors; donation placeholder is inactive in inspected source | Uses popout chat; donation bits are not active in the inspected code. |
| Odysee | `https://odysee.com/$/popout/*` | Main content mutations, author, livestream comment text, avatar | Rant/donation code is present only as commented-out notes in the inspected source | Treat as rendered chat capture; do not promise rants/donations from this pass. |
| Parti | `https://parti.com/popout-chat?id=*` | Current `.creator-chat-stream > .ccs-row` rows with fallback support for older `span.username` rows | Tip rows emit `event: "donation"` with `hasDonation`, structured `meta.amount` / `meta.currency` when parsable, and USD `donoValue`; viewer count heartbeat uses a stable per-window token when `showviewercount` or `hypemode` is enabled | Viewer count requires `id` query parameter and platform heartbeat response; source sends no verified chat-back path. |
| Picarto.tv | `https://picarto.tv/chatpopout/*`, `https://www.picarto.tv/chatpopout/*` | Chat popout rows with styled channel display name, message span, avatar | Handles image emotes inside message spans | Generated class names and two message-row layouts need live validation. |
| Piczel.tv | `https://piczel.tv/chat/*` | `#PiczelChat` rows, buttons/avatar, `Message_` content | Handles inline images/emotes; focuses CodeMirror line for chat input | DOM traversal uses deep child-node indexing and is fragile. |
| RokFin | `https://*.rokfin.com/popout/chat/*`, `https://rokfin.com/popout/chat/*` | Ant Design comment rows, author, badges, avatar, message body | Tip rows using `.ant-space-item mark` can set `hasDonation` | Requires popout chat URL; badges can be image or SVG descriptors. |
| Rutube | `https://rutube.ru/live/chat/*/` | `.bull-chat-module__messages`, author, message, avatar | Can look inside an iframe body for chat messages | No donation/rich-event path in inspected source. |
| SoopLive | `https://www.sooplive.com/chat/*`, `https://play.sooplive.com/*?vtype=chat`, `https://dashboard.sooplive.com/popup.php?streamerId=*` | `.channel-text` or `.username [user_nick]`, name color, message text | Uses extension state to start/stop scanning | Platform has several supported chat URL shapes; no rich-event path in inspected source. |
| VK Video / VK Play chat-only | `https://live.vkplay.ru/*/only-chat?*`, `https://vkplay.live/*/only-chat?*`, `https://live.vkvideo.ru/*/only-chat` | `vkvideo.js` reads chat root rows, author, badges, message text | Viewer count update when `showviewercount` or `hypemode` is enabled | Current manifest loads `vkvideo.js`; `vkplay.js` is an older/unreferenced chat parser in this pass. |

## Common Behavior

- Payload `type` is usually the source id: `beamstream`, `boltplus`, `chzzk`, `floatplane`, `goodgame`, `mixcloud`, `nimo`, `odysee`, `parti`, `picarto`, `piczel`, `rokfin`, `rutube`, `sooplive`, `vkvideo`, or `vkplay`.
- Most sources expose `getSource` and `focusChat`.
- No inspected file in this group implements a source-level `SEND_MESSAGE` handler.
- Most sources send ordinary chat fields: `chatname`, `chatmessage`, `chatimg` where available, `chatbadges` where available, `hasDonation` when parsed, and `textonly` from `settings.textonlymode`.
- Several scripts skip preloaded rows or suppress startup backlog, so missing old messages is often expected.

## First Support Checks

1. Confirm the exact chat-only/popout URL matches `supported-sites-lookup.md` and `manifest-row-matrix.md`.
2. Confirm the source page has loaded the chat list, not only the video/player page.
3. Reload the chat source after extension install/update/reload.
4. Ask whether the user expects plain chat, badges/emotes, donations/tips, viewer counts, or send-back.
5. Test with a new message because many scripts intentionally skip history.
6. For app users, validate that the standalone app source window actually loads the chat-only URL and injects the same source script.

## Do Not Promise

- Send-back support for this group without current source-control validation.
- Viewer counts except where explicitly documented for Parti and VK Video, and still only when the relevant settings and page data are available.
- Donation/tip support except where the inspected source parses it: Chzzk, Parti, RokFin, Mixcloud subscription rows, and similar source-specific paths.
- Normal watch/profile page capture when the public setup requires popout or chat-only URLs.
- Current support for `vkplay.js` as a manifest-loaded parser; current chat-only manifest rows use `vkvideo.js`.

## Extraction Gaps

- Live validation for each current chat-only page layout.
- App source-window validation for exact popout URLs and iframe/frame behavior.
- Controlled samples for Chzzk donations, Parti viewer counts/tips, RokFin tips, Mixcloud subscription rows, Beamstream source icons, and VK Video viewer counts.
- Source-control/send-back validation outside the inspected content scripts.
