# ISSUE-015: YouTube WS/API mode double-emits Super Chats

- **Status**: fixed (2026-09-05, local)
- **Severity**: high
- **Area**: social_stream `sources/websocket/youtube.html`
- **Found**: 2026-07-22, during YouTube source documentation pass

## Symptom

`superChatEvent` is missing from the `isSpecialEvent` list (`youtube.html:4238-4244`, which does include `superStickerEvent`). A Super Chat is therefore queued as a plain chat message (`:4261-4277`) **and** emitted as `event: "superchat"` (`:4384-4401`) — dock/overlays see two rows for one payment. Inconsistent with Super Sticker handling.

## Expected

Super Chat emitted once, as the `superchat` event row (same as Super Sticker → `supersticker`).

## Evidence

- `sources/websocket/youtube.html:4238-4244` — isSpecialEvent list missing superChatEvent
- `sources/websocket/youtube.html:4261-4277` — plain-chat queue path
- `sources/websocket/youtube.html:4384-4401` — superchat emit path

## Notes

Messages with `superChatDetails` now skip the ordinary-chat queue, matching the existing paid-message handler's condition. Fixture tests execute the response handler and Super Chat formatter, verifying one paid row with its amount/comment, ordinary chat delivery, and suppression of historical donations.
