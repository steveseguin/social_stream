# Timer Plan

## Goal

Add a narrow `timer.html` overlay/control page to Social Stream Ninja.

Target: satisfy roughly 70% of users who want a controllable on-stream timer, without trying to replace full stage-management tools.

## Product Boundary

The timer should stay a timer.

Keep inside `timer.html`:

- single active timer
- countdown / count-up
- overtime
- label / segment title
- warning states
- done sound
- simple operator controls
- a few visual styles

Keep outside `timer.html`:

- advanced stage messaging
- fullscreen cue cards
- moderated Q&A workflow
- question intake / approval / queueing
- team collaboration features
- full rundown / agenda editor for v1

Those belong in separate surfaces:

- `actions.html` for stage prompts / cue cards / advanced messaging
- future `qa.html` or similar for question management

## Timer MVP

### Core features

- `timer.html` viewer mode by default
- `&operator` mode with large controls
- start / pause / toggle
- reset
- `+30s` / `-30s`
- set exact time
- label
- overtime
- warning colors:
  - normal
  - warning
  - danger
- optional done chime
- custom sound URL / upload
- styles:
  - `stage`
  - `compact`
  - `ring`

### URL parameters

- standard:
  - `?session=`
  - `&password=`
  - `&server`
  - `&css=`
  - `&b64css=`
  - `&scale=`
- timer-specific:
  - `&operator`
  - `&style=stage|compact|ring`
  - `&duration=300`
  - `&warn=60`
  - `&danger=15`
  - `&autostart`
  - `&customsound=...`

## API

### Actions

- `starttimer`
- `pausetimer`
- `toggletimer`
- `resettimer`
- `settimer`
- `timeradd`
- `timersubtract`
- `gettimerstate`

### Example payloads

```json
{ "action": "starttimer" }
{ "action": "pausetimer" }
{ "action": "timeradd", "value": 30 }
{ "action": "timersubtract", "value": 30 }
{ "action": "settimer", "value": { "seconds": 300, "label": "Interview" } }
```

### Timer state shape

If timer state is exposed to other pages or the API, keep extra fields under `meta`.

```json
{
  "event": "timer_update",
  "meta": {
    "state": "running",
    "label": "Interview",
    "remainingMs": 182000,
    "durationMs": 300000,
    "warnAtMs": 60000,
    "dangerAtMs": 15000,
    "overtime": false,
    "style": "stage"
  }
}
```

## Implementation Plan

### Phase 1: Timer page

- add `timer.html`
- support viewer mode and `&operator`
- use existing SSN connection pattern:
  - P2P / iframe bridge
  - `&server` websocket relay support

### Phase 2: Popup integration

- add timer page registration in `popup.js`
- add timer section near the bottom of `popup.html`
- keep options compact

Suggested popup options:

- default duration
- warning threshold
- danger threshold
- style
- done sound on/off
- custom sound URL
- upload sound button

### Phase 3: Background / routing

- add timer control actions in `background.js`
- route timer commands using existing `sendTargetP2P(..., "timer")` style
- initialize timer state when a timer peer connects

### Phase 4: API / docs

- add timer controls to `sampleapi.html`
- add timer section to `api.md`
- add short timer section to `docs/commands.html`
- update `docs/event-reference.html` only if timer events are formally emitted

## Likely Files

- `timer.html`
- `popup.html`
- `popup.js`
- `background.js`
- `sampleapi.html`
- `api.md`
- `docs/commands.html`
- `docs/event-reference.html` if needed
- `scripts/prepare-chrome-web-store.sh` if `timer.html` should be treated like other website-hosted overlays

## Deferred

Not in MVP:

- presets / mini-rundown
- next / previous segment controls
- chat-driven moderator commands
- Event Flow timer node
- advanced messaging
- Q&A

## Follow-up Options

### V1.1

- presets / mini-rundown
- `timernext` / `timerprev`
- Event Flow timer control action

### Separate future work

- advanced cue / messaging improvements in `actions.html`
- dedicated Q&A page and workflow
