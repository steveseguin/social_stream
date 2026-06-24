# Features And Capabilities

Status: heavy reference pass started from public features docs, generated setting categories, source inventory, and existing agent pages.

## Purpose

Use this page when a user asks what Social Stream Ninja can do, whether a feature is free, whether a feature works in the Chrome extension or standalone app, or which doc to start with for a feature family.

This page describes capability families and support boundaries. For exact setup steps, follow the linked topic pages.

For an answer-ready yes/depends/external/dev matrix, use `feature-support-decision-matrix.md`. For "which page does this use?" questions, use `../07-overlays-and-pages/page-capability-matrix.md`. For broad public wording such as "100+ sites", "most platforms", "two-way chat", "no API keys", or "free", use `public-claims-boundary-matrix.md` before answering.

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
- `docs/agents/07-overlays-and-pages/game-pages.md`
- `docs/agents/07-overlays-and-pages/theme-pages.md`
- `docs/agents/08-platform-sources/source-inventory.md`
- `docs/agents/08-platform-sources/manual-static-and-helper-sources.md`
- `docs/agents/08-platform-sources/websocket-source-pages.md`
- `docs/agents/08-platform-sources/communication-and-sensitive-sources.md`
- `docs/agents/08-platform-sources/embedded-chat-widget-sources.md`
- `docs/agents/08-platform-sources/live-commerce-sources.md`
- `docs/agents/08-platform-sources/webinar-and-event-sources.md`
- `docs/agents/08-platform-sources/creator-live-cam-sources.md`
- `docs/agents/08-platform-sources/popout-chat-only-sources.md`
- `docs/agents/08-platform-sources/event-and-community-sources.md`
- `docs/agents/08-platform-sources/independent-live-platform-sources.md`
- `docs/agents/08-platform-sources/video-broadcast-platform-sources.md`
- `docs/agents/08-platform-sources/community-membership-webapp-sources.md`
- `docs/agents/08-platform-sources/regional-and-emerging-platform-sources.md`
- `docs/agents/08-platform-sources/special-case-platform-and-helper-sources.md`
- `docs/agents/09-api-and-integrations/index.md`
- `docs/agents/13-reference/free-paid-and-support-boundaries.md`
- `docs/agents/13-reference/modes-and-capability-matrix.md`
- `docs/agents/13-reference/settings-and-toggles.md`
- `docs/agents/13-reference/feature-support-decision-matrix.md`
- `docs/agents/13-reference/public-claims-boundary-matrix.md`

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

Support answers should keep those claims scoped. "Most platforms" and "100+" are broad public claims; exact platform and exact feature support should be checked against `public-claims-boundary-matrix.md`, the current source inventory, source file, and mode docs.

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
| Multi-platform chat capture | Yes | Platform page access, correct source mode, source visibility, source toggles for sensitive pages | `08-platform-sources/public-site-support-status.md` |
| Communication/private page capture | Depends | Web version, source toggle where required, page reload, visible chat/meeting panel, and privacy redaction | `08-platform-sources/communication-and-sensitive-sources.md` |
| Embedded chat widget capture | Depends | Exact widget URL, iframe/all-frame behavior, loaded widget, and new rendered messages | `08-platform-sources/embedded-chat-widget-sources.md` |
| Live-commerce capture | Depends | Live shopping URL, chat visibility, source-specific auction/product/viewer events, and separate product-list display routing | `08-platform-sources/live-commerce-sources.md` |
| Webinar/event page capture | Depends | Exact event URL, visible chat/Q&A/sidebar, source-specific relayed type behavior, and no assumed analytics/send-back | `08-platform-sources/webinar-and-event-sources.md` |
| Creator/live-cam page capture | Depends | Exact room/chat URL, visible chat panel, new rendered rows, source-specific token/tip/private-message handling, and no assumed send-back | `08-platform-sources/creator-live-cam-sources.md` |
| Popout/chat-only platform capture | Depends | Exact popout/chat-only URL, loaded chat list, new rendered rows, and source-specific donation/viewer-count limits | `08-platform-sources/popout-chat-only-sources.md` |
| Event/community page capture | Depends | Exact event/community URL, visible chat/comment/Q&A panel, new rows, and source-specific viewer/donation/type behavior | `08-platform-sources/event-and-community-sources.md` |
| Independent live platform capture | Depends | Exact platform URL, visible chat panel, new rows, and source-specific viewer/tip/reply/join/content-image behavior | `08-platform-sources/independent-live-platform-sources.md` |
| Video/broadcast platform capture | Depends | Exact video/chat URL, visible chat panel, new rows, and source-specific Q&A/upstream-type/source-icon/login behavior | `08-platform-sources/video-broadcast-platform-sources.md` |
| Community/membership web-app capture | Depends | Exact member/community/workspace URL, access state, visible message panel, source toggle where required, and privacy redaction | `08-platform-sources/community-membership-webapp-sources.md` |
| Regional/emerging platform capture | Depends | Exact URL form, visible chat/activity panel, new rows, and source-specific viewer/tip/raid/join behavior | `08-platform-sources/regional-and-emerging-platform-sources.md` |
| Special-case platform/helper routing | Depends | Exact mode: rendered site, source-page/API, static/manual helper, or helper copy | `08-platform-sources/special-case-platform-and-helper-sources.md` |
| Dock/dashboard | Yes | Matching session ID, API/server toggles for remote clients | `07-overlays-and-pages/dock.md` |
| Featured chat overlay | Yes | OBS browser source, matching session ID, dock selection or auto-show settings | `07-overlays-and-pages/featured.md` |
| OBS/browser overlays | Yes | Browser-source URL, transparency/CSS, refresh behavior, local-file limitations | `10-troubleshooting/obs-overlay-display.md` |
| Prebuilt visual themes | Yes | Correct theme family, session, source side, and OBS/local-file behavior | `07-overlays-and-pages/theme-pages.md` |
| Two-way chat sending | Partly, by platform/mode | Platform login/auth, source mode, API permissions, platform limits | Platform doc plus `modes-and-capability-matrix.md` and `08-platform-sources/websocket-source-pages.md` for source-page modes |
| Built-in chat commands | Yes, when enabled | Popup toggles, user permissions, API/OBS settings for some commands | `13-reference/commands-and-actions.md` |
| Auto-responder and fixed messages | Yes | Trigger settings, interval settings, source/mode restrictions | `settings-and-toggles.md` |
| Webhooks and external API | Yes | Remote API toggles, session secrecy, external endpoint/security setup | `09-api-and-integrations/websocket-http-api.md` |
| StreamDeck/Companion control | Yes | API control enabled, module/button setup | `09-api-and-integrations/streamdeck-companion.md` |
| Streamer.bot integration | Yes | Streamer.bot setup, SSN API/WebSocket routes | `09-api-and-integrations/streamerbot.md` |
| Event Flow automation | Yes | Flow setup, enabled triggers/actions, current event payload support | `09-api-and-integrations/event-flow-editor.md` |
| System/browser TTS | Yes | Browser/system voice availability, OBS audio capture | `09-api-and-integrations/tts.md` |
| Cloud/provider TTS | SSN integration is included | Provider account, API key, cost/quota, privacy review | `09-api-and-integrations/tts.md` |
| AI chatbot/moderation/cohost | SSN integration is included | Local model or provider account/API key, prompts/settings, privacy review | `09-api-and-integrations/ai-features.md` |
| AI cohost stage and generated overlays | SSN integration is included | Correct page pair, session, label, Private Chat Bot/provider, and OBS audio if speaking | `07-overlays-and-pages/ai-cohost-pages.md` |
| Polls, waitlist, giveaway, games | Yes | Page-specific setup, URL parameters, OBS/browser-source workflow, and game-specific command/input rules | `07-overlays-and-pages/waitlist-polls-games.md` plus `07-overlays-and-pages/game-pages.md` |
| Tip jar and credits roll | Yes | Donation/supporter source data, page open, session, and persistence choices | `07-overlays-and-pages/tipjar-credits.md` |
| Event dashboard, hype counts, word cloud, leaderboard, and confetti | Yes | Correct event/chat/waitlist/viewer-count payloads, page open, session, and page-specific filters/persistence | `07-overlays-and-pages/event-effect-overlays.md` |
| Emotes, reactions, scoreboard, ticker, and map utilities | Yes | Matching chat/event/ticker/location payloads, page open, session, and page-specific URL options | `07-overlays-and-pages/live-display-utilities.md` |
| Specialized/legacy overlay pages | Depends | Page-specific purpose: redirect helper, alert skin, YouTube-style renderer, or product-list display | `07-overlays-and-pages/specialized-legacy-pages.md` |
| Diagnostic, replay, recovery, import, and helper pages | Yes | Correct helper page, session handling, local storage/history privacy, and target page open when sending test data | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| Spotify now-playing overlay | Depends/External | Spotify payload sender plus matching SSN session/label | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| StreamElements/Streamlabs widget import | Depends/Dev | Widget files, importer conversion, exported HTML file, and OBS/browser validation | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| Tool/page capability routing | Yes | Correct page, source side, session, and page-specific dependencies | `07-overlays-and-pages/page-capability-matrix.md` |
| Multi-alerts | Yes | Alert routing, page URL, supported event payloads | `07-overlays-and-pages/multi-alerts.md` |
| Custom CSS | Yes | OBS custom CSS, URL encoding, local/hosted page choice | `07-overlays-and-pages/custom-overlays.md` |
| Custom JavaScript/user functions | Yes, trusted-user customization | Local/hosted context, security review, exact hook behavior | `13-reference/custom-plugins-and-extensions.md` |
| Custom overlays | Yes | WebSocket/VDO.Ninja/session connection code, payload handling | `07-overlays-and-pages/custom-overlays.md` |
| New platform/source development | Open source contribution path | Source script, manifest/docs updates, compatibility testing | `12-development/adding-a-source.md` |
| Desktop app managed source windows | Standalone app feature | Electron app install, app-specific OAuth/source behavior | `04-standalone-app-source-windows.md` |
| Browser extension capture | Extension feature | Browser permissions, reload after install, platform page visible | `03-extension-architecture.md` |
| Manual/static platform helpers | Depends | Source-specific toggle, page state, brittle platform DOM, or paired content script | `08-platform-sources/manual-static-and-helper-sources.md` |
| WebSocket/API source pages | Depends | Source page, auth/token/channel setup, app/extension bridge, and platform API/socket availability | `08-platform-sources/websocket-source-pages.md` |

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
- Static/manual helper sources can modify a page, add manual send buttons, collect points, scout IDs, or intercept WebSockets without being normal chat parsers.
- WebSocket/API source pages can expose richer events for some platforms but require page setup and sometimes auth/API support. Use `08-platform-sources/websocket-source-pages.md` for grouped source-page behavior and the platform docs for YouTube/Twitch/Kick/Rumble/Facebook.
- Communication/private sources capture rendered web pages, not platform bot APIs; use `08-platform-sources/communication-and-sensitive-sources.md` and avoid send-back claims unless a current source-control path is verified.
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
5. `08-platform-sources/websocket-source-pages.md` if it is a source-page/API/socket workflow.
6. `08-platform-sources/communication-and-sensitive-sources.md` if it is a private chat, meeting, or assistant page source.
7. `08-platform-sources/embedded-chat-widget-sources.md` if it is CBOX, Chatroll, KiwiIRC, QuakeNet, Minnit, or Online Church.
8. `08-platform-sources/live-commerce-sources.md` if it is Amazon Live, eBay Live, or Whatnot.
9. `08-platform-sources/webinar-and-event-sources.md` if it is Crowdcast, Livestorm, Livestream.com, ON24, Riverside, Sessions, Wave Video, or WebinarGeek.
10. `08-platform-sources/creator-live-cam-sources.md` if it is Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, or Stripchat.
11. `08-platform-sources/popout-chat-only-sources.md` if it is Beamstream, BoltPlus, Chzzk, FloatPlane, GoodGame, Mixcloud, Nimo, Odysee, Parti, Picarto, Piczel, RokFin, Rutube, SoopLive, or VK chat-only capture.
12. `08-platform-sources/event-and-community-sources.md` if it is Arena Social, Buzzit, CI.ME, Gala Music, LinkedIn Events, LivePush, MegaphoneTV, QuickChannel, Slido, or TradingView.
13. `08-platform-sources/independent-live-platform-sources.md` if it is BandLab, Bigo.tv, Bitchute, Blaze, Castr, Cherry TV, CloutHub, Cozy.tv, DLive, Estrim, FC2, Jaco.live, LFG.tv, Locals.com, or Loco.gg.
14. `08-platform-sources/video-broadcast-platform-sources.md` if it is Mixlr, NicoVideo, NonOLive, OpenStreamingPlatform, Owncast, PeerTube, Restream.io Chat, Steam Broadcasts, Trovo, Truffle.vip, TwitCasting, Vimeo, YouNow, or Zap.stream.
15. `08-platform-sources/community-membership-webapp-sources.md` if it is Circle.so, MeetMe, NextCloud, Patreon, Roll20, Simps, Tellonym, Whop, Wix Live/widgets, or Workplace legacy routing.
16. `08-platform-sources/regional-and-emerging-platform-sources.md` if it is Bilibili DOM paths, Favorited, Kwai, Pilled, Portal, Pump.fun, Retake, Rooter, SharePlay, SoulBound, Stream.place, Substack, Tikfinity, uScreen, VK Live, or Xeenon.
17. `08-platform-sources/special-case-platform-and-helper-sources.md` if it is Joystick, Velora, VPZone, X live/static split, Vertical Pixel Zone, Vercel Demo, or top-level YouTube helper copies.
18. Existing platform-specific agent page, if present.

If the platform is listed only as "manual", "popout", "toggle-required", or "websocket", include that mode in the answer.

### Can SSN reply/send chat back?

Sometimes. It depends on platform, mode, auth, and current implementation. Do not promise two-way send for a platform without checking its source doc/code. DOM capture, WebSocket source, API mode, and app OAuth mode can have different capabilities.

### Can SSN moderate chat?

It has filtering, block/allow lists, event filters, command controls, and AI/censor-bot settings. For exact moderation behavior, source-check the setting and processing path before saying it deletes, hides, blocks, or only suppresses display.

### Can SSN run a chatbot?

Yes, but it is optional and settings-driven. It may require local AI setup or a third-party API key, depending on provider. Check LLM provider settings, chatbot trigger settings, custom knowledge/RAG settings, and privacy expectations.

For cohost stage output or generated AI overlays, use `07-overlays-and-pages/ai-cohost-pages.md` to choose between `cohost.html`, `cohost-overlay.html`, `aiprompt.html`, and `aioverlay.html`.

### Can SSN read chat aloud?

Yes. Free browser/system TTS and multiple provider-backed TTS paths exist. If the user wants OBS to capture the audio, check whether the chosen TTS mode outputs through the browser page, system audio, or provider playback path.

### Can SSN make a custom overlay?

Yes. Start with CSS/URL parameters for simple visual changes, prebuilt themes for a different look, `sampleoverlay`/custom overlay docs for full custom rendering, and API/WebSocket docs for external apps. Avoid telling normal users to edit core source files unless they are explicitly developing/forking.

For existing themes, use `07-overlays-and-pages/theme-pages.md` to choose between normal chat themes, featured-message style themes, wrapper themes, and package themes.

### Can SSN make a plugin?

Be precise. SSN supports scriptable/custom behavior through custom JS hooks, custom overlays, API clients, Event Flow, uploaded custom user functions, and custom platform sources. It does not currently have a normal-user packaged plugin marketplace flow documented as the primary path.

### Can SSN do giveaways, polls, timers, queues, games, credits, or tip jars?

Yes, through separate overlay/tool pages. These are not all controlled by the same popup setting. Start with `07-overlays-and-pages/page-capability-matrix.md`, then check the specific page docs and URL parameters.

For chat games, use `07-overlays-and-pages/game-pages.md`. `games.html` is the Spam Power chat-activity game, while `games/*.html` pages have individual command or input rules. Most games reset on reload; Spam Power, Chicken Royale, and Phrase Guess have localStorage-backed state.

For event logs, hype/viewer counters, waitlist confetti, word clouds, and leaderboards, use `07-overlays-and-pages/event-effect-overlays.md`. These pages need the matching payload family; for example, a word cloud needs `chatmessage`, hype needs viewer-count style payloads, and confetti needs waitlist draw winner state.

For floating emotes, reaction bursts, points scoreboards, ticker text, and viewer-location maps, use `07-overlays-and-pages/live-display-utilities.md`. These pages are payload-specific and should not be treated as generic chat overlays.

For `chat-overlay.html`, `minecraft.html`, `septapus.html`, and `shop_the_stream.html`, use `07-overlays-and-pages/specialized-legacy-pages.md`. These pages are wrappers, skins, custom renderers, or experimental display utilities, not source integrations.

For helper pages such as `createtestmessage.html`, `simple_api_client.html`, `replaymessages.html`, `recover.html`, `urleditor.html`, `streamelements-importer.html`, `spotify-overlay.html`, and `test-giveaway-webrtc.html`, use `07-overlays-and-pages/diagnostic-helper-pages.md`. Most are not production OBS outputs; `spotify-overlay.html` and the exported importer HTML are the main output exceptions.

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
- Intense validation of `07-overlays-and-pages/page-capability-matrix.md` and `07-overlays-and-pages/game-pages.md` for polls, waitlist, giveaway, games, credits, tip jar, multi-alerts, Event Flow output, AI/cohost pages, and custom overlays.
- Runtime/source promotion of broad public claims in `public-claims-boundary-matrix.md` against current source inventory and real workflows.
