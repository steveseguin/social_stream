# ISSUE-016: YouTube provider retry loop reuses dead token after 401

- **Status**: fixed (2026-09-05, local)
- **Severity**: medium
- **Area**: social_stream `providers/youtube/liveChat.js` (Lite surface)
- **Found**: 2026-07-22, during YouTube source documentation pass

## Symptom

On 401 the provider throws `TOKEN_EXPIRED` (`liveChat.js:359-363`), but `scheduleRetry` (`:700-707`) re-calls `start(state.lastStartOptions)` and `ensureToken` (`:250-255`) prefers the stale `startOptions.token` without re-invoking `tokenProvider` — an infinite 401→retry loop. Lite's `reportError` doesn't clear the internal retry timer.

## Expected

After `TOKEN_EXPIRED`, retry obtains a fresh token via `tokenProvider` (or stops and surfaces a terminal auth error).

## Evidence

- `providers/youtube/liveChat.js:359-363` — TOKEN_EXPIRED throw
- `providers/youtube/liveChat.js:700-707` — scheduleRetry reusing lastStartOptions
- `providers/youtube/liveChat.js:250-255` — ensureToken preferring stale token

## Notes

`TOKEN_EXPIRED` now stops automatic retries, clears the cached token, and surfaces the existing reconnect error. An explicit start with replacement credentials still works. Verified by `tests/review-critical-regressions.test.cjs`; transient network failures retain automatic retry behavior.

Affects Lite (`lite/plugins/youtubeStreamingPlugin.js`) only; the extension/Electron websocket page implements streaming inline in `sources/websocket/youtube.html` and handles 401 by refreshing then `scheduleAuthRetry` (`youtube.html:3776-3779`).
