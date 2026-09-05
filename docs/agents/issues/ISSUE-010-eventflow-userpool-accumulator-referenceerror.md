# ISSUE-010: Event Flow `userPool`/`accumulator` triggers throw ReferenceError

- **Status**: fixed (2026-09-05, local)
- **Severity**: low
- **Area**: social_stream `actions/EventFlowSystem.js`
- **Found**: 2026-07-22, during Event Flow editor documentation pass

## Symptom

The `userPool` and `accumulator` trigger evaluators read `trigger.config`, but the variable in scope is `triggerNode`/`config` (`EventFlowSystem.js:2556-2566`, `:2652-2662`) — ReferenceError on evaluation. These triggers are not in the editor palette (dead code), but an imported flow JSON using them rejects the whole `evaluateFlow` because Pass 1 has no per-trigger try/catch (`:1756-1762`), breaking every other trigger in that flow.

## Expected

Evaluators use the correct variable, and/or Pass 1 isolates per-trigger errors.

## Evidence

- `actions/EventFlowSystem.js:2556-2566` — userPool
- `actions/EventFlowSystem.js:2652-2662` — accumulator
- `actions/EventFlowSystem.js:1756-1762` — unprotected Pass 1

## Notes

Both evaluators now read the existing `config` variable. Regression tests import and execute complete flows, checking distinct pool entrants, unrelated actions, accumulator thresholds, and per-user totals. The triggers remain absent from the editor palette; this fixes execution of existing/imported configurations.

Related to ISSUE-007 (same missing error isolation in Pass 1).
