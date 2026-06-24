# StreamDeck And Bitfocus Companion

Status: heavy extraction pass started from `api.md`, `docs/commands.html`, and README MIDI/API sections.

## Source Anchors

- `api.md`
- `docs/commands.html`
- `README.md`
- `parameters.md`
- `background.js`
- `dock.html`

## What This Integration Does

StreamDeck and Bitfocus Companion can control SSN through the API server. Typical actions:

- Clear featured overlay.
- Feature next message.
- Advance queue.
- Toggle auto-show.
- Send chat messages.
- Toggle TTS.
- Reset/close polls.
- Control waitlists.
- Trigger custom content.

## Required SSN Toggle

For remote control, enable:

```text
Enable remote API control of extension
```

Public docs place this under Global settings > Mechanics. Remote-control examples use channel 1 by default.

If the goal is to receive chat in another app, that is a different workflow and also requires `Send chat messages to API server`, then listening on channel 4.

## StreamDeck HTTP Method

Use StreamDeck's Website action with background GET request enabled.

Format:

```text
https://io.socialstream.ninja/SESSION_ID/ACTION/TARGET/VALUE
```

Examples:

```text
https://io.socialstream.ninja/SESSION_ID/clearOverlay
https://io.socialstream.ninja/SESSION_ID/nextInQueue
https://io.socialstream.ninja/SESSION_ID/autoShow/null/toggle
https://io.socialstream.ninja/SESSION_ID/sendEncodedChat/null/Hello%20Stream
```

Use `sendEncodedChat` for StreamDeck buttons when text contains spaces or special characters.

Test/generator page:

```text
https://socialstream.ninja/sampleapi.html?session=SESSION_ID
```

## StreamDeck Multi-Actions

Useful patterns:

- Send a chat message, wait, then clear overlay.
- Trigger `nextInQueue`, wait, then toggle TTS.
- Send multiple API commands with delays to sequence a show segment.

Advice:

- Add short delays between commands if an overlay or queue action needs time.
- Keep messages URL-encoded.
- Test each button with a harmless session before using it live.

## Bitfocus Companion

Public docs point to Companion support for Social Stream Ninja:

```text
https://bitfocus.io/companion
https://bitfocus.io/connections/socialstream-ninja
```

Basic setup:

1. Enable remote API control in SSN.
2. Copy the SSN session ID.
3. Add/configure the Social Stream Ninja connection in Companion.
4. Paste the session ID into the module settings.
5. Test a simple action such as clear featured or next in queue.

Common Companion actions documented:

- Clear featured message.
- Clear all messages.
- Next in queue.
- Toggle auto-show.
- Feature next unfeatured.
- Reset poll.
- Close poll.
- Waitlist controls.
- TTS controls.
- Send chat message.

Documented variable:

- `queue_size`

Older command docs mention variables such as current featured message/user. Verify current Companion module support before promising exact variable names beyond `queue_size`.

## WebSocket Method

For custom tooling or advanced Companion setups, use WebSocket:

```javascript
const ws = new WebSocket("wss://io.socialstream.ninja/join/SESSION_ID");

ws.onopen = () => {
  ws.send(JSON.stringify({ action: "nextInQueue" }));
  ws.send(JSON.stringify({ action: "clearOverlay" }));
};
```

Use channel 1 for normal remote control unless a specific page/workflow requires a different channel.

## MIDI Hotkey Path

README documents a separate MIDI hotkey option. It can be used with StreamDeck through a MIDI plugin and a virtual MIDI loopback device.

Documented Control Change channel 1 examples:

| Command | Value | Behavior |
| --- | --- | --- |
| 102 | 1 | Say `1` into all chats. |
| 102 | 2 | Say `LUL` into all chats. |
| 102 | 3 | Tell a random joke into all chats. |
| 102 | 4 | Clear featured chat overlays. |

Support checks:

- MIDI option enabled in SSN menu.
- MIDI loopback device installed/configured.
- StreamDeck MIDI plugin sends the expected CC/channel/value.

## Common Command Map

| Desired Button | Action |
| --- | --- |
| Clear featured overlay | `clearOverlay` |
| Feature next queued message | `nextInQueue` |
| Toggle automatic featuring | `autoShow` with value `toggle` |
| Send text to chat | `sendEncodedChat` |
| Clear dock messages | `clear` or `clearAll` |
| Feature next unfeatured message | `feature` |
| Toggle TTS | `toggleTTS` with value `toggle` |
| Get queue size | `getQueueSize` with callback-capable client |
| Reset poll | `resetpoll` |
| Close poll | `closepoll` |
| Select waitlist winner | `selectwinner` |

Use `websocket-http-api.md` for the broader action catalog.

## Common Failures

| Symptom | Likely Cause | First Checks |
| --- | --- | --- |
| Button does nothing | API toggle off, wrong session, bad URL | Enable remote API; test `clearOverlay`; verify session. |
| Text truncates or special chars break | Message not URL-encoded | Use `sendEncodedChat` and encode spaces/symbols. |
| All docks respond | Missing target label | Add `&label=` to dock/featured and target it. |
| Companion cannot connect | Module/session/config issue | Re-paste session; test HTTP URL; check SSN toggle. |
| Queue size variable stale | No callback/client listener or module limitation | Test `getQueueSize`; verify Companion module support. |
| Chat send fails but overlay commands work | Source cannot send chat | Manually send in source page; check sign-in/permissions. |
| MIDI buttons fail | MIDI option or loopback not configured | Confirm CC channel/value and loopback device. |

## Safety Notes

- Keep session IDs private; a session ID can control overlays or inject content.
- Avoid StreamDeck buttons that spam chat.
- Use account/platform permissions carefully when sending chat via automation.
- Add delays in multi-actions to avoid flooding API commands.

## Follow-Up Extraction Needs

- Current Companion module variable/action list from the module source or installed package.
- UI screenshots for StreamDeck setup.
- Exact MIDI implementation path and current command list from background code.
- Command recipes for common show workflows.
