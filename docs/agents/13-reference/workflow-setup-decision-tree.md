# Workflow Setup Decision Tree

Status: workflow routing pass started on 2026-06-24.

## Purpose

Use this page when the user asks "what should I use?", "how should I set this up?", or "which SSN pieces do I need?"

This is the setup counterpart to troubleshooting. It starts from the desired workflow and routes to the source side, receiving page, options, integrations, and validation checks.

## Source Anchors

- `01-product-map.md`
- `02-installation-and-surfaces.md`
- `13-reference/modes-and-capability-matrix.md`
- `13-reference/app-extension-mode-crosswalk.md`
- `13-reference/feature-support-decision-matrix.md`
- `13-reference/surface-url-cheatsheet.md`
- `13-reference/how-to-recipes.md`
- `07-overlays-and-pages/page-capability-matrix.md`
- `08-platform-sources/supported-sites-lookup.md`
- `08-platform-sources/platform-capability-matrix.md`
- `09-api-and-integrations/websocket-http-api.md`
- `11-support-kb/support-response-playbook.md`

## First Question

Ask:

```text
What is the output you want: capture chat, show it on stream, control it, automate it, hear it, analyze it with AI, send it to another app, or customize/build something?
```

Then route by output.

## Step 1: Choose The Source Side

| User Situation | Starting Source Side | First Checks |
| --- | --- | --- |
| Normal livestream chat in a browser | Chrome/Chromium extension | Supported site, correct page/popout, extension enabled, source page reloaded. |
| Wants managed source windows or less browser throttling | Standalone app source window | App version, source mode, session, login behavior, app parity. |
| Needs richer events such as follows, raids, channel points, rewards, or API-backed chat | WebSocket/API source page where supported | Source page auth/scopes, room/channel/token, platform capability doc. |
| Needs comments/posts/static page capture | Static/manual helper where supported | Manual action, helper script, exact page type. |
| Needs private/work/meeting/chat-app capture | Rendered web-page capture with toggle where required | Privacy, source toggle, visible panel, web version, no assumed send-back. |
| Needs a site not supported by SSN | Custom/generic source or new source development | Payload contract, API/WebSocket route, maintenance owner. |
| Already has an external bot/app generating data | External API client/custom source | JSON payload shape, channel 4 listener/output path, reconnect/error handling. |

Route:

- Site lookup: `../08-platform-sources/supported-sites-lookup.md`
- Capture modes: `modes-and-capability-matrix.md`
- Platform capability: `../08-platform-sources/platform-capability-matrix.md`
- New/custom sources: `../12-development/adding-a-source.md`

## Step 2: Choose The Receiving Page

| User Wants | Receiving Page Or Endpoint | Notes |
| --- | --- | --- |
| Operator dashboard | `dock.html?session=...` | Main control surface. |
| One selected message in OBS | `featured.html?session=...` | Needs dock selection, auto-feature path, or API featured payload. |
| Chat list visual on stream | Theme page or custom overlay | Choose normal chat theme, wrapper theme, or custom renderer. |
| Alerts for events | `multi-alerts.html?session=...` | Event support depends on platform/mode. |
| Event log/dashboard | `events.html?session=...` | Not the same as animated alert popups. |
| Hype/viewer count | `hype.html?session=...` | Needs viewer/hype payloads. |
| Word cloud | `wordcloud.html?session=...` | Needs chat text; `allwords` changes tokenizing. |
| Leaderboard | `leaderboard.html?session=...` | Needs chat/event/points data and selected ranking mode. |
| Emotes/reactions/scoreboard/ticker/map | Matching utility page | Payload family must match page. |
| Chat games | `games.html` or `games/*.html` | Each game has its own command/input rules. |
| Poll/waitlist/timer/giveaway | Matching tool page | Page-local state and API control vary. |
| API listener | `wss://io.socialstream.ninja/join/SESSION/4` | Requires API/chat relay toggles. |
| StreamDeck/Companion | HTTP API or Companion module | Target page/source must be connected. |
| Event Flow output | `actions.html?session=...` | Needed for media/audio/visual action output. |
| TTS | Page that should speak | Page must be open, unmuted, and captured by the intended audio path. |
| AI cohost/generation | `cohost.html`, `cohost-overlay.html`, `aiprompt.html`, `aioverlay.html` | Pick control, OBS stage, builder, or runtime page. |

Route:

- Page URLs: `surface-url-cheatsheet.md`
- Page capability: `../07-overlays-and-pages/page-capability-matrix.md`
- How-to recipes: `how-to-recipes.md`

## Step 3: Choose The Transport

| Transport | Use When | First Failure Check |
| --- | --- | --- |
| Hosted relay/session | Normal dock, overlays, tools, and API paths | Same session everywhere. |
| Local server | User specifically wants local server routing | Local server enabled/reachable and page supports local mode. |
| Direct WebSocket/API source page | Platform source page owns auth/socket/API setup | Source page connected, token/room/channel correct. |
| Browser content script | DOM capture from visible platform page | Extension enabled, page URL matched by manifest, page reloaded. |
| App source window bridge | Standalone app manages source | Source window loaded current source and app bridge is active. |
| External API client | Bot/app receives or sends SSN payloads | Remote API toggles, channel number, payload format. |

## Step 4: Add Options Only After The Base Path Works

Base validation order:

1. Source captures into dock.
2. Receiving page works in a normal browser.
3. OBS or external integration works.
4. URL parameters/settings customize the behavior.
5. Advanced automation, TTS, AI, send-back, or Event Flow is added.

Do not debug styling, AI, Event Flow, or OBS before proving the source and session path work.

## Common Setup Paths

### Basic OBS Chat

Use:

1. Extension or app source window for the platform.
2. `dock.html?session=...` for operator view.
3. `featured.html?session=...` or a theme page for OBS.

Validate:

- Dock receives messages.
- Overlay has same session.
- Browser preview works before OBS.

### Full Operator Workflow

Use:

1. Source side on extension/app/source page.
2. `dock.html?session=...` for feature, queue, pin, TTS, and moderation controls.
3. Optional `featured.html`, `multi-alerts.html`, Event Flow, or API commands.

Validate:

- Dock can see messages.
- Control action is the correct command system.
- Target page/source is open.

### Event-Rich Platform Workflow

Use:

1. Platform WebSocket/API/EventSub mode where supported.
2. Correct OAuth/scopes/token/room/channel setup.
3. Event-capable pages: `multi-alerts.html`, `events.html`, Event Flow, leaderboard, or API listener.

Validate:

- The selected platform/mode emits the event family.
- The receiving page understands that payload.
- Send-back/moderation/rewards are checked against current source.

### Private App Or Bot Listener

Use:

1. Source side captures chat into SSN.
2. Remote API/chat relay settings enabled.
3. External app listens on channel 4.

Validate:

- Listener connects to the right session.
- Chat relay toggle is enabled.
- Payload handling tolerates missing fields and reconnects.

### Custom Overlay Workflow

Use:

1. Existing overlay/theme if the change is visual only.
2. URL params or CSS for small styling changes.
3. Custom overlay HTML/API client for custom layout.
4. Local/forked page when local files or `custom.js` are needed.

Validate:

- Hosted pages cannot load arbitrary local JS files.
- Secrets are not embedded in shared overlay code.
- Payload fields are source/mode-dependent.

### New Platform Workflow

Use:

1. Existing source mode if the platform already has a source/helper.
2. Generic/custom source or external API app for private use.
3. First-class source file only when it should be maintained in the repo.

Validate:

- Manifest URL patterns.
- Source payload fields.
- Settings/toggles if privacy-sensitive.
- Dock/overlay/API behavior.
- App parity if standalone app support is expected.

## Setup Anti-Patterns

| Anti-Pattern | Better Path |
| --- | --- |
| Start with OBS before checking dock | Confirm dock receives messages first. |
| Use a random old overlay URL | Generate/use the current page URL and session. |
| Assume listed site means every feature works | Check setup type, mode, event family, and source doc. |
| Use WebSocket/API source pages as OBS overlays | Treat source pages as capture/setup pages. Send output to dock/overlay pages. |
| Add many URL parameters before base setup works | Start minimal, then add one option at a time. |
| Use the app to bypass platform login restrictions | Test extension/external-browser/source-page paths; app embedded login can be blocked. |
| Paste full URLs or logs into support | Redact session IDs, passwords, keys, OAuth tokens, webhooks, and private endpoints. |
| Edit app fallback bundle | Edit `social_stream` source; app fallback is disposable. |

## Final Setup Checklist

Before calling a workflow "set up":

- Source side is known and current.
- Correct supported URL or source page is open.
- Session IDs match across sender and receiver.
- Dock receives new messages.
- Target overlay/tool/API page works in a normal browser.
- OBS/external app works after browser validation.
- Feature-specific mode limits are checked.
- Secrets are not exposed in shared URLs, screenshots, or logs.

## Follow-Up Validation Needs

- Add exact app-source setup variants after real app/e2e validation.
- Add screenshots or rendered checks only after browser/OBS validation exists.
- Add exact per-platform rich-event setup paths after line-level platform capability validation.
- Add page-specific "minimal working URL" samples after generated page/parameter validation.
