# Command And Action Source Trace

Status: source-check pass started on 2026-06-24. No runtime API server, OBS, or app e2e validation was performed in this pass.

## Purpose

Use this page when a user asks for a command/action and the broad lookup pages are not enough. It traces the main command paths through current source so agents know which actions are handled directly, which are forwarded, which need a target page, and which public-doc examples need caution.

This is not a full command test report. Treat it as source evidence to pair with `action-command-index.md`, `commands-and-actions.md`, `api-command-examples.md`, and `api-command-validation-matrix.md`.

## Source Anchors

- `background.js`
  - API socket setup: `wss://io.socialstream.ninja/api`
  - Dock/server socket handling: `socketserverDock`
  - API payload branch for `data.action`
  - `processIncomingRequest(request, UUID)`
  - `sendMessageToTabs(data, reverse, metadata, relayMode, antispam, overrideTimeout)`
  - `sendToDestinations(message)`
  - `applyTimerAction(action, value)`
  - `blockUser(data)`
- `dock.html`
  - `processInput(data)`
  - direct `&server` WebSocket callback behavior
  - `sendDataP2P(data)`
  - queue/feature/clear/TTS handlers
- `featured.html`
  - `processData(data)` action branch
  - TTS toggle handling
- `poll.html`
  - `processInput(data)`
  - `processData(data)`
- `timer.html`
  - `actionName(action, cmd)`
  - `processInput(data)`
  - `respondState(token)`
- `waitlist.html`
  - `processInput(data)`
- `actions/EventFlowSystem.js`
  - `executeAction(actionNode, message)`
  - trigger/action switch blocks

## Main Command Lanes

| Lane | Entry Point | What It Handles | First Caveat |
| --- | --- | --- | --- |
| Background API socket | `background.js` `/api` WebSocket messages | Extension/app host actions, send-back, external content, waitlist/poll/timer settings, webhook-style injected events, generic forwarding. | Requires remote API/server path and host not disabled. Runtime server responses still need live validation. |
| Background dock/server socket | `background.js` `socketserverDock` | Messages from dock/server route back into `processIncomingRequest`. | Only handles inbound messages when `settings.server3` and extension is on. |
| P2P/iframe bridge | `background.js` `eventer(messageEvent, ...)` with `overlayNinja` | Dock/chatbot/page requests to background. | `settings.disablehost` blocks most host actions after a few early exceptions. |
| Dock page direct server | `dock.html?server` | Dock/page actions such as clear, clear overlay, queue, auto-show, content, feature, TTS. | Target label mismatch causes the dock to ignore the action. |
| Featured page | `featured.html` | Featured content display/clear behavior and TTS toggle. | It is not the dock queue controller. |
| Timer page | `timer.html` | Timer actions and timer state callbacks. | Direct timer page can handle actions; background also has timer state. Keep target/surface clear. |
| Poll page | `poll.html` | Poll vote processing plus reset/close/start actions. | Background API only directly handles some poll actions; page handles `startpoll` directly. |
| Event Flow | `actions/EventFlowSystem.js` | Visual automation triggers/actions. | Event Flow action types are not API action names. |

## Background API Action Behavior

These observations are from the current `background.js` API action branch.

| Action | Source-Checked Behavior | Caution |
| --- | --- | --- |
| `eventFlowEvent` | Calls `processEventFlowBridgeEvent(data.value)`. | Requires a value payload. It injects into Event Flow, not into a page action by itself. |
| `sendChat` | Builds `{ response: data.value, destination: data.target?, outgoingOrigin: "host" }` and calls `sendMessageToTabs(...)`. | Send-back only works if `sendMessageToTabs` can find valid source tabs and the platform/mode supports sending. |
| `sendEncodedChat` | Decodes `data.value`; decodes `data.target` if present; then calls `sendMessageToTabs(...)`. | Use this for HTTP GET values. Invalid encoding can break the command. |
| `blockUser` | In this API branch, it expects `data.target` as source type and `data.value` as a string username, then calls `blockUser({ chatname, type })`. | This differs from object-shaped `blockUser` requests in the bridge path. Do not promise JSON object GET behavior until runtime-tested. |
| no `action`, with `extContent` | Requires `data.extContent.type`, then calls `processIncomingMessage(data.extContent, false)`. | If `type` is missing, background returns an error. |
| `extContent` with `value` | Parses `data.value` as JSON, runs bot actions, Event Flow processing, then `sendToDestinations(msg)`. | The JSON-string form has less explicit validation in this branch; keep payload SSN-shaped. |
| `removefromwaitlist`, `highlightwaitlist`, `resetwaitlist`, `stopentries`, `downloadwaitlist`, `selectwinner` | Calls background waitlist/draw helpers, stops entries, triggers downloads, or selects winners. | Index/value behavior and visible waitlist page results need exact runtime validation for final recipes. |
| `resettipjar`, `settipjaramount` | Forwards `cmd` payloads to target `tipjar`. | Tip jar page must be open/listening; external provider privacy still matters. |
| `resetpoll`, `closepoll` | Forwards `{ cmd: "resetpoll" }` or `{ cmd: "closepoll" }` to target `poll`. | `startpoll` is page-handled but not directly listed in this background API branch. |
| `loadpoll`, `setpollsettings`, `getpollpresets`, `createpoll` | Calls background poll preset/settings helpers. `getpollpresets` can callback when `data.get` exists. | Preset storage and live page sync need deeper validation. |
| `starttimer`, `pausetimer`, `toggletimer`, `resettimer`, `timeradd`, `timersubtract`, `settimer`, `gettimerstate` | Calls `applyTimerAction(...)`, `initializeTimer()`, and for `gettimerstate` sends callback result when `data.get` exists. | This API branch is gated by `!settings.disablehost`. Direct `timer.html` also has its own handler. |
| `startmap`, `pausemap`, `resetmap` | Forwards `cmd` payload to target `map`. | Page must be open/listening. |
| `drawmode` | Parses boolean/toggle/on/off forms, stores `settings.drawmode`, calls `sendWaitlistConfig`, returns `{ drawmode: enable }`. | This is a global setting-style action, not just a visual page command. |
| `emoteonly` | Parses boolean/toggle/on/off forms, stores/removes `settings.emoteonlymode`, returns `{ emoteonlymode: enable }`. | Affects filtering behavior through settings, not only the current page. |
| any other `data.action` | If `data.target` is set and not `null`, calls `sendTargetP2P(data, data.target)`; otherwise calls `sendDataP2P(data)`. | Many action names are not understood by background; they are only useful if a connected page handles them. |

Channel content variants:

- `api.md` documents `content` through `content7` as channel content actions.
- This trace found direct `content` action handlers in `dock.html` and `featured.html`; numbered actions such as `content4` are documented API/channel examples but were not proven as direct page handlers in this focused pass.
- Use the numbered channel examples as documented relay patterns, and require runtime validation before promising a visible page result on a specific target.

## Send-Back Rules From Source

`sendChat`, `sendEncodedChat`, Event Flow `sendMessage`, Event Flow `relay`, and viewer chat auto-responses eventually depend on `sendMessageToTabs(...)`.

Source-checked requirements:

- `chrome.debugger` must exist.
- Extension host must be on.
- `settings.disablehost` must not block host actions.
- Payload must include `response`.
- Candidate tabs must pass URL/platform/destination filtering.
- Destination matching can use source type first, then URL fallback for custom destinations.
- Message origin affects routing: host, chatbot, relay, bot-role-controlled paths.
- Dynamic anti-spam and per-platform cooldowns can suppress sends.

Support implication:

```text
An API command can be syntactically valid and still send nothing if no eligible source tab/window exists, if the platform does not support send-back in that mode, if host control is disabled, or if routing/destination filters exclude every tab.
```

## Bridge/P2P Request Action Behavior

These actions appear in `background.js` `processIncomingRequest(...)`. They are often triggered from dock/page UI or bridge messages, and their payload shape can differ from the `/api` socket branch.

| Action | Source-Checked Behavior | Caution |
| --- | --- | --- |
| `getChatSources` | Builds an eligible tab/source list and returns `tabsList` to the requesting peer. | The requester must listen for the response and the list only reflects currently eligible sources. |
| `toggleVIPUser` | Requires `value.chatname` and `value.type`, updates VIP state, and forwards a `vipUser` destination message. | Source identity shape varies by platform; do not treat this as a generic moderation action. |

## Dock Page Action Behavior

`dock.html` handles direct page actions when connected through its server/P2P path.

| Action | Source-Checked Dock Behavior | Caution |
| --- | --- | --- |
| Target labels | If `data.target` exists and is neither `null` nor the current page label, dock returns without handling it. | Use labels carefully when multiple docks/pages are open. |
| `clear`, `clearAll` | Clears dock output, resets ticker/queues/state, clears TTS queue, and sends `false` to featured/overlay. Pinned messages clear only when `data.ctrl` is set. | Do not describe as "delete all history"; behavior is page/UI state. |
| `clearOverlay` | Sends `false` through `sendDataP2P` to clear featured/overlay output. | Does not clear dock history. |
| `nextInQueue` | Calls `nextInQueue()`. | Requires queued/selectable messages. |
| `getQueueSize` | Calls `updateQueueButton()` and returns `true` from `processInput`. | Source check did not prove a numeric queue-size callback from direct dock handler. Avoid promising a number until runtime-tested. |
| `autoShow` | Parses `toggle`, string booleans, `1`, `0`, truthy/falsy values, then calls `autoShow(false)`. | Values are parsed differently than background `drawmode`/`emoteonly`. |
| `content` | Parses `data.value` as JSON and processes it as a message/content payload, respecting pause/buffer behavior. | Invalid JSON fails. Use JSON body examples for safer external content. |
| `feature` | Features the first `div[data-mid]:not(.pressed)` if one exists. | Not the same as sending a specific message unless target context supports it. |
| `toggleTTS`, `tts` | Toggles or sets dock TTS state using `toggle`, string booleans, `1`, `0`, `on`, `off`, or truthy/falsy value. | This toggles dock/page TTS state, not provider setup. |

## Featured Page Behavior

`featured.html` handles selected/featured content and TTS state, not dock queue management.

Source-checked notes:

- Payloads with `contents` are displayed/queued or used as clear/reset input.
- `toggleTTS` and `tts` parse values similarly to dock TTS handling.
- A clear-style payload clears the currently featured output and related timers.
- Custom feature actions may run before processing when the custom feature hook exists.

Do not send dock-only actions to `featured.html` and expect queue control.

## Poll, Waitlist, And Timer Page Behavior

| Page | Source-Checked Behavior | Caution |
| --- | --- | --- |
| `timer.html` | Accepts `action` or `cmd` names matching `starttimer`, `pausetimer`, `toggletimer`, `resettimer`, `timeradd`, `timersubtract`, `settimer`, and `gettimerstate`. Sends callback for `gettimerstate` when a token exists. | Background has a parallel timer state path. Confirm which surface is connected. |
| `poll.html` | Handles `action` values `closepoll`, `resetpoll`, and `startpoll`; also handles `cmd` values for the same three. Chat messages can become votes when poll settings allow. | Background API directly forwards reset/close and has preset/settings helpers; direct `startpoll` needs page route. |
| `waitlist.html` | Receives waitlist display payloads such as `waitlistmessage`, `drawmode`, `winlist`, `drawPoolSize`, and `waitlist`. | Background actions mutate/select waitlist state; display page reacts to payloads. Do not conflate display payloads with API action names. |

## Event Flow Is A Separate Command System

Event Flow action names are `actionType` values inside `actions/EventFlowSystem.js`. They are not remote API action names.

Source-checked behavior:

- `blockMessage` sets `result.blocked = true` and allows downstream async continuation.
- `returnMessage` asks the flow to return the message immediately while async work can continue.
- `modifyMessage`, `setProperty`, `addPrefix`, `addSuffix`, `findReplace`, and `removeText` mutate message fields.
- `featureMessage` marks `meta.featured = true`; it does not click the dock UI.
- `sendMessage` uses `sendMessageToTabs` and marks outgoing messages with `reflection: true` to prevent loops.
- `relay` requires a `chatmessage`, excludes the source, and marks the relayed message as a reflection.
- `webhook` can run sync or async; sync mode can block on failure if configured.
- `customJs` only runs when `allowEvalCustomJs` is enabled. Otherwise the system warns and skips it.
- OBS action nodes send payloads to target `actions` through `sendTargetP2P` when available.
- Spotify action nodes call `sendMessageToBackground` with `spotifyAction` values.
- TTS action nodes send action payloads such as `tts`, `toggleTTS`, `skipTTS`, `clearTTS`, or `setTTSVolume`.

Support implication:

```text
If a user asks for an "Event Flow command", do not give them an HTTP API action unless they specifically want to trigger the API. Event Flow nodes execute inside the Event Flow runtime and often depend on page/background helper functions.
```

## Callback And Response Cautions

The public API server can return server-level statuses such as success, failed, timeout, or special. That does not prove the target page did the intended behavior.

Source-checked callback paths:

- Background `gettimerstate` sends `{ callback: { get, result: exportTimerState() } }` when `data.get` exists.
- Background `getpollpresets` sends callback results when `data.get` exists.
- Background `getHype` sends a callback snapshot on `/api` and `/dock` paths.
- Dock direct server route wraps `processInput(data)` result in a callback when `data.get` exists.

Caution:

- Dock `getQueueSize` source check shows a boolean `true` return from `processInput`, not a proven numeric count.
- Generic forwarded page actions can return success at the relay layer even if no useful page state changed.
- Page labels and `target` values are critical when multiple pages are open.

## High-Risk Public Examples To Verify Before Reuse

| Example Family | Why It Needs Care |
| --- | --- |
| `blockUser` with JSON object in a GET URL | Background `/api` branch source-check shows a string username/source-target shape, while bridge requests use object shape. |
| `getQueueSize` expecting a numeric result | Dock source-check did not prove numeric callback behavior. |
| `startpoll` through generic API | Poll page handles it, but background direct API branch does not list it next to reset/close. Use a page target route or source-check the exact transport. |
| Any send-back command | Depends on eligible tabs/source windows, auth, platform support, mode, anti-spam, and host control. |
| Any generic action with `target` | Background may only forward the payload; the target page must implement the action. |
| Event Flow custom JS | Depends on eval support. MV3-style contexts can disable it. |

## Practical Answer Pattern

When giving a command:

1. Identify command system: API action, page action, viewer chat command, Event Flow action, URL parameter, MIDI/hotkey, or custom JS.
2. Identify handling surface: background host, dock, featured, timer, poll, waitlist, Event Flow, OBS/actions page, or source tab.
3. Confirm transport: extension API socket, dock `&server`, page label target, iframe/P2P bridge, or direct page.
4. Confirm required toggles and `settings.disablehost`/host control risk.
5. Give a simple example only after the target page/source path is known.
6. For high-risk actions, state that source was checked but runtime behavior still needs validation.

## Follow-Up Validation Needed

- Controlled WebSocket tests for `sendChat`, `sendEncodedChat`, `extContent`, `clearOverlay`, `nextInQueue`, `getQueueSize`, `drawmode`, `emoteonly`, and timer callbacks.
- HTTP GET/POST tests for `blockUser` string versus object shapes.
- Dock `&server` tests with page labels and multiple open docks.
- Poll page direct `startpoll` route validation.
- OBS/browser validation for `featured.html`, `actions.html`, Event Flow OBS nodes, and TTS actions.
- App e2e validation for the same action paths through standalone source windows.
