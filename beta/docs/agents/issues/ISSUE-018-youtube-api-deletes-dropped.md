# ISSUE-018: YouTube API mode silently drops messageDeleted/messageRetracted events

- **Status**: open
- **Severity**: medium
- **Area**: social_stream `sources/websocket/youtube.html`
- **Found**: 2026-07-22, during YouTube source documentation pass

## Symptom

`messageDeletedEvent`/`messageRetractedEvent`/`tombstone` are in the stream type map (`youtube.html:3503-3504`) but have no handler in `processLiveChatResponseData` — delete/retract sync never reaches the dock in API mode (it works in DOM mode via the `is-deleted` MutationObserver, `sources/youtube.js:307-340`). Also unhandled: `chatEndedEvent`, `fanFundingEvent`, `sponsorOnlyMode` changes, `pollEvent`.

## Expected

Deleted/retracted API messages produce the same `{delete:{...}}` payload as DOM mode, at least when the advanced `syncDeleteMessages` toggle is on.

## Evidence

- `sources/websocket/youtube.html:3503-3504` — type map includes the events
- `sources/websocket/youtube.html:4196-4504` — `processLiveChatResponseData` has no delete/retract branch
- `sources/youtube.js:307-340` — DOM-mode delete handling for comparison

## Notes
