# ISSUE-011: Event Flow MIDI send actions use wrong WebMidi v3 signatures

- **Status**: open
- **Severity**: medium
- **Area**: social_stream `actions/EventFlowSystem.js`, `thirdparty/webmidi3.js`
- **Found**: 2026-07-22, during Event Flow editor documentation pass

## Symptom

`midiSendNote` calls `playNote(config.note, channel, {velocity, duration})` (`EventFlowSystem.js:4218-4221`) and `midiSendCC` calls `sendControlChange(controller, value, channel)` (`:4238`). WebMidi v3 signatures are `playNote(note, options)` and `sendControlChange(cc, value, options)` — the channel number lands where the options object belongs, `velocity` should be `attack`, and `duration`/channel config are ignored. Notes play on all channels with no duration/velocity control.

## Expected

`playNote(note, {channels: ch, attack: velocity, duration})`; `sendControlChange(cc, value, {channels: ch})`.

## Evidence

- `actions/EventFlowSystem.js:4218-4221` — playNote call
- `actions/EventFlowSystem.js:4238` — sendControlChange call
- `thirdparty/webmidi3.js` — `playNote(e,t={})`, `sendControlChange(e,t,n={})`

## Notes
