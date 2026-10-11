# Event And Community Sources

Status: heavy grouped source pass from current source files, manifest rows, and public site metadata on 2026-06-24.

Use this page for event, community, and niche live-page sources that are not covered by the high-volume platform docs, webinar/event doc, or popout/chat-only doc.

## Source Anchors

- `sources/arenasocial.js`
- `sources/buzzit.js`
- `sources/cime.js`
- `sources/gala.js`
- `sources/linkedin.js`
- `sources/livepush.js`
- `sources/megaphonetv.js`
- `sources/quickchannel.js`
- `sources/slido.js`
- `sources/tradingview.js`
- `manifest.json`
- `docs/js/sites.js`
- `docs/agents/08-platform-sources/supported-sites-lookup.md`

## Core Boundary

These are rendered page captures. They do not imply a platform API integration, platform moderation support, or chat send-back support.

Safe support wording:

```text
SSN can capture rendered chat or question rows from that event/community page when the exact supported URL is open and the chat or question list is visible. Extra fields such as viewer counts, donations, or question flags are source-specific.
```

## Source Matrix

| Source | Manifest/Public URL | Captures | Special Behavior | Main Caveats |
| --- | --- | --- | --- | --- |
| Arena Social | Manifest: `https://arena.social/*`; public setup: `https://arena.social/live/*` | Live chat list rows from `[data-testid='virtuoso-item-list']`; avatar, name, name color, message | Emits `viewer_update` when `showviewercount` or `hypemode` is enabled; includes anti-throttle helpers | Source only starts processing on `https://arena.social/live/`; broader manifest match does not mean every Arena page is a source. |
| Buzzit | `https://www.buzzit.ca/event/*/chat` | Event chat rows under `#messageList`; name/avatar from Vuetify avatar image; message from `.message-body` | Caches avatar URLs by name after delayed lookup | Public metadata says community-submitted integration; live layout validation is needed before strong claims. |
| CI.ME | `https://ci.me/*`, `https://www.ci.me/*`; public setup says `https://ci.me/@USERNAME/live` | Chat rows from CI.ME live chat list; name, badges, message, name color | Donation chat rows can set `hasDonation`; emits `viewer_update` when `showviewercount` or `hypemode` is enabled; duplicate suppression | Donation/viewer parsing is source-specific and needs live sample validation. |
| Gala Music | `https://music.gala.com/streaming/*` | Streaming chat rows; name, avatar, message | Plain rendered chat only in inspected source | No donation, membership, viewer-count, or send-back path found in this pass. |
| LinkedIn Events | `https://www.linkedin.com/*`, `https://linkedin.com/*`; public notes mention live/video/event paths | LinkedIn live/event comment rows; name, avatar, message | Converts small avatar images to data URLs when possible | Manifest is broad, but source only processes `/video/live`, `/video/event`, `/video/golive/`, or `/events/` paths. |
| LivePush | `https://multichat.livepush.io/*` | Aggregated multichat rows; author and message | Payload `type` is relayed from the chat-client icon when it matches Twitch, YouTube, or Facebook; otherwise `livepush` | Public notes say no input field support; do not assume send-back. |
| MegaphoneTV | `https://apps.megaphonetv.com/socialharvest/live/*`; public notes say Studio UGC Recent messages | Message list rows with avatar, name, message | Source contains event-type helper code, but inspected payload is normal `megaphonetv` chat-style data | `getSource` responds `metaphonetv` in inspected source, while payload type is `megaphonetv`; note typo if debugging source identity. |
| QuickChannel | `https://play.quickchannel.com/*` | `.chat-messages-container` rows with `.author` and `.chatmessage` content | Handles inline images in message content when not in text-only mode | Plain rendered chat only in inspected source. |
| Slido | `https://app.sli.do/event/*`, `https://admin.sli.do/event/*`, `https://wall.sli.do/event/*` | Question list items and card question rows; author, question body, avatar | `card--question` path sets `question: true`; script tries to switch to the second content tab | This is question/Q&A-style capture, not normal live chat. Startup can process existing question cards before marking them ignored. |
| TradingView Streams | `https://www.tradingview.com/streams/*` | `.tv-chat-scroll-container` chat items; username, avatar, message | Skips quoted content blocks | Plain rendered chat only in inspected source; source processes existing rows during startup. |

## Common Behavior

- Most payloads use the source id as `type`: `arenasocial`, `buzzit`, `cime`, `gala`, `linkedin`, `megaphonetv`, `quickchannel`, `slido`, or `tradingview`.
- LivePush is different: it can emit `type` as `twitch`, `youtube`, `facebook`, or `livepush` based on the relayed platform icon.
- Most sources expose `getSource` and `focusChat`.
- No inspected file in this group implements a source-level `SEND_MESSAGE` handler.
- Several sources intentionally ignore existing rows or track indexes to avoid replay; if a user expects old history, test with a new message/question.

## First Support Checks

1. Confirm exact URL shape from public setup and manifest rows.
2. Confirm the chat, comments, UGC, or question panel is open and visible.
3. Reload the source page after extension reload/update.
4. Test with a new rendered message or question.
5. Ask whether the user expects plain chat, Q&A/question rows, viewer counts, donations, relayed original platform type, or send-back.
6. For LinkedIn, confirm the current path is one of the live/event paths the source actually checks.
7. For LivePush, explain that payload type may reflect the upstream platform, not always `livepush`.

## Do Not Promise

- Send-back support from this source group without source-control validation.
- Platform API behavior, moderation, attendance analytics, polls, or registrations.
- Viewer counts except Arena Social and CI.ME, and only with the relevant settings and visible page data.
- Donation support except CI.ME donation chat rows in this pass.
- MegaphoneTV source identity consistency; payload and `getSource` differ in the inspected file.

## Extraction Gaps

- Live validation for current DOM selectors on each service.
- Controlled samples for Arena Social and CI.ME viewer counts, CI.ME donations, Slido question rows, and LivePush relayed source types.
- App source-window validation for broad manifest matches such as LinkedIn and CI.ME.
- Source-control/send-back validation outside the inspected content scripts.
