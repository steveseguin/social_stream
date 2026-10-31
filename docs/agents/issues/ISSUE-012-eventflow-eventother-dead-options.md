# ISSUE-012: Event Flow `eventOther` dropdown offers events that can never fire

- **Status**: resolved
- **Severity**: low
- **Area**: social_stream `actions/EventFlowEditor.js`, `actions/EventFlowSystem.js`
- **Found**: 2026-07-22, during Event Flow editor documentation pass

## Original Symptom

The `eventOther` trigger dropdown offers `viewer_update`, `likes_update`, `follower_update`, `subscriber_update` (`EventFlowEditor.js:3783-3786`), but meta-only payloads are dropped before evaluation (`EventFlowSystem.js:1699-1702`, `:1642-1648`). These options can never trigger — a UI trap for users building flows on viewer/like counts.

## Resolution

Known counter payloads now reach Event Flow and may match only an explicit `eventOther` trigger for the same event. They remain excluded from generic chat triggers such as Any Message. The like-count option is labeled platform-generically.

## Evidence

- `actions/EventFlowEditor.js:3783-3786` — dropdown options
- `actions/EventFlowSystem.js:1699-1702, 1642-1648` — meta-only exclusion

## Notes

Resolved during the cross-platform individual-like routing pass.
