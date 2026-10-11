# Creator Live-Cam Sources

Status: heavy grouped source pass from current source files, manifest rows, and public site metadata on 2026-06-24.

Use this page for Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, and Stripchat support questions. These are rendered page chat captures, not platform APIs.

## Source Anchors

- `sources/bongacams.js`
- `sources/cam4.js`
- `sources/camsoda.js`
- `sources/chaturbate.js`
- `sources/fansly.js`
- `sources/myfreecams.js`
- `sources/stripchat.js`
- `manifest.json`
- `docs/js/sites.js`

## Core Boundary

These sources read chat from pages the user can already access in the browser or app source window. They do not bypass platform access rules, age gates, login requirements, paid-room restrictions, or moderation rules.

Safe support wording:

```text
SSN can capture rendered chat from that site when the correct live room/chat page is open and chat is visible. Token/tip/private-message behavior is source-specific, and chat sending back to the platform is not verified from these source scripts.
```

## Source Matrix

| Source | Manifest/Public URL | Captures | Special Events Or Fields | Main Caveats |
| --- | --- | --- | --- | --- |
| Bongacams | `https://bongacams.com/*`, `https://www.bongacams.com/*` | `.chat_history` rows with `.js-chat_msg`; name from `.author_name`; avatar from `.icon_avatar img.profile`; message from `.message_area .msg` or `.msg` | Tip rows with `msg_tip_success` can set `hasDonation` as token amount; messages are capped at 4000 chars | Skips existing history after connection delay; uses a WebRTC loopback keepalive when hidden; source exposes `getSource` and `focusChat`, not source-level send-back. |
| CAM4 | `https://cam4.com/*`, `https://www.cam4.com/*` | Mobile chat holder rows; name from `ChatMessageTypes__msgSender`; message from `ChatMessageTypes__msgDesktopContent` style selectors | Tip notifications from `ChatNotificationsTypes` rows can set `hasDonation` as tokens | Class-name selectors are generated and fragile; skips existing children; uses a WebRTC loopback keepalive; exposes `getSource` and `focusChat`, not source-level send-back. |
| Camsoda | `https://www.camsoda.com/*` | Chat wrapper rows; name from `chat-user-module__user--`; avatar from `chat-user-module__userAvatar`; message from `p.break-words` | Tip-like rows can set `hasDonation`; there is a viewer-update helper, but the inspected call is commented out | Uses extension state to start/stop scanning; includes aggressive visibility/throttle overrides; exposes `getSource` and `focusChat`, not source-level send-back. |
| Chaturbate | `https://chaturbate.com/*` | Public chat and private-message containers; rows with `[data-testid="chat-message"]` | Room notices use `chatname` `CB Notice`; private-message rows set a truthy `private` field; notices set a truthy `event` field | Private-message capture is sensitive; source does not fetch initial settings in the inspected file, only listens for settings updates; exposes `getSource` and `focusChat`, not source-level send-back. |
| Fansly | `https://fansly.com/chatroom/*` | `.chat-container` rows matching `app-chat-room-message.chat-message`; name from `[appaccountcard]`; message from `.message-content .message-text` | Tip rows with `.message-wrapper.has-tip` and `app-balance-display` can set `hasDonation`; broadcaster badge can map to the SSN host icon | URL is chatroom-specific, not every Fansly page; no avatar extraction in inspected source; dedupes by timestamp/name/message/donation signature; exposes `getSource` and `focusChat`, not source-level send-back. |
| MyFreeCams | `https://myfreecams.com/*`, `https://www.myfreecams.com/*` | `#chat_contents` appended rows; name from `.author` or `.username`; message from `.chat` | Emoji-text badges from `.MfcChannelMembers_ShareBadges_emoji`; avatar from `img.in_chat_avatar`; `userid` from `data-user_id` when present | Skips preloaded rows; simple last user/message dedupe; uses a WebRTC loopback keepalive; exposes `getSource` and `focusChat`, not source-level send-back. |
| Stripchat | `https://stripchat.com/*`, `https://www.stripchat.com/*`, `https://*.stripchat.com/*` | Public chat containers such as `.model-chat-container.public .messages`; messages from `.message-base` or rows with `data-message-id` | Tip rows can set `hasDonation`; action, goal, and Lovense-style notification rows are skipped | Uses all-frame manifest behavior; maintains a 1500-key dedupe cache and scan fallback; sends through normal runtime message then wrapped `toBackground` fallback; exposes `getSource` and `focusChat`, not source-level send-back. |

## Common Behavior

- Payload `type` is the source id: `bongacams`, `cam4`, `camsoda`, `chaturbate`, `fansly`, `myfreecams`, or `stripchat`.
- These sources generally emit `chatname`, `chatmessage`, `chatimg` when available, `chatbadges` where available, `hasDonation` for supported token/tip rows, `membership` as an empty string, and `textonly` from `settings.textonlymode`.
- Most sources ignore old rows on startup so they do not replay existing chat history.
- Most sources expose `getSource` and `focusChat`; none of the inspected files implements a source-level `SEND_MESSAGE` handler.
- Several sources include anti-throttling helpers, but hidden/minimized browser behavior still needs live validation.

## First Support Checks

1. Confirm the exact URL matches the manifest pattern.
2. Confirm the user can access the live room and the chat panel is visible.
3. Reload the page after extension reload/update.
4. Ask whether the user expects ordinary chat, private chat, token/tip rows, viewer counts, or send-back.
5. Treat screenshots/logs as sensitive because names, private-message text, room URLs, and paid-room context can be private.
6. If only old messages are missing, explain that many source scripts intentionally skip preloaded history and only capture new rows.

## Do Not Promise

- Chat send-back to these platforms without current source-control validation.
- Viewer counts for Camsoda from the inspected source; the helper exists but is not actively called in this pass.
- Full tip, token, goal, private-message, or notice parity across all sites.
- Standalone app parity without Electron source-window validation.
- Support for content the user cannot legally or normally access through the platform.

## Extraction Gaps

- Live browser validation against current site layouts and login states.
- App source-window validation for each URL pattern.
- Current source-control/send-back path search beyond the inspected source files.
- Controlled sample payloads for private messages, notices, tokens/tips, skipped goal/action rows, and generated CSS selector changes.
