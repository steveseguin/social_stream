# Commands And Actions

Status: heavy reference pass started from public command/API docs and command handlers. Use this for support orientation; verify rare actions against code before publishing final automation recipes.

For exact action-name lookup, use `action-command-index.md`. For source-checked handler caveats, use `command-action-source-trace.md`. For accepted-by-relay versus acted-on-by-target validation, use `api-command-validation-matrix.md`. For safe copy/paste API examples, use `api-command-examples.md`.

## Source Anchors

- `docs/commands.html`
- `api.md`
- `README.md`
- `parameters.md`
- `background.js`
- `dock.html`
- `featured.html`
- `waitlist.html`
- `poll.html`
- `timer.html`
- `actions/EventFlowSystem.js`
- `docs/agents/09-api-and-integrations/websocket-http-api.md`
- `docs/agents/09-api-and-integrations/event-flow-editor.md`
- `docs/agents/13-reference/action-command-index.md`
- `docs/agents/13-reference/api-command-validation-matrix.md`

## Do Not Mix These Up

SSN has several command-like systems:

| Bucket | What It Means | Example |
| --- | --- | --- |
| Viewer chat commands | Text typed by viewers in a platform chat. | `!joke`, `hi`, `!cycle`, `!say`, `!join` |
| API actions | JSON or HTTP commands sent through `io.socialstream.ninja`. | `clearOverlay`, `nextInQueue`, `sendChat` |
| URL parameters | Options added to page URLs before load. | `&autoshow`, `&speech=en-US`, `&server` |
| MIDI/hotkey controls | Local control shortcuts from MIDI devices or configured hotkeys. | MIDI CC 102 value 4 clears overlay |
| Event Flow actions | Visual automation nodes in the Event Flow editor. | send message, OBS action, TTS, media, state nodes |
| Custom script functions | JavaScript hooks that modify or react to messages. | `window.customUserFunction(data)` |

Support rule: if a user asks for a "command", first determine which bucket they mean.

## Viewer Chat Commands

Public docs currently name these built-in or page-specific viewer commands:

| Command | Meaning | Requirements |
| --- | --- | --- |
| `!joke` | Sends a random geeky dad joke. | Enable the menu toggle; platform must allow SSN to send chat. |
| `hi` | Welcomes users who say hi. | Enable the menu toggle; auto-responder path must work. |
| `!cycle` | Lets viewers change OBS scenes. | OBS remote/cycle support must be enabled and permitted. |
| `!say` | Default command trigger for TTS when `ttscommand` is used. | TTS page/provider and command settings must be enabled. |
| `!pass` | Forwards TTS to remote automation when `passtts` is enabled. | `passtts`; optionally `passttsmod` for moderator-only use. |
| `!join` | Battle/game join command in older battle docs and some current mini-games. | Exact game page/workflow active; use `07-overlays-and-pages/game-pages.md` for current game commands. |
| Game-specific commands/input | Mini-game commands such as `!drop`, `!dig B5`, color/team commands, phrase guesses, beat words, emoji, or paint commands. | Exact `games.html` or `games/*.html` page active on the same session. |
| `!say` in battle/game context | Sends an in-game chat message in older battle docs. | Battle/game page active; source-check `battle.html` before using as a current mini-game pattern. |
| Values in `selfqueue` | Viewer commands that add the viewer/message to a queue. | `&selfqueue=...` on the dock page. |

Common support checks:

- Is the relevant toggle enabled?
- Is the source allowed to send chat back to the platform?
- Is the user signed in and permitted to chat?
- Is the source page visible and not throttled?
- Is the user on Firefox, where debugger/auto-responder paths can be limited?

## API Connection Quick Reference

Remote control:

```text
https://io.socialstream.ninja/SESSION_ID/clearOverlay
https://io.socialstream.ninja/SESSION_ID/nextInQueue
https://io.socialstream.ninja/SESSION_ID/sendEncodedChat/null/Hello%20World
```

WebSocket command path:

```text
wss://io.socialstream.ninja/join/SESSION_ID
```

Receive chat in an external app:

```text
wss://io.socialstream.ninja/join/SESSION_ID/4
```

Required toggles:

| Use Case | Required Toggle(s) |
| --- | --- |
| Remote control from StreamDeck/Companion/API | Enable remote API control of extension. |
| Receive source chat in Python/Node | Enable remote API control of extension; enable Send chat messages to API server. |
| Control dock directly through server | Enable Dock to use and publish via API server, or open dock with `&server` when that page-specific path is intended. |

## Common API Actions

| Action | Target | Purpose |
| --- | --- | --- |
| `sendChat` | Extension/app source send path | Sends a message to connected chat platforms where send-back is supported. |
| `sendEncodedChat` | Extension/app source send path | Same as `sendChat`, but URL-encoded for GET usage. |
| `clearOverlay` | Dock/featured/overlay routing | Clears the featured overlay without necessarily clearing the dock list. |
| `clear` / `clearAll` | Dock/page | Clears messages on supported pages. Pinned behavior can vary. |
| `nextInQueue` | Dock | Features the next queued message. |
| `getQueueSize` | Dock | Requests the current queue size, usually with `get` callback token. |
| `autoShow` | Dock | Toggles or sets automatic featuring. |
| `feature` | Dock | Features the next unfeatured message. |
| `blockUser` | Extension/source control | Blocks a user where source control supports it. Needs source and user details. |
| `extContent` | Extension/background processing | Injects external content into SSN processing. |
| `content`, `content2`, ... `content7` | API channel routing | Sends custom content to specific channels. |
| `getChatSources` | Extension/app | Requests active source list where supported. |
| `toggleVIPUser` | Dock/background user tools | Toggles VIP status for a user. |
| `getUserHistory` | Dock/background user tools | Requests known user history where supported. |
| `drawmode` | Dock/waitlist/giveaway | Toggles draw/giveaway style mode. |
| `emoteonly` | Filtering | Toggles or sets global emote-only filtering. |
| `toggleTTS` / `tts` | Dock/featured | Toggles or sets TTS state. |

Use `sampleapi.html?session=SESSION_ID` for a quick manual command test.

## Waitlist, Poll, And Timer Actions

Waitlist/giveaway:

- `waitlistmessage`
- `removefromwaitlist`
- `highlightwaitlist`
- `resetwaitlist`
- `downloadwaitlist`
- `selectwinner`
- `drawmode`

Poll:

- `resetpoll`
- `closepoll`
- `loadpoll`
- `setpollsettings`
- `getpollpresets`
- `createpoll`

Timer:

- `starttimer`
- `pausetimer`
- `toggletimer`
- `resettimer`
- `timeradd`
- `timersubtract`
- `settimer`
- `gettimerstate`

Timer pages should be opened with a session and API server route when remote control is expected:

```text
timer.html?session=SESSION_ID&server
```

## MIDI And Hotkey Commands

Public docs list MIDI Control Change channel 1, CC 102:

| CC 102 Value | Action |
| --- | --- |
| `1` | Send `1` into chat. |
| `2` | Send `LUL` into chat. |
| `3` | Tell a random joke. |
| `4` | Clear all featured chat overlays. |

Requirements:

- MIDI support enabled in menu/settings.
- MIDI loopback device if using StreamDeck through a MIDI plugin.
- Browser/app focus and platform send permissions where the action sends chat.

## Event Flow Actions

Event Flow is a node-based automation system, not a plain API command list.

Major action families:

- Send/relay chat messages.
- TTS actions.
- Media/audio/visual effects.
- OBS actions.
- Streamer.bot/external integration actions.
- MIDI actions.
- State controls such as gates, counters, and throttles.
- Custom JS actions where supported.

Important boundary: MV3 extension contexts block direct `eval`-style custom JS, while app/Electron or explicit supported contexts can allow custom JS action execution.

## Targeting Specific Pages

Give a page a label:

```text
dock.html?session=SESSION_ID&label=control
featured.html?session=SESSION_ID&label=main
```

Then target that label:

```json
{
  "action": "nextInQueue",
  "target": "control"
}
```

For HTTP GET:

```text
https://io.socialstream.ninja/SESSION_ID/nextInQueue/control/null
```

Use labels when multiple docks, featured pages, or overlays are open.

## Common Mistakes

- User enables API remote control but forgets "Send chat messages to API server" for listeners.
- User listens on channel 1 instead of channel 4 for chat.
- User uses `sendChat` in a GET URL without encoding spaces/special characters; use `sendEncodedChat`.
- User sends a dock command while no dock is open or while dock is not connected to the server route.
- User assumes `clearOverlay` clears all dock history.
- User expects viewer chat commands to work without auto-responder/source send permissions.
- User targets a page label that does not exist.
- User shares a real session ID/webhook URL publicly.

## Answer Pattern

When asked for a command:

1. Identify bucket: viewer chat, API action, URL parameter, MIDI, Event Flow, or custom JS.
2. Identify target: extension/app, dock, featured, waitlist, poll, timer, OBS, or external listener.
3. Confirm required toggle/page is active.
4. Give the shortest working example.
5. Mention the most likely failure condition.
