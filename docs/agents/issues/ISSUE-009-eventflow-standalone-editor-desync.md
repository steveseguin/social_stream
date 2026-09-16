# ISSUE-009: Standalone Event Flow editor tab edits don't reach the running background instance

- **Status**: open
- **Severity**: medium
- **Area**: social_stream `actions/EventFlowEditor.js`, `actions/index.html`
- **Found**: 2026-07-22, during Event Flow editor documentation pass

## Symptom

Saving in the standalone editor tab (`actions/index.html`, opened via `popup.js:306`) writes the shared IndexedDB, but the background tab's in-memory flows are never reloaded: `notifyParentToReloadFlows` no-ops there (`window.parent.eventFlowSystem === this.eventFlowSystem`, `EventFlowEditor.js:1465-1470`) and flow changes are not BroadcastChannel-synced (only user memory is). Edits don't take effect until background.html reloads.

Additionally, the standalone tab's own `EventFlowSystem` instance lacks `sendMessageToTabs`/`sendTargetP2P`, so relay/send/OBS actions silently fail from its test panel (`EventFlowSystem.js:3423`, `:3756`).

## Expected

Saving in any editor surface reloads flows in the running background instance (e.g. BroadcastChannel flow-sync like user memory).

## Evidence

- `actions/EventFlowEditor.js:1455-1476` — reload notification logic
- `actions/EventFlowSystem.js:427-458` — BroadcastChannel only syncs user memory
- `actions/EventFlowSystem.js:3423, 3756` — missing bridges in standalone instance

## Notes
