# Issues Index

Bugs and defects found while writing/maintaining the AI-facing docs. Only issues bigger than a nit are tracked here. One file per issue: `ISSUE-NNN-short-slug.md`.

Status values: `open`, `in-progress`, `fixed`, `wontfix`.

| ID | Title | Area | Severity | Status |
|----|-------|------|----------|--------|
| [ISSUE-001](ISSUE-001-duplicate-ipc-registration-on-window-recreate.md) | Duplicate IPC/globalShortcut registration on window recreate | ssapp main.js | high | open |
| [ISSUE-002](ISSUE-002-dead-onbeforeunload-on-browserwindow.md) | Dead `onbeforeunload` on BrowserWindow (hide-instead-of-close inert) | ssapp main.js | medium | open |
| [ISSUE-003](ISSUE-003-sendtiktokmessage-virtual-tab-id.md) | `sendTikTokMessage` IPC fails for virtual tab IDs | ssapp main.js | medium | open |
| [ISSUE-004](ISSUE-004-tiktoksendresult-no-listener.md) | `tiktokSendResult` event has no renderer listener | ssapp main.js | medium | open |
| [ISSUE-005](ISSUE-005-exec-arbitrary-js-endpoint.md) | Legacy `/exec` = arbitrary JS execution, contradicts docs | ssapp main.js + control-api.md | high | open |
| [ISSUE-006](ISSUE-006-control-api-token-in-query-param.md) | Control API token accepted via `?token=` query param | ssapp main.js | medium | resolved in API 1.1.5 |
| [ISSUE-007](ISSUE-007-eventflow-scheduler-null-message-crash.md) | Event Flow scheduler crashes flows mixing time + message triggers | actions/EventFlowSystem.js | high | fixed (local) |
| [ISSUE-008](ISSUE-008-eventflow-timeofday-editor-corrupts-config.md) | `timeOfDay` trigger breaks after any editor edit | actions/EventFlowEditor.js | medium | fixed (local) |
| [ISSUE-009](ISSUE-009-eventflow-standalone-editor-desync.md) | Standalone editor tab edits don't reach running background | actions/EventFlowEditor.js | medium | open |
| [ISSUE-010](ISSUE-010-eventflow-userpool-accumulator-referenceerror.md) | `userPool`/`accumulator` triggers throw ReferenceError | actions/EventFlowSystem.js | low | fixed (local) |
| [ISSUE-011](ISSUE-011-eventflow-midi-wrong-webmidi-signature.md) | MIDI signature claim disproved; related zero-velocity bug fixed | actions/EventFlowSystem.js | medium | reviewed; fix local |
| [ISSUE-012](ISSUE-012-eventflow-eventother-dead-options.md) | `eventOther` dropdown offers events that can never fire | actions/EventFlowEditor.js | low | open |
| [ISSUE-013](ISSUE-013-eventflow-random-gate-zero-probability.md) | RANDOM gate treats probability 0 as 50% | actions/EventFlowSystem.js | low | fixed (local) |
| [ISSUE-014](ISSUE-014-eventflow-gate-autoreset-hardcodes-block.md) | GATE autoReset always resets to BLOCK | actions/EventFlowSystem.js | low | open |
| [ISSUE-015](ISSUE-015-youtube-ws-superchat-double-emit.md) | YouTube WS/API mode double-emits Super Chats | sources/websocket/youtube.html | high | fixed (local) |
| [ISSUE-016](ISSUE-016-youtube-provider-retry-dead-token.md) | YouTube provider retry loop reuses dead token after 401 | providers/youtube/liveChat.js | medium | fixed (local) |
| [ISSUE-017](ISSUE-017-youtube-dom-membershiprenewal-leak.md) | DOM mode emits undocumented `membershiprenewal` event | sources/youtube.js | medium | open |
| [ISSUE-018](ISSUE-018-youtube-api-deletes-dropped.md) | YouTube API mode drops messageDeleted/Retracted events | sources/websocket/youtube.html | medium | open |
