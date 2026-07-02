# Diagnostic And Helper Pages

Status: heavy extraction pass from current source on 2026-06-24.

## Purpose

Use this page when a user asks about SSN helper pages that test, recover, import, replay, or diagnose behavior. These pages are not all the same type:

- Some are safe setup helpers.
- Some are API or transport test clients.
- Some are OBS output pages with a narrow payload type.
- Some are local/browser-state tools that can expose private session or history data.

Do not treat these pages as normal chat overlays unless the row below says they are output pages.

## Source Anchors

- `simple_api_client.html`
- `createtestmessage.html`
- `replaymessages.html`
- `replaymessages.js`
- `recover.html`
- `urleditor.html`
- `streamelements-importer.html`
- `streamelements-importer.js`
- `spotify-overlay.html`
- `test-giveaway-webrtc.html`
- `giveaway.html`
- `giveaway-obs-entries.html`
- `background.js`

## Quick Classification

| Page | Type | User-Facing Job | Production Output |
| --- | --- | --- | --- |
| `createtestmessage.html` | Test sender | Build fake SSN chat/event payloads and send them to a session | No, diagnostic only |
| `simple_api_client.html` | Minimal API client | Connect to the SSN WebSocket server and send a simple `sendChat` action | No, developer diagnostic |
| `replaymessages.html` | History replay controller | Replay stored chat history from IndexedDB by time range | No, control/helper page |
| `recover.html` | Settings recovery helper | Convert a `dock.html` URL into an importable `.data` settings JSON file | No, recovery helper |
| `urleditor.html` | URL parameter editor | Parse, edit, save, and copy overlay URLs without hand-editing params | No, helper page |
| `streamelements-importer.html` | Import/export helper | Convert a StreamElements/Streamlabs chat widget zip/folder into one OBS HTML file | The exported HTML is output; importer page is not |
| `spotify-overlay.html` | Now-playing overlay | Display Spotify now-playing payloads from SSN traffic | Yes, OBS output page |
| `test-giveaway-webrtc.html` | Giveaway sync tester | Test local giveaway page communication messages | No, diagnostic only |

## `createtestmessage.html`

Primary use: create controlled test payloads without waiting for a real platform event.

What it does:

- Reads `session`, `id`, or `apiid` from the URL, then falls back to `localStorage` key `ssnTestMessageSession`.
- Offers presets for chat, donation/cheer, subscriber, gifted subs, raid, channel points reward, viewer count update, first-time chatter, hype train begin/progress/end, and treasure train progress.
- Lets the user edit the generated JSON before submitting.
- Stores the last entered session ID in browser `localStorage`.

Delivery modes:

| Delivery | Transport | Source-Observed Behavior |
| --- | --- | --- |
| `extension` | HTTP POST to `https://io.socialstream.ninja/SESSION?channel=1` | Sends `{ action: "extContent", apiid: SESSION, value: JSON.stringify(payload) }`; if POST fails, falls back to an image GET request at `/SESSION/extContent/null/VALUE?channel=1`. |
| `direct1` | WebSocket `wss://io.socialstream.ninja:443` | Joins `{ join: SESSION, out: 1, in: 1 }`, waits briefly, then sends the raw payload. |
| `direct4` | WebSocket `wss://io.socialstream.ninja:443` | Joins `{ join: SESSION, out: 4, in: 1 }`, waits briefly, then sends the raw payload. |

Important setup note:

- `extension` delivery requires the extension popup setting `Enable remote API control of extension` to be enabled for the same session ID.
- Direct modes only help when a target page is listening on the matching server/channel path.
- Hype train metadata is intended for `events.html` style event handling, not as ordinary chat.

First failure checks:

- Confirm the session ID is current and not copied from an old URL.
- Confirm the target page is open on the same session.
- For `extension`, confirm the remote API control setting is enabled.
- For `direct1` or `direct4`, confirm the target page uses the expected channel/server mode.

## `simple_api_client.html`

Primary use: minimal developer smoke test for the SSN API WebSocket path.

What it does:

- Takes a session ID from a text input.
- Opens `wss://io.socialstream.ninja:443`.
- On open, sends `{ join: sessionID, out: 3, in: 4 }`.
- Displays raw inbound WebSocket messages.
- Sends user text as:

```json
{
  "action": "sendChat",
  "apiid": "SESSION_ID",
  "value": "message text"
}
```

Support boundary:

- This is a tiny API client, not a replacement for `sampleapi.html`, dock, or an external app integration guide.
- It does not prove platform send-back is supported. It only proves the page can connect and send a `sendChat` request shape.

First failure checks:

- Confirm WebSocket connectivity to `io.socialstream.ninja`.
- Confirm remote API settings are enabled if the intended action requires the extension/app to accept remote control.
- Confirm the source/platform can actually send chat back before calling `sendChat` broken.

## `replaymessages.html` And `replaymessages.js`

Primary use: replay chat history over time into connected overlays/pages.

What it does:

- Shows start time, optional end time, and playback speed controls.
- Defaults start time to 24 hours ago.
- Sends `chrome.runtime.sendMessage` actions:
  - `startReplay`
  - `pauseReplay`
  - `resumeReplay`
  - `stopReplay`
  - `updateReplaySpeed`
- The extension background handler reads stored messages from the message-store IndexedDB by `timestamp`, sorts them, and re-sends them through `sendDataP2P(message)` on delayed timers.
- The Electron fallback tries to read `chatMessagesDB_v3`, object store `messages`, index `timestamp`, then posts replay messages to `window.opener`.

Data source:

| Mode | Data Source | Notes |
| --- | --- | --- |
| Chrome extension | Extension message store via `messageStoreDB` in `background.js` | Requires SSN to be enabled; replay is async and reports queued message count. |
| Electron/app fallback | IndexedDB `chatMessagesDB_v3`, store `messages`, index `timestamp` | Source code warns Electron replay is limited without IPC/opener support. |

Privacy and safety:

- Replayed messages come from stored local chat history. Treat screenshots, exports, and recordings as potentially private.
- Replay can resend old chat into overlays as if live. Use a test session when experimenting.

Source-observed caveat:

- In `background.js`, the replay loop uses `messages.forEach((message, messageIndex) => ...)`, but the timeout body uses `index + 1` for progress and cleanup. In that scope, `index` is also the IndexedDB index object. This may make progress values and cleanup unreliable until corrected in code.
- `updateReplaySpeed` currently stores the new speed on the session object, but the source comment says recalculating pending timeouts is not implemented.

First failure checks:

- Confirm SSN is enabled before starting replay.
- Confirm message history exists for the selected time range.
- Confirm target overlays/pages are open on the same session.
- Treat Electron replay as limited unless verified in the running app.

## `recover.html`

Primary use: rebuild importable extension settings from a `dock.html` URL.

What it does:

- Accepts a full dock URL or query string beginning with `session=...` or `?session=...`.
- Derives `streamID` from `session`, `room`, `push`, `view`, or `label`.
- Derives `password` from `password`, `pass`, or `pw`.
- Skips `session`, `password`, `pass`, `pw`, and `v` when building `settings`.
- Converts URL params into settings entries with `param1: true`.
- Puts numeric-looking values or known numeric keys into `numbersetting`.
- Puts `true` or `false` values into `setting`.
- Puts other non-empty values into `textparam1`.
- Generates JSON shaped like the built-in export and downloads `socialstream-settings.data`.

Support boundary:

- This is a converter from URL params to settings JSON. It does not verify that every parameter is still current or supported by every page.
- It does not recover hidden settings that were never present in the URL.

First failure checks:

- Make sure the pasted URL includes a usable session/stream ID.
- If the recovered import behaves oddly, compare the URL params against `url-parameter-index.md` and the page-specific docs.
- Redact session IDs and passwords before sharing a recovered JSON snippet.

## `urleditor.html`

Primary use: edit overlay URLs with a UI instead of manual query-string editing.

What it does:

- Parses a full URL entered by the user.
- Detects duplicate parameters.
- Groups known parameters into categories such as basic configuration, visual style, message display, layout, animation, filtering, donation/member, TTS, bot/host control, notification/sound, OBS integration, export/saving, and queue/selection.
- Uses input controls based on parameter type: boolean, number/float, option list, or text.
- Adds known parameters through a searchable suggestion list.
- Copies the resulting URL to clipboard.
- Saves named URL presets to browser `localStorage` key `savedUrls`.

Support boundary:

- The parameter catalog is hardcoded in the page and may be incomplete or stale compared with `shared/config/urlParameters.js`.
- It is mostly dock/overlay URL editing help; it is not a source setup tool.

First failure checks:

- Paste a full valid URL, not just a path.
- If a parameter exists in the editor but does nothing, check whether the target page actually supports it and whether the page needs refresh.
- Clear browser localStorage if saved presets are stale or private.

## `streamelements-importer.html`

Primary use: convert a StreamElements or Streamlabs chat widget package into a standalone OBS HTML file that reads SSN payloads.

What it accepts:

- `.zip` file via JSZip.
- Multiple files.
- A folder selected through the browser file picker.
- Manual overrides for which file is HTML, CSS, JS, fields, or data.

What it exports:

- A single HTML file, default name `ssn-imported-overlay.html`.
- Optional README text file after export.
- A compatibility runtime with `window.SSNSECompat.start()`.
- Embedded config containing field data, optional session, optional password, source name, and whether widget JS exists.

Runtime behavior in the exported file:

- Reads `session` from URL or embedded config.
- Reads `password` from URL or embedded config.
- Receives SSN traffic through the hidden VDO.Ninja iframe bridge unless `serveronly` is used.
- Optional WebSocket mode if the exported file is opened with `server`, `server2`, or `localserver`.
- Joins WebSocket with `{ join: roomID, out: 3, in: 4 }`.
- Supports `demo` mode for sample messages.
- Supports runtime overrides:
  - `limit`
  - `direction=top`
  - `direction=bottom`
  - `top`
  - `bottom`
  - `hideAfter`

SSN to StreamElements-style mapping:

- `chatname` maps to display name/nick.
- `chatmessage` maps to text/rendered text.
- `chatbadges` maps to badge data when URLs or labels exist.
- `type` maps to service/source.
- `mid`, `id`, `messageId`, `message_id`, or `meta.messageId` map to message IDs.
- `membership`, `subtitle`, badges, and role hints map to subscriber/mod/VIP/broadcaster flags when detectable.
- `hasDonation`, `donation`, and `contentimg` map to amount/support text or attachment data where possible.

Known limits:

- Chat widgets are the main target.
- Widgets that depend on private StreamElements or Streamlabs APIs, overlay-store state, full plugin ecosystems, or platform emote APIs may need manual edits.
- Local packaged assets can be embedded, but remote URLs stay remote and may fail in OBS/browser context.
- The importer page itself is not the OBS overlay; the downloaded HTML file is.

First failure checks:

- Confirm the source package contains usable HTML/CSS/JS/fields/data files.
- Paste the SSN session before exporting, or append `?session=SESSION_ID` to the downloaded file URL.
- Test exported file with `?demo` before testing live traffic.
- If live chat fails, check the hidden iframe bridge first, then try WebSocket `server`/`localserver` mode only when needed.

## `spotify-overlay.html`

Primary use: show Spotify now-playing data as an OBS/browser overlay.

Accepted URL parameters:

| Parameter | Behavior |
| --- | --- |
| `session` or `room` | Session/room ID for bridge traffic. |
| `password` | Password for the bridge; defaults to `false`. |
| `label` | Bridge label; defaults to `spotify`. |
| `hidepaused` | Hide overlay when playback is paused. |
| `hideoffline` or `hideinactive` | Hide overlay when status is stopped/inactive. |
| `hidenosong` | Hide overlay when no track exists. |
| `hideart` | Hide album art. |
| `hidealbum` | Hide album line. |
| `hideprogress` | Hide progress bar. |
| `hidedevice` | Hide device details. |
| `hidestatus` | Hide status badge. |
| `compact` | Use compact sizing. |
| `accent` | Set CSS accent color. |
| `style` or `theme` | Theme name; source includes `spotify`, `minimal`, `glass`, `comic`, and `ticker` behavior. |
| `ticker` | Force ticker mode. |
| `out` or `outchan` | WebSocket out channel, default `8`. |
| `in` or `inchan` | WebSocket in channel, default `9`. |
| `server`, `server2`, `server3`, `localserver` | Optional WebSocket bridge modes. |

Payload shape:

- Processes either a top-level Spotify payload or `payload.spotify`.
- Expected fields include `track`, `status`, `isPlaying`, `progressMs` or `progress`, `durationMs` or `duration`, `device`, `receivedAt`, and optional `message`.
- `track` fields include `name`, `artist`, `album`, `imageUrl`, and duration if present.

Transport:

- Default hidden iframe bridge URL uses `vdo.socialstream.ninja` with `solo`, `view`, `room`, `label`, `novideo`, `noaudio`, and `cleanoutput`.
- Optional WebSocket bridge joins `{ join: sessionId, out: outChannel, in: inChannel }`.

First failure checks:

- Confirm the source workflow is actually sending Spotify payloads, not ordinary chat.
- Confirm `session`/`room` and `label` match the sender.
- If using WebSocket mode, confirm the expected channel pair.
- If hidden while paused/offline/no-song, remove hide flags while debugging.

## `test-giveaway-webrtc.html`

Primary use: test local communication between the giveaway controller and OBS entries widget.

What it does:

- Reads `session`, `s`, or `id`; if missing, uses a hardcoded test default.
- Reads `password`; if missing, uses `false`.
- Opens a `BroadcastChannel` named `giveaway_SESSION`.
- If `BroadcastChannel` is not available, listens and writes through `localStorage` key `giveaway_broadcast_SESSION`.
- Sends test messages for:
  - `keyword_update`
  - `giveaway_update`
  - `spin_update`
  - `winner_update`
- Provides links to open `giveaway.html?session=...&password=...` and `giveaway-obs-entries.html?session=...&password=...`.

Support boundary:

- It is a test page for local giveaway synchronization, not a WebRTC production transport by itself.
- It can help prove whether local BroadcastChannel/localStorage messages are moving, but it does not prove the live source is collecting entrants.

First failure checks:

- Confirm all giveaway pages use the same session and password.
- Confirm both pages are open in the same browser profile/context for BroadcastChannel/localStorage communication.
- Use the main giveaway page to test entrant capture from chat.

## Common Mistakes

| Mistake | Correction |
| --- | --- |
| Using `simple_api_client.html` as the main API docs | Use `sampleapi.html` and `websocket-http-api.md` for broad API testing. `simple_api_client.html` is only a tiny smoke client. |
| Expecting `createtestmessage.html` to prove real platform events | It creates synthetic SSN payloads. Real platform event support still depends on source/mode. |
| Sharing `recover.html` output in public | Redact session IDs and passwords before sharing. |
| Opening `streamelements-importer.html` in OBS | Export/download the generated HTML and use that file in OBS. |
| Opening `spotify-overlay.html` for normal chat | It expects Spotify now-playing payloads, not ordinary chat messages. |
| Treating replay as harmless | Replay can resend old private chat history into live overlays. Use a test session. |

## Next Extraction Needs

- Validate `createtestmessage.html` presets against `events.html`, `multi-alerts.html`, and Event Flow sample payload handling.
- Fix or confirm the `background.js` replay progress/cleanup caveat before publishing replay as stable user-facing workflow.
- Validate `streamelements-importer.html` exports with real StreamElements and Streamlabs chat widget packages in OBS.
- Trace the Spotify source/control side that emits `spotify-overlay.html` payloads.
- Validate `test-giveaway-webrtc.html` against current `giveaway.html` and `giveaway-obs-entries.html` runtime behavior in a browser.
