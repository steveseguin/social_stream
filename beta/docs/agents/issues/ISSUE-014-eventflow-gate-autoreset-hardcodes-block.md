# ISSUE-014: Event Flow GATE autoReset always resets to BLOCK

- **Status**: open
- **Severity**: low
- **Area**: social_stream `actions/EventFlowSystem.js`
- **Found**: 2026-07-22, during Event Flow editor documentation pass

## Symptom

GATE's `autoResetMs` hardcodes the reset target to BLOCK (`EventFlowSystem.js:1085-1089`) regardless of the configured `defaultState`. A gate configured to default ALLOW still resets to BLOCK. `autoResetMs` is also not exposed in the editor UI, so this only affects imported/hand-built flows.

## Expected

Auto-reset returns the gate to its configured `defaultState`.

## Evidence

- `actions/EventFlowSystem.js:1069-1097` — GATE evaluator, hardcoded BLOCK reset at `:1085-1089`

## Notes
