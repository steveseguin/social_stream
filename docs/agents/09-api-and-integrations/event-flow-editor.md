# Event Flow Editor

Status: heavy extraction pass plus focused Node-test evidence on 2026-06-24.

## Purpose

Event Flow is SSN's visual automation layer. It lets users connect source triggers, logic gates, state nodes, and actions so chat messages or system events can be filtered, modified, relayed, displayed, spoken, or sent to integrations.

## Source Anchors

- `social_stream/actions/EventFlowEditor.js`
- `social_stream/actions/EventFlowSystem.js`
- `social_stream/actions/event-flow-guide.html`
- `social_stream/actions/state-nodes-guide.html`
- `social_stream/actions/STATE_NODES_EXPLANATION.md`
- `social_stream/actions/examples/kick-channel-points-action-flow.json`
- `social_stream/docs/kick-channel-points-event-flow.md`
- `social_stream/tests/eventflow-customjs.test.js`
- `social_stream/tests/eventflow-compare-property.test.js`
- `social_stream/tests/eventflow-template-vars.test.js`
- `social_stream/tests/eventflow-play-media-duration.test.js`

## Focused Validation Evidence

On 2026-06-24, these focused Node tests passed:

```powershell
node tests/eventflow-customjs.test.js
node tests/eventflow-compare-property.test.js
node tests/eventflow-template-vars.test.js
node tests/eventflow-play-media-duration.test.js
```

Results:

- `eventflow-customjs.test.js`: `23 passed, 0 failed`
- `eventflow-compare-property.test.js`: `18 passed, 0 failed`
- `eventflow-template-vars.test.js`: `6 passed, 0 failed`
- `eventflow-play-media-duration.test.js`: `2 passed, 0 failed`

Evidence label: `focused-node-test`; not runtime-tested.

What this supports: custom JS allow/block detection, custom JS trigger/action behavior, syntax-error handling, compare-property behavior, OBS system trigger matching, dynamic template variables, counter-derived `counterRemaining`, and `playTenorGiphy` duration payload behavior.

What it does not support: Event Flow editor UI behavior, flow save/import/export, Flow Actions overlay rendering, OBS Browser Source output, OBS WebSocket control, Chrome extension runtime behavior, standalone app runtime behavior, live source payloads, webhook/relay/TTS/Spotify/MIDI/points/send-message actions, or long-running state.

Full evidence entry: `../18-focused-validation-evidence-log.md`.

## Mental Model

An Event Flow is a graph. A source event enters a trigger node, passes through optional logic or state nodes, then reaches one or more actions.

Each line carries:

- A message/event payload.
- A boolean gate value.

If a node returns `true`, downstream nodes continue. If it returns `false`, downstream nodes stop for that branch. Some actions modify the payload and continue; others block, relay, display, or run side effects.

Do not put arbitrary custom data at the top level unless current code expects it. Existing docs point agents toward `docs/event-reference.html` for canonical fields and recommend putting extra custom data inside `meta`.

## User Entry Points

- Event Flow editor page: `actions/` in the web repo.
- Event Flow guide: `actions/event-flow-guide.html`.
- State node guide: `actions/state-nodes-guide.html`.
- Flow Actions overlay: `actions.html?session=YOUR_SESSION`.

Media, audio, text overlay, and OBS actions need a rendering/control surface. In normal streaming use, that surface is the Flow Actions overlay running as a browser tab or OBS Browser Source. If the overlay is closed, those actions can appear to do nothing even though the flow itself is firing.

## Trigger Families

Exact trigger IDs come from `actions/EventFlowEditor.js`.

Stream events:

- `eventNewFollower`
- `eventNewSubscriber`
- `eventResub`
- `eventGiftSub`
- `eventDonation`
- `eventRaid`
- `eventCheer`
- `eventOther`
- `eventCustom`

OBS Studio system events:

- `obsStreamStarted`
- `obsStreamStopped`
- `obsRecordingStarted`
- `obsRecordingStopped`
- `obsSceneChanged`
- `obsReplaybufferSaved`

OBS events are non-chat payloads with `type: "obs"` and an `event` value such as `stream_started`, `recording_started`, `scene_changed`, or `replay_buffer_saved`. Tests confirm they are allowed into Event Flow but do not trigger `anyMessage`.

Chat message triggers:

- `anyMessage`
- `messageContains`
- `messageStartsWith`
- `messageEndsWith`
- `messageEquals`
- `messageRegex`

Message property triggers:

- `messageLength`
- `wordCount`
- `containsEmoji`
- `containsLink`
- `hasDonation`
- `compareProperty`
- `messageProperties`

User and source triggers:

- `fromSource`
- `fromChannelName`
- `fromUser`
- `userRole`
- `channelPointRedemption`

Timing and random triggers:

- `randomChance`
- `timeInterval`
- `timeOfDay`

MIDI triggers:

- `midiNoteOn`
- `midiNoteOff`
- `midiCC`

Advanced triggers:

- `eventType`
- `customJs`

## Action Families

Message actions:

- `blockMessage`
- `returnMessage`
- `continueAsync`
- `modifyMessage`
- `addPrefix`
- `addSuffix`
- `findReplace`
- `removeText`
- `setProperty`
- `featureMessage`
- `sendMessage`
- `relay`
- `reflectionFilter`

Integration actions:

- `customJs`
- `webhook`
- `addPoints`
- `spendPoints`

Media and effects actions:

- `playTenorGiphy`
- `showAvatar`
- `showText`
- `clearLayer`
- `playAudioClip`
- `delay`

OBS Studio actions:

- `obsChangeScene`
- `obsToggleSource`
- `obsSetSourceFilter`
- `obsMuteSource`
- `obsStartRecording`
- `obsStopRecording`
- `obsStartStreaming`
- `obsStopStreaming`
- `obsReplayBuffer`

Spotify actions:

- `spotifySkip`
- `spotifyPrevious`
- `spotifyPause`
- `spotifyResume`
- `spotifyToggle`
- `spotifyVolume`
- `spotifyQueue`
- `spotifyNowPlaying`
- `spotifyShuffle`
- `spotifyRepeat`

TTS actions:

- `ttsSpeak`
- `ttsToggle`
- `ttsSkip`
- `ttsClear`
- `ttsVolume`

MIDI actions:

- `midiSendNote`
- `midiSendCC`

State control actions:

- `setGateState`
- `resetStateNode`
- `setCounter`
- `incrementCounter`
- `checkCounter`

## Logic Nodes

Current logic node types:

- `AND`
- `OR`
- `NOT`
- `RANDOM`
- `CHECK_BAD_WORDS`

The user-facing guide also describes common filter patterns such as compare, regex, condition, and reflection/no-echo protection. In support answers, be careful to distinguish actual node IDs from broader guide concepts.

## State Nodes

Current state node types:

- `GATE`: on/off switch that can allow or block downstream flow.
- `COUNTER`: count-based state for thresholds and cooldown-like workflows.
- `THROTTLE`: rate limiter.

Common setup rule: add the state node first, give it a stable name or ID, then point the matching action node at that state node. If an action references the wrong node ID/name, it has nothing useful to update.

State actions:

- `setGateState`: changes a gate to allow/block.
- `resetStateNode`: resets a target state node.
- `setCounter`: sets a counter value.
- `incrementCounter`: increments a counter value.
- `checkCounter`: copies counter details onto the message for later templates.

Tests confirm `checkCounter` exposes:

- `counterValue`
- `counterTarget`
- `counterRemaining`

Example template:

```text
You have to wait {counterRemaining} seconds to send a tts!
```

## Template Variables

Templates can use common SSN payload fields such as:

- `{username}`
- `{message}`
- `{source}`
- `{chatname}`
- `{chatmessage}`
- `{hasDonation}`
- `{membership}`
- `{meta}`

Tests also verify dynamic top-level fields can render in templates. For counters, `counterRemaining` is derived from `counterTarget - counterValue`.

## Custom JS

Custom JS exists as both a trigger (`customJs`) and an action (`customJs`).

Important runtime boundary:

- In the Chrome extension context, custom JS eval is disabled because MV3 extension pages do not allow dynamic eval under the default CSP.
- In SSApp/Electron-like contexts, custom JS eval is allowed.

Current detection treats these as allow contexts:

- `window.ssapp === true`
- `window.ninjafy` truthy
- `window.electronApi` truthy
- URL has `?ssapp`
- global `isSSAPP === true`
- explicit constructor option `allowEvalCustomJs: true`

Tests confirm blocked custom JS triggers return `false`, and blocked custom JS actions do not execute user code. When allowed, custom JS triggers can return a boolean, and custom JS actions can mutate the message and return a result object.

Support guidance:

- If a custom-code node works in SSApp but not in the Chrome extension, that is expected unless the extension CSP/runtime is changed.
- Syntax errors in custom JS should fail the node, not crash the full flow.
- Do not recommend unsafe eval changes casually; prefer SSApp/Electron for custom code workflows.

## Media And Overlay Actions

`playAudioClip`, `playTenorGiphy`, and `showText` send payloads to the Flow Actions overlay. The overlay should be open at:

```text
actions.html?session=YOUR_SESSION
```

Recommended OBS setup from the guide:

- Add it as an OBS Browser Source when the output should render on stream.
- Use a 1920x1080 browser source unless the user has a specific canvas/layout reason to do otherwise.
- Keep the overlay open while the flow should produce audio/media/text effects.

`playTenorGiphy` duration behavior from tests:

- Undefined duration falls back to `10000` ms.
- Explicit `duration: 0` is preserved and means manual close behavior for that overlay payload.

## OBS Actions

OBS controls can work in two modes:

- Browser Source API: only when `actions.html` runs inside an OBS Browser Source with the right advanced access.
- OBS WebSocket: recommended mode for source/filter/mute/scene/recording/streaming actions.

OBS WebSocket requirements in current docs:

- OBS 28+.
- obs-websocket v5 API.
- Default port `4455`.
- Example: `actions.html?session=test&obsws=ws://127.0.0.1:4455`.
- Add `&obspw=...` only if the OBS WebSocket server is configured to require a password.
- Add `&obsdebug=1` to show a small diagnostic badge on the overlay.

Old obs-websocket 4.x on port `4444` is not expected to work for source/filter/mute controls until the user upgrades.

## Kick Reward Example

The current example flow is `actions/examples/kick-channel-points-action-flow.json`, with detailed instructions in `docs/kick-channel-points-event-flow.md`.

The example uses:

- Trigger `channelPointRedemption` with `rewardName`.
- Trigger `fromSource` with `source: "kick"`.
- Logic `AND`.
- Actions `playAudioClip`, `playTenorGiphy`, and `showText`.

Key support point: Kick channel rewards should use the Kick bridge source, not only the ordinary Kick chatroom. The bridge can emit structured reward events with `type: "kick"`, `event: "reward"`, and reward details in `meta`.

## Relay Loop Protection

The guide describes No Reflections / No Echo behavior for relay workflows. When building relay flows, tag relayed messages in `meta` where possible, for example `meta.source = "relay"`, and add a reflection/no-echo filter before re-relaying.

Without loop protection, a flow can relay a message into another destination, then capture its own relayed message and repeat.

## Troubleshooting

Flow does not fire:

- Confirm the flow is saved and active.
- Confirm the source tab/bridge is open and sending events.
- Use the Event Flow test panel with a payload that actually matches the trigger.
- For reward-name filters, the test message or event must include the reward name.
- For OBS events, use OBS-specific triggers, not `anyMessage`.

Media/audio/text action does nothing:

- Open the Flow Actions overlay with the same session.
- Check browser/OBS source audio permissions.
- Confirm the media/audio URL is reachable.
- For OBS Browser Source usage, verify the overlay is actually loaded in OBS.

OBS action does nothing:

- Prefer OBS WebSocket v5 on port `4455`.
- Add `&obsws=ws://127.0.0.1:4455` to the overlay URL.
- Add `&obspw=...` only if OBS requires auth.
- Use `obs-websocket-test.html` for connection testing.
- Upgrade if the user is on obs-websocket 4.x / port `4444`.

State action seems broken:

- Confirm the state node exists.
- Confirm action target node ID/name matches the state node.
- Reset state between tests when old state could be affecting results.
- For counters, use `checkCounter` before trying to render `{counterRemaining}`.

Custom JS does not run:

- In the Chrome extension, this is expected because eval is disabled by CSP.
- Use SSApp/Electron or an approved runtime path for custom JS workflows.
- Check the console for syntax/runtime errors.

## Remaining Extraction Targets

- Line-level review of every trigger evaluator in `EventFlowSystem.js`.
- Line-level review of every action executor, especially relay, webhook, points, Spotify, TTS, MIDI, and OBS actions.
- Cross-check `STATE_NODES_EXPLANATION.md` against current code because some older notes appear stale compared with current editor/test behavior.
- Add support-derived examples for common automation recipes.
