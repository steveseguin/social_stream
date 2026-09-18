# YouTube WebSocket Streaming Plan

## Goal

Add YouTube Data API streaming support to `sources/websocket/youtube.html` while keeping the end-user UI and workflow the same.

## Fixed Decisions

- Keep `sources/websocket/youtube.html` as the only user-facing YouTube websocket page.
- Do not reuse `lite/*` code.
- Reuse shared provider code from `providers/youtube/*` where it makes sense.
- Keep outbound payloads the same as the current polling page.
- Treat streaming as additive, with polling as fallback.
- Do not introduce visible UI differences for end users as part of this work.

## Implementation Shape

1. Add a websocket-side adapter file under `sources/websocket/`.
   Suggested file: `sources/websocket/youtube_streaming_adapter.js`
   Purpose: bridge `youtube.html` to `providers/youtube/liveChat.js` and optionally `providers/youtube/contextResolver.js`.

2. Keep `youtube.html` as the main controller.
   It should:
   - keep the current OAuth flow
   - keep the current query-param flow
   - keep the current connect/disconnect UI
   - decide whether to start polling or streaming internally

3. Reuse existing page message handling.
   Streamed chat/events should pass through the same page-level normalization and relay logic already used by polling so downstream output stays unchanged.

4. Add automatic fallback.
   If streaming fails because of unsupported streaming responses, auth expiry, ended chat, repeated retries, or malformed chunks, fall back to the existing polling flow cleanly.

5. Keep transport-specific logic isolated.
   - `providers/youtube/liveChat.js`: streaming transport, chunk parsing, retries
   - `providers/youtube/contextResolver.js`: channel/video/liveChat resolution
   - `sources/websocket/youtube_streaming_adapter.js`: page adapter
   - `sources/websocket/youtube.html`: surface wiring and UI

## Phases

### Phase 1

- Build the adapter.
- Wire it into `youtube.html`.
- Make streaming opt-in by query flag or internal debug flag.
- Keep polling as the default path until verified.

### Phase 2

- Switch to `auto` transport internally.
- Prefer streaming first.
- Fall back to polling automatically.
- Keep the visible page behavior unchanged.

## Testing

### Small Harnesses

- Add `tests/youtube-livechat-stream.html`
  Purpose: test `providers/youtube/liveChat.js` with mocked `fetch`, `ReadableStream`, retries, auth failures, and malformed chunks.

- Add `tests/youtube-websocket-stream.html`
  Purpose: test the websocket adapter and verify streamed messages produce the same page-level output shape as polling.

### Manual Smoke Checks

Run against `sources/websocket/youtube.html` on localhost with a real token and target.

Check:

- live chat connects and messages render
- connect by `videoId` still works
- connect by channel still works
- disconnect works cleanly
- sign-out still works
- ended stream falls back cleanly
- auth expiry falls back or prompts cleanly
- repeated reconnects do not loop aggressively
- polling fallback still works

## Acceptance Criteria

- End-user UI looks and behaves the same.
- `youtube.html` remains the main page.
- No dependency on `lite/*`.
- Streaming uses shared provider code from `providers/youtube/*`.
- Outbound event shape remains compatible with current consumers.
- Polling fallback remains available and reliable.
