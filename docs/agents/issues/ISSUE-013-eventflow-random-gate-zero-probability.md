# ISSUE-013: Event Flow RANDOM logic gate treats probability 0 as 50%

- **Status**: fixed (2026-09-05, local)
- **Severity**: low
- **Area**: social_stream `actions/EventFlowSystem.js`
- **Found**: 2026-07-22, during Event Flow editor documentation pass

## Symptom

`(nodeConfig && nodeConfig.probability) || 50` (`EventFlowSystem.js:411`) turns an explicitly configured probability of 0 into 50. Users cannot configure a never-pass RANDOM gate.

## Expected

Nullish check (`?? 50`) so 0 is honored.

## Evidence

- `actions/EventFlowSystem.js:411`

## Notes

The evaluator, node description, and property input now preserve an explicit 0. Regression tests in `tests/review-critical-regressions.test.cjs` cover zero, the 50% default, 100%, inactive input, and editor rendering.

The related send/relay timeout fallback described below is also fixed locally (2026-09-05). Explicit zero is passed to the transport instead of being replaced by 1000 ms; missing values retain the existing default. Transport-level platform throttling remains in place. Regression tests verify both actions and reflection-loop protection.

Same falsy-default class of bug as the send/relay `timeout` help text (editor says 0 = immediate, `config.timeout || 1000` makes it 1000ms — `EventFlowSystem.js:3486, 3564`, help text `EventFlowEditor.js:4600, 4664`).
