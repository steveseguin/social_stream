# ISSUE-007: Event Flow scheduler crashes flows mixing time triggers with message triggers

- **Status**: fixed (2026-09-05, local)
- **Severity**: high
- **Area**: social_stream `actions/EventFlowSystem.js`
- **Found**: 2026-07-22, during Event Flow editor documentation pass

## Symptom

The 1s scheduler tick calls `evaluateFlow(flow, null)` for flows containing `timeInterval`/`timeOfDay` triggers (`EventFlowSystem.js:209`). Most trigger evaluators dereference `message` unguarded — e.g. `eventNewFollower` (`:2233`), `compareProperty` (`:2369`), `randomChance` (`:2783`), `fromChannelName` (`:2177`), `fromUser` (`:2184`), `hasDonation` (`:2201`), `messageProperties` (`:2839`). Any flow combining a time trigger with one of these throws in Pass 1 (no try/catch, `:1756-1762`), so the time trigger never fires. The error is swallowed at `:210-212`, making this silent.

## Expected

Time triggers fire on schedule regardless of what other triggers exist in the flow; message-dependent triggers evaluate false on null-message ticks.

## Evidence

- `actions/EventFlowSystem.js:209` — `evaluateFlow(flow, null)`
- `actions/EventFlowSystem.js:2233, 2369, 2783, 2177, 2184, 2201, 2839` — unguarded `message` dereferences
- `actions/EventFlowSystem.js:210-212` — swallowed error

## Notes

Null-message evaluations now skip message-dependent triggers before accessing the payload or changing message counters. Time triggers, custom scripts, and random triggers explicitly configured with `requireMessage: false` remain supported. Regression tests exercise the actual scheduler with mixed triggers and check that real follower events still match.

Guard message-dependent evaluators with `if (!message) return false;` or try/catch Pass 1 per trigger.
