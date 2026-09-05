# ISSUE-008: Event Flow `timeOfDay` trigger breaks after any editor edit

- **Status**: fixed (2026-09-05, local)
- **Severity**: medium
- **Area**: social_stream `actions/EventFlowEditor.js`, `actions/EventFlowSystem.js`
- **Found**: 2026-07-22, during Event Flow editor documentation pass

## Symptom

The editor renders `config.times` as a joined string and the generic property listener stores that raw string back (`EventFlowEditor.js:3433`, `:5945-5957`). The evaluator requires `Array.isArray(config.times)` (`EventFlowSystem.js:2446`), so after any edit the trigger silently never fires.

## Expected

Editor parses the string back into an array (or the evaluator accepts both).

## Evidence

- `actions/EventFlowEditor.js:3433` — joined-string rendering
- `actions/EventFlowEditor.js:5945-5957` — generic string store
- `actions/EventFlowSystem.js:2446` — `Array.isArray` requirement

## Notes

The editor now saves an array, and both rendering and evaluation accept legacy string schedules. The related daily-repeat bug is also fixed: duplicate suppression tracks the actual minute, not just HH:MM, so the same time can fire on later days. Regression coverage is in `tests/review-critical-regressions.test.cjs`.
