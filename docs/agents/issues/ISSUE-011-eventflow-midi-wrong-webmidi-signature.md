# ISSUE-011: Event Flow MIDI send actions use wrong WebMidi v3 signatures

- **Status**: original claim not reproduced; related zero-velocity bug fixed (2026-09-05, local)
- **Severity**: medium
- **Area**: social_stream `actions/EventFlowSystem.js`, `thirdparty/webmidi3.js`
- **Found**: 2026-07-22, during Event Flow editor documentation pass

## Validation

Tests against the actual bundled `thirdparty/webmidi3.js` show that its enabled-by-default validation layer supports the old signatures. Channel selection, nonzero velocity, duration, and CC routing work; the original claim below was incorrect for the application's configuration.

A separate reproducible bug changed velocity 0 to 127 in the action and editor. Both now preserve zero, and the note action uses `attack` because the vendor's deprecated `velocity` compatibility path also ignores zero. Regression tests check emitted MIDI bytes and note-off timestamps without accessing hardware (`tests/review-critical-regressions.test.cjs`).

## Original suspected symptom (not reproduced)

`midiSendNote` calls `playNote(config.note, channel, {velocity, duration})` (`EventFlowSystem.js:4218-4221`) and `midiSendCC` calls `sendControlChange(controller, value, channel)` (`:4238`). WebMidi v3 signatures are `playNote(note, options)` and `sendControlChange(cc, value, options)` — the channel number lands where the options object belongs, `velocity` should be `attack`, and `duration`/channel config are ignored. Notes play on all channels with no duration/velocity control.

## Expected

`playNote(note, {channels: ch, attack: velocity, duration})`; `sendControlChange(cc, value, {channels: ch})`.

## Evidence

- `actions/EventFlowSystem.js:4218-4221` — playNote call
- `actions/EventFlowSystem.js:4238` — sendControlChange call
- `thirdparty/webmidi3.js` — `playNote(e,t={})`, `sendControlChange(e,t,n={})`

## Notes
