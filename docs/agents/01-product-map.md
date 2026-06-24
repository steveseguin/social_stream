# SSN Product Map

Status: heavy extraction pass started from public repo docs and app docs. This is the orientation page for future AI documentation passes.

## Source Anchors

- `README.md`
- `api.md`
- `parameters.md`
- `docs/features.html`
- `docs/download.html`
- `docs/commands.html`
- `docs/ssapp.html`
- `docs/js/sites.js`
- `C:\Users\steve\Code\ssapp\AGENTS.md`

## What Social Stream Ninja Is

Social Stream Ninja is a free, open-source live-chat capture and overlay ecosystem. It consolidates chat, events, donations, and automation across many platforms and exposes the data to docks, featured overlays, alert pages, bots, APIs, and external production tools.

Public repo docs describe the product as:

- Browser extension or standalone desktop app.
- 120+ supported sites and growing.
- Built around VDO.Ninja peer-to-peer transport, with optional API server workflows.
- Open API for control and data access.
- Featured chat overlay and dock workflow.
- AI and TTS integrations.
- Scriptable customization and custom overlay support.

## Primary Surfaces

| Surface | Role | Typical User |
| --- | --- | --- |
| Browser extension | Captures messages from supported browser pages and popout chats | Streamers already using Chrome/Edge/Brave/Firefox sessions |
| Standalone desktop app | Electron app that manages sources and loads Social Stream code without browser extension install | Users who want source management, app windows, and fewer browser throttling issues |
| Dock (`dock.html`) | Main control/dashboard page for chat, queueing, pinning, filtering, chat sending, TTS controls, and source state | Streamer/moderator/operator |
| Featured overlay (`featured.html`) | Shows selected/featured chat messages | OBS/production output |
| Alert/tool pages | Waitlist, polls, games, tip jar, credits, emotes, multi-alerts, timers, AI/bot/cohost pages | Streamer production extras |
| Hosted pages | Current hosted versions on `socialstream.ninja` | Normal users and OBS browser sources |
| Local/forked pages | Local files or fork-hosted pages | Advanced customization and development |
| Lite web app | Lightweight web-only option | Quick/mobile/limited workflows |
| External API clients | StreamDeck, Companion, bots, private apps, donation webhooks | Automation developers/operators |

## Extension vs Standalone App

Use the extension when:

- The site works best with normal browser cookies/login/session.
- A platform blocks embedded app sign-in.
- The user wants Chrome Web Store/manual extension behavior.
- The user already has popout chats open in their browser workflow.

Use the standalone app when:

- The user wants source windows managed in one app.
- The workflow suffers from Chrome background throttling or minimized windows.
- Always-on-top or transparent app-window behavior is useful.
- Extension install/policy restrictions are a problem.

Boundary from `ssapp` instructions:

- Source edits belong in `C:\Users\steve\Code\social_stream`.
- The standalone app loads Social Stream source files remotely from that repo at app startup.
- `ssapp/resources/social_stream_fallback` is a rebuilt fallback bundle, not the primary source.

## Core User Workflow

1. Install/launch the extension or standalone app.
2. Enable the source/capture mode needed for the platform.
3. Open the supported chat page, popout chat, or source page.
4. Open `dock.html` with the same session ID.
5. Open `featured.html` or another overlay in OBS with the same session ID.
6. Select/queue/pin messages in the dock or allow auto-show rules.
7. Add optional TTS, AI, Event Flow, API, waitlist, polls, tip jar, or graphics integrations.

Most support issues reduce to a mismatch in one of those steps: wrong surface, wrong source mode, wrong session ID, hidden/minimized source, missing toggle, or stale page.

## Supported Sites

The README states 120+ supported sites. `docs/js/sites.js` currently lists 139 public site cards and classifies them into standard, popout, toggle-required, WebSocket-source, and manual-pick setup types. Focused metadata validation found duplicate `On24`/`ON24` cards, so treat 139 as a public-card count, not a unique-live-platform count.

The implementation source of truth is:

- `manifest.json` for extension URL matching.
- `sources/*.js` for DOM/manual/static capture.
- `sources/websocket/*` for source-page/API/socket capture.
- `providers/*` and `shared/*` for shared provider/runtime logic.

Do not promise a site is working from the README list alone. Check the source file and recent support history for active breakages.

## Message Flow In One Paragraph

A source captures a platform message or event, builds an SSN message object, sends it to the extension/app background processing path, optional filters/bots/AI/custom user functions modify it, and the resulting payload is delivered through peer-to-peer or API-server routing to docks, overlays, alert pages, and external listeners.

See `05-message-flow-and-event-contracts.md` for the payload contract and `09-api-and-integrations/websocket-http-api.md` for remote-control/listener workflows.

## Customization Layers

From simplest to most invasive:

1. URL parameters: style, filters, queueing, TTS, API routing, labels, OBS/graphics options.
2. OBS browser-source CSS: fastest safe visual override.
3. Hosted/forked/local custom overlay: full visual control.
4. `custom.js`: local dock/featured custom behavior.
5. Uploaded `window.customUserFunction`: message processing/filter/reply logic.
6. API/WebSocket source: external app sends SSN-shaped messages.
7. New source file: first-class platform integration.

## Automation And Integrations

Main integration families:

- HTTP/WebSocket API for StreamDeck, custom apps, and bots.
- Bitfocus Companion module.
- MIDI hotkeys.
- Donation webhooks for Stripe, Ko-Fi, Buy Me A Coffee, and Fourthwall.
- OBS remote/scene support through browser-source permissions and URL parameters.
- H2R, SPX-GC, Singular.live, generic POST/PUT integrations.
- AI chatbot/moderation/cohost features through local or cloud providers.
- TTS through browser/system voices, local/browser providers, or cloud providers.

## Free vs Paid Boundaries

SSN itself is free/open-source. Costs can appear when:

- A third-party TTS/AI provider requires an account/API key/billing.
- A platform feature is paywalled by the platform.
- The user pays for unrelated production tools such as graphics systems or hosted services.

Do not describe third-party services as free unless the current provider docs/code confirm it. The SSN docs note that free tiers and provider availability vary.

## Related But Separate Projects

Mention related projects only when they matter to a support answer:

- VDO.Ninja: underlying transport inspiration/integration and related remote-control workflows.
- Electron Capture: separate app sometimes suggested for always-on-top browser windows.
- `ssapp` / `ssn_app`: standalone desktop app source repo.
- Lite: web app with limited feature set.

## Open Documentation Gaps

- Exact current status of each site source.
- Full overlay/page catalog with every parameter and message contract.
- Feature matrix comparing extension, app, hosted, local, Firefox, MV3, and Lite.
- AI/TTS provider setup matrix.
- Mined Discord/KB historical issue frequency.
