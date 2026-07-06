# SSN Documentation Extraction Checklist

Last updated on 2026-06-24.

## Purpose

Use this file to track which source files and support datasets have been processed for the SSN AI documentation set. The goal is to support multiple AI passes without redoing the same work or skipping important resource areas.

Only write extraction notes and status changes inside `C:\Users\steve\Code\social_stream\docs\agents`.

## Extraction Levels

### Quick

Use quick extraction when the goal is coverage and orientation.

Record:

- What the file/dataset is for
- Major concepts, pages, features, or workflows
- Obvious links to planned docs
- Any high-risk unknowns needing deeper review

Expected output: short notes, source map entries, and candidate doc sections.

### Heavy

Use heavy extraction when a source is important to product behavior or user support.

Record:

- Function/page/component responsibilities
- Message flows, settings, storage, APIs, URL params, and runtime boundaries
- User setup steps
- Common failure modes
- Chrome extension vs standalone app differences
- Source-backed claims with file references

Expected output: usable topic documentation.

### Intense

Use intense extraction for source-of-truth behavior, fragile integrations, or high-volume support issues.

Record:

- Line-level behavior and key state transitions
- Edge cases, retries, fallbacks, cleanup, persistence, and security boundaries
- Cross-checks against current code, existing docs, tests, and support history
- Known stale/historical claims
- Repro or validation notes when practical

Expected output: final-grade documentation and troubleshooting pages.

## Status Values

Use these labels in pass notes:

- `not-started`
- `quick-complete`
- `heavy-complete`
- `intense-complete`
- `needs-refresh`
- `blocked`
- `skip`

## Pass Log

Add one entry per extraction pass.

| Date | Agent | Scope | Level | Output files | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-06-23 | Codex | Initial repo/support inventory | Quick | `00-inventory-and-plan.md`, `01-extraction-checklist.md`, `02-resource-manifest.md` | quick-complete | Created tracker and manifest. No detailed extraction yet. |
| 2026-06-23 | Codex | Documentation framework and starter pages | Quick | Topic files under `01-*` through `12-*`, `_templates/`, `99-agent-index.md` | quick-complete | Created starter files and section scaffolds. Detailed extraction still not started. |
| 2026-06-24 | Codex | Backbone architecture, flow, storage, and triage notes | Heavy | `03-extension-architecture.md`, `04-standalone-app-architecture.md`, `05-message-flow-and-event-contracts.md`, `06-settings-sessions-and-storage.md`, `10-troubleshooting/quick-triage.md`, `AGENT.md`, `99-agent-index.md` | heavy-complete | First source-backed pass using manifest, service worker, background, app preload/state/main notes, and support history. Needs field-level/intense passes later. |
| 2026-06-24 | Codex | Priority platform sources: YouTube, TikTok, Twitch, Kick | Heavy | `08-platform-sources/index.md`, `youtube.md`, `tiktok.md`, `twitch.md`, `kick.md`, `99-agent-index.md` | heavy-complete | Added source-backed capture modes, setup notes, payload/event notes, app-vs-extension differences, support failures, and deeper extraction targets. |
| 2026-06-24 | Codex | Product map, install surfaces, API, common FAQ, custom/source development | Heavy | `01-product-map.md`, `02-installation-and-surfaces.md`, `09-api-and-integrations/websocket-http-api.md`, `11-support-kb/common-questions.md`, `08-platform-sources/generic-and-custom-sources.md`, `12-development/adding-a-source.md`, indexes | heavy-complete | Source-backed pass using README, api.md, parameters.md, commands docs, download docs, site metadata, manifest/source patterns, custom script templates, and sample WSS source. Support DB mining remains pending. |
| 2026-06-24 | Codex | Overlay pages, TTS, AI, OBS, StreamDeck/Companion, capture/display troubleshooting | Heavy | `07-overlays-and-pages/dock.md`, `featured.md`, `07-overlays-and-pages/index.md`, `09-api-and-integrations/tts.md`, `ai-features.md`, `obs.md`, `streamdeck-companion.md`, `10-troubleshooting/extension-not-capturing.md`, `obs-overlay-display.md`, indexes | heavy-complete | Added source-backed setup modes, command/control references, free-vs-paid AI/TTS boundaries, OBS audio/control notes, and troubleshooting matrices. Needs line-level behavior and support DB mining later. |
| 2026-06-24 | Codex | Support KB mining method, historical issue map, stale-claim register, platform known-issue matrix | Heavy | `11-support-kb/mining-method.md`, `historical-issues.md`, `unresolved-or-stale-claims.md`, `support-source-map.md`, `10-troubleshooting/platform-known-issues.md`, indexes | heavy-complete | Safe support-source pass using curated instructions, generated top issues, Q&A exports, playbooks, SQLite schemas/counts, and topic-frequency queries. Raw archive was schema/count checked only; no raw conversation extraction. |
| 2026-06-24 | Codex | Desktop app issues, auth/sign-in, settings loss and backups | Heavy | `10-troubleshooting/desktop-app-issues.md`, `auth-and-sign-in.md`, `settings-loss-and-backups.md`, indexes | heavy-complete | Source-backed pass using `ssapp/main.js`, `state.js`, OAuth handlers, backup/transfer modules, and settings diagnostics. Does not include real in-app/e2e testing. |
| 2026-06-24 | Codex | Event Flow, Streamer.bot, Rumble, Facebook, Instagram, Discord | Heavy | `09-api-and-integrations/event-flow-editor.md`, `streamerbot.md`, `08-platform-sources/rumble.md`, `facebook.md`, `instagram.md`, `discord.md`, indexes | heavy-complete | Source-backed pass using Event Flow editor/system/tests/guides, Streamer.bot setup page, Rumble DOM/API bridge, Facebook DOM/Graph bridge, Instagram live/feed scripts, and Discord content script. Needs line-level/intense validation later. |
| 2026-06-24 | Codex | Multi-alerts, waitlist/polls/timer/giveaway/games, custom overlays | Heavy | `07-overlays-and-pages/multi-alerts.md`, `waitlist-polls-games.md`, `custom-overlays.md`, indexes | heavy-complete | Source-backed pass using `multi-alerts.*`, `waitlist.html`, `poll.html`, `timer.html`, `giveaway*.html`, `games.html`, `docs/customoverlays.md`, `sampleoverlay.html`, and `api.md`. Needs command-handler and game rendering validation later. |
| 2026-06-24 | Codex | Development repo map, shared code rules, testing, build/release boundaries | Heavy | `12-development/index.md`, `repo-map.md`, `shared-code-rules.md`, `testing-and-validation.md`, `build-and-release-boundaries.md`, `99-agent-index.md` | heavy-complete | Source-backed pass using `social_stream/AGENTS.md`, `manifest.json`, package scripts, `ssapp/AGENTS.md`, `ssapp/package.json`, `ssapp/RELEASE.md`, and app resource notes. |
| 2026-06-24 | Codex | Cross-cutting reference pages for commands, URL options, modes, costs, plugin paths, and support resources | Heavy | `13-reference/index.md`, `commands-and-actions.md`, `url-parameters.md`, `modes-and-capability-matrix.md`, `free-paid-and-support-boundaries.md`, `custom-plugins-and-extensions.md`, `support-resources-and-escalation.md`, `99-agent-index.md` | heavy-complete | Source-backed reference pass using README, `api.md`, `parameters.md`, `docs/commands.html`, support/download/guides pages, custom script templates, source/dev docs, and current agent pages. Needs line-level/intense validation against command handlers, settings definitions, and page-specific parameter parsing. |
| 2026-06-24 | Codex | Supported-site and source inventory | Heavy | `08-platform-sources/source-inventory.md`, `08-platform-sources/index.md`, `99-agent-index.md`, `01-extraction-checklist.md` | heavy-complete | Parsed `docs/js/sites.js`, `manifest.json`, `sources/*.js`, `sources/static/*`, `sources/inject/*`, and `sources/websocket/*` into counts and public setup groups. Needs generated manifest-to-site mapping and health/status reconciliation later. |
| 2026-06-24 | Codex | Generated settings, toggles, URL parameter counts, and feature capability map | Heavy | `13-reference/settings-and-toggles.md`, `features-and-capabilities.md`, `13-reference/index.md`, `11-support-kb/common-questions.md`, indexes | heavy-complete | Parsed `shared/config/settingsDefinitions.js` and `shared/config/urlParameters.js`; mapped 327 popup settings, 255 generated URL parameters, generated setting categories, and public feature families from `docs/features.html`. Needs line-level storage/live-update/app-parity validation later. |
| 2026-06-24 | Codex | Manifest source-load matrix and provider/shared utility map | Heavy | `08-platform-sources/manifest-content-scripts.md`, `12-development/provider-cores-and-shared-utils.md`, indexes | heavy-complete | Parsed `manifest.json` content-script buckets, special `document_start`/`all_frames` entries, web-accessible provider/shared resources, and provider-core exports for Kick, Twitch, and YouTube. Needs curated public-site mapping and adapter/event-payload tracing later. |
| 2026-06-24 | Codex | Public supported-site lookup and common how-to recipes | Heavy | `08-platform-sources/supported-sites-lookup.md`, `13-reference/how-to-recipes.md`, indexes | heavy-complete | Extracted the 139 public site cards from `docs/js/sites.js` into setup-type lookup tables and added task recipes for installation, source capture, OBS/featured, dock operation, styling, TTS, AI, API, StreamDeck, webhooks, custom overlays, custom JS, new sources, and troubleshooting. Needs tested, UI-label-verified user-facing recipe pass later. |
| 2026-06-24 | Codex | Public docs coverage and stale-risk map | Heavy | `11-support-kb/public-docs-coverage.md`, `99-agent-index.md`, `01-extraction-checklist.md` | heavy-complete | Inventoried public `docs/*.html`, `docs/*.md`, `docs/md/*.md`, docs data/scripts, and mapped canonical references, summary docs, generated indexes, stale-risk rules, and current agent-doc coverage. Needs claim-by-claim reconciliation against code later. |
| 2026-06-24 | Codex | Generated setting-key and URL-parameter lookup indexes | Heavy | `13-reference/settings-key-index.md`, `13-reference/url-parameter-index.md`, indexes | heavy-complete | Extracted 327 setting keys and 255 URL parameter entries/aliases from shared config. Needs UI-label, live-update, page-specific parameter, and app-parity verification later. |
| 2026-06-24 | Codex | Generated metadata focused validation for settings, URL parameters, and public site cards | Heavy/focused validation | `18-focused-validation-evidence-log.md`, `13-reference/settings-and-toggles.md`, `settings-key-index.md`, `url-parameter-index.md`, `08-platform-sources/supported-sites-lookup.md`, `public-site-implementation-map.md`, validation docs | needs-refresh | Read-only inline Node checker confirmed 327 settings, 54 setting categories, 255 URL parameter items, 23 URL parameter sections, 139 public site cards, and no missing required fields. Findings: duplicate URL aliases for `password` and normalized `strokecolor`, plus duplicate public `On24`/`ON24` cards. Not runtime-tested. |
| 2026-06-24 | Codex | Agent docs navigation and link audit | Quick/focused docs audit | `19-navigation-and-link-audit.md`, `AGENT.md`, `99-agent-index.md`, `01-extraction-checklist.md`, ledger/audit updates | quick-complete | Read-only inline Node audit now finds 158 Markdown files, zero unreferenced non-template pages, zero broken exact agent-doc Markdown refs, and zero ambiguous bare section-index filenames after sitemap cleanup. Wildcard section references remain intentional. Not product runtime validation. |
| 2026-06-24 | Codex | Static docs viewer and folder sitemaps | Quick/Heavy documentation navigation pass | `docs/index.html`, `docs/agents/SITEMAP.md`, section `docs/agents/*/SITEMAP.md` files, `AGENT.md`, indexes/ledger/audit updates | quick-complete | Replaced the redirecting public docs index with a client-side Markdown viewer modeled after the VDO.Ninja docs page. Added grep-free sitemap Markdown files for `docs/agents` root and every immediate subfolder, then refreshed the navigation audit. Browser smoke passed for default doc load, deep link load, section sitemap link traversal, raw link state, sidebar filter, and zero console errors. |
| 2026-06-24 | Codex | Resource processing ledger | Quick | `02-resource-processing-ledger.md`, indexes | quick-complete | Added a resource-group ledger that separates inventory-only, quick, heavy, intense-needed, and skip coverage so future passes can avoid repeating broad scans. |
| 2026-06-24 | Codex | Source file processing matrix | Quick | `08-platform-sources/source-file-processing-matrix.md`, indexes | quick-complete | Generated a file-level matrix for 143 top-level source scripts, 6 static helpers, 3 injected helpers, 14 WebSocket source scripts, and 20 WebSocket assets. Public site-card matches are heuristic; future new rows should get quick extraction before detailed answers. |
| 2026-06-24 | Codex | Full manifest row matrix | Quick | `08-platform-sources/manifest-row-matrix.md`, indexes | quick-complete | Generated all 155 manifest content-script rows with script bucket, match count, flags, sample match, and public routing hints. Public site/type hints still need curation before exact support claims. |
| 2026-06-24 | Codex | Action and command lookup index | Heavy | `13-reference/action-command-index.md`, `13-reference/index.md`, `commands-and-actions.md`, indexes | heavy-complete | Added a lookup for public API actions, channel content actions, waitlist/poll/timer/tip/map actions, featured/dock actions, background/internal actions, viewer chat commands, and Event Flow action/trigger types. Rare/internal actions still need line-level validation before public recipes. |
| 2026-06-24 | Codex | Feature support decision matrix | Heavy | `13-reference/feature-support-decision-matrix.md`, `features-and-capabilities.md`, indexes | heavy-complete | Added an answer-ready yes/depends/external/dev matrix for common feature support questions, surfaces, costs, and high-risk claims. Needs per-platform capability verification later. |
| 2026-06-24 | Codex | Support answer bank | Heavy | `11-support-kb/support-answer-bank.md`, `common-questions.md`, indexes | heavy-complete | Added concise answer patterns for product basics, install/update, capture troubleshooting, platform triage, OBS/overlays, API/commands, TTS/AI, customization/development, settings/URL parameters, security/privacy, and escalation. Needs future refresh from curated support mining and source validation. |
| 2026-06-24 | Codex | Platform capability matrix | Heavy | `08-platform-sources/platform-capability-matrix.md`, `08-platform-sources/index.md`, `13-reference/feature-support-decision-matrix.md`, `13-reference/modes-and-capability-matrix.md`, indexes | heavy-complete | Added per-platform and setup-type routing for chat capture, rich events, send-back, app differences, first support checks, and high-risk claims. Needs line-level validation for send-back, moderation, app parity, and exact event fields. |
| 2026-06-24 | Codex | Standalone app source windows and app parity | Heavy | `04-standalone-app-source-windows.md`, `04-standalone-app-architecture.md`, `10-troubleshooting/desktop-app-issues.md`, reference indexes | heavy-complete | Added app source-window lifecycle, source state fields, session bindings, Electron window behavior, `window.ninjafy` bridge, source injection/fallback routing, app-vs-extension parity matrix, and support answer patterns. Needs real Electron in-app/e2e validation and line-level renderer event tracing. |
| 2026-06-24 | Codex | Public site support-status layer | Heavy | `08-platform-sources/public-site-support-status.md`, `supported-sites-lookup.md`, `08-platform-sources/index.md`, reference/support indexes | heavy-complete | Added support-strength levels for public site listings, setup-type status matrix, dedicated-doc routing, public-list oddities, safe answer boundaries, app/browser boundaries, and evidence needed before marking a site broken. Needs exact public-site-to-manifest-to-source generation and current health validation. |
| 2026-06-24 | Codex | SSN glossary | Heavy | `13-reference/glossary.md`, `13-reference/index.md`, `01-extraction-checklist.md`, `99-agent-index.md` | heavy-complete | Added concise definitions and routing for common ambiguous terms: source, dock, session, command, plugin, WSS, Event Flow, custom source, send-back, rich events, public listing, and secrets. Needs UI-label and support-transcript synonym pass later. |
| 2026-06-24 | Codex | Surface URL cheat sheet | Heavy | `13-reference/surface-url-cheatsheet.md`, reference/support/overlay/API indexes | heavy-complete | Added fast URL/page routing for dock, featured, multi-alerts, actions/Event Flow, waitlist, poll, timer, giveaway, tip jar, credits, TTS/AI pages, sample API/overlay, HTTP/WebSocket API endpoints, and WebSocket source pages. Needs generated page-by-page parameter and channel validation. |
| 2026-06-24 | Codex | Overlay/tool page capability routing | Heavy | `07-overlays-and-pages/page-capability-matrix.md`, overlay/reference/support/API indexes | heavy-complete | Added cross-page capability, OBS/API/Event Flow dependency, state, and first-failure matrix for dock, featured, alerts, actions, waitlist, poll, timer, giveaway, tip jar, credits, sample overlay/API, Streamer.bot, AI/cohost, battle, and game pages. Needs generated per-page parameter/channel/storage validation. |
| 2026-06-24 | Codex | Overlay/tool page processing matrix | Quick | `07-overlays-and-pages/page-processing-matrix.md`, overlay/resource indexes | quick-complete | Added file-level extraction-depth tracking for 70 root HTML files, 18 theme pages, 17 game pages, and Event Flow files, with inventory-only flags and next-pass priorities. |
| 2026-06-24 | Codex | Tip jar and credits pages | Heavy | `07-overlays-and-pages/tipjar-credits.md`, overlay/reference/support indexes | heavy-complete | Source-backed pass for `tipjar.html` and `credits.html`: transport, URL options, commands, donation/supporter processing, persistence, controls, sorting, and first-failure checks. Needs popup/API command sender, `currency.js`, OBS, and e2e validation. |
| 2026-06-24 | Codex | AI/cohost pages and generated overlay runtime | Heavy | `07-overlays-and-pages/ai-cohost-pages.md`, overlay/API/reference/support indexes | heavy-complete | Source-backed pass for `cohost.html`, `cohost-overlay.html`, `aiprompt.html`, `aioverlay.html`, background bridge actions, and AI prompt overlay storage. Needs dock right-click command, local model worker, and rendered OBS validation. |
| 2026-06-24 | Codex | Event/effect overlay pages | Heavy | `07-overlays-and-pages/event-effect-overlays.md`, overlay/reference/support indexes | heavy-complete | Source-backed pass for `events.html`, `hype.html`, `confetti.html`, `wordcloud.html`, and `leaderboard.html`: transport, URL options, payload families, filters, local state/persistence, and first-failure checks. Needs controlled payload and OBS validation. |
| 2026-06-24 | Codex | Live display utility pages | Heavy | `07-overlays-and-pages/live-display-utilities.md`, overlay/reference/support indexes | heavy-complete | Source-backed pass for `emotes.html`, `reactions.html`, `scoreboard.html`, `ticker.html`, and `map.html`: transport, URL options, payload families, filters, commands, local state, and first-failure checks. Scoreboard later received a narrow controlled browser validation pass; the other pages still need controlled payload validation and all live display utilities still need OBS validation. |
| 2026-06-24 | Codex | Specialized and legacy root pages | Heavy | `07-overlays-and-pages/specialized-legacy-pages.md`, overlay/reference/support indexes | heavy-complete | Source-backed pass for `chat-overlay.html`, `minecraft.html`, `septapus.html`, and `shop_the_stream.html`: redirect/runtime role, alert skin behavior, YouTube-style renderer, direct WebSocket product-list behavior, URL parameters, caveats, and support routing. Needs controlled runtime validation. |
| 2026-06-24 | Codex | Diagnostic, helper, replay, import, and Spotify pages | Heavy | `07-overlays-and-pages/diagnostic-helper-pages.md`, overlay/reference/support indexes | heavy-complete | Source-backed pass for `createtestmessage.html`, `simple_api_client.html`, `replaymessages.html/js`, `recover.html`, `urleditor.html`, `streamelements-importer.html/js`, `spotify-overlay.html`, and `test-giveaway-webrtc.html`: roles, URL params, transports, storage/privacy, output boundaries, caveats, and first-failure checks. Needs controlled browser/OBS validation. |
| 2026-06-24 | Codex | Individual chat game pages | Heavy | `07-overlays-and-pages/game-pages.md`, overlay/reference/support indexes | heavy-complete | Source-backed pass for `games.html` and 17 `games/*.html` pages: URL shapes, commands/input rules, storage exceptions, transport/channel differences, bot-response caveats, and first-failure checks. Needs controlled browser/OBS validation and exact parameter generation. |
| 2026-06-24 | Codex | Theme pages and featured-style overlays | Heavy | `07-overlays-and-pages/theme-pages.md`, overlay/reference/support indexes | heavy-complete | Source-backed pass for 41 `themes/**/*.html` pages and theme README files: chat themes, featured-message styles, wrapper themes, package themes, params, bridge modes, OBS/local-file caveats, and first-failure checks. Needs browser/OBS render validation and exact parameter generation. |
| 2026-06-24 | Codex | Static/manual/helper source scripts | Heavy | `08-platform-sources/manual-static-and-helper-sources.md`, source matrix/index/ledger/support/reference updates | heavy-complete | Source-backed pass for `sources/static/*`, `sources/inject/*`, `sources/autoreload.js`, `sources/capturevideo.js`, `sources/grabvideo.js`, and paired StreamElements/VPZone/Whatnot consumers. Separates normal chat parsers from manual/static helpers, Kick scout, Twitch points/ad helper, YouTube watch-page helper, VDO media publishing, and main-world WebSocket interceptors. Needs live browser validation. |
| 2026-06-24 | Codex | WebSocket/API source pages | Heavy | `08-platform-sources/websocket-source-pages.md`, source matrix/index/ledger/support/reference updates | heavy-complete | Source-backed grouped pass for `sources/websocket/bilibili.*`, `irc.*`, `joystick.*`, `nostr.*`, `socialstreamchat.*`, `stageten.*`, `streamlabs.*`, `velora.*`, `vpzone.*`, and shared WebSocket assets. Existing YouTube/Twitch/Kick/Rumble/Facebook source pages remain routed to their platform docs. Needs line-level send-back, auth, app parity, reconnect, CORS, and payload validation. |
| 2026-06-24 | Codex | Communication and sensitive source scripts | Heavy | `08-platform-sources/communication-and-sensitive-sources.md`, source matrix/index/ledger/support/reference updates | heavy-complete | Source-backed grouped pass for ChatGPT/OpenAI, Slack, Telegram, WhatsApp, Google Meet, Microsoft Teams, Zoom, Webex, and Amazon Chime. Needs live browser validation, send-back/background path verification, opt-in toggle checks, and privacy-safe support-history mining. |
| 2026-06-24 | Codex | Embedded chat widget source scripts | Heavy | `08-platform-sources/embedded-chat-widget-sources.md`, source matrix/index/ledger/support/reference updates | heavy-complete | Source-backed grouped pass for CBOX, Chatroll, KiwiIRC, QuakeNet, Minnit Chat, and Online Church. Needs live browser validation, Minnit public URL wording check, QuakeNet parser/debug-log review, Online Church viewer-update samples, and send-back/background path verification. |
| 2026-06-24 | Codex | Live-commerce source scripts | Heavy | `08-platform-sources/live-commerce-sources.md`, source matrix/index/ledger/support/reference updates | heavy-complete | Source-backed grouped pass for Amazon Live, eBay Live, Whatnot, and Whatnot WebSocket interception. Needs live browser validation, eBay auction/commerce/follower payload samples, Whatnot WebSocket frame samples, product-list overlay routing validation, and send-back/background path verification. |
| 2026-06-24 | Codex | Webinar and event source scripts | Heavy | `08-platform-sources/webinar-and-event-sources.md`, source matrix/index/ledger/support/reference updates | heavy-complete | Source-backed grouped pass for Crowdcast, Livestorm, Livestream.com, ON24, Riverside, Sessions.us, Wave Video, and WebinarGeek. Needs live browser validation, ON24 Q&A samples, Wave Video source-type samples, Riverside setting validation, WebinarGeek selector review, and send-back/background path verification. |
| 2026-06-24 | Codex | Creator/live-cam source scripts | Heavy | `08-platform-sources/creator-live-cam-sources.md`, source matrix/index/ledger/support/reference updates | heavy-complete | Source-backed grouped pass for Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, and Stripchat. Needs live browser validation, token/tip samples, private-message/notice privacy review, hidden-tab behavior checks, app parity validation, and send-back/background path verification. |
| 2026-06-24 | Codex | Popout and chat-only source scripts | Heavy | `08-platform-sources/popout-chat-only-sources.md`, source matrix/index/ledger/support/reference updates | heavy-complete | Source-backed grouped pass for Beamstream, BoltPlus, Chzzk, FloatPlane, GoodGame, Mixcloud, Nimo, Odysee, Parti, Picarto, Piczel, RokFin, Rutube, SoopLive, VK Video, and older VK Play parser routing. Needs live browser validation, exact popout URL checks, donation/viewer-count samples, and app parity validation. |
| 2026-06-24 | Codex | Event and community source scripts | Heavy | `08-platform-sources/event-and-community-sources.md`, source matrix/index/ledger/support/reference updates | heavy-complete | Source-backed grouped pass for Arena Social, Buzzit, CI.ME, Gala Music, LinkedIn Events, LivePush, MegaphoneTV, QuickChannel, Slido, and TradingView. Needs live browser validation, Slido Q&A samples, CI.ME donation/viewer samples, LivePush relayed type samples, LinkedIn path validation, and MegaphoneTV source identity review. |
| 2026-06-24 | Codex | Independent live platform source scripts | Heavy | `08-platform-sources/independent-live-platform-sources.md`, source matrix/index/ledger/support/reference updates | heavy-complete | Source-backed grouped pass for BandLab, Bigo.tv, Bitchute, Blaze, Castr, Cherry TV, CloutHub, Cozy.tv, DLive, Estrim, FC2, Jaco.live, LFG.tv, Locals.com, and Loco.gg. Needs live browser validation, Blaze/LFG/Locals viewer/tip samples, Cherry joined/gift row review, DLive public routing reconciliation, and app parity validation. |
| 2026-06-24 | Codex | Video/broadcast platform source scripts | Heavy | `08-platform-sources/video-broadcast-platform-sources.md`, source matrix/index/ledger/support/reference updates | heavy-complete | Source-backed grouped pass for Mixlr, NicoVideo, NonOLive, OpenStreamingPlatform, Owncast, PeerTube, Restream.io Chat, Steam Broadcasts, Trovo, Truffle.vip, TwitCasting, Vimeo, YouNow, and Zap.stream. Needs live browser validation, Vimeo Q&A samples, Truffle upstream type samples, Restream source-icon samples, PeerTube login tests, Trovo public routing reconciliation, and app parity validation. |
| 2026-06-24 | Codex | Community/membership web-app source scripts | Heavy | `08-platform-sources/community-membership-webapp-sources.md`, source matrix/index/ledger/support/reference updates | heavy-complete | Source-backed grouped pass for Circle.so, MeetMe, NextCloud, Patreon, Roll20, Simps, Tellonym, Whop, Wix Live/widgets, and Workplace legacy routing. Needs live browser validation, Patreon toggle/viewer samples, Simps/Whop viewer samples, Wix frame validation, NextCloud domain scope validation, Workplace routing review, and app parity validation. |
| 2026-06-24 | Codex | Regional/emerging platform source scripts | Heavy | `08-platform-sources/regional-and-emerging-platform-sources.md`, source matrix/index/ledger/support/reference updates | heavy-complete | Source-backed grouped pass for Bilibili DOM paths, Favorited, Kwai, Pilled, Portal, Pump.fun, Retake, Rooter, SharePlay, SoulBound, Stream.place, Substack, Tikfinity, uScreen, VK Live, and Xeenon. Needs live browser validation, Bilibili URL-variant checks, SharePlay shoutout/Blitz samples, Tikfinity payload samples, Stream.place relay samples, and inactive viewer helper review. |
| 2026-06-24 | Codex | Special-case platform/helper source scripts | Heavy | `08-platform-sources/special-case-platform-and-helper-sources.md`, source matrix/index/ledger/support/reference updates | heavy-complete | Source-backed pass for Joystick DOM chat, Velora DOM chat/activity, Vercel demo session helper, Vertical Pixel Zone, VPZone rendered/WS-intercepted site capture, X live/broadcast chat, and unmanifested top-level YouTube helper copies. Needs live validation for mode splits, source identity, X URL variants, VPZone duplicate suppression, and YouTube helper load status. |
| 2026-06-24 | Codex | Support KB index and first-answer router | Heavy | `11-support-kb/index.md`, support/reference/checklist/ledger indexes | heavy-complete | Added a support section map, first-answer router, triage evidence checklist, privacy rules, support-history source priority, and follow-up extraction needs. |
| 2026-06-24 | Codex | Support evidence ledger | Heavy | `11-support-kb/support-evidence-ledger.md`, support/source-map/ledger/reference indexes | heavy-complete | Added support claim families with evidence labels, docs that use each claim, next validation targets, promotion rules, and next extraction targets. |
| 2026-06-24 | Codex | Common question coverage map | Heavy | `11-support-kb/common-question-coverage-map.md`, support/reference/ledger indexes | heavy-complete | Added objective-level coverage routing for product, cost, modes, sources, troubleshooting, overlays, commands, options, AI/TTS, integrations, customization, development, and platform-specific question families. |
| 2026-06-24 | Codex | Support response playbook | Heavy | `11-support-kb/support-response-playbook.md`, support/reference/ledger indexes | heavy-complete | Added ready-to-send support answer templates for free/cost, app-vs-extension, install/update, capture failure, OBS blank, supported sites, rich events/send-back, URLs/pages, commands/API, settings/options, plugins/customization, AI/TTS, app issues, stale claims, and bug reports. |
| 2026-06-24 | Codex | Diagnostic decision tree | Heavy | `10-troubleshooting/diagnostic-decision-tree.md`, troubleshooting/support/reference/ledger indexes | heavy-complete | Added symptom-to-branch routing for capture/source, routing/session, overlay/OBS display, control/API/send-back, standalone app/auth, settings/options, customization/development, escalation, and minimal evidence collection. |
| 2026-06-24 | Codex | Workflow setup decision tree | Heavy | `13-reference/workflow-setup-decision-tree.md`, reference/support/ledger indexes | heavy-complete | Added setup-choice routing from user goal to source side, receiving page, transport, options, common setup paths, anti-patterns, and final setup validation checklist. |
| 2026-06-24 | Codex | Common misconceptions and boundaries | Heavy | `11-support-kb/common-misconceptions-and-boundaries.md`, support/reference/ledger indexes | heavy-complete | Added common overclaim guardrails for supported-site meaning, app-vs-extension parity, app login limits, dock/OBS diagnosis, API command targets, settings vs URL params, costs, secrets, private captures, plugin meaning, fallback edits, testing language, and support-history freshness. |
| 2026-06-24 | Codex | Agent entry guide refresh | Heavy | `AGENT.md`, `99-agent-index.md`, `01-extraction-checklist.md` | heavy-complete | Replaced early first-pass guidance with current navigation, support/setup/troubleshooting entry points, answer workflow, source-check expectations, and validation-state warnings. |
| 2026-06-24 | Codex | Validation and refresh roadmap | Quick | `14-validation-and-refresh-roadmap.md`, `AGENT.md`, `99-agent-index.md`, `02-resource-processing-ledger.md`, `01-extraction-checklist.md` | quick-complete | Added a central queue for remaining source-check, line-level, browser, app, OBS, and support-history validation passes, plus pass protocol and evidence labels. |
| 2026-06-24 | Codex | Support intake templates | Heavy | `11-support-kb/support-intake-templates.md`, support/reference/index/checklist updates | heavy-complete | Added copyable intake and repro templates for vague reports, no chat, OBS blanks, listed site issues, send-back, API commands, settings, standalone app, AI/TTS, customization, bug reports, and redaction examples. |
| 2026-06-24 | Codex | Preflight and maintenance checklists | Heavy | `13-reference/preflight-checklists.md`, support/reference/index/checklist updates | heavy-complete | Added before-first-setup, before-stream, after-update, standalone app, OBS, API/automation, AI/TTS, customization, safe-support-pack, and avoid-first-step checklists. |
| 2026-06-24 | Codex | Privacy, security, and secrets | Heavy | `13-reference/privacy-security-and-secrets.md`, support/reference/index/checklist updates | heavy-complete | Added centralized guidance for URL/log/screenshot/settings sharing, session IDs, webhook spoofing risk, provider keys, private source families, API/custom-code safety, support-history privacy, and secret leak response. |
| 2026-06-24 | Codex | API command examples | Heavy | `13-reference/api-command-examples.md`, command/API/support/index/checklist updates | heavy-complete | Added safe HTTP, WebSocket, JSON, page-label, dock/featured, waitlist, poll, timer, channel-content, moderation/user-tool, viewer-command, Event Flow, and common-failure examples with secret-handling warnings. |
| 2026-06-24 | Codex | Install, update, and version guide | Heavy | `13-reference/install-update-version-guide.md`, install/support/preflight/settings/index/checklist updates | heavy-complete | Added install path choice, safe update flows, settings-safe rules, version mismatch symptoms, update intake, user-facing patterns, and bad-answer guardrails. |
| 2026-06-24 | Codex | URL option examples | Heavy | `13-reference/url-option-examples.md`, URL/support/index/checklist updates | heavy-complete | Added safe page URL examples for OBS chat overlays, featured messages, filters, operator/queue/helper modes, themes, event/utility pages, tip jar/credits, TTS, API/server labels, CSS/customization, and common URL failures. |
| 2026-06-24 | Codex | Customization and plugin recipes | Heavy | `13-reference/customization-plugin-recipes.md`, reference/support/checklist/ledger updates | heavy-complete | Added recipe-style routing for URL/CSS, themes, custom overlays, `custom.js`, custom user functions, API/WebSocket apps, Event Flow, first-class sources, sharing custom work, failure checks, intake questions, and bad-answer guardrails. |
| 2026-06-24 | Codex | Stevesbot support resource inventory | Quick/Heavy | `11-support-kb/stevesbot-resource-inventory.md`, support-source-map, mining-method, ledger, indexes | quick-complete | Classified curated support docs, SQLite DBs, alternate resource DB, QA exports, mined JSONL, transcripts, replays, attachments, imports, backups, logs, and secrets by extraction depth, safety risk, and future mining order. |
| 2026-06-24 | Codex | Command/action source trace | Intense source-check | `13-reference/command-action-source-trace.md`, command/API/support/roadmap/ledger indexes | source-check-complete | Traced background API actions, dock/featured/poll/timer/waitlist page handlers, Event Flow actions, send-back routing, callbacks, high-risk examples, and remaining runtime validation needs. No HTTP/WebSocket/app/OBS runtime validation performed. |
| 2026-06-24 | Codex | URL parameter source trace | Intense source-check | `13-reference/url-parameter-source-trace.md`, URL/reference/API/support/roadmap/ledger indexes | source-check-complete | Traced page-specific URL parsers and socket branches for dock, featured, waitlist, poll, timer, giveaway, sample pages, actions, tip jar, credits, events, hype, word cloud, leaderboard, emotes, reactions, scoreboard, ticker, and map. No browser/WebSocket/app/OBS runtime validation performed. |
| 2026-06-24 | Codex | Root page URL parameter matrix | Quick generated-source inventory | `13-reference/root-page-url-parameter-matrix.md`, URL/reference/roadmap/ledger indexes | quick-complete | Scanned 70 root `*.html` files, identified 50 pages with URL parser markers or literal parameter reads, and listed detected literal parameters. Does not include themes, games, WebSocket source pages, or runtime validation. |
| 2026-06-24 | Codex | Theme/game/WebSocket URL parameter matrix | Quick generated-source inventory | `13-reference/subpage-url-parameter-matrix.md`, URL/reference/roadmap/ledger indexes | quick-complete | Scanned 41 theme HTML pages, 17 game HTML pages, and 14 WebSocket source HTML pages for literal URL parameter reads. No runtime validation performed. |
| 2026-06-24 | Codex | SSN support topic frequency index | Quick support-history pass | `11-support-kb/support-topic-frequency-index.md`, support index/source-map/mining-method/ledger updates | quick-complete | Counted SSN-filtered topic buckets from the latest curated QA export without copying raw conversations. Counts are directional and require current source validation before support claims are promoted. |
| 2026-06-24 | Codex | Settings, session, and storage source trace | Intense source-check | `13-reference/settings-session-storage-source-trace.md`, settings/support/roadmap/ledger/checklist/index updates | source-check-complete | Traced extension sync/local storage split, background load/save/migration, popup generated links, Electron popup shim, app `socialStreamState`, cached-state downgrade guards, settings backup format, localStorage mirror keys, and reset boundaries. No Chrome/app/e2e/runtime validation performed. |
| 2026-06-24 | Codex | Public site implementation map | Heavy generated-source inventory | `08-platform-sources/public-site-implementation-map.md`, platform/reference/support/roadmap/ledger/checklist indexes | heavy-complete | Mapped all 139 public site cards from `docs/js/sites.js` to current source files, source-page assets, manifest row IDs, grouped routing docs, and stale-risk notes. No live/platform/app/browser validation performed. |
| 2026-06-24 | Codex | Question intent router | Heavy support-routing pass | `11-support-kb/question-intent-router.md`, support/reference/agent/checklist/index updates | heavy-complete | Added plain-language user wording routes for common SSN questions covering product basics, installs, capture, supported sites, modes, commands, API, URL options, settings, feature support, AI/TTS, plugins/customization, privacy, and escalation. This is routing guidance, not runtime validation. |
| 2026-06-24 | Codex | Support question phrasebook | Heavy support-history wording pass | `11-support-kb/support-question-phrasebook.md`, support/reference/agent/checklist/index updates | heavy-complete | Added paraphrased support-history wording patterns from curated support docs, summarized support records, mined topic counts, and current agent docs. Covers app-vs-extension, dock/overlay/OBS, OAuth ports, source activation, Twitch/Kick events, TikTok, YouTube, Instagram, TTS/AI, privacy, plugins, language, and settings phrasing. No raw transcripts copied and no runtime validation performed. |
| 2026-06-24 | Codex | Objective coverage and readiness audit | Heavy coverage audit | `15-objective-coverage-and-readiness-audit.md`, agent/reference/support/checklist/index updates | heavy-complete | Mapped Steve's broad AI-docs objective to current docs, evidence strength, answer-readiness labels, completion proof requirements, and highest-value remaining work. This is a coverage/readiness audit, not proof of full runtime completion. |
| 2026-06-24 | Codex | Control surface crosswalk | Heavy reference disambiguation pass | `13-reference/control-surface-crosswalk.md`, support/reference/agent/checklist/audit updates | heavy-complete | Added a crosswalk that separates viewer commands, API actions, URL parameters, popup settings, sessions, labels, modes, source pages, Event Flow, custom JS, custom overlays, and custom sources. This is disambiguation guidance, not runtime validation. |
| 2026-06-24 | Codex | Runtime validation playbooks | Heavy validation-planning pass | `16-runtime-validation-playbooks.md`, roadmap/audit/testing/agent/index/checklist/ledger updates | heavy-complete | Added concrete runtime validation recipes and evidence templates for commands/API, URL parameters, settings/storage, public supported-site health, standalone app source windows/auth, OBS overlays, Event Flow/Streamer.bot/StreamDeck/OBS control, TTS/AI, and support claim promotion. These are future validation instructions, not runtime validation results. |
| 2026-06-24 | Codex | Existing test and validation assets | Heavy inventory/routing pass | `12-development/test-asset-matrix.md`, development/reference/agent/checklist/ledger/runtime-playbook updates | heavy-complete | Mapped current `social_stream` npm test aliases, direct Node tests, browser fixture pages, Playwright scripts, static-server helper, setup risks, and feature-to-test routing. This is a test asset inventory, not evidence that the tests were run. |
| 2026-06-24 | Codex | Standalone app TikTok connector | Heavy app-source pass | `08-platform-sources/tiktok-standalone-app.md`, platform/support/reference/checklist/ledger updates | heavy-complete | Mapped app TikTok modes, state fields, connection lifecycle, virtual tabs, signing, fallback paths, replies, event families, regression assets, and support triage from `ssapp/tiktok/*`, `ssapp/tiktok-signing/*`, and `ssapp/tests/tiktok/*`. No live TikTok or Electron e2e runtime validation performed. |
| 2026-06-24 | Codex | Command/API validation matrix | Heavy source-check pass | `13-reference/api-command-validation-matrix.md`, API/reference/roadmap/checklist/ledger updates | heavy-complete | Source-checked service-worker handoff, background `/api` and `/dock` sockets, bridge request handling, P2P target routing, page handlers, callbacks, false positives, and send-back gates. No hosted API, browser, OBS, or app runtime validation performed. |
| 2026-06-24 | Codex | API command proof ledger | Heavy command evidence-ledger pass | `13-reference/api-command-proof-ledger.md`, command/reference/support/checklist/ledger updates | heavy-complete | Added source-backed evidence labels, claim ledger, minimum proof packs, and update rules for command/API claims, including relay acceptance, target-page action, send-back, callbacks, numbered content channels, Event Flow, and StreamDeck/Companion paths. No runtime validation performed. |
| 2026-06-24 | Codex | Settings change impact matrix | Heavy source-check pass | `13-reference/settings-change-impact-matrix.md`, settings/support/reference/roadmap/checklist/ledger updates | heavy-complete | Source-checked popup save/session flows, generated links, page URL parsers, app source state, app cached-state guards, settings backups, and reload/reconnect boundaries. No Chrome/app/OBS/runtime validation performed. |
| 2026-06-24 | Codex | Options and settings proof ledger | Heavy options/settings evidence-ledger pass | `13-reference/options-settings-proof-ledger.md`, URL/settings/support/checklist/ledger/index updates | heavy-complete | Added source-backed evidence labels, claim ledger, minimum proof packs, and update rules for URL options, popup settings, generated links, session/password changes, app state, provider/auth settings, page-local state, and duplicate metadata findings. No runtime validation performed. |
| 2026-06-24 | Codex | Customization path decision matrix | Heavy source-check pass | `13-reference/customization-path-decision-matrix.md`, customization/reference/support/checklist/ledger/index updates | heavy-complete | Source-checked URL/CSS, themes, custom overlays, local `custom.js`, uploaded custom user functions, API/WebSocket external sources, Event Flow, and first-class source boundaries. No runtime validation performed. |
| 2026-06-24 | Codex | Customization validation ledger | Heavy customization evidence-ledger pass | `13-reference/customization-validation-ledger.md`, reference/support/audit/checklist/ledger updates | heavy-complete | Added source-backed evidence labels, claim ledger, minimum proof packs, and update rules for plugin/customization paths, including local `custom.js`, uploaded custom user functions, custom overlays, API/WebSocket external sources, Event Flow, and first-class source work. No runtime validation performed. |
| 2026-06-24 | Codex | Public feature/support claim boundary matrix | Heavy source-check pass | `13-reference/public-claims-boundary-matrix.md`, reference/support/audit/checklist/ledger updates | heavy-complete | Reconciled broad public wording from README, features, supported-sites, support, services, app, TTS/local-TTS, API, and parameter docs with agent support/reference docs. No runtime validation performed. |
| 2026-06-24 | Codex | Feature, cost, and public claim proof ledger | Heavy evidence-ledger pass | `13-reference/feature-cost-claims-proof-ledger.md`, reference/support/audit/checklist/ledger updates | heavy-complete | Added evidence labels, claim ledger, minimum proof packs, and do-not-promise boundaries for feature, cost, provider, support, service, app-vs-extension, public site count, AI/TTS/RAG, app, plugin/customization, API, and option/setting claims. No runtime validation performed. |
| 2026-06-24 | Codex | Common question fast-path matrix | Heavy support-routing pass | `11-support-kb/common-question-fast-path.md`, support/reference/audit/checklist/ledger updates | heavy-complete | Added compact answer-shape, must-check, and do-not-say routing for common SSN questions across product basics, cost, support, sites, modes, app, OBS, commands, API, URL parameters, settings, plugins/customization, source development, AI/TTS, privacy, bug reports, and testing claims. No runtime validation performed. |
| 2026-06-24 | Codex | Curated support macro routing | Quick/Heavy support-macro pass | `11-support-kb/support-macro-routing.md`, support-source-map, stevesbot inventory, support/reference/checklist/ledger updates | quick/heavy-complete | Filtered safe curated macro playbooks down to SSN-relevant intake, safety/refusal, overlay blank, TikTok blank, Twitch auth, transparent overlay, platform-change, API no-op, app, AI/TTS, plugin, and escalation packet routing. VDO.Ninja-only macros were not imported except where OBS/TTS context overlaps SSN. No runtime validation performed. |
| 2026-06-24 | Codex | Common question evidence status | Heavy evidence-status pass | `11-support-kb/common-question-evidence-status.md`, support/reference/audit/checklist/ledger updates | heavy-complete | Added evidence-strength and runtime-proof status labels for common SSN answer families, separating answer-ready orientation, source-backed, generated inventory, source-trace, support-derived, runtime-needed, and runtime-tested claims. No runtime validation performed. |
| 2026-06-24 | Codex | Common question proof pack | Heavy support-evidence routing pass | `11-support-kb/common-question-proof-pack.md`, support/reference/audit/checklist/ledger updates | heavy-complete | Added evidence requirements and minimum proof artifacts for stronger answers about common SSN questions: product/cost/support, sites, platform features, app/extension modes, install/update, troubleshooting, OBS, commands/API, URL options, settings, customization/plugins, new sources, AI/TTS/RAG, privacy, and testing claims. No runtime validation performed. |
| 2026-06-24 | Codex | Common question test set | Heavy support-routing benchmark pass | `11-support-kb/common-question-test-set.md`, support/index/sitemap/ledger/audit updates | heavy-complete | Added benchmark-style test prompts for product/cost/support, install/modes, source capture, platform behavior, commands/API, URL/settings/sessions, overlays/pages, AI/TTS/RAG, customization/plugins/development, privacy, and testing claims. Each row records expected first doc, secondary proof docs, required caveat, and fail condition. This validates answer routing only, not product runtime behavior. |
| 2026-06-24 | Codex | Support history refresh playbook | Heavy support-refresh workflow pass | `11-support-kb/support-history-refresh-playbook.md`, support indexes/ledger/audit updates | heavy-complete | Added a safe repeatable support-history refresh workflow with aggregate SQLite query pack, current seed counts from `knowledge.sqlite` and `stevesbot.sqlite`, latest QA export reference, raw archive gate, stale-claim decision tree, and required downstream doc updates. Counts are priority signals only, not runtime/product proof. |
| 2026-06-24 | Codex | App, extension, and mode crosswalk | Heavy support-routing/reference pass | `13-reference/app-extension-mode-crosswalk.md`, support/reference indexes/checklist/ledger/audit updates | heavy-complete | Added first-stop routing for Chrome extension vs standalone app vs hosted pages, local pages, Lite, Firefox, WebSocket/API source pages, and custom sources. Includes safe answer rules, surface matrix, app-vs-extension decision matrix, common confusion points, troubleshooting routes, recommended answer shapes, and overclaim guardrails. Not runtime-tested. |
| 2026-06-24 | Codex | Priority platform answer matrix | Heavy support-routing/platform pass | `08-platform-sources/priority-platform-answer-matrix.md`, platform/support indexes/checklist/ledger/audit updates | heavy-complete | Added safe support phrasing and first-check routing for YouTube, TikTok, Twitch, Kick, Rumble, Facebook, Instagram, and Discord. The pass source-grepped send-back, source-control, auth/token, and rich-event terms, but did not perform live platform, app, or OBS testing. |
| 2026-06-24 | Codex | Priority platform validation ledger | Heavy platform evidence-ledger pass | `08-platform-sources/priority-platform-validation-ledger.md`, platform/support indexes/checklist/ledger/audit updates | heavy-complete | Added per-platform evidence labels, claim ledger, minimum proof packs, and update rules for high-risk YouTube, TikTok, Twitch, Kick, Rumble, Facebook, Instagram, and Discord support claims. This is not runtime validation. |
| 2026-06-24 | Codex | Scoreboard controlled browser validation | Runtime browser validation | `17-runtime-validation-evidence-log.md`, `07-overlays-and-pages/live-display-utilities.md`, `07-overlays-and-pages/page-capability-matrix.md`, checklist/ledger/audit/index updates | browser-validated-partial | Ran `node scripts/playwright-scoreboard-e2e.cjs`; result `PASS scoreboard e2e`. Validated local headless Chromium behavior for `scoreboard.html` preview-mode points snapshot rendering, `maxusers`, `minpoints`, layout/theme/title/subtitle, local `chatpoints`, `donationpoints`, `customtriggers`, compact layout, and `hidepoints`. Did not test OBS, hosted page, extension/app bridge, live source payloads, WebSocket/server modes, session/password/label routing, or persistence. |
| 2026-06-24 | Codex | Reactions overlay controlled browser validation | Runtime browser validation | `17-runtime-validation-evidence-log.md`, `07-overlays-and-pages/live-display-utilities.md`, `07-overlays-and-pages/page-capability-matrix.md`, checklist/ledger/audit/index updates | browser-validated-partial | Ran `node scripts/playwright-reactions-overlay-e2e.cjs`; result `Reactions overlay test passed with 12 blocked external request(s).` Validated controlled local headless Chromium behavior for popup-generated reactions URL parameters, `reactions.html` option parsing, synthetic VDO bridge liked payloads, direct reaction/liked payload rendering, inline image scaling, fake server-mode joins, and controlled TikTok-like target routing. Did not test OBS, hosted page, real extension runtime, real VDO bridge, real relay delivery, live TikTok/platform behavior, standalone app, or long-running persistence. |
| 2026-06-24 | Codex | Multi-alerts controlled browser validation attempt | Runtime browser validation attempt | `17-runtime-validation-evidence-log.md`, `07-overlays-and-pages/multi-alerts.md`, `07-overlays-and-pages/page-capability-matrix.md`, checklist/ledger/audit/index updates | validation-failed | Ran `node scripts/playwright-multi-alerts-overlay-e2e.cjs`; result failed with `frame.waitForFunction: Timeout 30000ms exceeded` at `waitForPreviewFrame` while waiting for the preview iframe to expose `window.__multiAlertsOverlay.getSettings`. Do not promote multi-alert render, queue, filter, audio, or server-mode behavior to browser-validated from this run. |
| 2026-06-24 | Codex | Event Flow focused Node tests | Focused deterministic validation | `18-focused-validation-evidence-log.md`, `09-api-and-integrations/event-flow-editor.md`, `13-reference/customization-path-decision-matrix.md`, checklist/ledger/audit/index updates | focused-node-test-complete | Ran `node tests/eventflow-customjs.test.js`, `node tests/eventflow-compare-property.test.js`, `node tests/eventflow-template-vars.test.js`, and `node tests/eventflow-play-media-duration.test.js`; results were 23/0, 18/0, 6/0, and 2/0 passed/failed. Supports Event Flow internal custom JS, compare-property, template/counter, OBS system trigger, and play-media duration claims only. Does not validate editor UI, Flow Actions overlay, OBS, extension runtime, app runtime, live source payloads, or external integration actions. |
| 2026-06-24 | Codex | Twitch provider, local TTS, and local AI focused Node tests | Focused deterministic validation | `18-focused-validation-evidence-log.md`, `08-platform-sources/twitch.md`, `09-api-and-integrations/tts.md`, `09-api-and-integrations/ai-features.md`, `13-reference/free-paid-and-support-boundaries.md`, `11-support-kb/common-question-evidence-status.md`, checklist/ledger/audit/index updates | focused-node-test-partial | Ran `node tests/twitch-chatClient-subgift.test.js`, `node tests/kokoro-local-assets.test.js`, `node tests/piper-local-assets.test.js`, `node tests/kitten-tts-assets.test.js`, and `node tests/transformers-local-defaults.test.js`. Twitch, Kokoro, Kitten, and Transformers passed. Piper failed on the expected `FALLBACK_REMOTE_PIPER_BASE` string. These are static/provider focused checks only, not live platform, audio, model-runtime, OBS, app, or extension validation. |
| 2026-06-24 | Codex | RAG focused browser fixture and benchmark tests | Focused deterministic validation | `18-focused-validation-evidence-log.md`, `09-api-and-integrations/ai-features.md`, `12-development/test-asset-matrix.md`, checklist/ledger/audit/index updates | focused-browser-fixture-complete | Ran `npm run test:rag:benchmark` and `npm run test:rag:e2e`; results were `PASS rag benchmark` and `PASS rag e2e`. Benchmark fixture loaded 6 docs/3 processed chunks with 10/10 retrieval top1, 10/10 retrieval topK, and 8/8 question accuracy. E2E fixture verified seeded docs, descriptor generation, exact/fuzzy search, answer/abstain behavior, prompt placeholder replacement, and reload persistence. `test:rag:scale` was not run because it writes `tests/artifacts/rag-scale-benchmark-latest.json`. This does not validate real upload/delete/provider/popup/app/extension/OBS workflows. |
| 2026-06-24 | Codex | AI moderation, local model registry, and OpenCode Zen fallback focused tests | Focused deterministic validation | `18-focused-validation-evidence-log.md`, `09-api-and-integrations/ai-features.md`, `12-development/test-asset-matrix.md`, `13-reference/free-paid-and-support-boundaries.md`, support evidence docs, checklist/ledger/audit/index updates | focused-node-test-complete | Ran `node tests/profanity-filter.test.js`, `node tests/moderation-regressions.test.js`, `node tests/local-browser-model-registry.test.js`, and `node tests/opencode-zen-fallback.test.js`. Results: profanity dataset loaded 743 words to 18467 variations; moderation regression passed; local model registry passed 28 printed checks; OpenCode Zen fallback exited successfully. Skipped Qwen browser eval scripts because they launch persistent browser contexts and/or write `tests/artifacts`. This does not validate live moderation quality, model download/runtime, provider availability/pricing, popup/cohost UI, extension/app runtime, or OBS. |
| 2026-06-24 | Codex | AI prompt builder focused browser smoke test | Focused deterministic validation | `18-focused-validation-evidence-log.md`, `07-overlays-and-pages/ai-cohost-pages.md`, `09-api-and-integrations/ai-features.md`, `12-development/test-asset-matrix.md`, checklist/ledger/audit/index updates | focused-browser-smoke-complete | Ran `npm run test:aiprompt:smoke`; result `aiprompt.html smoke test passed.` Supports local headless Chromium behavior for `aiprompt.html` startup, mocked bridge sync, seeded templates, template modal, unique page names, delete focus, code/preview tabs, preview payload handling, `textonly` HTML behavior, mocked chatbot response settling, and builder localStorage migration/sync paths. Skipped conversation/expectations scripts because they call a live LLM endpoint by default; skipped fake integrations script because it deletes `debug.log` in the repo root. This does not validate live LLM generation, real extension sync, app behavior, `aioverlay.html`, OBS, or generated overlay quality. |
| 2026-06-24 | Codex | Settings config JSON validation | Focused config validation | `18-focused-validation-evidence-log.md`, `13-reference/settings-and-toggles.md`, `12-development/test-asset-matrix.md`, checklist/ledger updates | focused-config-validation-complete | Ran `bash scripts/validate-configs.sh`; validated `settings/config_0.json`, `settings/config_linux_0.json`, and `settings/config_mac_0.json`, with final output `All config JSON files are valid.` This checks JSON syntax and duplicate keys only. It does not validate generated settings definitions, popup UI, storage, migration, app behavior, generated links, or live setting changes. |

## Master Checklist

### Product And Existing Docs

- [x] Quick: `social_stream/README.md`, `about.md`, `ai.md`
- [x] Quick: resource processing ledger linking manifests, pass logs, source groups, and support data coverage
- [x] Quick: validation and refresh roadmap for remaining source-check, intense, browser, app, OBS, and support-history passes
- [x] Quick: navigation/link audit for agent Markdown discoverability and exact agent-doc reference resolution
- [x] Heavy: runtime validation playbooks for final-grade command/option/source/app/OBS/integration/provider/support-claim evidence
- [x] Runtime partial: evidence log entries for narrow controlled browser validation of `scoreboard.html` and `reactions.html`
- [x] Focused validation: evidence log entries for settings config JSON, generated settings/URL/public-site metadata, Event Flow, Twitch provider, AI prompt builder, AI moderation, local model registry, provider fallback, local TTS, local AI, and RAG tests that are useful but not full runtime validation
- [x] Heavy: current `AGENT.md` operating guide for the docs workspace
- [x] Heavy: product surfaces, install modes, extension/app differences
- [x] Heavy: install/update/version decision guide with safe update and settings-preservation rules
- [x] Heavy: public feature/support claim boundary matrix for 100+/120+ site counts, free/cost, two-way chat, no API keys, AI/TTS, app, plugin, service, and support promises
- [x] Heavy: feature, cost, and public claim proof ledger for source-backed, generated-inventory, focused-tested, provider-current-needed, runtime-needed, and do-not-promise claims
- [ ] Intense: verify all claims against current code and public docs

- [x] Quick: `social_stream/api.md`, `parameters.md`, `docs/event-reference.html`
- [x] Heavy: API commands, URL params, event schema, message payload contract
- [x] Heavy: exact action-name lookup for API/page/background/Event Flow command systems
- [x] Heavy: safe API command examples for HTTP, WebSocket, JSON payloads, labels, page actions, and common failures
- [x] Intense source-check: command/action source trace for background API, dock/featured/page handlers, Event Flow action execution, send-back routing, and callback caveats
- [x] Heavy: command/API accepted-vs-acted-on validation matrix for service worker, background sockets, bridge requests, page handlers, callbacks, and send-back gates
- [x] Heavy: safe URL option examples for overlay pages, filters, themes, TTS, labels, server modes, and common failures
- [x] Intense source-check: page-specific URL parameter parser trace, `server`/`server2`/`server3` caveats, label overloads, and boolean parsing differences
- [x] Quick: root page URL parameter matrix for detected literal params in 70 root `*.html` files
- [x] Quick: theme, game, and WebSocket source page URL parameter matrix
- [x] Heavy: cross-topic reference pages for command/action buckets, URL parameter families, mode selection, free/paid boundaries, plugin/custom paths, and support resources
- [x] Heavy: generated setting category map, popup/URL setting distinction, and broad feature/capability routing
- [x] Heavy: answer-ready feature support decision matrix with yes/depends/external/dev statuses
- [x] Heavy: exact generated popup setting-key and URL-parameter lookup indexes
- [x] Focused validation: generated settings, URL parameter, and public-site metadata structural check completed with duplicate metadata findings
- [x] Intense source-check: settings/session/storage source trace for extension sync/local split, popup generated links, app cached-state backups, and settings-loss guardrails
- [x] Heavy: settings change impact matrix for popup settings, URL params, generated links, app source state, page-local state, provider/auth values, and reload/reconnect boundaries
- [x] Heavy: options/settings proof ledger for source-backed, generated-inventory, focused-config-check, runtime-needed, and do-not-promise claims
- [x] Heavy: common how-to recipes for setup, OBS, overlays, TTS, AI, API, custom behavior, source development, and troubleshooting
- [x] Heavy: recipe-style customization/plugin guide for choosing URL/CSS, themes, custom overlays, custom JS, API apps, Event Flow, or first-class sources
- [x] Heavy: customization path decision matrix for URL/CSS, themes, custom overlays, local `custom.js`, uploaded custom user functions, API apps, Event Flow, and first-class source work
- [x] Heavy: customization validation ledger for source-backed, focused-tested, runtime-needed, and do-not-promise plugin/customization claims
- [x] Heavy: glossary for common SSN terms and ambiguous support wording
- [x] Heavy: surface URL cheat sheet for choosing SSN pages, endpoints, and source pages
- [x] Heavy: workflow setup decision tree for choosing source side, receiver, transport, and options by user goal
- [x] Heavy: preflight and maintenance checklists for stream-day, update, app, OBS, API, AI/TTS, customization, and support-pack workflows
- [x] Heavy: centralized privacy/security/secrets reference for URLs, sessions, webhooks, keys, settings exports, logs, and private source evidence
- [x] Heavy: page capability matrix for overlay/tool/API/Event Flow/OBS dependencies and first failure checks
- [ ] Intense: field-by-field payload and command behavior with source references

- [x] Quick: `social_stream/docs/*.html`, `social_stream/docs/*.md`
- [x] Heavy: public docs coverage map and stale-claim review
- [x] Heavy: public site-card to source-file/manifest-row implementation map
- [x] Heavy: support answer bank for common support-response patterns
- [x] Heavy: support KB section index and first-answer router
- [x] Heavy: common question fast-path matrix for answer shape, must-check docs, and overclaims to avoid
- [x] Heavy: common question evidence-status ledger for answer confidence and runtime-proof boundaries
- [x] Heavy: support evidence ledger for common support claims and validation targets
- [x] Heavy: common question coverage map tied to the overall SSN AI-docs objective
- [x] Heavy: support response playbook with ready-to-send templates and safe follow-up questions
- [x] Heavy: support intake/repro templates with redaction-safe evidence collection
- [x] Heavy: question intent router from common user wording to canonical docs
- [x] Heavy: support question phrasebook with paraphrased real-world wording patterns
- [x] Quick/Heavy: SSN-filtered support macro routing from curated support playbooks
- [x] Heavy: objective coverage and readiness audit mapping requested deliverables to current docs
- [x] Heavy: command/option/setting/mode/source/plugin control-surface crosswalk
- [x] Heavy: API command proof ledger for source-backed, focused-doc-check, runtime-needed, and do-not-promise command/API claims
- [x] Heavy: diagnostic decision tree for vague or mixed troubleshooting symptoms
- [x] Quick/Heavy: `stevesbot` support archive inventory with safe/skip groups, raw/private boundaries, and extraction depth labels
- [x] Quick: SSN-filtered support topic frequency index from latest curated QA export
- [x] Heavy: common misconceptions and support-boundary guardrails
- [ ] Intense: only for docs that are canonical source references

### Extension Runtime

- [ ] Quick: `manifest.json`, `service_worker.js`, `background.html`, `background.js`
- [ ] Heavy: extension lifecycle, background routing, storage, source capture, messaging
- [ ] Intense: source-to-dock message flow and external API behavior

- [x] Heavy: manifest content-script buckets, source-load flags, and helper/source-page classification

- [x] Quick: `popup.html`, `popup.js`, `settings/*`, `shared/config/*`
- [x] Heavy: settings UI, storage keys, session/password behavior, generated parameter docs
- [x] Intense source-check: settings migration, sync/local behavior, app cached-state backup boundaries, and app parity risks
- [x] Heavy source-check: practical change-impact routing for settings, generated links, URL params, app source state, cached state, and reload/reconnect boundaries
- [x] Focused validation: `settings/config*.json` files passed JSON and duplicate-key validation
- [ ] Runtime/app/browser validation: settings migration, live update behavior, app export/import/reset, and app parity

### Shared Pages And Overlays

- [x] Quick: `dock.html`, `featured.html`, `multi-alerts.*`, `tts.*`
- [x] Quick: root overlay/tool page, theme page, game page, and Event Flow file processing-depth matrix
- [x] Heavy: dock controls, featured overlay, alert routing, TTS behavior, waitlist/poll/timer/giveaway/games, and custom overlays
- [x] Heavy: tip jar and credits page behavior, persistence, commands, filters, and first checks
- [x] Heavy: AI/cohost page routing, overlay payloads, generated overlay builder/runtime, storage, and first checks
- [x] Focused validation: `aiprompt.html` builder smoke test passed with mocked bridge and mocked chatbot responses
- [x] Heavy: event/effect overlay behavior for events dashboard, hype counts, confetti, word cloud, and leaderboard
- [x] Heavy: live display utility behavior for emotes, reactions, scoreboard, ticker, and map pages
- [x] Runtime partial: controlled local browser validation for `scoreboard.html` preview/local scoring behavior
- [x] Runtime partial: controlled local browser validation for `reactions.html` popup URL parsing, synthetic bridge/payload rendering, fake server-mode joins, and controlled TikTok-like target routing
- [ ] Runtime follow-up: resolve failed `multi-alerts.html` Playwright validation attempt before claiming multi-alert browser validation
- [x] Heavy: specialized/legacy root-page behavior for chat-overlay redirect, Minecraft alert skin, Septapus renderer, and shop-the-stream display
- [x] Heavy: diagnostic/helper page behavior for synthetic payloads, raw API smoke test, chat replay, settings recovery, URL editing, StreamElements/Streamlabs import, Spotify now-playing overlay, and giveaway sync test
- [x] Heavy: individual game-page behavior for Spam Power and current `games/*.html` commands, URL shapes, storage exceptions, and first checks
- [x] Heavy: theme-page behavior for chat themes, featured-style themes, wrapper themes, package themes, bridge modes, and OBS/local-file caveats
- [x] Heavy: cross-page capability routing for page dependencies, OBS/API/Event Flow role, state, and first failure checks
- [x] Intense source-check: page-specific URL parser behavior for high-use root pages and utility pages
- [x] Quick: root HTML page URL parameter inventory for parser coverage triage
- [x] Quick: theme, game, and WebSocket source URL parameter inventory for parser coverage triage
- [ ] Intense: OBS/browser-source troubleshooting and payload/rendering edge cases

- [x] Quick: overlay/tool pages listed in `02-resource-manifest.md`
- [x] Heavy: high-use pages only: waitlist, poll, timer, giveaway, actions/Event Flow, custom overlays, multi-alerts
- [ ] Intense: only pages tied to frequent support issues or APIs

### Platform Sources

- [x] Quick: all active `social_stream/sources/*.js` listed and routed in the source-file processing matrix
- [x] Quick: file-level processing matrix for all current source scripts, static helpers, injected helpers, and WebSocket source assets
- [x] Heavy: public supported-site/source inventory counts and setup-type groups
- [x] Heavy: public supported-site setup lookup grouped by setup type
- [x] Heavy: public supported-site support-strength/status layer and safe claim rules
- [x] Focused validation: public supported-site metadata structural check completed with duplicate `On24`/`ON24` card finding
- [x] Heavy: manifest content-script source-load matrix and special load flags
- [x] Quick: full 155-row manifest content-script matrix with sample URL patterns and routing hints
- [x] Heavy: high-value platform capability matrix for chat capture, rich events, send-back routing, app differences, and support triage
- [x] Heavy: YouTube, TikTok, Twitch, Kick
- [x] Focused validation: Twitch provider subgift normalization Node test passed
- [x] Heavy: Facebook, Instagram, Rumble, Discord
- [x] Heavy: generic/custom sources
- [x] Heavy: static/manual/helper source script routing for `sources/static/*`, `sources/inject/*`, VDO media helpers, and reload helper
- [x] Heavy: communication/sensitive source script routing for ChatGPT/OpenAI, Slack, Telegram, WhatsApp, Google Meet, Teams, Zoom, Webex, and Chime
- [x] Heavy: embedded chat widget source routing for CBOX, Chatroll, KiwiIRC, QuakeNet, Minnit Chat, and Online Church
- [x] Heavy: live-commerce source routing for Amazon Live, eBay Live, Whatnot, and Whatnot WebSocket interception
- [x] Heavy: webinar/event source routing for Crowdcast, Livestorm, Livestream.com, ON24, Riverside, Sessions.us, Wave Video, and WebinarGeek
- [x] Heavy: creator/live-cam source routing for Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, and Stripchat
- [x] Heavy: popout/chat-only source routing for Beamstream, BoltPlus, Chzzk, FloatPlane, GoodGame, Mixcloud, Nimo, Odysee, Parti, Picarto, Piczel, RokFin, Rutube, SoopLive, and VK chat-only paths
- [x] Heavy: event/community source routing for Arena Social, Buzzit, CI.ME, Gala Music, LinkedIn Events, LivePush, MegaphoneTV, QuickChannel, Slido, and TradingView
- [x] Heavy: independent live platform source routing for BandLab, Bigo.tv, Bitchute, Blaze, Castr, Cherry TV, CloutHub, Cozy.tv, DLive, Estrim, FC2, Jaco.live, LFG.tv, Locals.com, and Loco.gg
- [x] Heavy: video/broadcast platform source routing for Mixlr, NicoVideo, NonOLive, OpenStreamingPlatform, Owncast, PeerTube, Restream.io Chat, Steam Broadcasts, Trovo, Truffle.vip, TwitCasting, Vimeo, YouNow, and Zap.stream
- [x] Heavy: community/membership web-app source routing for Circle.so, MeetMe, NextCloud, Patreon, Roll20, Simps, Tellonym, Whop, Wix Live/widgets, and Workplace legacy routing
- [x] Heavy: regional/emerging platform source routing for Bilibili DOM paths, Favorited, Kwai, Pilled, Portal, Pump.fun, Retake, Rooter, SharePlay, SoulBound, Stream.place, Substack, Tikfinity, uScreen, VK Live, and Xeenon
- [x] Heavy: special-case platform/helper source routing for Joystick, Velora, VPZone, X live, Vertical Pixel Zone, Vercel demo helper, and top-level YouTube helper copies
- [ ] Intense: TikTok, YouTube, Kick, Twitch, and any platform with recurring support failures

- [x] Quick: `social_stream/sources/websocket/*`
- [x] Heavy: WebSocket setup, auth, message sending, fallback behavior for grouped source-page workflows and dedicated platform pages
- [ ] Intense: YouTube, TikTok-adjacent app behavior, Kick, Twitch EventSub, Rumble

- [ ] Quick: `social_stream/providers/*`, `shared/*`
- [x] Heavy: provider core responsibilities and extension/app compatibility rules
- [ ] Intense: provider cores used by fragile/high-value integrations

### Event Flow And Integrations

- [x] Quick: `actions/*`
- [x] Heavy: Event Flow Editor, triggers, actions, state nodes, tests
- [x] Focused validation: Event Flow custom JS, compare-property, template/counter, OBS system trigger, and play-media duration Node tests passed
- [ ] Intense: custom JS actions, media actions, Kick rewards, OBS actions

- [x] Quick: `api.md`, `streamerbot.html`, `obs-websocket-test.html`, StreamDeck/Companion sections
- [x] Heavy: integration setup, command paths, troubleshooting
- [x] Focused validation: API command examples documentation consistency check found 29 extracted actions and zero missing entries across action index, validation matrix, and source trace after docs updates
- [ ] Intense: API command contract and OBS remote-control behavior

- [x] Heavy: TTS providers, AI features, OBS integration, StreamDeck/Companion control
- [x] Focused validation: profanity filter and moderation regression Node tests passed
- [x] Focused validation: local browser model registry Node test passed
- [x] Focused validation: OpenCode Zen fallback Node test passed
- [x] Focused validation: Kokoro and Kitten local TTS asset tests passed; Piper local asset test failed on expected fallback remote-base string
- [x] Focused validation: Transformers local AI default-host test passed
- [x] Focused validation: RAG benchmark and browser-fixture E2E tests passed for local deterministic fixture data
- [ ] Intense: provider/API behavior, OBS control paths, and command contract from line-level code

### Standalone App

- [ ] Quick: `ssapp/README.md`, `RELEASE.md`, `package.json`
- [x] Heavy: app build/run commands and release boundaries from `AGENTS.md`, `RELEASE.md`, and `package.json`
- [ ] Intense: release docs only if doing release-related docs

- [x] Quick: `ssapp/main.js`, `preload.js`, `state.js`, `index.html`, `renderer.js`
- [x] Heavy: Electron app architecture, source loading, IPC, state persistence
- [x] Heavy: standalone app source-window lifecycle, app-vs-extension parity, session partitions, and source injection routing
- [ ] Intense: settings loss, source resolution, security/path validation, message bridge

- [x] Quick: `ssapp/resources/electron-*-handler.js`, `kick-ws-client.js`
- [x] Heavy: OAuth and platform handlers
- [ ] Intense: YouTube/Twitch/Facebook/Kick/Velora/VPZone auth flows

- [x] Quick: `ssapp/tiktok/*`, `ssapp/tiktok-signing/*`, `ssapp/tests/tiktok/*`
- [x] Heavy: TikTok modes, signing, fallbacks, regression expectations
- [ ] Intense: TikTok support/troubleshooting and current behavior docs

### Support Knowledge Base

- [x] Quick: `stevesbot/resources/instructions/social-stream-support.md`
- [x] Heavy: support answer style, top recurring advice, escalation rules
- [ ] Intense: verify every user-facing troubleshooting claim against code/docs

- [x] Quick: `stevesbot/resources/learnings/social-stream-ninja-top-issues.md`
- [x] Heavy: common issues and platform-specific support history
- [ ] Intense: stale/historical claim review

- [x] Quick: SSN files in `stevesbot/resources/learnings/support-qa/*`
- [x] Heavy: common Q&A extraction into troubleshooting pages
- [ ] Intense: scenario-by-scenario validation against current source

- [x] Quick: repo-backed common questions from `README.md`, `api.md`, `parameters.md`, and public docs
- [x] Heavy: repo-backed common questions and support triage baseline
- [x] Heavy: support KB index, first-answer router, evidence checklist, and privacy rules
- [x] Heavy: support evidence ledger separating source-backed, mixed, support-derived, stale-risk, and live-validation claim families
- [x] Heavy: objective coverage map for common support/reference question families and remaining validation gaps
- [x] Heavy: support response playbook for phrasing common answers without overclaiming
- [x] Heavy: misconception/boundary map for common overclaims and safer phrasing
- [x] Heavy: historical support method, issue map, stale claim register, and platform known-issues matrix
- [x] Heavy: support resource routing, escalation criteria, and bug-report evidence checklist
- [x] Heavy: symptom-to-branch diagnostic decision tree for common support failures
- [ ] Intense: resolve stale/contradictory claims against current source

- [x] Quick: `stevesbot/data/sqlite/knowledge.sqlite`
- [ ] Quick: `stevesbot/resources/knowledge.sqlite`
- [x] Heavy: category/platform/product queries for SSN support issues
- [ ] Intense: high-frequency platform support threads and contradiction checks

- [x] Quick: `stevesbot/data/sqlite/stevesbot.sqlite`
- [x] Heavy: curated support records and Q&A entries
- [ ] Intense: only for high-risk/high-volume claims

- [x] Quick: `stevesbot/data/sqlite/archive.sqlite`
- [ ] Heavy: raw message search only to confirm real-world symptom wording or frequency
- [ ] Intense: anonymized deep dives only for unresolved or unclear support issues

### Tests And Validation Material

- [x] Quick: `social_stream/tests/*`, `social_stream/scripts/playwright-*.cjs`
- [x] Heavy: expected behavior and testable workflows
- [x] Focused validation: focused evidence log for settings config JSON, generated metadata checks, Event Flow, Twitch provider, AI prompt builder, AI moderation, local model registry, provider fallback, local TTS, local AI, and RAG deterministic/static/browser-fixture tests
- [ ] Intense: only for features with current E2E coverage or fragile regressions

- [x] Quick: `ssapp/tests/electron/*`
- [x] Quick: `ssapp/tests/tiktok/*`
- [x] Heavy: app regression expectations and diagnostics
- [ ] Intense: settings loss, source URL parsing, TikTok connection behavior

## Row Template For New Detailed Tracking

Use this when a pass needs file-level status.

| Source | Type | Target doc | Current level | Last checked | Notes |
| --- | --- | --- | --- | --- | --- |
| `relative/path.ext` | code/doc/support/db | `planned-doc.md` | not-started |  |  |
