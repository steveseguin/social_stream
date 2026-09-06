# Independent Live Platform Sources

Status: quick/heavy source pass from current `sources/*.js`, public supported-site lookup, and manifest matrices on 2026-06-24.

Use this page for smaller independent live/chat platforms that are not yet large enough for a dedicated platform doc but have source-backed behavior beyond a simple inventory row.

This page covers:

- BandLab
- Bigo.tv
- Bitchute
- Blaze / Blaze.stream
- Castr
- Cherry TV
- CloutHub
- Cozy.tv
- DLive
- Estrim
- FC2
- Jaco.live
- LFG.tv
- Locals.com
- Loco.gg

## Core Boundary

These are mostly rendered-page DOM capture sources. They watch the live/chat page for new rows, extract the visible author/message/avatar fields, and forward SSN payloads through the extension/app message bridge.

Safe answer:

```text
This source captures rendered chat rows from the platform page. Keep the exact supported page open with chat visible, then test with a new message. Rich events, viewer counts, tips, and send-back vary by source, so do not infer them from the public listing alone.
```

Do not assume:

- API-level access
- moderation events
- complete gift/tip parity
- complete viewer-count parity
- app parity without source-window validation
- send-back support just because `focusChat` exists

## Source Matrix

| Platform | Files | Public/Manifest Setup | Captures | Extras | First Checks |
| --- | --- | --- | --- | --- | --- |
| BandLab | `sources/bandlab.js` | Public note says keep BandLab page/chat open; manifest matches `https://*.bandlab.com/*`. | Author, avatar, message body, inline/content image. | `userid` from author link when available; `focusChat` targets `textarea#commentField`. | Correct BandLab page, comments/live chat container visible, new message after source loads. |
| Bigo.tv | `sources/bigo.js` | Public and manifest use `https://www.bigo.tv/*`. | `.chat__container` rows with user name and text. | Simple payload type `bigo`; no rich events found in this pass. | Chat container visible and not only historical rows. |
| Bitchute | `sources/bitchute.js` | Public says `https://www.bitchute.com/video/*`; no popout chat. Manifest also includes Bitchute video URLs. | Name, avatar, text, optional content image. | Source disables iframes to reduce embedded noise; `focusChat` targets textareas/message inputs. | Use a video page with visible chat/comments; no popout route. |
| Blaze / Blaze.stream | `sources/blaze.js` | Public has duplicate Blaze/Blaze.stream entries; manifest matches `https://blaze.stream/*`. | Name, name color, avatar, message, donation badge/text when visible. | Emits `viewer_update` when `showviewercount` or `hypemode` is enabled and count can be parsed. | Use Blaze stream page, verify duplicate public name, check viewer-count setting before expecting viewer events. |
| Castr | `sources/castr.js` | Public setup uses `https://chat.castr.io/room/XXXXXXXX`; manifest matches `https://chat.castr.io/*`. | Chat username, username color, message text. | No avatar and no donation path in inspected source. `focusChat` comment says chat input may not exist. | Confirm exact Castr chat-room URL, not the marketing/control page. |
| Cherry TV | `sources/cherrytv.js` | Public and manifest use `https://cherry.tv/*`. | Normal chat rows with username, message, avatar. | User-joined rows emit `event: "joined"` with `type: "cherry"`. Gift, Lovense/vibrator, and VIP rows are detected/logged but not forwarded in this pass. | Test normal chat separately from gifts/join/VIP rows; do not promise gift forwarding. |
| CloutHub | `sources/cloudhub.js` | Public CloutHub entry uses `https://app.clouthub.com/*`; manifest matches that URL. | Meeting/post chat name, message, avatar. | Payload `type` is `clouthub`, while `getSource` responds `cloudhub`; note spelling when debugging source identity. | Confirm app.clouthub.com page and `.post-chat-messages` visible. |
| Cozy.tv | `sources/cozy.js` | Public says open the normal view page; manifest matches `https://cozy.tv/*`. | Chat avatar, name, name color, message. | Captures sticker/content image from `.chat_sticker`; badge list can include image and SVG badges. | Keep normal Cozy view/chat open; verify stickers/badges with new test rows. |
| DLive | `sources/dlive.js` | Manifest row exists for `https://dlive.tv/c/*`, but this pass did not find a public supported-site card mapping. | DLive chat name, avatar, message, inline emote/image content. | Follower-style rendered rows may be converted into message text when visible. | Treat as manifest/source evidence until public listing/routing is reconciled. |
| Estrim | `sources/estrim.js` | Public and manifest use `https://estrim.com/publications/view/*`. | Username, avatar, message. | Badge images are collected into `chatbadges`. | Use a publication view page with `.chat-container > .messages`. |
| FC2 | `sources/fc2.js` | Public and manifest use `https://live.fc2.com/*/`. | User name, text, avatar when it is not the default placeholder. | `focusChat` comment says the source may not support/have chat input. | Verify live FC2 page with `#js-commentListContainer`; default avatar may be blanked. |
| Jaco.live | `sources/jaco.js` | Public says `https://jaco.live/golive`; manifest matches `https://jaco.live/*`. | Comment nickname, comment text, avatar. | Duplicate suppression for repeated same user/message. | Confirm chat-box item list is visible and a new row renders. |
| LFG.tv | `sources/lfg.js` | Public and manifest use `https://lfg.tv/*`. | Name, name color, avatar, badges, message. | Tip/donation parsing into `hasDonation`; reply metadata can map into `initial` and `reply`; emits `viewer_update` when viewer settings allow it. | Ask whether the user expects plain chat, tips, replies, or viewer counts; test each separately. |
| Locals.com | `sources/locals.js` | Public says use Locals post/feed pages; manifest matches `https://*.locals.com/*` and `https://locals.com/*`. | Name, message, avatar, content images, reply metadata, and legacy/new chat layouts. | Donation/tip parsing, donation numeric value, dedupe by message ID, retry logic for rows whose content loads late, and `viewer_update` when settings allow it. | Confirm exact Locals page type and visible live chat block/history; redact private community evidence. |
| Loco.gg | `sources/loco.js` | Public says Loco stream pages; manifest includes `loco.gg`, `loco.com`, and `locolive.tv` URL forms. | Name, avatar, message, stickers/content image. | Skips placeholder/system text such as deleted messages; duplicate suppression for same user/message. | Confirm domain form, loaded `.chat-elements-list`, and new message after source load. |

## Common Behavior

- Most sources send payloads with `chatname`, `chatmessage`, `chatimg`, `hasDonation`, `textonly`, and a source-specific `type`.
- Most sources expose `getSource` and `focusChat`.
- In this pass, none of these source files exposed a source-level `SEND_MESSAGE` handler.
- Mutation observers usually skip old history or only reliably capture new rows after the source is connected.
- Several parsers depend on brittle CSS classes or SVG path selectors; current live page validation matters.
- App parity is not proven by source presence. The standalone app still needs the correct source URL, Electron session/login state, and bridge behavior.

## Rich Event Notes

| Feature | Source-Backed Notes |
| --- | --- |
| Viewer counts | Blaze, LFG, and Locals have `viewer_update` paths gated by `settings.showviewercount` or `settings.hypemode`; do not promise viewer counts for the rest of this group. |
| Tips/donations | Blaze has a visible donation text path; LFG has multiple tip parsers; Locals has donation/tip extraction and numeric parsing; Cherry TV detects gifts but does not forward them in this pass. |
| Joins | Cherry TV forwards user-joined rows as `event: "joined"` with `type: "cherry"`. |
| Replies | LFG and Locals have reply extraction paths; answer carefully because exact fields and display vary by page layout and text-only mode. |
| Badges | Cozy, Estrim, LFG, and Blaze have badge-related code paths; Blaze badge extraction is commented out in inspected source. |
| Content images/stickers | BandLab, Bitchute, Cozy, Locals, Loco, and DLive have content-image or inline-image paths. |

## First Support Checks

1. Exact URL and domain form, especially for Castr, Loco, Locals, BandLab subdomains, and duplicate Blaze public entries.
2. Whether the user is in Chrome extension, standalone app, Firefox, or hosted page only.
3. Whether the page is logged in and the chat panel is visible.
4. Whether the user expects plain chat, tips/donations, viewer counts, replies, joins, stickers/images, or send-back.
5. Whether SSN was enabled before the new test message rendered.
6. Whether evidence contains private community names, post URLs, avatars, user IDs, tips, or message text that should be redacted.

## Safe Answer Patterns

### Site Is Listed

```text
It is listed as a supported rendered-page source. Open the exact supported page with chat visible, keep SSN enabled, then send or wait for a new message. If you need tips/viewer counts/replies, that depends on the specific source and should be tested separately.
```

### User Wants Send-Back

```text
I would not promise send-back for this source from the current grouped pass. These scripts expose focusChat in several cases, but no source-level send-message handler was verified here.
```

### Viewer Count Does Not Work

```text
Viewer counts are only source-backed for selected platforms in this group. Blaze, LFG, and Locals have viewer_update paths, and those depend on the viewer-count/hype setting plus a parsable count on the page.
```

### Cherry TV Gift Does Not Appear

```text
The inspected Cherry TV source detects gift/Lovense/VIP rows for logging, but the grouped pass only confirmed forwarding for normal chat and joined rows. Do not treat gift forwarding as verified without a live/source update.
```

## Do Not Promise Yet

- DLive as a public supported-site card until public listing/routing is reconciled.
- Cherry TV gift, Lovense/vibrator, or VIP rows as SSN forwarded events.
- Blaze badges as forwarded badge arrays, because the badge extraction block is commented out in inspected source.
- Castr or FC2 chat input/send-back.
- LFG/Locals donation/reply fields without a current sample from the page.
- Viewer counts outside Blaze, LFG, and Locals.
- Standalone app parity for any platform in this group without real app source-window validation.

## Extraction Gaps

- Live/browser validation for every source in this group.
- App source-window validation for exact source URLs and login/session behavior.
- Exact payload samples for Blaze donations/viewers, LFG tips/replies/viewers, Locals tips/replies/viewers, and Cherry joined rows.
- Public support reconciliation for DLive.
- Check whether Cherry TV gift/Lovense/VIP detections should become forwarded SSN events or remain debug-only.
- Source-control/send-back validation against background handlers before answering send-message questions.
