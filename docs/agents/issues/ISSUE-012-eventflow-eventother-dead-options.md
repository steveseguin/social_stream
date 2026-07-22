# ISSUE-012: Event Flow `eventOther` dropdown offers events that can never fire

- **Status**: open
- **Severity**: low
- **Area**: social_stream `actions/EventFlowEditor.js`, `actions/EventFlowSystem.js`
- **Found**: 2026-07-22, during Event Flow editor documentation pass

## Symptom

The `eventOther` trigger dropdown offers `viewer_update`, `likes_update`, `follower_update`, `subscriber_update` (`EventFlowEditor.js:3783-3786`), but meta-only payloads are dropped before evaluation (`EventFlowSystem.js:1699-1702`, `:1642-1648`). These options can never trigger — a UI trap for users building flows on viewer/like counts.

## Expected

Remove those options, or allow meta-only payloads to reach triggers (with an explicit opt-in).

## Evidence

- `actions/EventFlowEditor.js:3783-3786` — dropdown options
- `actions/EventFlowSystem.js:1699-1702, 1642-1648` — meta-only exclusion

## Notes

Documented as a limitation in `09-api-and-integrations/event-flow-editor.md` until fixed.
