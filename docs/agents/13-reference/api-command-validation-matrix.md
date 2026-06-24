# API Command Validation Matrix

Status: heavy source-check pass on 2026-06-24. No live hosted API, browser, OBS, or standalone app runtime validation was performed in this pass.

## Purpose

Use this page when a user asks whether an SSN API command "really works" or why an API call reports success but nothing changes.

This page complements:

- `commands-and-actions.md` for command-system concepts.
- `action-command-index.md` for action-name lookup.
- `command-action-source-trace.md` for broader handler notes.
- `api-command-examples.md` for safe examples.
- `api-command-proof-ledger.md` for evidence labels and proof requirements before stronger command claims.
- `../09-api-and-integrations/websocket-http-api.md` for API setup.

The central rule is:

```text
Accepted by the API relay is not the same as acted on by the target page or source.
```

## Source Anchors

- `service_worker.js`
  - `routeBackgroundBoundMessage(message, sendResponse)`
  - `ensureBackgroundPageIsOpen(load, force)`
  - runtime `onMessage` listener
- `background.js`
  - `setupSocketDock()`
  - `setupSocket()`
  - `/api` socket action branch
  - `processIncomingRequest(request, UUID)`
  - `sendDataP2P(data, UUID)`
  - `sendTargetP2P(data, target)`
  - `sendDataP2PChunked(data, UUID)`
  - `processEventFlowBridgeEvent(value)`
  - `applyTimerAction(action, value)`
  - `sendMessageToTabs(data, ...)`
- `dock.html`
  - `processInput(data, force)`
- `featured.html`
  - server message handler
  - `processData(data)`
- `poll.html`
  - `processData(data)`
  - `processInput(data)`
- `timer.html`
  - `actionName(action, cmd)`
  - `processInput(data)`
  - `respondState(token)`
- `waitlist.html`
  - `processInput(data)`

## Evidence Boundaries

This source pass proves:

- Which code path accepts a command.
- Which commands are handled directly by background code.
- Which commands are forwarded to a page label or source tab.
- Which commands need page/source runtime state to do anything useful.
- Which callbacks are visible in source.

This source pass does not prove:

- The hosted relay is reachable right now.
- The user's session, labels, or API toggles are correct.
- A page is open, connected, and listening.
- OBS browser-source behavior.
- Platform send-back success.
- App parity through Electron source windows.

## Main Routing Lanes

| Lane | Source Entry | What It Proves | What Still Needs Runtime Proof |
| --- | --- | --- | --- |
| MV3 service worker handoff | `service_worker.js` `routeBackgroundBoundMessage` | The service worker opens or reuses `background.html`, queues messages, and falls back to runtime messaging. | Whether the background page loads in the user's browser and handles the specific command. |
| Background `/api` socket | `background.js` `setupSocket()` | When `settings.socketserver` and extension-on state allow it, background joins the hosted/local API socket and directly handles a defined set of actions. | Hosted/local relay connectivity, current session, and target page/source action. |
| Background `/dock` socket | `background.js` `setupSocketDock()` | When `settings.server3` and extension-on state allow it, inbound dock/server messages go into `processIncomingRequest`. | Whether the dock/server fallback toggles are enabled and the page is actually paired. |
| Bridge/P2P requests | `background.js` `processIncomingRequest` | Dock/chatbot/page-originated requests can send responses, run selected background actions, or forward to tabs/pages. | Whether the requesting page has a live peer/label route and whether `settings.disablehost` blocks the action. |
| Page-target P2P | `sendDataP2P` / `sendTargetP2P` | Background sends to VDO SDK labels first when available, then iframe fallback paths. | Whether a page with that label is connected and implements the command. |
| Page local handler | `dock.html`, `featured.html`, `timer.html`, `poll.html`, `waitlist.html` | The page can parse a matching command once it receives the message. | Whether that exact page is open with the same session/server/label settings. |
| Platform send-back | `sendMessageToTabs` | Send-back only starts if debugger, extension-on state, host control, response text, tab filtering, and destination rules pass. | Whether a specific platform tab/app source is eligible and the platform accepts the send. |

## Service Worker Role

The service worker is not the main command executor.

Confirmed behavior:

- It detects background-bound messages and tries to route them to `background.html`.
- It can open or reuse a pinned inactive `background.html` tab.
- It queues messages while the background page is being opened.
- It can return a stored settings snapshot for settings requests while background recovery is happening.
- It handles a few service-worker-only request types, such as custom source injection, background page checks, opening the Event Flow editor, and tab audio capture.

Support implication:

```text
If a command fails in MV3 extension mode, check whether background.html is open and responding before debugging the command action itself.
```

## Background API Socket Actions

These are handled directly in the `/api` socket branch before generic forwarding.

| Action Or Shape | Background Result | Actual Target Needed |
| --- | --- | --- |
| `getHype` or `get: "hype"` | Returns a hype snapshot callback on the same socket. | Hype data must exist for a useful result. |
| `eventFlowEvent` with `value` | Calls `processEventFlowBridgeEvent(value)`. | Event Flow system must be loaded and relevant flows must exist. |
| `sendChat` with `value` | Builds `response`, optional `destination`, and calls `sendMessageToTabs`. | Eligible source tab/window and platform send-back support. |
| `sendEncodedChat` with `value` | Decodes `value` and optional `target`, then calls `sendMessageToTabs`. | Same as `sendChat`; GET values must be valid URI encoding. |
| `blockUser` with `value` | Treats `target` as source type and `value` as username string. | Platform/source moderation support and a matched user/source. |
| no `action`, with `extContent` | Requires `extContent.type`; calls `processIncomingMessage`. | Valid SSN-shaped payload and destination pages/listeners. |
| `extContent` action with JSON `value` | Parses JSON, applies bot actions, runs Event Flow, then calls `sendToDestinations`. | Valid JSON and open destinations. |
| `removefromwaitlist`, `highlightwaitlist`, `resetwaitlist`, `stopentries`, `downloadwaitlist`, `selectwinner` | Mutates waitlist/draw state or triggers download/selection helpers. | Waitlist state and display pages need separate validation. |
| `resettipjar`, `settipjaramount` | Sends `cmd` payloads to target `tipjar`. | Tip jar page must be open/listening. |
| `resetpoll`, `closepoll` | Sends `cmd` payloads to target `poll`. | Poll page must be open/listening. |
| `loadpoll`, `setpollsettings`, `getpollpresets`, `createpoll` | Calls background poll preset/settings helpers. | Preset storage and page sync need runtime validation. |
| `starttimer`, `pausetimer`, `toggletimer`, `resettimer`, `timeradd`, `timersubtract`, `settimer`, `gettimerstate` | Calls `applyTimerAction`, initializes timer, and can callback timer state. | Host control must be enabled; timer page/app display state still needs runtime validation. |
| `startmap`, `pausemap`, `resetmap` | Sends `cmd` payload to target `map`. | Map page must be open/listening. |
| `drawmode` | Parses toggle/boolean-like values, stores `settings.drawmode`, sends waitlist config, returns `{ drawmode: value }`. | Actual draw display depends on waitlist/giveaway state. |
| `emoteonly` | Parses toggle/boolean-like values, stores/removes `settings.emoteonlymode`, returns `{ emoteonlymode: value }`. | Filtering impact depends on later message processing. |
| Any other `action` | Forwards to `target` with `sendTargetP2P`; otherwise broadcasts with `sendDataP2P`. | Target page must implement the action. |

Channel content note:

- `api.md` documents `content`, `content2`, `content3`, `content4`, `content5`, `content6`, and `content7` as channel content actions.
- The focused examples consistency check confirmed the `content4` example is represented in `action-command-index.md`.
- Source grep in this pass found direct page-level `content` handlers in `dock.html` and `featured.html`; numbered channel routing still needs runtime validation before promising a target-page outcome.

High-risk mismatch:

- Public examples sometimes show `blockUser` with object-shaped `value`.
- The `/api` socket branch source-check shows string username in `value` and source type in `target`.
- Bridge/P2P `blockUser` uses object-shaped `request.value`.

Do not give a final `blockUser` recipe without specifying the transport and value shape.

## Bridge Request Actions

`processIncomingRequest(request, UUID)` handles page/bridge-originated requests.

Important gates:

- `requestViewerCount` and `eventFlowEvent` are handled before the host-disabled check.
- Most other actions return immediately when `settings.disablehost` is active.
- Chunked bridge requests are handled after the host-disabled check.
- `response` payloads go to `sendMessageToTabs`.

Directly handled bridge actions include:

| Action | Result |
| --- | --- |
| `openChat` | Calls platform chat-opening helper. |
| `aiOverlay`, `cohostOverlay` | Sends AI/cohost overlay command payloads. |
| `skipTTS` | Sends skip instruction to tabs with content scripts. |
| `getUserHistory`, `getRecentHistory`, `getHistoryBefore` | Reads message history and returns results to the requesting peer. |
| `toggleVIPUser` | Updates VIP setting and forwards `vipUser` destination message. |
| `markUser` | Updates role lists and forwards `markUser` destination message. |
| `getChatSources` | Builds eligible tab/source list and returns `tabsList`. |
| `blockUser` | Calls `blockUser(request.value)` with object-shaped value. |
| `deleteSourceMessage` | Forwards delete request to WebSocket source pages. |
| `obsCommand` | Sends OBS command destination payload. |
| `registerTimer` and timer actions | Updates/initializes timer state. |
| `saveAiPromptOverlays`, `getAiPromptOverlays` | Saves or returns AI prompt overlay store; large returns can use chunking. |
| `cohostToolStatus`, `cohostTool` | Returns cohost tool status or result. |
| `chatbot` | Requires private chatbot setting and returns chunks/final response or error. |

Support implication:

```text
Bridge actions can be blocked by host-control settings even when the page is connected. Check the setting before treating a page callback failure as an API relay problem.
```

## Page Handler Matrix

| Page | Accepted Inputs | Source-Checked Behavior | Runtime Requirement |
| --- | --- | --- | --- |
| `dock.html` | `action`, direct content payloads, queue/pin/history/user payloads, webhook-shaped donation payloads | Handles clear/clearAll, clearOverlay, nextInQueue, getQueueSize, autoShow, content, feature, TTS toggles, pin/queue/history/user states, and selected webhook display conversions. | Dock must be open on same session and label; `getQueueSize` source path updates UI and returns true, not a proven numeric callback. |
| `featured.html` | `content`, `action: "content"`, plain chat payloads, false clear payloads, TTS actions | Displays or clears featured content, filters by URL options, handles duplicate IDs, and toggles TTS state. | Featured page must be open/listening; it is not the dock queue controller. |
| `timer.html` | `action` or `cmd` in timer action allow-list | Handles start/pause/toggle/reset/add/subtract/set/get state. | Timer page must be open for page-level display; background also keeps timer state. |
| `poll.html` | `action` or `cmd` for `closepoll`, `resetpoll`, `startpoll`; chat messages as votes | Direct page can start/reset/close poll and process votes. | Background `/api` direct branch does not directly list `startpoll`; use page route or validate transport. |
| `waitlist.html` | Display payloads such as `waitlistmessage`, `drawmode`, `winlist`, `drawPoolSize`, `waitlist` | Renders waitlist, draw pool, winners, titles, and counts. | Background owns many waitlist mutations; waitlist page is primarily display. |

## Send-Back Validation Gate

`sendMessageToTabs(data, ...)` is the common dependency for `sendChat`, `sendEncodedChat`, bridge `response`, Event Flow `sendMessage`, relay paths, and many bot responses.

The source gate requires:

- `chrome.debugger` exists.
- Extension is on.
- Host control is not disabled.
- Payload has `response`.
- Optional outgoing AI translation does not fail fatally.
- Global event-hide logic does not block the payload.
- Anti-spam/dynamic timing does not suppress the send.
- Candidate tabs pass URL/source filtering.
- Destination, account-role, relay-mode, and per-tab validity checks pass.
- The selected source tab supports a chat focus/send path.

Support implication:

```text
`sendChat` can be a valid command and still send nothing. The command only starts the send-back attempt; it does not guarantee a platform accepted the message.
```

## Callback Matrix

| Request | Source-Checked Callback |
| --- | --- |
| `/api` or `/dock` `getHype` | `{ callback: { get, result: { hype } } }` on the same socket. |
| Background `/api` `gettimerstate` with `get` | Sends `{ callback: { get, result: exportTimerState() } }`. |
| Background `/api` `getpollpresets` with `get` | Sends `{ callback: { get, result: presets } }`. |
| Featured server route with callback token | Sends callback wrapping the `processData` result when response is not null. |
| Dock server route with callback token | Wraps `processInput(data)` result. |
| Dock `getQueueSize` | Source-check shows `updateQueueButton()` and `true`; do not promise a numeric API result without runtime evidence. |

## Common False Positives

| Symptom | Why It Happens | First Check |
| --- | --- | --- |
| API returns success but page does not change | Background accepted or forwarded the command, but no page acted. | Confirm target page, session, label, and page handler support. |
| Command works in dock but not featured | Dock and featured have different handlers. | Use page-specific action list. |
| `startpoll` does nothing through API | Poll page handles direct `startpoll`; background direct branch only listed reset/close plus preset helpers in this pass. | Route to `poll` page or runtime-test exact transport. |
| `sendChat` works on one platform but not another | Send-back depends on source eligibility, auth, mode, and platform limits. | Check platform doc and source mode. |
| `blockUser` value shape confusion | `/api` branch and bridge branch use different shapes. | Identify transport before giving syntax. |
| Timer action accepted but display stale | Background timer state and timer page display are separate surfaces. | Confirm `timer.html` is open and registered. |
| Label target ignored | Page returns early when `target` does not match its label. | Check `&label=` and target value. |
| Host/page actions stop after setting change | `settings.disablehost` blocks most bridge and send-back paths. | Check host/remote-control settings. |

## Minimum Runtime Proof Before Saying Tested

For a command/action claim, record:

- Transport: hosted WebSocket, local WebSocket, HTTP GET, POST/PUT, dock server, bridge/P2P, or app path.
- Exact action, target, value shape, and callback token if any.
- Required popup/app settings.
- Target page/source and its URL/session/label.
- Observed callback, UI/page change, source send, or destination message.
- What was not tested.

Example evidence note:

```text
Ran: hosted WebSocket remote command, action clearOverlay, session redacted, dock and featured pages open with no label.
Observed: featured output cleared and callback returned true.
Not tested: OBS browser source, labeled pages, standalone app path.
```

## Follow-Up Validation Needed

- Runtime-test `blockUser` value shape by transport.
- Runtime-test `getQueueSize` callback expectations.
- Runtime-test `startpoll` through hosted WebSocket, HTTP, and direct poll page routes.
- Runtime-test timer callbacks with and without `timer.html` open.
- Runtime-test label targeting with multiple docks and featured pages.
- Runtime-test `sendChat` on at least one reply-capable source and one unsupported source.
- App e2e-test the same command families through the standalone app bridge.
