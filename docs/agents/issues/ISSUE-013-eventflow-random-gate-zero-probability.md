# ISSUE-013: Event Flow RANDOM logic gate treats probability 0 as 50%

- **Status**: open
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

Same falsy-default class of bug as the send/relay `timeout` help text (editor says 0 = immediate, `config.timeout || 1000` makes it 1000ms — `EventFlowSystem.js:3486, 3564`, help text `EventFlowEditor.js:4600, 4664`).
