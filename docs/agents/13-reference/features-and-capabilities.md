# Features And Capabilities

Status: heavy reference pass started from public features docs, generated setting categories, source inventory, and existing agent pages.

## Purpose

Use this page when a user asks what Social Stream Ninja can do, whether a feature is free, whether a feature works in the Chrome extension or standalone app, or which doc to start with for a feature family.

This page describes capability families and support boundaries. For exact setup steps, follow the linked topic pages.

## Source Anchors

- `README.md`
- `docs/features.html`
- `docs/download.html`
- `docs/guides.html`
- `docs/settings.html`
- `docs/supported-sites.html`
- `docs/commands.html`
- `api.md`
- `parameters.md`
- `docs/js/sites.js`
- `shared/config/settingsDefinitions.js`
- `docs/agents/01-product-map.md`
- `docs/agents/02-installation-and-surfaces.md`
- `docs/agents/07-overlays-and-pages/index.md`
- `docs/agents/08-platform-sources/source-inventory.md`
- `docs/agents/09-api-and-integrations/index.md`
- `docs/agents/13-reference/free-paid-and-support-boundaries.md`
- `docs/agents/13-reference/modes-and-capability-matrix.md`
- `docs/agents/13-reference/settings-and-toggles.md`

## Published Feature Families

`docs/features.html` currently presents these main families:

- Multi-platform chat integration.
- Featured chat overlay.
- Bot commands and auto-response.
- AI and LLM integration.
- Text-to-speech.
- API and external control.
- Deep customization.
- Advanced streaming tools.

It also presents SSN as free and open source, with 100+ supported platforms, no API keys for most platforms, extensive CSS/JS customization, two-way chat on most platforms, AI provider support, active Discord support, open contributions, built-in mini-games, and multimodal AI assistant features.

Support answers should keep those claims scoped. "Most platforms" and "100+" are broad public claims; exact platform and exact feature support should be checked against the current source inventory, source file, and mode docs.

## Current Inventory Signals

As of the 2026-06-24 extraction pass:

- `docs/js/sites.js` contains 139 named site entries.
- Site metadata groups include standard/open-page entries, popout entries, toggle-required entries, WebSocket-source entries, and manual-pick entries.
- `manifest.json` contains 155 content-script entries.
- `sources/*.js` contains 143 top-level source scripts.
- `sources/websocket/*` contains 28 source-page HTML/JS files.
- `shared/config/settingsDefinitions.js` contains 327 popup setting definitions.
- The generated settings categories include 36 LLM/API settings, many TTS provider settings, command settings, filters, source toggles, webhook automation, MIDI, printer control, Spotify/now-playing, custom injection, and management controls.

These counts are reference signals, not user-facing guarantees.

## Capability Map

| Capability | Included In Core SSN | Often Needs Extra Setup | Start With |
| --- | --- | --- | --- |
| Multi-platform chat capture | Yes | Platform page access, correct source mode, source visibility, source toggles for sensitive pages | `08-platform-sources/source-inventory.md` |
| Dock/dashboard | Yes | Matching session ID, API/server toggles for remote clients | `07-overlays-and-pages/dock.md` |
| Featured chat overlay | Yes | OBS browser source, matching session ID, dock selection or auto-show settings | `07-overlays-and-pages/featured.md` |
| OBS/browser overlays | Yes | Browser-source URL, transparency/CSS, refresh behavior, local-file limitations | `10-troubleshooting/obs-overlay-display.md` |
| Two-way chat sending | Partly, by platform/mode | Platform login/auth, source mode, API permissions, platform limits | Platform doc plus `modes-and-capability-matrix.md` |
| Built-in chat commands | Yes, when enabled | Popup toggles, user permissions, API/OBS settings for some commands | `13-reference/commands-and-actions.md` |
| Auto-responder and fixed messages | Yes | Trigger settings, interval settings, source/mode restrictions | `settings-and-toggles.md` |
| Webhooks and external API | Yes | Remote API toggles, session secrecy, external endpoint/security setup | `09-api-and-integrations/websocket-http-api.md` |
| StreamDeck/Companion control | Yes | API control enabled, module/button setup | `09-api-and-integrations/streamdeck-companion.md` |
| Streamer.bot integration | Yes | Streamer.bot setup, SSN API/WebSocket routes | `09-api-and-integrations/streamerbot.md` |
| Event Flow automation | Yes | Flow setup, enabled triggers/actions, current event payload support | `09-api-and-integrations/event-flow-editor.md` |
| System/browser TTS | Yes | Browser/system voice availability, OBS audio capture | `09-api-and-integrations/tts.md` |
| Cloud/provider TTS | SSN integration is included | Provider account, API key, cost/quota, privacy review | `09-api-and-integrations/tts.md` |
| AI chatbot/moderation/cohost | SSN integration is included | Local model or provider account/API key, prompts/settings, privacy review | `09-api-and-integrations/ai-features.md` |
| Polls, waitlist, giveaway, games | Yes | Page-specific setup, URL parameters, OBS/browser-source workflow | `07-overlays-and-pages/waitlist-polls-games.md` |
| Multi-alerts | Yes | Alert routing, page URL, supported event payloads | `07-overlays-and-pages/multi-alerts.md` |
| Custom CSS | Yes | OBS custom CSS, URL encoding, local/hosted page choice | `07-overlays-and-pages/custom-overlays.md` |
| Custom JavaScript/user functions | Yes, trusted-user customization | Local/hosted context, security review, exact hook behavior | `13-reference/custom-plugins-and-extensions.md` |
| Custom overlays | Yes | WebSocket/VDO.Ninja/session connection code, payload handling | `07-overlays-and-pages/custom-overlays.md` |
| New platform/source development | Open source contribution path | Source script, manifest/docs updates, compatibility testing | `12-development/adding-a-source.md` |
| Desktop app managed source windows | Standalone app feature | Electron app install, app-specific OAuth/source behavior | `04-standalone-app-architecture.md` |
| Browser extension capture | Extension feature | Browser permissions, reload after install, platform page visible | `03-extension-architecture.md` |

## Free, Paid, And Third-Party Boundaries

Use these rules in support answers:

- SSN itself is free and open source.
- Donations or sponsorships are not support contracts.
- Most platform capture modes do not require SSN-specific API keys, but some platform/API modes can require authentication or platform keys.
- Free system/browser TTS exists, but cloud/provider TTS can cost money.
- Local AI can be free to use after setup, but cloud AI providers can cost money and can involve privacy considerations.
- Payment/donation integrations are third-party services. Their fees, limits, and availability are outside SSN's control.

For a longer answer, use `free-paid-and-support-boundaries.md`.

## Mode-Specific Claims

When a user asks "can SSN do X?", answer by mode:

- Chrome extension DOM capture can capture many web pages but depends on supported URL patterns, content scripts, and visible/unthrottled pages.
- Popout mode is required for some platforms, such as Twitch popout chat.
- Toggle-required sources need the relevant popup setting enabled before reloading the site.
- WebSocket/API source pages can expose richer events for some platforms but require page setup and sometimes auth/API support.
- The standalone app can manage source windows and app-specific auth/OAuth flows, but embedded browsers can be blocked by some platforms.
- Hosted overlay pages and local overlay files can behave differently with custom CSS/JS and local assets.
- Lite and Firefox builds have smaller capability surfaces than the full Chromium extension/app paths.

Use `modes-and-capability-matrix.md` when the mode choice is the real question.

## Common Feature Questions

### Does SSN support my platform?

Check in this order:

1. `docs/agents/08-platform-sources/source-inventory.md`.
2. `docs/js/sites.js`.
3. `manifest.json` content-script matches.
4. `sources/` and `sources/websocket/`.
5. Existing platform-specific agent page, if present.

If the platform is listed only as "manual", "popout", "toggle-required", or "websocket", include that mode in the answer.

### Can SSN reply/send chat back?

Sometimes. It depends on platform, mode, auth, and current implementation. Do not promise two-way send for a platform without checking its source doc/code. DOM capture, WebSocket source, API mode, and app OAuth mode can have different capabilities.

### Can SSN moderate chat?

It has filtering, block/allow lists, event filters, command controls, and AI/censor-bot settings. For exact moderation behavior, source-check the setting and processing path before saying it deletes, hides, blocks, or only suppresses display.

### Can SSN run a chatbot?

Yes, but it is optional and settings-driven. It may require local AI setup or a third-party API key, depending on provider. Check LLM provider settings, chatbot trigger settings, custom knowledge/RAG settings, and privacy expectations.

### Can SSN read chat aloud?

Yes. Free browser/system TTS and multiple provider-backed TTS paths exist. If the user wants OBS to capture the audio, check whether the chosen TTS mode outputs through the browser page, system audio, or provider playback path.

### Can SSN make a custom overlay?

Yes. Start with CSS/URL parameters for simple visual changes, `sampleoverlay`/custom overlay docs for full custom rendering, and API/WebSocket docs for external apps. Avoid telling normal users to edit core source files unless they are explicitly developing/forking.

### Can SSN make a plugin?

Be precise. SSN supports scriptable/custom behavior through custom JS hooks, custom overlays, API clients, Event Flow, uploaded custom user functions, and custom platform sources. It does not currently have a normal-user packaged plugin marketplace flow documented as the primary path.

### Can SSN do giveaways, polls, timers, queues, games, credits, or tip jars?

Yes, through separate overlay/tool pages. These are not all controlled by the same popup setting. Check the specific page docs and URL parameters.

## Fragile Or Volatile Areas

These feature areas need current source/code verification before strong claims:

- Platform-specific two-way chat sending.
- TikTok connection/signing modes.
- YouTube API/event behavior.
- Kick/Twitch WebSocket and reward/event coverage.
- AI provider-specific model/key/endpoint behavior.
- Cloud TTS provider options and pricing.
- Any support claim based only on historical Discord conversations.
- Any feature that depends on a third-party site DOM, API, or login policy.

## Extraction Gaps

Needed intense passes:

- Full feature matrix by platform and mode.
- Exact two-way-chat/send capability per platform.
- Exact AI/LLM setting-to-runtime behavior.
- Exact TTS provider capability and OBS audio capture behavior.
- Page-by-page tool feature matrix for polls, waitlist, giveaway, games, credits, tip jar, multi-alerts, and custom overlays.
- Current public-doc claim reconciliation between `README.md`, `docs/features.html`, `docs/supported-sites.html`, and source inventory.
