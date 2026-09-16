# Community Membership Web-App Sources

Status: quick/heavy source pass from current `sources/*.js`, public supported-site lookup, and manifest matrices on 2026-06-24.

Use this page for community, membership, collaboration, and web-app chat sources that are not dedicated platform docs.

This page covers:

- Circle.so
- MeetMe
- NextCloud
- Patreon
- Roll20
- Simps
- Tellonym
- Whop
- Wix Live / Wix embedded widgets
- Workplace legacy parser

## Core Boundary

These are rendered-page content-script sources. They read visible page/chat rows after the user has access to the page. They are not official platform bot/API integrations unless another source-page doc says otherwise.

Safe answer:

```text
This source captures rendered chat or message rows from the page the user can access. Confirm the exact URL, any required source toggle, visible chat/message panel, and a new rendered row after SSN connects. Do not assume send-back or API-level access from capture support.
```

Privacy boundary:

- These sources can include private community names, member names, avatars, membership pages, paid/community URLs, collaboration sessions, game tables, and direct question text.
- Ask for redacted screenshots/logs when debugging.
- Do not advise users to bypass platform access, login, paid membership, or workspace privacy rules.

## Source Matrix

| Platform | Files | Public/Manifest Setup | Captures | Extras | First Checks |
| --- | --- | --- | --- | --- | --- |
| Circle.so | `sources/circle.js` | Public says Circle-powered domains; manifest includes `https://*.circle.so/*` plus known community domains. | Author, avatar, message text, and content image when not in text-only mode. | Rewrites local "You" to the detected Circle user or "Host" when possible; includes `userid` from reply-count text when available. | Confirm exact Circle domain/community page, visible message rows, and new row after SSN connects. |
| MeetMe | `sources/meetme.js` | Public uses `https://*.meetme.com/*` or `https://meetme.com/*`; manifest uses `all_frames`. | Avatar, name, message. | Basic payload `type: "meetme"`; old history is debug-only in inspected source. | Confirm page/frame chat is loaded and a new message is rendered. |
| NextCloud | `sources/nextcloud.js` | Public says domain support is required; manifest example is `https://cloud.malte-schroeder.de/call/*`. | Name, avatar, message from NextCloud Talk/call chat. | If display name looks like an email, source can derive name from avatar URL. | Do not generalize to all NextCloud domains without manifest/source update; confirm exact instance URL. |
| Patreon | `sources/patreon.js` | Public says enable Patreon toggle, then use `https://patreon.com/*`; manifest includes `*.patreon.com` and `patreon.com`. | Name, avatar, message, posted image content, and fallback previous author for follow-up rows. | Emits `viewer_update` when `showviewercount` or `hypemode` is enabled and a count can be parsed; dedupes by row index. | Confirm Patreon source toggle, logged-in access, live/chat row visibility, and whether user expects viewer counts or images. |
| Roll20 | `sources/roll20.js` | Public says use Roll20 pages; manifest includes `https://*.roll20.net/*` and `https://roll20.net/*`. | Avatar, author, and chat text. | Avatar is converted to data URL when possible. Source has a content-image conversion branch, but the inspected path does not actively populate content images. | Confirm Roll20 game/table chat is visible; treat game content and player names as private. |
| Simps | `sources/simps.js` | Public and manifest use `https://simps.com/app/*`. | Avatar converted to base64, name, message. | Emits `viewer_update` when viewer-count/hype settings are enabled and page count can be parsed. | Confirm app URL, live chat row visibility, and whether viewer counts are expected. |
| Tellonym | `sources/tellonym.js` | Public and manifest use `https://tellonym.me/*`. | Message text only; `chatname` and `chatimg` are blank in inspected source. | Captures newly added Tellonym cards/questions, not a normal live chat identity feed. | Explain that name/avatar may not be available from this source path. |
| Whop | `sources/whop.js` | Public and manifest use `https://whop.com/*`. | Name, name color, message. | Emits `viewer_update` when viewer-count/hype settings are enabled and page count can be parsed. Inspected code finds a content image but does not forward it in `data.contentimg`. | Confirm exact Whop page and whether the user expects viewer counts or images. |
| Wix Live | `sources/wix.js`, `sources/wix2.js` | Public says Wix pages and embedded Wix video widget URLs; manifest includes `https://*.wix.com/*`, `https://wix.com/*`, `https://www.wix.com/*`, `https://chat.wix.com/*`, `https://live.wix.com/*`, and `editor.wixapps.net` widget modal URLs. | `wix.js`: message text and inline images from Wix chat. `wix2.js`: Annoto/Wix widget name, avatar, message. | Both send `type: "wix"`. `wix2.js` is the all-frames embedded widget/modal path. | Confirm whether the user is on a normal Wix live page or embedded video widget/modal path. |
| Workplace legacy parser | `sources/workplace.js` | Current manifest routes Workplace URLs to `sources/facebook.js`; `sources/workplace.js` has no manifest refs in the matrix. | Legacy parser can build `type: "workplace"` for Workplace URLs and `type: "facebook"` otherwise. | Treat as unreferenced/legacy unless current source loading changes; current support routing should start with `facebook.md`. | For current Workplace questions, verify whether `facebook.js` is loaded; use this file only for legacy/source-history context. |

## Common Behavior

- Most sources send `chatname`, `chatmessage`, `chatimg`, `hasDonation`, `contentimg`, `textonly`, and a source-specific `type`.
- Most expose `getSource` and `focusChat`.
- In this pass, none exposed a source-level `SEND_MESSAGE` handler.
- Several sources intentionally avoid processing existing history and rely on a new rendered row after the observer starts.
- Several sources operate on private/member-only pages; support evidence must be redacted.

## Rich Or Unusual Behavior

| Feature | Source-Backed Notes |
| --- | --- |
| Viewer counts | Patreon, Simps, and Whop can emit `viewer_update` when `settings.showviewercount` or `settings.hypemode` is enabled and the page exposes a parseable count. |
| Content images | Circle and Patreon forward content images; Wix can include inline images in message HTML; Whop detects an image but does not forward it in the inspected data object. |
| Identity fallback | Patreon can reuse the previous message author/avatar for follow-up rows. Circle can rewrite "You" to the detected user or host label. NextCloud can derive a name from an avatar URL when the visible name looks like an email. |
| Toggle required | Patreon is a public toggle-required source. Enable the Patreon source toggle and reload before debugging capture. |
| Embedded widget path | `wix2.js` handles the embedded/editor widget path and sends `type: "wix"` just like `wix.js`. |
| Workplace routing | Current manifest rows use `facebook.js` for Workplace URLs. `workplace.js` should be treated as unreferenced legacy context in this pass. |

## First Support Checks

1. Exact URL and product surface:
   - Patreon needs the Patreon toggle enabled.
   - NextCloud support is domain-specific in the current manifest.
   - Wix normal page capture and Wix embedded widget capture use different source files.
   - Current Workplace support should route through Facebook/Workplace DOM capture, not the unreferenced `workplace.js` file.
2. Login, membership, workspace, or game-session access.
3. Visible chat/message panel and a new rendered row after SSN connects.
4. Whether the user expects plain text, avatars, content images, viewer counts, Tellonym identity, or send-back.
5. Privacy redaction for member/community/game/workspace names, URLs, avatars, and message text.

## Safe Answer Patterns

### Community Or Membership Page Is Listed

```text
It is a rendered-page capture source. Make sure the user has normal access to that community/page, the source URL matches the supported pattern, chat is visible, and a new row appears after SSN connects. Redact private community/member details when sharing evidence.
```

### User Wants Send-Back

```text
I would not promise send-back for this grouped source path. These scripts expose focusChat in several cases, but no source-level send-message handler was verified here.
```

### User Wants Viewer Counts

```text
Viewer counts are source-specific. Patreon, Simps, and Whop have viewer_update paths, and those depend on the viewer-count/hype setting plus a parseable count on the page.
```

### Workplace Question

```text
Current Workplace URL handling routes through the Facebook DOM source in the manifest. Use the Facebook/Workplace doc first; treat sources/workplace.js as legacy/unreferenced unless source loading has changed.
```

## Do Not Promise Yet

- Patreon capture without the Patreon toggle and page reload.
- All NextCloud domains without manifest/source updates.
- Tellonym names/avatars.
- Whop content-image forwarding from the current inspected source.
- Workplace behavior from `sources/workplace.js` unless it is actually loaded.
- Send-back for any source in this group.
- Standalone app parity without source-window validation.

## Extraction Gaps

- Live/browser validation for each source in this group.
- App source-window validation for membership/login/workspace pages and embedded Wix frames.
- Controlled payload samples for Patreon/Simps/Whop viewer updates, Circle content images, Roll20 avatar conversion, Wix vs Wix2 capture, and Tellonym message-only rows.
- Confirm whether `sources/workplace.js` should be kept, removed, documented as legacy, or reconnected.
- Source-control/send-back validation against background handlers before answering send-message questions.
