# WebSocket And HTTP API

Status: heavy extraction pass started from `api.md`, command docs, and public API examples. Verify command behavior against code before changing production automation.

For exact action names and target/page routing, use `../13-reference/action-command-index.md`. For source-checked handler caveats, use `../13-reference/command-action-source-trace.md`. For accepted-by-relay versus acted-on-by-target validation, use `../13-reference/api-command-validation-matrix.md`. For safe copy/paste examples, use `../13-reference/api-command-examples.md`.

## Source Anchors

- `api.md`
- `README.md`
- `docs/commands.html`
- `sampleapi.html`
- `sample_wss_source.html`
- `tests/sse.html`
- `background.js`
- `dock.html`
- `featured.html`
- `docs/agents/13-reference/action-command-index.md`
- `docs/agents/13-reference/api-command-validation-matrix.md`

## What The API Does

The SSN API lets external tools control the extension/app, dock, featured overlay, waitlist/polls/timer pages, and custom overlays. It also lets external apps receive chat messages when the user opts into relaying chat through the API server.

Primary transports:

- WebSocket: real-time bidirectional commands and chat listener workflows.
- HTTP GET: simple StreamDeck-style command buttons.
- HTTP POST/PUT: JSON command bodies.
- Server-Sent Events: simple one-way listener option.
- WebRTC SDK: alternate peer-to-peer option for developers who do not want to use the hosted relay.

## Required Toggles

The public API docs name these settings under Global settings > Mechanics:

| Toggle | Required For | Notes |
| --- | --- | --- |
| Enable remote API control of extension | All API workflows | First setting to check when API commands do nothing. |
| Enable Dock to use and publish via API server | Commands directly to the dock | Needed for dock actions through the API server. |
| Send chat messages to API server | External chat listeners | Sends source chat to channel 4. |
| Dock sends its commands to Extension via server | Dock-to-extension via relay | Optional; used when direct P2P is not desired/working. |

Support rule: if the user wants to receive chat in Python/Node, the third toggle is the one most often missed.

## Session ID

API endpoints use the same session ID as the dock/featured/app/extension. A wrong session ID looks like a dead API even when the endpoint format is correct.

Do not publish real user session IDs in public logs. Session IDs can control overlays and, for webhook paths, can inject fake donation events.

## WebSocket Connections

Default remote-control connection:

```javascript
const ws = new WebSocket("wss://io.socialstream.ninja/join/SESSION_ID");

ws.onopen = () => {
  ws.send(JSON.stringify({ action: "clearOverlay" }));
  ws.send(JSON.stringify({ action: "nextInQueue" }));
  ws.send(JSON.stringify({ action: "sendChat", value: "Hello from API!" }));
};
```

Explicit channel connection:

```javascript
const ws = new WebSocket("wss://io.socialstream.ninja/join/SESSION_ID/IN_CHANNEL/OUT_CHANNEL");
```

Connect then join:

```javascript
const ws = new WebSocket("wss://io.socialstream.ninja");

ws.onopen = () => {
  ws.send(JSON.stringify({ join: "SESSION_ID", in: 1, out: 2 }));
};
```

## Receiving Chat

Required toggles:

- Enable remote API control of extension.
- Send chat messages to API server.

External listeners should connect to channel 4:

```javascript
const ws = new WebSocket("wss://io.socialstream.ninja/join/SESSION_ID/4");

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.chatname) {
    console.log(`[${data.type || "unknown"}] ${data.chatname}: ${data.chatmessage || ""}`);
  }
};
```

Minimal fields to expect:

- `chatname`: display name.
- `chatmessage`: message body.
- `type`: source identifier such as `youtube`, `twitch`, `kick`, or `external`.

Donation/event messages may include `hasDonation`, `membership`, `subtitle`, `event`, `contentimg`, `chatbadges`, and `meta`.

## Channel Reference

The public docs use channels for different components, but older docs sometimes describe channel 4 differently depending on page context. For external chat listeners, use `/4`.

| Channel | Common External Meaning | Notes |
| --- | --- | --- |
| 1 | Main/default API command channel | Used by most remote-control examples. |
| 2 | Dock communication/output | Common when targeting dock workflows. |
| 3 | Extension communication | Used by extension/server routing internals. |
| 4 | Chat listener channel for external apps | Requires the "Send chat messages to API server" toggle. |
| 5 | Waitlist/giveaway workflows | Used by waitlist-related pages/actions. |
| 6-9 | Reserved/custom/future use | Verify before relying on one. |

Channel-specific content actions:

| Action | Output Channel |
| --- | --- |
| `content` | 1 |
| `content2` | 2 |
| `content3` | 3 |
| `content4` | 4 |
| `content5` | 5 |
| `content6` | 6 |
| `content7` | 7 |

## HTTP API

GET format:

```text
https://io.socialstream.ninja/SESSION_ID/ACTION/TARGET/VALUE
```

If an action needs a value but no target, use `null`:

```text
https://io.socialstream.ninja/SESSION_ID/sendEncodedChat/null/Hello%20World
https://io.socialstream.ninja/SESSION_ID/drawmode/null/toggle
```

POST/PUT formats:

```text
https://io.socialstream.ninja/SESSION_ID
https://io.socialstream.ninja/SESSION_ID/ACTION
```

Example body:

```json
{
  "action": "sendChat",
  "value": "Hello from API!"
}
```

Channel override:

```text
https://io.socialstream.ninja/SESSION_ID/sendChat/null/Hello?channel=2
```

## Common Commands

| Action | Purpose | Example Payload/URL |
| --- | --- | --- |
| `sendChat` | Send a chat response/message | `{"action":"sendChat","value":"Hello"}` |
| `sendEncodedChat` | Send URL-encoded chat text | `/SESSION/sendEncodedChat/null/Hello%20World` |
| `clearOverlay` | Clear featured overlay | `/SESSION/clearOverlay` |
| `clear` / `clearAll` | Clear dock messages, except pinned behavior may vary by page | `{"action":"clear"}` |
| `nextInQueue` | Feature the next queued message | `/SESSION/nextInQueue` |
| `getQueueSize` | Request queue size | `{"action":"getQueueSize","get":"queue-1"}` |
| `autoShow` | Toggle/set auto-show mode | `{"action":"autoShow","value":"toggle"}` |
| `feature` | Feature next unfeatured message | `{"action":"feature"}` |
| `blockUser` | Block a user by source/user | `{"action":"blockUser","value":{"chatname":"name","type":"twitch"}}` |
| `extContent` | Inject external content into processing | `{"action":"extContent","value":"{\"chatname\":\"User\",\"chatmessage\":\"Hello\"}"}` |
| `getChatSources` | Ask for active source list | `{"action":"getChatSources","get":"sources-1"}` |
| `toggleVIPUser` | Toggle VIP state for a user | `{"action":"toggleVIPUser","value":{"chatname":"name","type":"youtube"}}` |
| `getUserHistory` | Fetch user history where available | `{"action":"getUserHistory","value":{"chatname":"name","type":"kick"}}` |
| `drawmode` | Toggle/set draw mode | `{"action":"drawmode","value":"toggle"}` |
| `emoteonly` | Toggle/set global emote-only filtering | `{"action":"emoteonly","value":true}` |
| `toggleTTS` / `tts` | Toggle/set TTS state | `{"action":"toggleTTS","value":"toggle"}` |

## Poll, Waitlist, And Timer Commands

Poll controls documented in `api.md`:

- `resetpoll`
- `closepoll`
- `loadpoll`
- `setpollsettings`
- `getpollpresets`
- `createpoll`

Waitlist/giveaway controls:

- `removefromwaitlist`
- `highlightwaitlist`
- `resetwaitlist`
- `downloadwaitlist`
- `selectwinner`
- `waitlistmessage`

Timer controls:

- `starttimer`
- `pausetimer`
- `toggletimer`
- `resettimer`
- `timeradd`
- `timersubtract`
- `settimer`
- `gettimerstate`

Use `sampleapi.html` or code inspection before building workflows around less-common commands.

## Message/Content Payload

Minimum custom content:

```json
{
  "chatname": "Username",
  "chatmessage": "Message content",
  "type": "external"
}
```

Common optional fields:

| Field | Meaning |
| --- | --- |
| `chatimg` | Avatar URL or small data URI. |
| `contentimg` | Media attachment URL. |
| `hasDonation` | Display donation amount/unit. |
| `membership` | Member/subscription label. |
| `subtitle` | Secondary label, such as tenure or gifted-by detail. |
| `chatbadges` | Badge URLs or badge descriptors. |
| `textonly` | Whether `chatmessage` should be plain text. |
| `event` | Structured event name such as follow/raid/subscription. |
| `meta` | Extra structured details. |
| `id` | Unique message ID for ordering/dedup/routing. |

`chatname`, `chatmessage`, and `type` are the safest baseline for integrations.

## Targeting Specific Pages

Add a label to the receiving page:

```text
dock.html?session=SESSION_ID&label=control
featured.html?session=SESSION_ID&label=main
```

Then send a command with `target`:

```json
{
  "action": "clearOverlay",
  "target": "main"
}
```

For GET-style URLs, public docs also show target as the path segment:

```text
https://io.socialstream.ninja/SESSION_ID/nextInQueue/control/null
```

Use labels when multiple docks/featured pages are open and commands must not hit every instance.

## Server-Sent Events

SSE endpoint:

```javascript
const events = new EventSource("https://io.socialstream.ninja/sse/SESSION_ID");
```

Demo page:

```text
https://socialstream.ninja/tests/sse.html
```

Use SSE for simple receive-only browser integrations. Use WebSocket when commands and callbacks are needed.

## Callbacks And Responses

Some commands support a `get` field for responses:

```json
{
  "action": "getQueueSize",
  "get": "queue-size-1"
}
```

Expected callback shape:

```json
{
  "callback": {
    "get": "queue-size-1",
    "result": true
  }
}
```

Response states documented in `api.md` include success data, `failed`, `timeout`, and `special` for some non-default channel cases.

## Inbound Donation Webhooks

Supported webhook paths in `api.md`:

| Service | URL Pattern | Notes |
| --- | --- | --- |
| Stripe | `https://io.socialstream.ninja/SESSION_ID/stripe` | Uses `checkout.session.completed`. |
| Ko-Fi | `https://io.socialstream.ninja/SESSION_ID/kofi` | Public donations only. |
| Buy Me A Coffee | `https://io.socialstream.ninja/SESSION_ID/bmac` | Supports donations and memberships. |
| Fourthwall | `https://io.socialstream.ninja/SESSION_ID/fourthwall` | Uses `ORDER_PLACED`. |

Security rule: keep session IDs and webhook URLs private. The API docs say webhook URLs do not use signature verification.

Duplication warning from `api.md`: do not enable both `&server` dock behavior and remote API control for webhook display unless the workflow intentionally handles duplicate donation alerts.

## StreamDeck And Companion

Simple StreamDeck path:

```text
https://io.socialstream.ninja/SESSION_ID/sendEncodedChat/null/Hello%20Stream
```

Bitfocus Companion has a Social Stream Ninja module. Public docs list common actions such as clear featured, clear all, next in queue, auto-show toggle, feature next, poll controls, waitlist controls, TTS controls, and send chat. Companion can expose variables such as queue size.

## Common Mistakes

- API toggle is off.
- Chat listener toggle is missing.
- Wrong session ID.
- User sends to channel 1 but listens on channel 4, or the reverse.
- User forgets URL encoding for GET `sendEncodedChat`.
- User targets a label that is not present on any dock/featured page.
- User expects a local custom file to run on a hosted page.
- User shares a webhook/session URL publicly.
- User uses old docs for channel meanings without checking the current `api.md`.

## Verification Checklist For Agents

- Confirm exact endpoint and session format.
- Confirm required toggle(s).
- Confirm whether the target is extension, dock, featured, waitlist, poll, timer, or custom page.
- Confirm channel number.
- Test with `clearOverlay` or `nextInQueue` before debugging complex payloads.
- Use `sampleapi.html` to reproduce a user command.
- For chat listeners, verify channel 4 with a minimal WebSocket client.
- For webhook issues, verify duplicate settings and secret/session exposure risk.
