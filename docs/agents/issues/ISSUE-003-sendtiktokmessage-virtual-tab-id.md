# ISSUE-003: `sendTikTokMessage` IPC fails for virtual tab IDs

- **Status**: open
- **Severity**: medium
- **Area**: ssapp repo, `main.js`
- **Found**: 2026-07-22, during ssapp TikTok documentation pass

## Symptom

The `sendTikTokMessage` IPC handler (`main.js:18425`, lookup at `main.js:18448`) looks up `websocketConnections[numericWssID]` with the raw value and never normalizes the `900000 + wssID` virtual tab ID via `normalizeTikTokConnectionHandle` — unlike `disconnectTikTokConnection` (`main.js:18020`) which does normalize. Any caller passing the virtual tab ID (which is what the renderer stores as `tiktokWssId`) gets "Connection not found".

Currently latent: index.html has no direct caller; preload/dock paths route via `sendToTikTok` instead. But the IPC handler is broken for its natural input.

## Expected

`sendTikTokMessage` accepts the same handle forms as `disconnectTikTokConnection`.

## Evidence

- `main.js:18448` — raw lookup, no normalization
- `main.js:18020` — `disconnectTikTokConnection` using `normalizeTikTokConnectionHandle`
- `main.js:17941-17990` — virtual tab ID registration (`900000 + wssID`)

## Notes

Apply `normalizeTikTokConnectionHandle` in the `sendTikTokMessage` handler.
