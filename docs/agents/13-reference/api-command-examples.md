# API Command Examples

Status: examples pass and focused documentation consistency check on 2026-06-24 from `api.md`, command docs, and current agent command references.

## Purpose

Use this page when an AI agent needs a safe copy/paste example for common SSN API and command workflows.

This page is an example cookbook, not the final source of truth for every action. For exact action names and target rules, check `action-command-index.md`. For transport and channel details, check `09-api-and-integrations/websocket-http-api.md`. For "the request succeeded but nothing happened" cases, check `api-command-validation-matrix.md`. For evidence labels and proof requirements before stronger command claims, check `api-command-proof-ledger.md`.

## Focused Consistency Note

On 2026-06-24, a static extractor found 29 distinct action names in this examples page. After docs updates, every extracted action was present in `action-command-index.md`, `api-command-validation-matrix.md`, and `command-action-source-trace.md`.

This was a documentation consistency check only. It did not exercise the hosted relay, browser pages, OBS, platform source tabs, or the standalone app. Treat examples as source-backed patterns until a matching runtime evidence note exists.

## Safety Rules

- Replace all real sessions, passwords, keys, webhook URLs, tokens, and private endpoints with placeholders before sharing.
- Use `SESSION_ID` only as a placeholder in docs/support.
- Use `sendEncodedChat` for HTTP GET chat text that contains spaces or special characters.
- Do not test send-chat, moderation, donation, webhook, or paid-provider actions on a live stream unless the user explicitly intends that side effect.
- A successful HTTP/WebSocket request does not prove the target page acted. The target page/source must be open, connected, and on the same session.
- For send-back to platform chat, verify platform/source support, login, permissions, and source mode before promising it.

## Required Toggles

| Goal | Required Setup |
| --- | --- |
| Send remote API actions | Enable remote API control of extension/app. |
| Receive chat in an external app | Enable remote API control and Send chat messages to API server. |
| Control dock via API server | Enable Dock to use and publish via API server, or open dock with the intended server route. |
| Send chat back to platform | Source/app path must support send-back, user must be logged in, and platform permissions must allow it. |
| Control waitlist, poll, timer, overlays, games, or helper pages | Target page must be open on the same session and must support that action. |

## Placeholder Conventions

Use these placeholders in examples:

| Placeholder | Meaning |
| --- | --- |
| `SESSION_ID` | Redacted SSN session. |
| `TARGET` | Optional target label or page target. Use `null` for no target in HTTP GET. |
| `VALUE` | Action value or URL-encoded value. |
| `LABEL` | Page label from `&label=LABEL`. |
| `SOURCE_TYPE` | Source type such as `youtube`, `twitch`, `kick`, or `external`. |
| `CHAT_NAME` | Redacted display name. |

## Transport Patterns

| Transport | Pattern | Best For |
| --- | --- | --- |
| HTTP GET | `https://io.socialstream.ninja/SESSION_ID/ACTION/TARGET/VALUE` | StreamDeck, Companion buttons, quick browser tests. |
| HTTP POST/PUT | JSON body to `https://io.socialstream.ninja/SESSION_ID` or `/SESSION_ID/ACTION` | Custom apps and structured values. |
| WebSocket remote control | `wss://io.socialstream.ninja/join/SESSION_ID` | Real-time command senders. |
| WebSocket chat listener | `wss://io.socialstream.ninja/join/SESSION_ID/4` | External apps that receive SSN chat. |
| Server-Sent Events | See `api.md` | Simple one-way listeners. |

## Quick Smoke Tests

Use these to prove the API path is alive. They still require the relevant target page/source to be open.

```text
https://io.socialstream.ninja/SESSION_ID/clearOverlay
https://io.socialstream.ninja/SESSION_ID/nextInQueue
https://io.socialstream.ninja/SESSION_ID/drawmode/null/toggle
https://io.socialstream.ninja/SESSION_ID/sendEncodedChat/null/Hello%20World
```

Expected interpretation:

- `clearOverlay`: should clear featured overlay output when the dock/featured path is connected.
- `nextInQueue`: should feature the next queued message when the dock has a queue.
- `drawmode`: should toggle draw mode where waitlist/draw paths are active.
- `sendEncodedChat`: should attempt platform chat send-back where source support exists.

## WebSocket Remote Control Example

```javascript
const ws = new WebSocket("wss://io.socialstream.ninja/join/SESSION_ID");

ws.onopen = () => {
  ws.send(JSON.stringify({ action: "clearOverlay" }));
  ws.send(JSON.stringify({ action: "nextInQueue" }));
  ws.send(JSON.stringify({ action: "sendChat", value: "Hello from API" }));
};

ws.onmessage = (event) => {
  console.log("SSN response:", event.data);
};
```

Checks if it does nothing:

- Remote API control toggle is enabled.
- The session is correct.
- Target page/source is open.
- The action is valid for the target.
- The platform supports send-back if `sendChat` is used.

## WebSocket Chat Listener Example

External listeners should use channel 4 and require the chat relay toggle.

```javascript
const ws = new WebSocket("wss://io.socialstream.ninja/join/SESSION_ID/4");

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.chatname) {
    console.log(`[${data.type || "unknown"}] ${data.chatname}: ${data.chatmessage || ""}`);
  }
};
```

Minimum expected fields:

- `chatname`
- `chatmessage`
- `type`

Optional fields can include `chatimg`, `contentimg`, `hasDonation`, `membership`, `subtitle`, `chatbadges`, `event`, `meta`, and `id`.

## HTTP POST JSON Examples

General POST body:

```json
{
  "action": "nextInQueue"
}
```

Send platform chat where supported:

```json
{
  "action": "sendChat",
  "value": "Hello from API"
}
```

Inject external content:

```json
{
  "action": "extContent",
  "value": {
    "chatname": "External User",
    "chatmessage": "Hello from my app",
    "type": "external",
    "textonly": true
  }
}
```

Request active sources:

```json
{
  "action": "getChatSources",
  "get": "sources-request-1"
}
```

## Page Label Targeting

Add labels to target pages:

```text
dock.html?session=SESSION_ID&label=control
featured.html?session=SESSION_ID&label=main
```

Target the label over WebSocket:

```json
{
  "action": "nextInQueue",
  "target": "control"
}
```

Target the label over HTTP GET:

```text
https://io.socialstream.ninja/SESSION_ID/nextInQueue/control/null
```

Common failure: the command is valid, but no open page has `&label=control`.

## Dock And Featured Examples

| Goal | Example | Checks |
| --- | --- | --- |
| Clear featured overlay | `/SESSION_ID/clearOverlay` | Dock/featured connected to same session. |
| Feature next queued message | `/SESSION_ID/nextInQueue` | Dock open, queue contains messages. |
| Toggle auto-show | `/SESSION_ID/autoShow/null/toggle` | Dock open and server route active when needed. |
| Clear dock/page content | `/SESSION_ID/clear` | Target page supports clear. |
| Clear dock history | `/SESSION_ID/clearAll` | Pinned behavior can vary; source-check before promising. |
| Get queue size | WebSocket `{"action":"getQueueSize","get":"q1"}` | Consumer must listen for response. |

## Waitlist And Giveaway Examples

```text
https://io.socialstream.ninja/SESSION_ID/resetwaitlist
https://io.socialstream.ninja/SESSION_ID/stopentries
https://io.socialstream.ninja/SESSION_ID/selectwinner/null/1
https://io.socialstream.ninja/SESSION_ID/waitlistmessage/null/Next%20up
```

Checks:

- `waitlist.html` or the relevant giveaway/waitlist page is open.
- Same session is used.
- The page supports the action.
- Values are URL-encoded.

## Poll Examples

```text
https://io.socialstream.ninja/SESSION_ID/resetpoll
https://io.socialstream.ninja/SESSION_ID/closepoll
```

Structured poll actions should usually use POST/PUT or a validated client:

```json
{
  "action": "createpoll",
  "value": {
    "settings": {
      "question": "Choose one",
      "options": ["A", "B"]
    }
  }
}
```

Checks:

- `poll.html` is open on the same session.
- The exact value shape is source-checked before using it in production.
- Presets/settings actions are higher risk than reset/close.

## Timer Examples

Simple HTTP controls:

```text
https://io.socialstream.ninja/SESSION_ID/starttimer
https://io.socialstream.ninja/SESSION_ID/pausetimer
https://io.socialstream.ninja/SESSION_ID/toggletimer
https://io.socialstream.ninja/SESSION_ID/resettimer
https://io.socialstream.ninja/SESSION_ID/timeradd/null/60
https://io.socialstream.ninja/SESSION_ID/timersubtract/null/30
```

Structured timer state:

```json
{
  "action": "settimer",
  "value": {
    "seconds": 300,
    "label": "Break"
  }
}
```

Checks:

- `timer.html?session=SESSION_ID&server` is open when remote server control is intended.
- Time values are in the expected units for that action.
- `gettimerstate` requires a response listener.

## Channel Content Examples

Send custom content to default channel:

```json
{
  "action": "content",
  "value": {
    "chatname": "External User",
    "chatmessage": "Channel 1 message",
    "type": "external"
  }
}
```

HTTP channel variants:

```text
https://io.socialstream.ninja/SESSION_ID/content/null/%7B%22chatname%22%3A%22External%20User%22%2C%22chatmessage%22%3A%22Hello%22%2C%22type%22%3A%22external%22%7D
https://io.socialstream.ninja/SESSION_ID/content4/null/%7B%22chatname%22%3A%22External%20User%22%2C%22chatmessage%22%3A%22Hello%22%2C%22type%22%3A%22external%22%7D
```

Use JSON POST/WebSocket for structured payloads whenever possible; encoded JSON in GET URLs is hard to read and easy to break.

## Moderation And User Tools

Examples:

```json
{
  "action": "blockUser",
  "value": {
    "chatname": "CHAT_NAME",
    "type": "SOURCE_TYPE"
  }
}
```

```json
{
  "action": "toggleVIPUser",
  "value": {
    "chatname": "CHAT_NAME",
    "type": "SOURCE_TYPE"
  }
}
```

Support warnings:

- Moderation actions are platform/source dependent.
- User identity shape can differ by source.
- Do not promise delete/block/moderation support without checking the exact platform doc and current source.

## Viewer Chat Commands Are Different

These are typed by viewers in platform chat, not sent as API action names:

```text
!joke
hi
!cycle
!say
!pass
!join
!drop
!dig B5
```

Checks:

- Relevant command setting is enabled.
- Source can send replies back to platform chat when needed.
- Game/page is open on the same session when the command belongs to a game.
- The user is not trying to send viewer commands through HTTP API as `action` values.

## Event Flow Is Different Too

Event Flow action types are node names in the visual automation system, not necessarily HTTP API action names.

Examples of Event Flow action families:

- `sendMessage`
- `webhook`
- `customJs`
- `ttsSpeak`
- `obsChangeScene`
- `playAudioClip`
- `setCounter`

Use `09-api-and-integrations/event-flow-editor.md` before converting an Event Flow idea into API commands.

## Common Failure Matrix

| Symptom | Likely Cause | First Check |
| --- | --- | --- |
| HTTP URL loads but nothing happens | Target page/source is not open or not on server/session route | Open dock/target page, same session, refresh. |
| WebSocket connects but no chat arrives | Chat relay toggle missing or wrong channel | Use channel 4 and enable Send chat messages to API server. |
| `sendChat` does nothing | Platform/source send-back unsupported or not logged in | Check platform capability matrix and source mode. |
| Command affects wrong page | Session or label mismatch | Confirm `session` and `label`. |
| `nextInQueue` does nothing | Dock has no queued messages or dock not open | Queue a message in dock first. |
| `clearOverlay` does not clear dock list | It clears featured/overlay output, not necessarily dock history | Use `clear`/`clearAll` where supported. |
| GET value breaks | Missing URL encoding | Use `sendEncodedChat` or POST JSON. |
| Poll/timer/waitlist command fails | Target page missing or value shape wrong | Open correct page and source-check action value. |
| API response says success but page unchanged | Relay accepted message but target did not act | Check target page console/session/label. |
| Support example exposes secrets | Full URL/session/key was pasted | Redact and route to `privacy-security-and-secrets.md`. |

## Safe Answer Pattern

When giving an API command answer:

1. Name the command bucket: API, viewer chat, URL parameter, Event Flow, MIDI, or custom JS.
2. Give one minimal example with placeholders.
3. Name the required toggle and target page/source.
4. Mention the first likely failure.
5. Warn about secrets if the example includes session, password, key, token, webhook, or private endpoint values.
