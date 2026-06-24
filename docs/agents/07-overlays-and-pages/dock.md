# Dock Page

Status: heavy extraction pass started from `README.md`, `api.md`, `parameters.md`, and `dock.html`.

## Source Anchors

- `dock.html`
- `api.md`
- `parameters.md`
- `README.md`
- `tts.js`
- `custom_sample.js`
- `docs/agents/09-api-and-integrations/websocket-http-api.md`

## Role

`dock.html` is the operator dashboard and message control page. It is not just an overlay. It receives source messages, shows the consolidated chat feed, lets the operator feature/clear/queue/pin/block messages, sends chat responses where supported, controls TTS, and can forward selected messages to overlays or external integrations.

Typical URL:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID
```

Support note: a white or empty dock is not automatically broken. It may simply have no messages yet, the wrong session, or no active source.

## Required Setup

- The source side must be running: browser extension, standalone app, WebSocket source page, or API sender.
- The dock `session` value must match the extension/app/source session.
- The extension/app must be enabled and source pages must be loaded/reloaded.
- For API-server operation, required API toggles must be enabled.
- For local `custom.js`, use a local/forked dock page that can load the local file.

## Core Controls

The README and `dock.html` confirm these user controls:

| Control | Behavior |
| --- | --- |
| Click message | Feature/send selected message to the featured overlay. |
| Clear featured | Clears the featured overlay without necessarily clearing dock history. |
| Clear dock | Clears dock messages depending on mode/pinned state. |
| Auto-show | Automatically features incoming messages. |
| Queue | Hold CTRL on Windows/Linux or cmd on Mac and click a message to queue it. |
| Next in queue | Features the next queued message. |
| Pin | Hold ALT and click a message to pin/unpin it at the top. |
| TTS toggle | Starts/stops reading incoming messages where TTS is configured. |
| Chat composer | Sends chat replies to connected source pages where supported. |

## Dashboard Modes

Important URL parameters from `parameters.md` and `dock.html`:

| Parameter | Meaning |
| --- | --- |
| `featuredmode` | Makes `dock.html` listen to the featured-message feed instead of all messages. |
| `chatmode` | Chat-only mode; hides pin/feature behavior. |
| `helpermode` | View/pin/queue mode without chat/feature controls. |
| `chatonly` | Moves chat input into the toolbar for a chat-centric layout. |
| `viewonly` | Disables chat, pin, and feature capabilities. |
| `queueonly` | Shows only queued messages. |
| `pinnedonly` | Shows only pinned messages. |
| `sync` / `synced` | Syncs message selection/deletion/pin/queue behavior across multiple docks. |
| `label` | Names this dock for targeted API commands. |

Use these when one session has multiple operators, dashboards, or output pages.

## Auto-Feature And Queue Parameters

| Parameter | Meaning |
| --- | --- |
| `autoshow` | Auto-features incoming messages. |
| `autoshowtime` | Custom timing for auto-show. |
| `chartime` | Auto-show duration based on message length. |
| `autoshowdonos` | Auto-features donation messages only. |
| `autoshowmembers` | Auto-features member messages only. |
| `autoshowqueued` | Automatically advances queued messages. |
| `autoshowcontentimages` | Auto-features queued messages with images/content. |
| `autopindonations` | Pins donation cards as they arrive. |
| `autopinquestions` | Pins question cards as they arrive. |
| `autoqueuedonations` | Queues donation cards automatically. |
| `autoqueuequestions` | Queues question cards automatically. |
| `selfqueue` | Viewer command(s) that add a user/message to the queue. |
| `random` | Randomizes which queued message is featured next. |

Support rule: when auto-show appears to skip messages, check filters, donation/member-only modes, queue settings, and source event type before assuming transport failure.

## Display And Filter Parameters

Common dock display parameters:

- `lightmode`
- `darkmode`
- `scale`
- `compact`
- `showtime`
- `notime`
- `hidesource`
- `showsourcename`
- `noavatar`
- `nobadges`
- `striplinks`
- `hidecommands`
- `hidefrom` / `exclude`
- `onlyfrom` / `fromonly`
- `onlytwitch`
- `hidetwitch`
- `showonlymods`
- `showonlyvips`
- `showonlydonos`
- `showonlymembers`
- `filterevents`
- `hideallevents`

The full list is in `parameters.md`. Treat it as the current parameter catalog.

## API Actions

`api.md` documents dock actions including:

- `clear`
- `clearAll`
- `clearOverlay`
- `nextInQueue`
- `getQueueSize`
- `autoShow`
- `content`
- `feature`
- `toggleTTS`
- `tts`

Example:

```text
https://io.socialstream.ninja/SESSION_ID/nextInQueue
```

When controlling a specific dock, use a label:

```text
dock.html?session=SESSION_ID&label=control
https://io.socialstream.ninja/SESSION_ID/nextInQueue/control/null
```

## External Output

Dock can publish selected/featured messages to external systems through URL parameters:

- `postserver`
- `putserver`
- `h2rurl`
- `h2r`
- `spxserver`
- `spxfunction`
- `spxlayer`
- `singular`

These are normally added to the dock URL, because the dock is where selected/featured message actions happen.

## TTS In The Dock

Dock loads `tts.js` and can read incoming messages when TTS is enabled. Basic parameters:

- `speech` / `tts`
- `volume`
- `rate`
- `pitch`
- `voice`
- `ttscommand`
- `ttscommandmembersonly`
- `simpletts`
- `readevents`
- `readouturls`

Disabling TTS from the dock stops playback and clears the TTS queue.

## OBS Usage

Use `dock.html` as an OBS custom dock only for operator UI. For visible stream output, prefer `featured.html` or a purpose-built overlay page.

OBS-specific notes:

- Browser Source size of `1280x600` or `1920x600` is commonly recommended for chat overlay layouts.
- Use OBS Browser Source custom CSS for quick styling changes.
- On macOS/Linux, locally hosted dock/featured files may not behave well in OBS; hosted pages or OBS CSS are safer.
- OBS remote scene control requires an SSN page running as an OBS Browser Source with appropriate permissions, not just as a custom dock.

## Common Support Issues

| Symptom | Likely Cause | First Checks |
| --- | --- | --- |
| Empty dock | No source messages, wrong session, extension/app disabled | Session match, extension green/enabled, source page loaded. |
| Dock works but featured overlay does not | Overlay session mismatch or overlay not open | Open `featured.html?session=...`; click a dock message. |
| API commands do nothing | API toggle off or wrong channel/session | Enable remote API control; test `clearOverlay`. |
| Multiple docks all respond | Missing/incorrect `label` targeting | Add unique `&label=` to each dock. |
| Queue button missing | No queued items or mode hides controls | Check CTRL/cmd click, `viewonly`, `chatmode`, `helpermode`. |
| Auto-show feels delayed/skippy | Auto-show queue/filter behavior | Check `autoshowtime`, filters, donation/member modes. |
| TTS silent | Browser audio gate or system TTS routing | Click page, check provider, check OBS audio capture path. |
| Custom behavior not loading | Hosted page cannot load local custom file | Use local/forked dock or URL/script method. |

## Follow-Up Extraction Needs

- Line-level trace of `processInput` for every dock API action.
- Full dock URL parameter behavior matrix.
- Exact storage/export behavior for dock database/history features.
- User-facing screenshots/labels for toolbar buttons.
