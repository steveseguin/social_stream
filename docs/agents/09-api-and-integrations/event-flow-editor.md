# Event Flow Editor

Status: intense extraction pass on 2026-07-22 (execution engine, persistence, entry points, defect audit) on top of the 2026-07-21 heavy pass with focused Node and SSApp Electron E2E evidence. Known defects tracked in `../issues/ISSUE-007` through `ISSUE-014`.

## Purpose

Event Flow is SSN's visual automation layer. It lets users connect source triggers, logic gates, state nodes, and actions so chat messages or system events can be filtered, modified, relayed, displayed, spoken, or sent to integrations.

## Source Anchors

- `social_stream/actions/EventFlowEditor.js`
- `social_stream/actions/EventFlowSystem.js`
- `social_stream/actions/event-flow-guide.html`
- `social_stream/actions/state-nodes-guide.html`
- `social_stream/actions/user-memory-guide.html`
- `social_stream/actions/STATE_NODES_EXPLANATION.md`
- `social_stream/actions/examples/kick-channel-points-action-flow.json`
- `social_stream/actions/examples/user-memory-participation-draw.json`
- `social_stream/docs/kick-channel-points-event-flow.md`
- `social_stream/tests/eventflow-customjs.test.js`
- `social_stream/tests/eventflow-compare-property.test.js`
- `social_stream/tests/eventflow-template-vars.test.js`
- `social_stream/tests/eventflow-play-media-duration.test.js`
- `social_stream/tests/eventflow-user-memory.test.js`
- `ssapp/tests/electron/eventflow-user-memory-e2e.js`

## Focused Validation Evidence

On 2026-07-05, these focused Node tests passed:

```powershell
node tests/eventflow-customjs.test.js
node tests/eventflow-compare-property.test.js
node tests/eventflow-template-vars.test.js
node tests/eventflow-play-media-duration.test.js
```

Results:

- `eventflow-customjs.test.js`: `23 passed, 0 failed`
- `eventflow-compare-property.test.js`: `39 passed, 0 failed`
- `eventflow-template-vars.test.js`: `6 passed, 0 failed`
- `eventflow-play-media-duration.test.js`: `2 passed, 0 failed`

Evidence label: `focused-node-test`; not runtime-tested.

What this supports: custom JS allow/block detection, custom JS trigger/action behavior, syntax-error handling, compare-property behavior including donation label currency conversion, OBS system trigger matching, dynamic template variables, counter-derived `counterRemaining`, and `playTenorGiphy` duration payload behavior.

What it does not support: Event Flow editor UI behavior, flow save/import/export, Flow Actions overlay rendering, OBS Browser Source output, OBS WebSocket control, Chrome extension runtime behavior, standalone app runtime behavior, live source payloads, webhook/relay/TTS/Spotify/MIDI/points/send-message actions, or long-running state.

Full evidence entry: `../18-focused-validation-evidence-log.md`.

### User Memory validation

On 2026-07-21, the focused User Memory Node test and the real SSApp Electron E2E test passed:

```powershell
# From social_stream
node tests/eventflow-user-memory.test.js

# From ssapp
npm run test:eventflow-user-memory:e2e
```

The Node test covers identity normalization, per-platform separation, deduplication, participation counts, independent memory objects, targeted forget/clear/reset, random draw/removal outputs, inactivity and stream reset scope, persistent-store reload, anonymous-event rejection, and the TikTok-eligibility-plus-later-command pattern.

The Electron test launches SSApp with an isolated profile and the real Social Stream source. It verifies the imported example renders 14 nodes and four dashed shared-state references; tests eligible and ineligible users through the editor's Test Flow panel; confirms ordinary viewers cannot run the moderator-protected draw/reset commands; draws and removes a winner; clears the selected memory; switches it to saved persistence; restarts SSApp; confirms the entrant reloads; clears it from the memory properties; and restarts again to prove the persistent clear holds. A separate manual pass also imported the example with SSApp's native file chooser.

Evidence labels: `focused-node-test` and `ssapp-electron-e2e`. This does not validate live TikTok/Twitch/YouTube payload delivery or a production broadcast.

## Donation Value Semantics

Event Flow treats `hasDonation` as the paid-support display label and `donoValue` as the exact numeric value when a source provides one. Threshold logic for `eventDonation`, `compareProperty` on `donoValue`/`donationAmount`, and numeric `hasDonation` comparisons uses the exact `donoValue` first, then legacy `donationAmount`, then `currency.js` conversion of `hasDonation` with the source `type`.

This conversion is only for normalized donation labels such as `1500 bits`, `$15 CAD`, `500 Stars`, `100 gifted subs`, `cheer100`, or `200 Jewels`. Event Flow does not parse `chatmessage` prose for donation values. Unknown named virtual units use the shared fallback of 100 units = $0.01 USD.

`eventDonation` matches the named paid-support events `superchat`, `supersticker`, `jeweldonation`, legacy `donation`, and Twitch `cheer`; value-only rows with no `event` still use the `hasDonation` trigger.

## Mental Model

An Event Flow is a graph. A source event enters a trigger node, passes through optional logic or state nodes, then reaches one or more actions.

Each line carries:

- A message/event payload.
- A boolean gate value.

If a node returns `true`, downstream nodes continue. If it returns `false`, downstream nodes stop for that branch. Some actions modify the payload and continue; others block, relay, display, or run side effects.

Do not put arbitrary custom data at the top level unless current code expects it. Existing docs point agents toward `docs/event-reference.html` for canonical fields and recommend putting extra custom data inside `meta`.

## User Entry Points

- Event Flow editor page: `actions/` in the web repo (`actions/index.html`, standalone tab; loads `EventFlowSystem.js` + `EventFlowEditor.js` via `actions/loader.js:15-20`).
- Embedded editor: `background.html#editor` (embedded `#editor` div, `background.html:746-886`; toggled by `dashboard.js showEditorView()`, `:283-298`). Opened from the popup (`popup.js:9893-9902` → `openEventFlowEditor()` `:292-309`) or via the MV3 `openEventFlowEditor` message (`service_worker.js:540-574`).
- URL params: `?ssapp` (postMessage-to-parent mode + enables custom JS eval, `EventFlowEditor.js:480-481`, `EventFlowSystem.js:152`), `?localserver` (local-media copy URL, `EventFlowEditor.js:6706`). `?session` etc. are not editor params — they are passed through to the Flow Actions overlay link (`EventFlowEditor.js:580-595`).
- Event Flow guide: `actions/event-flow-guide.html`.
- State node guide: `actions/state-nodes-guide.html`.
- User Memory guide: `actions/user-memory-guide.html`.
- Flow Actions overlay: `actions.html?session=YOUR_SESSION`.

Media, audio, text overlay, and OBS actions need a rendering/control surface. In normal streaming use, that surface is the Flow Actions overlay running as a browser tab or OBS Browser Source. If the overlay is closed, those actions can appear to do nothing even though the flow itself is firing.

Editor-surface caveat: the standalone `actions/index.html` tab and the embedded background editor share IndexedDB but not in-memory state — saves in the standalone tab do not reach the running background instance until background.html reloads (ISSUE-009), and relay/send/OBS actions fail silently from its test panel.

## Execution Engine

`EventFlowSystem.processMessage(message)` (`EventFlowSystem.js:1689-1743`):

1. Drops null payloads; runs stream-start/stop user-memory resets; drops meta-only payloads (`meta` present, no chatname/chatmessage/hasDonation/contentimg, not OBS — `:1642-1656`, `:1699-1702`).
2. Iterates `this.flows` **sequentially in saved `order`**; each flow's modified message feeds the next. `blocked` → return null and stop all flows; `returnNow` → stop remaining flows but keep the message.

`evaluateFlow(flow, message)` (`:1745-1988`) runs three passes per flow:

- **Pass 1**: all trigger nodes evaluated (awaited each) into `nodeActivationStates` (`:1756-1762`). No per-trigger error isolation — one throwing trigger rejects the whole flow (see ISSUE-007, ISSUE-010).
- **Pass 2**: iterative logic/state resolution to fixpoint, `maxIterations = nodes.length + 5` (`:1766-1819`). State nodes may replace the message. Cyclic logic graphs simply never evaluate.
- **Pass 3**: actions whose inputs are `=== true` run via recursive `executeActionChain`, deduped by an `executedActions` set (`:1827-1833`). Downstream actions sorted by priority: state-control (0) → normal (50) → `delay` (100) (`:1933-1956`). `continueAsync` spawns a `setTimeout(0)` async sub-chain (`:1868-1927`).

Schedulers and hardware:

- 1 s tick evaluates flows containing `timeInterval`/`timeOfDay` with a **null message** (`:177-218`; started at `background.js:18585`). Flows mixing time triggers with message-dependent triggers currently break — ISSUE-007.
- MIDI listeners bind on flow load/save and synthesize `{type:'midi', midiData}` messages (`:291-389`).

Rate limits and loop guards: only per-node `THROTTLE` and `randomChance.maxPerMinute` — there is **no global rate limit** on webhook/TTS/OBS/send actions. Relay loops are guarded by `reflection:true` tagging + `reflectionFilter` + OBS bridge 2 s dedupe (`background.js:13343-13364`). The `delay` action **awaits inline and stalls the whole message pipeline** (`:3913-3918`) — use `returnMessage`/`continueAsync` before it.

Errors: regex/customJs/eventCustom are wrapped per node; other trigger exceptions propagate and are caught at the background call sites (e.g. `background.js:4613-4615`), so the message passes through unmodified. Webhook failures land in `webhookError`/`webhookStatus` fields; `blockOnFailure` optionally blocks.

## Persistence And Flow Records

- IndexedDB `eventFlowDB` v2: stores `flowSettings` (keyPath `id`) and `userMemoryState` (`EventFlowSystem.js:5-7`, `:1359-1380`).
- Flow record: `{id, name, description, active, order, nodes, connections}`; node: `{id, type: trigger|logic|state|action, triggerType|logicType|stateType|actionType, label?, x, y, config:{}}`; connection: `{from, to}`.
- Load normalizes `active !== false` default and renumbers `order` (`:1442-1543`). `enableAllFlows` exists (`:1414-1421`) but has no editor UI.
- Export: single flow JSON + `{exportDate, version:'1.0.0', exportedBy}` (`EventFlowEditor.js:1564-1600`); all-flows export wraps in `{flows[]}` (`:1602-1639`). Import strips metadata, clears `id`, dedupes names with ` (n)` (`:1702-1740`). No schema validation or migration beyond the static version string.
- Deleting a flow cleans its state nodes and persisted user memories (`:1589-1620`, `:1168-1222`, `:633-657`).
- Cross-surface sync after save: SSApp → postMessage `eventFlowRequest/reloadFlows`; otherwise tries `window.parent.eventFlowSystem.reloadFlows()` (`EventFlowEditor.js:1455-1476`). User Memory syncs live via BroadcastChannel `social-stream-event-flow-state:eventFlowDB` (`EventFlowSystem.js:427-458`) — flow definitions do not (ISSUE-009).

## Trigger Surface (What Can Fire Flows)

Entry points into `processMessage` from `background.js`:

| Source | Ref |
| --- | --- |
| Main chat pipeline `processIncomingMessage` (after `applyBotActions`, before `sendToDestinations`) | `background.js:4486`, `:4611-4618` |
| `extContent` websocket bridge | `background.js:9687-9701` |
| Stripe / Ko-fi / BMAC / Fourthwall webhooks | `background.js:10055`, `:10135`, `:10211`, `:10297` |
| Fake/test messages | `background.js:18524` |
| OBS bridge `action:'eventFlowEvent'` (P2P + dock), 2 s dedupe | `background.js:9640`, `:13335-13381`; `dock.html:3479-3509` |
| MIDI hardware | `EventFlowSystem.js:379-389` |
| 1 s scheduler ticks (null message) | `EventFlowSystem.js:197-218` |

Condition-readable fields: any top-level field via `compareProperty`/`messageProperties`/`customJs`; specials include `chatmessage` (HTML-stripped into `message.textContent`, `:2076-2087`), `type`, `sourceName`, `userid`, `chatname`, `event`, `hasDonation`, `donoValue`, `donationAmount`, `meta.viewers`, `bits`, `membership`, role booleans, `karma`, `chatbadges`, `rewardTitle`/`rewardName`, `containsBadWords` (set by background for `CHECK_BAD_WORDS`).

Template variables are not a fixed list: `replaceTemplateVars` (`:2979-3042`) exposes any top-level message key plus derived `counterRemaining`.

## Implemented But Not In The Editor Palette

Code exists but no palette entry (imported flow JSON can still reference them):

- Triggers: `counter`, `userPool`, `accumulator` (`:2493-2772`) — `userPool`/`accumulator` are broken (ISSUE-010).
- State nodes: `QUEUE`, `SEMAPHORE`, `LATCH`, `SEQUENCER` (`:1100-1308`).
- Action: `triggerOBSScene` (`:3869`; editor UI case at `EventFlowEditor.js:5200` but no palette button).

## Known Defects (see `../issues/`)

| Issue | Impact |
| --- | --- |
| ISSUE-007 | Flows mixing time triggers with message triggers silently never fire on schedule |
| ISSUE-008 | `timeOfDay` breaks after any editor edit (string vs array config) |
| ISSUE-009 | Standalone editor tab saves don't reach the running background instance |
| ISSUE-010 | `userPool`/`accumulator` triggers throw (imported flows only) |
| ISSUE-011 | MIDI send actions ignore channel/duration/velocity |
| ISSUE-012 | `eventOther` offers meta-only events (`viewer_update` etc.) that can never fire |
| ISSUE-013 | RANDOM gate probability 0 becomes 50%; send/relay timeout 0 becomes 1000 ms despite help text |
| ISSUE-014 | GATE autoReset always resets to BLOCK |

Additional caveats: THROTTLE's editor UI exposes `burstSize`/`dropStrategy` fields the evaluator never reads (`EventFlowEditor.js:4834-4844` vs `EventFlowSystem.js:1271-1290`). `eventCustom.customCondition` uses `new Function` without the CSP guard, so it always fails closed in the extension (`:2311-2321`).

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
- `userMemoryContains`

`userRole` supports `tiktokTeamMember`, which matches positive TikTok team/fan levels or `fans_badge` / `grade_badge` data on an incoming TikTok message. This check is independent of dock-overlay URL settings.

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
- `pinMessage`
- `sendMessage`
- `relay`
- `reflectionFilter`

`pinMessage` (`EventFlowSystem.js:3288-3350`) sets `meta.pinned`/`pinnedTarget` and sends dock `pin`/`unpin`/`nextPinned` via P2P; config: `mode`, `messageId` (`{id}` template), `target` (dock label).

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

`ttsSpeak.config.voice` is an optional per-utterance voice name or provider voice ID. Empty or missing values use the configured Flow Actions TTS voice. The override is preserved while premium-provider speech waits in the queue and does not mutate the configured default.

## Action Behavior Notes

Line-level details from the 2026-07-22 pass (`EventFlowSystem.js:3134-4467`):

- `sendMessage` (`:3411-3498`): `destination` reply/all/all-except-source/platform/custom; `sanitizeMode` safe/preserveUrls/raw; sets `reflection:true`; reply needs `message.tid`.
- `relay` (`:3500-3576`): always excludes the source, skips reflections, needs `chatmessage`.
- `webhook` (`:3578-3654`): sync mode writes `webhookResponse/webhookResponseText/webhookStatus/webhookError` onto the message; async is fire-and-forget; `headers`/`timeout` exist in code but not the editor UI.
- `addPoints`/`spendPoints` (`:3656-3708`): keyed by `chatname`+`type`; spend failure blocks the message and stamps `pointsSpendError`; add stamps `pointsTotal`.
- `setProperty` (`:3250-3272`): sets any top-level field; template vars in values.
- `modifyMessage` (`:3236`): replaces `chatmessage`.
- `featureMessage` (`:3274`): sets `meta.featured=true`.
- Overlay/media/TTS/OBS actions emit `{overlayNinja:{actionType,...}}` via `sendTargetP2P(...,'actions')` (fallback `sendMessageToTabs` with `targetPage:'actions'`); pin targets `'dock'`; Spotify routes `chrome.runtime.sendMessage({spotifyAction})` → `background.js handleSpotifyAction` (`:11997`).
- `delay` (`:3913-3918`): awaits inline — stalls the entire message pipeline. Put `returnMessage` or `continueAsync` before it.
- State actions stamp template-consumable fields: `counterValue/Target/Remaining` (`checkCounter`), `userMemory*` (`rememberUser`/`forgetUser`/`clearUserMemory`), `selectedUser*` (`pickRandomUser`).

MIDI actions:

- `midiSendNote`
- `midiSendCC`

State control actions:

- `setGateState`
- `resetStateNode`
- `setCounter`
- `incrementCounter`
- `checkCounter`
- `rememberUser`
- `forgetUser`
- `clearUserMemory`
- `pickRandomUser`

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
- `USER_MEMORY`: named, isolated collection of unique users for eligibility, participation tracking, and draws.

Common setup rule: add the state node first, give it a stable name or ID, then point the matching action node at that state node. If an action references the wrong node ID/name, it has nothing useful to update.

State actions:

- `setGateState`: changes a gate to allow/block.
- `resetStateNode`: resets a target state node.
- `setCounter`: sets a counter value.
- `incrementCounter`: increments a counter value.
- `checkCounter`: copies counter details onto the message for later templates.
- `rememberUser`: adds or updates the current user's entry in the selected memory.
- `forgetUser`: removes the current user from the selected memory.
- `clearUserMemory`: clears every user from the selected memory only.
- `pickRandomUser`: selects a unique user and can optionally remove the winner.

`userMemoryContains` checks whether the current event's user is in the selected User Memory. User identity is keyed by platform plus user ID, with username fields as fallbacks. Events without a usable identity are ignored. Repeated participation updates one entry's participation count rather than creating duplicate draw entries.

User Memory is a shared resource rather than an execution step. Solid teal wires continue to show event execution, while dashed purple side links show which User Memory an operation targets. The operation stores the target node ID, and the same target can also be selected from its properties dropdown. Each memory independently controls session-versus-saved persistence, inactivity reset, stream-start reset, stream-stop reset, and manual clearing. `resetStateNode` clears only the targeted memory when its target is `USER_MEMORY`.

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

The Call Webhook action uses the same template renderer for string values in its Custom Body JSON, including values nested inside objects and arrays. JSON object keys are not templated, and bodies without placeholders are sent unchanged.

Discord example:

```json
{
  "content": "{message}",
  "username": "{username}",
  "avatar_url": "{chatimg}"
}
```

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

- Cross-check `STATE_NODES_EXPLANATION.md` against current code because some older notes appear stale compared with current editor/test behavior.
- Add support-derived examples for common automation recipes.
- Runtime-validate scheduler behavior after ISSUE-007 is fixed (time triggers in mixed flows).

Completed in the 2026-07-22 intense pass: line-level review of trigger evaluators and action executors (see Execution Engine, Trigger Surface, and Known Defects above).
