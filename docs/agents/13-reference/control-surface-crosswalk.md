# Control Surface Crosswalk

Status: cross-reference pass on 2026-06-24 from current command, URL, settings, mode, surface, workflow, and support-routing docs. This is a disambiguation guide, not runtime validation.

## Purpose

Use this page when a user says "command", "option", "setting", "mode", "link", "source", "plugin", or "control" and it is not clear which SSN system they mean.

This page connects:

- Viewer chat commands.
- HTTP/WebSocket API actions.
- URL parameters.
- Popup settings and toggles.
- Page labels and sessions.
- Product/capture modes.
- Event Flow actions.
- Custom JS, custom overlays, and custom sources.

Start here for disambiguation, then open the narrower doc before giving exact syntax or platform-specific advice.

## Source Anchors

- `13-reference/commands-and-actions.md`
- `13-reference/action-command-index.md`
- `13-reference/api-command-examples.md`
- `13-reference/url-parameters.md`
- `13-reference/url-parameter-index.md`
- `13-reference/url-parameter-source-trace.md`
- `13-reference/settings-and-toggles.md`
- `13-reference/settings-key-index.md`
- `13-reference/modes-and-capability-matrix.md`
- `13-reference/surface-url-cheatsheet.md`
- `13-reference/workflow-setup-decision-tree.md`
- `13-reference/customization-plugin-recipes.md`
- `11-support-kb/question-intent-router.md`
- `11-support-kb/support-question-phrasebook.md`

## Fast Classification

| User Says | Usually Means | First Doc | First Check |
| --- | --- | --- | --- |
| "What command do I use?" | Could be viewer chat command, API action, Event Flow action, MIDI/hotkey, or URL option | `commands-and-actions.md` | Ask where the command is being typed or sent. |
| "What action do I send?" | API action or Event Flow action | `action-command-index.md` | Confirm target page/source is open and connected. |
| "What URL/link do I open?" | Receiving page, source page, API endpoint, or diagnostic helper | `surface-url-cheatsheet.md` | Identify output goal before adding parameters. |
| "What option changes this?" | URL parameter or popup setting | `settings-and-toggles.md` | Ask whether the user edited a URL or the popup/settings UI. |
| "The setting did not apply" | Persistent setting, URL override, generated-link issue, app source state, or page reload issue | `settings-change-impact-matrix.md` | Check page refresh, source reload, OBS URL replacement, and app-vs-extension state. |
| "The parameter does not work" | Page-specific URL parser issue | `url-parameter-source-trace.md` | Confirm the target page reads that parameter. |
| "The mode is wrong" | Product surface or capture mode | `modes-and-capability-matrix.md` | Determine extension/app/Lite/source-page/DOM/static mode. |
| "The session is wrong" | Sender/receiver room mismatch | `surface-url-cheatsheet.md` | Compare source, dock, overlay, API, and app session values. |
| "The label target does nothing" | API target label mismatch | `api-command-examples.md` | Confirm page has `&label=...` and action supports targeting. |
| "Can it send chat back?" | Platform source send-back support | `08-platform-sources/platform-capability-matrix.md` | Check platform, login, permissions, source mode, and current source. |
| "Can I make a plugin?" | Custom overlay, custom JS, API client, Event Flow, or new source | `customization-plugin-recipes.md` | Pick the smallest extension point that solves the need. |

## Which Surface Controls What

| Control Surface | Changed Where | Persists? | Affects | Common Failure |
| --- | --- | --- | --- | --- |
| Popup setting/toggle | Extension popup, app equivalent, settings UI | Usually yes | Capture, filtering, provider setup, command behavior, integrations | Source or page needs reload; user changed app but tests extension or vice versa. |
| URL parameter | Query string on a specific page URL | No, unless saved as a link | One page instance at load time | User puts it on the wrong page or expects it to update live. |
| Session ID | Source/dock/overlay/API URL or app state | Depends on surface | Which room messages/control traffic use | Source and overlay are on different sessions. |
| Password | URL/API/session security value | Depends on surface | Access/control for protected session paths | Shared publicly or mismatched between pages. |
| Page label | `&label=NAME` on target page | Only in that URL/page instance | API action target selection | API targets label that is not open. |
| Viewer chat command | Typed in platform chat by viewer/mod/streamer | No | Auto reply, TTS trigger, queue/game input, OBS scene cycle where enabled | Source cannot send back, command toggle off, or game/page not open. |
| HTTP API action | `https://io.socialstream.ninja/SESSION/ACTION/...` | No | Dock/source/page/API control | HTTP returns but no target page/source acted. |
| WebSocket API action | JSON sent to `wss://io.socialstream.ninja/join/SESSION` | No | Same as HTTP API plus real-time external clients | Wrong channel, missing toggles, malformed payload. |
| Event Flow action | Event Flow editor/flow runtime | Yes, in flow storage | Automation, media/audio/OBS/webhooks/state/custom JS | Trigger does not fire or output page is closed. |
| Custom JS/user function | Local/custom script or supported upload path | Depends on path | Message mutation, filtering, replies, styling, automation | Hosted page cannot load local disk code; bad script drops messages. |
| Custom overlay | Local/hosted HTML/CSS/JS page | User-managed | Visual rendering of SSN payloads | Payload fields differ by source/mode; session or transport wrong. |
| Custom source/API client | External app/bot/source file | User-managed | Sends SSN-shaped payloads into the system | Payload incomplete, reconnect missing, API toggles off. |

## Same Word, Different Meaning

| Word | Possible Meanings | Disambiguation Question |
| --- | --- | --- |
| Command | Viewer chat command, API action, MIDI/hotkey, Event Flow action, custom JS function | "Where are you sending it from: chat, browser URL/HTTP, WebSocket, StreamDeck, Event Flow, or code?" |
| Option | Popup setting, URL parameter, OBS browser-source setting, provider account setting, app window option | "Did you change it in SSN settings, in the page URL, in OBS, or in the external provider?" |
| Source | Platform page, content script, WebSocket/API source page, standalone app source window, external custom sender | "Is this a browser page, an app source window, a source setup page, or your own sender?" |
| Overlay | `featured.html`, theme page, custom overlay, OBS browser source, generated AI overlay, alert page | "Which page URL is in OBS or the browser?" |
| Mode | Extension/app/Lite, DOM/WebSocket/API/static, simple/full UI, OBS/server mode, platform-specific mode | "Which mode label are you seeing, and on which page/app?" |
| Plugin | Custom overlay, custom JS hook, Event Flow flow, API integration, source file, forked page | "Do you need visuals, message logic, external data, automation, or a new platform?" |
| API | SSN relay API, platform API, browser WebSocket, Event Flow action, provider endpoint | "Which endpoint or provider is being called?" |
| Server | Hosted relay, local server, WebSocket source server, OBS WebSocket, platform server | "Which URL/host/port are you connecting to?" |

## Setup Order To Avoid False Debugging

Use this order before advising advanced options:

1. Source captures into the dock.
2. The receiving page works in a normal browser.
3. OBS/external app works with the same URL/session.
4. URL parameters or popup settings are added one at a time.
5. API commands, Event Flow, TTS, AI, or send-back are layered on.

Do not troubleshoot CSS, AI, TTS, Event Flow, StreamDeck, or OBS before proving source capture and session routing.

## Common False Equivalences

| Wrong Assumption | Better Rule |
| --- | --- |
| "An API action is the same as a URL parameter." | API actions are sent after pages/sources are running; URL parameters shape a page at load time. |
| "A popup setting changes every open overlay instantly." | Some settings affect capture or generated links; many open pages need refresh or a new URL. |
| "The supported-site card means send-back/events work." | Public support means at least one capture path. Rich events and send-back are platform/mode-specific. |
| "If dock receives chat, OBS should work." | OBS can still fail from wrong URL/session, page role, transparency/CSS, cache, audio, or browser-source settings. |
| "If HTTP API returns, the command worked." | The relay can receive a request while the target page/source is closed, unlabeled, wrong session, or unsupported. |
| "A WebSocket/API source page is an overlay." | Source pages capture or ingest data; output goes to dock/featured/themes/tools/API listeners. |
| "Local custom JS works on hosted pages." | Hosted pages cannot load arbitrary local disk scripts; use local/forked pages or supported custom-code paths. |
| "The app is always better than the extension." | App source windows help some workflows but can differ for cookies, embedded login, OAuth, and platform restrictions. |
| "TTS/AI provider support means it is free." | SSN may integrate with a provider, but the provider controls accounts, keys, pricing, quotas, and limits. |

## Decision Recipes

### User Wants A Visual Change

Start with:

1. Built-in theme or URL parameter.
2. OBS custom CSS.
3. Custom overlay if layout must be fully custom.
4. Custom JS only if behavior/message logic must change.

Do not start with a new source or "plugin" if the user only wants colors, fonts, spacing, or layout.

### User Wants Automation

Start with:

1. Existing page/API action if it is one command.
2. StreamDeck/Companion if it is a button.
3. Event Flow if it is conditional logic, state, media, OBS, or multi-step automation.
4. Custom API client or custom JS if Event Flow is not enough.

Check `action-command-index.md`, `api-command-examples.md`, and `event-flow-editor.md`.

### User Wants Platform Events

Start with:

1. Does the platform/source mode emit that event?
2. Is the user using DOM, WebSocket/API, app source, or static/manual helper mode?
3. Does the receiving page understand the event payload?
4. Does the user need send-back or moderation permissions?

Check `08-platform-sources/platform-capability-matrix.md` and the exact platform doc.

### User Wants Data In Another App

Start with:

1. Enable remote API control.
2. Enable chat relay to API server if receiving chat.
3. Listen on WebSocket channel 4.
4. Treat payload fields as optional/source-dependent.
5. Redact session IDs and private endpoints before sharing logs.

Check `09-api-and-integrations/websocket-http-api.md`.

### User Wants To Add A New Site

Start with:

1. Check whether the platform already exists in `supported-sites-lookup.md` and `public-site-implementation-map.md`.
2. Decide whether a custom source/API client is enough.
3. If first-class support is needed, add source file, manifest route, docs/site metadata, and event-contract compatibility.
4. Validate extension and app behavior separately.

Check `08-platform-sources/generic-and-custom-sources.md` and `12-development/adding-a-source.md`.

## Minimal Follow-Up Questions

Ask one or two:

| Problem | Ask |
| --- | --- |
| "Command not working" | "Where are you sending it from, and what exact command/action text are you using?" |
| "Option not working" | "Is that option in the page URL or in the SSN popup/settings UI?" |
| "Overlay not updating" | "Does the dock receive messages, and does the same overlay URL work in a normal browser?" |
| "Source not working" | "Which exact source URL/mode are you using, and is chat visibly updating there?" |
| "API not working" | "Which session, action, target label, and channel are you using after redacting secrets?" |
| "App not working" | "Which app version, OS, source mode, and source-window state are involved?" |
| "Plugin question" | "Are you trying to change visuals, message logic, external data, automation, or add a new platform?" |

## Validation Needs

- Runtime-validate the most common false-equivalence examples with controlled dock/featured/API/page tests.
- Add exact examples for `label`, `server`, `server2`, `server3`, and `localserver` only after page-specific runtime validation.
- Add app-specific crosswalk notes after Electron source-window and settings parity validation.
