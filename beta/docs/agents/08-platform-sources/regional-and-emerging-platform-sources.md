# Regional And Emerging Platform Sources

Status: quick/heavy source pass from current `sources/*.js`, public supported-site lookup, and manifest matrices on 2026-06-24.

Use this page for smaller regional, emerging, app-specific, or newly added rendered-page source parsers that do not yet have a dedicated platform doc and do not fit cleanly into the earlier grouped pages.

This page covers:

- Bilibili.tv DOM live pages
- Bilibili.com DOM live pages
- Favorited
- Kwai Studio
- Pilled.net
- Portal
- Pump.fun
- Retake.tv
- Rooter
- SharePlay.tv
- SoulBound.tv
- Stream.place
- Substack live streams
- Tikfinity activity feed widget
- uScreen-style live chat pages
- VK Live
- Xeenon

## Core Boundary

These are mostly rendered-page content-script captures. They do not prove official platform API access, moderation support, or send-back support. The normal support flow is:

1. Confirm the exact supported URL form.
2. Confirm the platform page is loaded in the extension/app source surface, not only an OBS overlay page.
3. Keep the chat or activity panel visible enough for new rows to render.
4. Test with a new message after SSN has injected.
5. Treat viewer counts, tips, raids, joins, and rich events as source-specific extras.

Safe answer:

```text
This is a rendered-page source. Open the exact supported page with chat/activity visible, keep SSN enabled, and test with a new row. Rich events and send-back are source-specific, so check the grouped source doc or current source before promising them.
```

Do not assume:

- broad URL support beyond the manifest/public setup path
- official API access
- complete event parity with the platform
- send-back support
- app parity without source-window validation
- viewer counts unless the specific source has an active `viewer_update` path

## Source Matrix

| Platform | Files | Public/Manifest Setup | Captures | Extras | First Checks |
| --- | --- | --- | --- | --- | --- |
| Bilibili.tv live | `sources/bilibili.js` | Public and manifest use `https://bilibili.tv/*/live/*` and wildcard Bilibili.tv live paths. | `.comment-container` live rows with `.type-name` and `.type-comment`; payload `type: "bilibili"`. | Skips existing rows when observer starts; `focusChat` targets `textarea.comment-sender_input`. | Confirm Bilibili.tv live URL, visible comment container, and a new non-action message row. |
| Bilibili.com live | `sources/bilibilicom.js` | Public and manifest use `https://live.bilibili.com/*`. | `#chat-items` rows, including iframe fallback; name from `.user-name`, message from `.danmaku-item-right`; payload `type: "bilibili"`, while `getSource` returns `bilibilicom`. | Inline images can be converted while building message HTML. | Confirm live.bilibili.com URL, direct vs iframe chat DOM, and source identity when debugging. |
| Favorited | `sources/favorited.js` | Manifest host permission and source route use `https://studio.favorited.com/popout/chat`; public card is Favorited popout. | Avatar, author, badges, rendered message; payload `type: "favorited"`. | Badge list can include image URLs or SVG badge HTML. | Use the studio popout chat, not a normal profile page; verify new rows after injection. |
| Kwai Studio | `sources/kwai.js` | Manifest host permission uses `https://studio.kwai.com/*`; no public site card was found in this pass. | Chat/comment rows with avatar, author, and message; payload `type: "kwai"`. | Feed/event rows can mark joined events or gift counts in `hasDonation`; active `viewer_update` path is gated by `showviewercount` or `hypemode`. | Confirm Studio page, chat and feed panels, viewer-count setting if expected, and no assumed public-listing promise. |
| Pilled.net | `sources/pilled.js` | Public and manifest use `https://pilled.net/*`; active observer only processes `https://pilled.net/comment/*`. | Comment tree rows with profile image, username, message, and sticker image as `contentimg`; payload `type: "pilled"`. | Generic focus target for textareas/contenteditable/chat inputs. | Check exact `/comment/` URL before selector debugging. |
| Portal | `sources/portal.js` | Public and manifest use `https://portal.abs.xyz/stream/*`. | Stream chat rows with avatar, name, name color, message; payload `type: "portal"`. | Viewer-count helper exists, but the active source loop does not call it in the inspected source. WebRTC keepalive and visibility override are present. | Confirm `.str-chat__list` chat is loaded; do not promise viewer counts without live/source validation. |
| Pump.fun | `sources/pumpfun.js` | Public and manifest use `https://pump.fun/coin/*`. | Message rows with author/avatar/name color/message; payload `type: "pumpfun"`. | Tip rows can populate `hasDonation`; viewer-count helper exists but the active loop has the call commented out in this pass. Has WebRTC keepalive and visibility override. | Confirm coin page, new `[data-message-id]` rows after startup skip window, and tip vs normal chat expectations. |
| Retake.tv | `sources/retake.js` | Public and manifest use `https://retake.tv/*`. | Comment-section rows with avatar, author, message; payload `type: "retake"`. | Tip rows can populate `hasDonation`; viewer-count helper exists but the active loop has the call commented out in this pass. Has WebRTC keepalive and visibility override. | Confirm `.comments-section` is loaded and a new row appears; do not promise viewer counts without validation. |
| Rooter | `sources/rooter.js` | Public and manifest use `https://*.rooter.gg/*`; active path check expects `/stream/`. | Live chat tab rows parsed as `name: message`; avatar from linked image; payload `type: "rooter"`. | Duplicate suppression for same user/message; WebRTC keepalive when hidden. | Confirm Rooter stream URL, live chat tab panel, and that messages still contain a parsable `name: message` shape. |
| SharePlay.tv | `sources/shareplay.js` | Public and manifest use `https://www.shareplay.tv/*` and `https://shareplay.tv/*`. | Chat rows with author, avatar, badges, rendered message, and reply context; payload `type: "shareplay"`. | Shoutout cards emit `event: "shoutout"`; Blitz cards emit `event: "raid"` with optional viewer metadata; viewer-count helper emits `viewer_update`. | Ask whether the user expects normal chat, replies, shoutouts, Blitz/raid cards, or viewer counts, then test that event family separately. |
| SoulBound.tv | `sources/soulbound.js` | Public site card exists; the source file has zero manifest refs in the current source matrix. | Chat rows with avatar, author/name color, message; payload `type: "soulbound"`. | Tip/system rows can set `event` truthy and `hasDonation`; active `viewer_update` path is gated by settings. | Treat as public/source evidence but verify load path before promising current browser injection. |
| Stream.place | `sources/streamplace.js` | Public and manifest use `https://stream.place/*`. | Chat rows with avatar, author, name color, badges, message, reply metadata; payload `type: "streamplace"`. | Parses relayed names from `Name (source): message`; emits `viewer_update` when settings allow and count changes; has keepalive/visibility override. | Confirm the chat container loaded, check reply/relay expectations, and test viewer counts only with the setting enabled. |
| Substack live streams | `sources/substack.js` | Public and manifest use `https://substack.com/*?liveStream=*` and `https://*.substack.com/live-stream/*`. | Live stream rows with author, avatar, message; payload `type: "substack"`. | Joined rows can emit `event: "joined"`; `viewer_update` path is gated by settings and page count availability. | Confirm the URL is a live stream URL, not a normal post; reload when navigation changes. |
| Tikfinity activity feed | `sources/tikfinity.js` | Manifest uses `https://tikfinity.zerody.one/*` with all-frame behavior; active code exits unless path includes `/widget/vite/src/activity-feed/`. | Window message payloads from Tikfinity activity feed normalized as TikTok payloads; payload `type: "tiktok"`. | Supports chat, gift, follow, share, subscribe, joined, and envelope events with metadata; gift filtering respects TikTok donation settings and join filtering respects `capturejoinedevent`. `getSource` and `focusChat` return false. | Use the Tikfinity activity feed widget path; treat it as read-only event ingestion, not a platform send-back target. |
| uScreen-style live pages | `sources/uscreen.js` | Public card is uScreen; manifest row in this pass includes `https://www.ilmfix.de/programs/*`. | Live chat rows with avatar, author, message; payload `type` is derived from the main domain or falls back to `uscreen`. | Uses `ds-text-editor` shadow DOM for focus. | Confirm the exact uScreen/program domain and live-chat sidebar; source identity may be the site domain rather than literal `uscreen`. |
| VK Live | `sources/vklive.js` | Public card is VK Live; manifest includes broad `https://vk.com/*`. | VK video chat rows with author and message; payload `type: "vklive"`. | Optional `customlivespacestate` and `customlivespaceaccount` settings can restrict capture/focus to a configured channel. | Confirm VK live/chat page, `#react_rootVideoChat`, account filter settings, and `#type-a-message` input presence. |
| Xeenon | `sources/xeenon.js` | Public/manifest route uses `https://xeenon.xyz/*`. | Chat rows with profile image, author, message; payload `type: "xeenon"`. | Viewer-count helper exists, but `isExtensionOn` is initialized false and not refreshed from state in the inspected path, so do not promise viewer events without validation. WebRTC keepalive is present. | Confirm chat message container exists and a new row renders; do not treat viewer counts as verified. |

## Common Behavior

- These sources use content scripts and DOM observers or short polling to capture rendered rows.
- Most expose `getSource` and `focusChat`, except Tikfinity where both are intentionally read-only/false.
- Most skip old history or initial rows and only reliably capture new rows after injection.
- Several sources include WebRTC keepalive or visibility overrides to reduce hidden-tab throttling, but that does not prove app/OBS parity.
- In this pass, no source-level `SEND_MESSAGE` handler was found for this group.
- Selector fragility is high. Many sources depend on generated class names, SVG paths, or app-specific DOM shapes.

## Rich Event Notes

| Feature | Source-Backed Notes |
| --- | --- |
| Viewer counts | Active/gated paths were found for Kwai, SharePlay, SoulBound, Stream.place, and Substack. Portal, Pump.fun, Retake, and Xeenon contain viewer helper code, but the inspected active path does not prove emission. |
| Tips/gifts/donations | Kwai parses gift count text; Pump.fun and Retake parse `Tipped` rows; SoulBound parses tipped rows; Tikfinity gift payloads emit `event: "gift"` with coin value. |
| Joins | Kwai can mark joined feed rows; Substack can mark joined rows; Tikfinity emits joined/member events only when `capturejoinedevent` allows it. |
| Raids/shoutouts | SharePlay detects shoutout cards and Blitz cards, mapping Blitz to `event: "raid"` with optional viewer metadata. |
| Replies | SharePlay and Stream.place preserve reply context in `initial`, `reply`, and/or `meta.reply`. |
| Relayed source identity | Stream.place can rewrite `Name (source): message` rows and store the bridge author in `meta.bridgeAuthor`. |
| TikTok-like feed events | Tikfinity normalizes activity-feed messages into `type: "tiktok"` events rather than a separate `tikfinity` type. |

## First Support Checks

1. Exact URL form, especially Bilibili.tv vs live.bilibili.com, Pilled `/comment/`, Substack live-stream URLs, Tikfinity activity-feed path, and Rooter `/stream/`.
2. Whether the user is using the browser extension, standalone app source window, Firefox, or only an OBS/hosted overlay page.
3. Whether the chat/activity/sidebar panel is visible and a new row renders after SSN is enabled.
4. Whether the user expects plain chat, viewer counts, tips/gifts, joins, replies, raids/shoutouts, or send-back.
5. Whether source-specific settings are involved, such as viewer-count/hype mode, TikTok donation/join filters for Tikfinity, or VK Live account filtering.
6. Whether evidence contains private usernames, avatars, paid/tip data, crypto/trading pages, or app-specific account URLs that should be redacted.

## Safe Answer Patterns

### Site Is Listed But Not Capturing

```text
It is a rendered-page source, so the exact URL and current page DOM matter. Open the supported page, keep the chat/activity panel visible, reload after enabling SSN, and test with a new row. If the site has multiple URL forms, use the form in the grouped source doc.
```

### User Wants Send-Back

```text
I would not promise send-back for this source from the current grouped pass. These scripts are capture-oriented; several expose focusChat, but no source-level send-message handler was verified here.
```

### User Wants Viewer Counts

```text
Viewer counts are source-specific. Kwai, SharePlay, SoulBound, Stream.place, and Substack have source-backed viewer_update paths gated by viewer-count or hype settings. Other sources in this group need live/source validation before promising viewer counts.
```

### Tikfinity Is Confusing

```text
Tikfinity is treated as a read-only activity-feed ingest path. It normalizes feed payloads into TikTok-style SSN events and is not a send-back source target.
```

## Do Not Promise Yet

- App parity for any source in this group.
- Viewer counts for Portal, Pump.fun, Retake, or Xeenon without live validation.
- Send-back for any source in this group.
- Full gift/tip/raid parity beyond the explicitly noted source paths.
- Broad URL support beyond manifest/public setup paths.
- That SoulBound currently injects through the manifest until its zero manifest refs are reconciled.
- That uScreen always emits `type: "uscreen"`; inspected source derives the payload type from the main domain when possible.

## Extraction Gaps

- Live/browser validation of every source in this group.
- Exact manifest-to-public-site reconciliation for Kwai, SoulBound, uScreen domain variants, VK Live, and Bilibili aliases.
- App source-window parity validation.
- Controlled payload samples for SharePlay shoutout/Blitz, Tikfinity gifts/envelopes/subs, Kwai gifts, SoulBound tips, Pump.fun/Retake tips, and Stream.place relayed rows.
- Line-level validation of inactive/commented viewer-count helpers in Portal, Pump.fun, Retake, and Xeenon.
