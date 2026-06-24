# Reference Index

Status: heavy reference pass started.

## Purpose

This section gives AI agents fast answers for common SSN questions that cut across many pages: commands, URL options, mode selection, costs, support boundaries, and plugin/customization paths.

Use these pages when the user asks "how do I do X?" and the answer may involve more than one product surface.

## Pages

- `commands-and-actions.md`: viewer chat commands, API actions, MIDI/hotkey commands, Event Flow actions, and common command mistakes.
- `control-surface-crosswalk.md`: disambiguates commands, URL parameters, settings, sessions, labels, modes, source pages, Event Flow, custom JS, and plugin-like paths.
- `action-command-index.md`: action-name lookup for public API actions, page actions, background/internal actions, viewer commands, and Event Flow action types.
- `command-action-source-trace.md`: source-checked command/action routing notes, handler boundaries, target/page caveats, and high-risk public examples.
- `api-command-validation-matrix.md`: command/API acceptance versus target page/source action, runtime proof boundaries, callbacks, and false-positive matrix.
- `api-command-examples.md`: safe copy/paste HTTP, WebSocket, JSON, page-label, waitlist, poll, timer, and troubleshooting examples.
- `url-parameters.md`: high-value URL parameter families for dock, featured, TTS, filters, automation, tip jar, credits, and security.
- `url-option-examples.md`: safe copy/paste page URL and parameter examples for OBS, dock, featured, filters, themes, TTS, labels, server modes, and failures.
- `url-parameter-index.md`: exact generated URL parameter, alias, value-hint, and short-description lookup from `shared/config/urlParameters.js`.
- `url-parameter-source-trace.md`: source-checked page-specific URL parser behavior, server/channel differences, boolean parsing caveats, and support guardrails.
- `root-page-url-parameter-matrix.md`: quick generated-source inventory of detected literal URL parameters across root `*.html` pages.
- `subpage-url-parameter-matrix.md`: quick generated-source inventory of detected literal URL parameters across theme, game, and WebSocket source pages.
- `surface-url-cheatsheet.md`: which SSN page, hosted URL, API endpoint, or WebSocket source page to open for common jobs.
- `workflow-setup-decision-tree.md`: setup-choice routing from user goal to source side, receiving page, transport, options, and validation checks.
- `app-extension-mode-crosswalk.md`: first-stop comparison for Chrome extension, standalone app, hosted pages, local pages, Lite, Firefox, WebSocket/API source pages, and custom sources.
- `install-update-version-guide.md`: install path choice, safe update flow, version mismatch symptoms, and reinstall/settings warnings.
- `preflight-checklists.md`: before-stream, after-update, OBS, app, API, AI/TTS, customization, and safe-support checklists.
- `07-overlays-and-pages/page-capability-matrix.md`: which overlay/tool page supports a feature, what else must be open, and first failure checks.
- `07-overlays-and-pages/event-effect-overlays.md`: routing and first checks for `events.html`, `hype.html`, `confetti.html`, `wordcloud.html`, and `leaderboard.html`.
- `07-overlays-and-pages/live-display-utilities.md`: routing and first checks for `emotes.html`, `reactions.html`, `scoreboard.html`, `ticker.html`, and `map.html`.
- `07-overlays-and-pages/specialized-legacy-pages.md`: routing and first checks for `chat-overlay.html`, `minecraft.html`, `septapus.html`, and `shop_the_stream.html`.
- `07-overlays-and-pages/diagnostic-helper-pages.md`: routing and first checks for `createtestmessage.html`, `simple_api_client.html`, `replaymessages.html`, `recover.html`, `urleditor.html`, `streamelements-importer.html`, `spotify-overlay.html`, and `test-giveaway-webrtc.html`.
- `10-troubleshooting/diagnostic-decision-tree.md`: symptom-to-branch routing for vague "SSN is not working" reports.
- `07-overlays-and-pages/game-pages.md`: commands, URLs, storage, transport, and first checks for `games.html` and current `games/*.html` pages.
- `07-overlays-and-pages/theme-pages.md`: routing, parameters, bridge mode, and first checks for `themes/**/*.html`.
- `modes-and-capability-matrix.md`: extension/app/hosted/local/Lite/Firefox/API mode comparison and platform capture mode rules.
- `04-standalone-app-source-windows.md`: standalone app source-window lifecycle, source injection, session partitions, and app-vs-extension parity routing.
- `08-platform-sources/public-site-support-status.md`: support-strength rules for public supported-site listings and setup types.
- `08-platform-sources/public-site-implementation-map.md`: public site-card to source-file, source-page, manifest-row, and grouped-doc routing.
- `08-platform-sources/platform-capability-matrix.md`: platform-specific routing for event families, send-back support, app differences, and first support checks.
- `08-platform-sources/tiktok-standalone-app.md`: standalone app TikTok connector modes, signing providers, fallbacks, replies, event families, test assets, and support triage.
- `08-platform-sources/manual-static-and-helper-sources.md`: routing for static/manual source helpers, injected WebSocket helpers, and helper scripts that are not normal chat parsers.
- `08-platform-sources/websocket-source-pages.md`: routing for WebSocket/API source pages, source-page setup, auth/token caveats, and send-back support boundaries.
- `08-platform-sources/communication-and-sensitive-sources.md`: routing for private communication, meeting, and assistant page sources and their privacy/send-back boundaries.
- `08-platform-sources/embedded-chat-widget-sources.md`: routing for CBOX, Chatroll, KiwiIRC, QuakeNet, Minnit, and Online Church embedded widget sources.
- `08-platform-sources/live-commerce-sources.md`: routing for Amazon Live, eBay Live, Whatnot, commerce metadata, and product-list display boundaries.
- `08-platform-sources/webinar-and-event-sources.md`: routing for webinar/event pages, Q&A/sidebar capture, Wave Video relayed types, and analytics/send-back boundaries.
- `08-platform-sources/creator-live-cam-sources.md`: routing for Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, Stripchat, token/tip handling, private-message boundaries, and send-back limits.
- `08-platform-sources/popout-chat-only-sources.md`: routing for smaller popout/chat-only platforms, exact chat URL setup, source-specific donations/viewer counts, and send-back limits.
- `08-platform-sources/event-and-community-sources.md`: routing for event/community pages, Q&A/comment captures, viewer/donation/source-type extras, and send-back limits.
- `08-platform-sources/independent-live-platform-sources.md`: routing for smaller independent live/chat platforms, normal page/chat setup, source-specific viewer/tip/reply/join/content-image behavior, and send-back limits.
- `08-platform-sources/video-broadcast-platform-sources.md`: routing for smaller video/audio/broadcast chat platforms, Q&A/source-icon/upstream-type/login caveats, and send-back limits.
- `08-platform-sources/community-membership-webapp-sources.md`: routing for community, membership, collaboration, and web-app pages, privacy/toggle/login boundaries, viewer-count/image paths, and send-back limits.
- `08-platform-sources/regional-and-emerging-platform-sources.md`: routing for regional, emerging, app-specific, and newly added rendered-page sources, activity-feed ingests, viewer/tip/raid/join caveats, and inactive helper paths.
- `08-platform-sources/special-case-platform-and-helper-sources.md`: routing for Joystick/Velora/VPZone rendered-site versus source-page modes, X live versus static capture, Vertical Pixel Zone identity caveats, Vercel helper behavior, and top-level YouTube helper copies.
- `free-paid-and-support-boundaries.md`: what is free, what can cost money, support expectations, donations, Terms/Privacy, and third-party limits.
- `public-claims-boundary-matrix.md`: safe boundaries for broad public claims such as 100+/120+ supported sites, two-way chat, no API keys, free/open-source, AI/TTS, app, plugin, services, and support promises.
- `privacy-security-and-secrets.md`: what to redact, session/webhook/key safety, private source handling, support-log rules, and secret leak response.
- `customization-plugin-recipes.md`: recipe-style routing for URL/CSS, themes, custom overlays, `custom.js`, custom actions, API apps, Event Flow, new sources, and sharing custom work.
- `customization-source-trace.md`: source-checked local `custom.js`, uploaded custom JavaScript, custom overlay, API/WebSocket source, Event Flow, and first-class source hook boundaries.
- `custom-plugins-and-extensions.md`: exact meaning of plugin-like support in SSN and how to build custom behavior safely.
- `11-support-kb/index.md`: first-answer routing by support question type, evidence checklist, and support-history safety rules.
- `11-support-kb/question-intent-router.md`: plain-language user wording to canonical doc route, first disambiguation question, and wrong-route warnings.
- `11-support-kb/common-question-fast-path.md`: compact common-question answer-shape matrix with must-check docs and overclaim warnings.
- `11-support-kb/support-question-phrasebook.md`: paraphrased support-history wording patterns tied to canonical docs and safe answer boundaries.
- `11-support-kb/common-question-coverage-map.md`: objective-level map of common question families to current docs and validation gaps.
- `11-support-kb/common-question-evidence-status.md`: evidence-strength and runtime-proof status for common SSN answer families.
- `11-support-kb/common-question-proof-pack.md`: evidence artifacts required before stronger answers about commands, options, supported sites, modes, customization, costs, privacy, testing, and platform behavior.
- `15-objective-coverage-and-readiness-audit.md`: objective requirement coverage, answer-readiness labels, completion evidence, and remaining proof gaps.
- `16-runtime-validation-playbooks.md`: runtime validation recipes and evidence templates for final-grade command, option, source, app, OBS, integration, AI/TTS, and support-claim evidence.
- `18-focused-validation-evidence-log.md`: focused non-runtime validation evidence, currently including settings config JSON, generated settings/URL/public-site metadata checks, Event Flow, Twitch provider, AI prompt builder, AI moderation, local model registry, provider fallback, local TTS, local AI asset, and RAG fixture tests.
- `11-support-kb/common-misconceptions-and-boundaries.md`: common overclaims, boundaries, and safer support phrasing.
- `11-support-kb/support-evidence-ledger.md`: support claim evidence labels, docs that use each claim, and validation targets.
- `11-support-kb/support-response-playbook.md`: ready-to-send support answer templates and safe follow-up questions.
- `11-support-kb/support-macro-routing.md`: SSN-filtered support macros from curated support playbooks for safe intake, blank overlays, TikTok, Twitch auth, platform-change, API no-op, app, AI/TTS, plugin, and escalation routing.
- `11-support-kb/support-intake-templates.md`: copyable intake/repro templates for collecting useful support details without secrets.
- `support-resources-and-escalation.md`: where to send users, what to collect, and when to escalate a support issue.
- `settings-and-toggles.md`: popup settings, URL parameters, storage layers, generated setting categories, and common setting support patterns.
- `settings-session-storage-source-trace.md`: source-checked extension/app storage split, session/password save flow, popup-generated links, app cached-state backups, and settings-loss guardrails.
- `settings-change-impact-matrix.md`: practical "why did this setting/option/link/app change not take effect?" routing, reload/reconnect rules, and false-positive checks.
- `settings-key-index.md`: exact generated popup setting-key, category, type, and short-description lookup from `shared/config/settingsDefinitions.js`.
- `features-and-capabilities.md`: broad feature family map, mode/cost boundaries, and routing for capability questions.
- `feature-support-decision-matrix.md`: answer-ready yes/depends/external/dev matrix for common feature support questions.
- `customization-path-decision-matrix.md`: first-stop routing for URL/CSS, themes, custom overlays, local `custom.js`, uploaded user functions, API apps, Event Flow, and first-class source work.
- `12-development/test-asset-matrix.md`: existing Node tests, browser fixtures, Playwright scripts, npm aliases, setup assumptions, and feature-to-test routing.
- `how-to-recipes.md`: task-oriented recipes for setup, OBS, featured chat, TTS, AI, API, StreamDeck, webhooks, custom overlays, custom JS, new sources, and troubleshooting.
- `glossary.md`: concise definitions for SSN terms such as source, dock, session, command, plugin, WSS, Event Flow, and send-back.

## Source Priority

Prefer current code and source docs in this order:

1. Current `social_stream` code and docs.
2. Current `ssapp` code/docs for standalone app behavior.
3. Curated `stevesbot` support material.
4. Historical raw support records, only after summarizing and source-checking.

## Fast Routing

| User Question | Start With |
| --- | --- |
| "What kind of command system am I dealing with?" | `commands-and-actions.md` |
| "Is this a command, URL option, setting, mode, label, source, or plugin path?" | `control-surface-crosswalk.md` |
| "What exact API action or Event Flow action exists?" | `action-command-index.md` |
| "How is this command actually handled in source?" | `command-action-source-trace.md` |
| "Why did the API command say success but nothing changed?" | `api-command-validation-matrix.md` |
| "Can you give me a safe API command example?" | `api-command-examples.md` |
| "What URL option changes this overlay?" | `url-parameters.md` |
| "Can you give me a safe overlay URL example?" | `url-option-examples.md` |
| "What exact URL parameter or alias exists?" | `url-parameter-index.md` |
| "Why does this URL option work on one page but not another?" | `url-parameter-source-trace.md` |
| "Which root page appears to parse this URL parameter?" | `root-page-url-parameter-matrix.md` |
| "Which theme, game, or WebSocket source page parses this URL parameter?" | `subpage-url-parameter-matrix.md` |
| "Which SSN page or URL should I open?" | `surface-url-cheatsheet.md` |
| "What should I use for this setup?" | `workflow-setup-decision-tree.md` |
| "Which version/install path should I use?" | `install-update-version-guide.md` |
| "How do I update without losing settings?" | `install-update-version-guide.md` |
| "What should I check before going live?" | `preflight-checklists.md` |
| "What should I check after updating?" | `preflight-checklists.md` |
| "SSN is not working; where do I start?" | `10-troubleshooting/diagnostic-decision-tree.md` |
| "Where should I route this plain-language support question?" | `11-support-kb/question-intent-router.md` |
| "What is the fastest safe answer path for this common question?" | `11-support-kb/common-question-fast-path.md` |
| "How do users usually phrase this SSN issue?" | `11-support-kb/support-question-phrasebook.md` |
| "How strong is the evidence for this common answer?" | `11-support-kb/common-question-evidence-status.md` |
| "How close are these AI docs to the full objective?" | `15-objective-coverage-and-readiness-audit.md` |
| "How do I runtime-validate this claim before saying tested?" | `16-runtime-validation-playbooks.md` |
| "Which overlay/tool page supports this?" | `07-overlays-and-pages/page-capability-matrix.md` |
| "Why is events, hype, confetti, word cloud, or leaderboard blank?" | `07-overlays-and-pages/event-effect-overlays.md` |
| "Why is emotes, reactions, scoreboard, ticker, or map blank?" | `07-overlays-and-pages/live-display-utilities.md` |
| "What is chat-overlay, minecraft, septapus, or shop-the-stream?" | `07-overlays-and-pages/specialized-legacy-pages.md` |
| "What helper page do I use for test messages, replay, recovery, import, Spotify, or giveaway sync?" | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| "How do the SSN chat games work?" | `07-overlays-and-pages/game-pages.md` |
| "Which prebuilt theme should I use?" | `07-overlays-and-pages/theme-pages.md` |
| "Should I use app, extension, WebSocket, hosted/local pages, Firefox, or Lite?" | `app-extension-mode-crosswalk.md` |
| "What are the broader mode capabilities?" | `modes-and-capability-matrix.md` |
| "Why does this source work in Chrome but not the desktop app?" | `04-standalone-app-source-windows.md` |
| "Is this site really supported?" | `08-platform-sources/public-site-support-status.md` |
| "Which source file or manifest row handles this public site card?" | `08-platform-sources/public-site-implementation-map.md` |
| "Does this platform support this event, reward, or send-back?" | `08-platform-sources/platform-capability-matrix.md` |
| "Why is TikTok different in the desktop app?" | `08-platform-sources/tiktok-standalone-app.md` |
| "Is this source file a normal chat parser or a helper?" | `08-platform-sources/manual-static-and-helper-sources.md` |
| "How does this WebSocket/API source page work?" | `08-platform-sources/websocket-source-pages.md` |
| "How does this private chat or meeting source work?" | `08-platform-sources/communication-and-sensitive-sources.md` |
| "How does this embedded chat widget source work?" | `08-platform-sources/embedded-chat-widget-sources.md` |
| "How do Amazon/eBay/Whatnot shopping events work?" | `08-platform-sources/live-commerce-sources.md` |
| "How does this webinar/event source work?" | `08-platform-sources/webinar-and-event-sources.md` |
| "How does this creator/live-cam source work?" | `08-platform-sources/creator-live-cam-sources.md` |
| "Which chat-only URL does this smaller platform need?" | `08-platform-sources/popout-chat-only-sources.md` |
| "How does this event/community page source work?" | `08-platform-sources/event-and-community-sources.md` |
| "How does this independent live platform source work?" | `08-platform-sources/independent-live-platform-sources.md` |
| "How does this video or broadcast source work?" | `08-platform-sources/video-broadcast-platform-sources.md` |
| "How does this community or membership web-app source work?" | `08-platform-sources/community-membership-webapp-sources.md` |
| "How does this regional or emerging platform source work?" | `08-platform-sources/regional-and-emerging-platform-sources.md` |
| "Is this a rendered-site source, source-page mode, or helper copy?" | `08-platform-sources/special-case-platform-and-helper-sources.md` |
| "Can I safely repeat this broad public claim?" | `public-claims-boundary-matrix.md` |
| "What does 100+/120+ supported sites mean?" | `public-claims-boundary-matrix.md` |
| "Is this free? Does support cost money?" | `free-paid-and-support-boundaries.md` |
| "Can I share this URL, log, screenshot, key, or settings file?" | `privacy-security-and-secrets.md` |
| "Which customization/plugin/source path should I use?" | `customization-path-decision-matrix.md` |
| "Can I make my own plugin/source/overlay?" | `customization-plugin-recipes.md` |
| "How does custom.js or uploaded custom JavaScript actually hook into source?" | `customization-source-trace.md` |
| "What answer page should I start with?" | `11-support-kb/index.md` |
| "Do the AI docs cover this question family?" | `11-support-kb/common-question-coverage-map.md` |
| "What should I avoid overpromising?" | `11-support-kb/common-misconceptions-and-boundaries.md` |
| "Is this support claim source-backed or historical?" | `11-support-kb/support-evidence-ledger.md` |
| "How should I phrase this support answer?" | `11-support-kb/support-response-playbook.md` |
| "Is there a short macro for this support thread?" | `11-support-kb/support-macro-routing.md` |
| "What information should I ask the user for?" | `11-support-kb/support-intake-templates.md` |
| "Where do I get help or report a bug?" | `support-resources-and-escalation.md` |
| "Where is this toggle or setting?" | `settings-and-toggles.md` |
| "Where is this setting stored, why did it not stick, or why did my session/link change?" | `settings-session-storage-source-trace.md` |
| "Why did my setting, URL option, generated link, or app source change not take effect?" | `settings-change-impact-matrix.md` |
| "What exact popup setting key exists?" | `settings-key-index.md` |
| "Can SSN do this feature?" | `feature-support-decision-matrix.md` |
| "What feature family is this?" | `features-and-capabilities.md` |
| "Which existing test or Playwright script covers this?" | `12-development/test-asset-matrix.md` |
| "How do I set this up?" | `how-to-recipes.md` |
| "What does this SSN term mean?" | `glossary.md` |

## Follow-Up Extraction Needs

- Intense source validation of every action in `background.js`, `dock.html`, Event Flow, and special pages.
- Runtime validation of page-specific URL parameter support beyond the source-checked parser trace.
- Runtime-validate URL parameter matrices for theme pages, game pages, and WebSocket source pages.
- Runtime-validate settings/session/storage behavior from `settings-session-storage-source-trace.md` and `settings-change-impact-matrix.md`, especially extension migration, app export/import, source/page reload requirements, and live-vs-reload setting behavior.
- Use `16-runtime-validation-playbooks.md` as the evidence template for command/API, URL option, settings/storage, site health, app, OBS, integration, provider, and support-claim runtime passes.
- Use `12-development/test-asset-matrix.md` before inventing a new test command for Event Flow, AI, TTS, overlay, RAG, local-model, or Playwright-supported checks.
- Page-by-page URL/support matrix generated from actual root HTML files, building on `surface-url-cheatsheet.md`.
- Page-by-page capability, dependency, state, and OBS/API/Event Flow matrix generated from root HTML files, building on `07-overlays-and-pages/page-capability-matrix.md`.
- Runtime health validation for `08-platform-sources/public-site-implementation-map.md`, building on `08-platform-sources/public-site-support-status.md`.
- Runtime/source promotion of broad public claims in `public-claims-boundary-matrix.md`, especially site counts, two-way chat, no API keys, AI/TTS, app, plugin, services, and free/support wording.
- Intense validation of `08-platform-sources/platform-capability-matrix.md` by browser/app/OS/platform.
- Runtime validation of `customization-path-decision-matrix.md` and `customization-source-trace.md`, especially local `custom.js`, uploaded custom user functions, custom overlay payloads, and hosted/local/app differences.
- Live/browser validation of `08-platform-sources/manual-static-and-helper-sources.md` helper behavior.
- Line-level/live validation of `08-platform-sources/websocket-source-pages.md` send-back, auth, reconnect, and app parity behavior.
- Live/browser validation of `08-platform-sources/communication-and-sensitive-sources.md` opt-in toggles, current DOM selectors, meeting/chat panels, and send-back boundaries.
- Live/browser validation of `08-platform-sources/embedded-chat-widget-sources.md` iframe/all-frame behavior, current widget selectors, and viewer/event payload samples.
- Live/browser validation of `08-platform-sources/live-commerce-sources.md` Amazon/eBay/Whatnot DOM, WebSocket, auction, commerce, and product-list display behavior.
- Live/browser validation of `08-platform-sources/webinar-and-event-sources.md` chat/Q&A/sidebar capture, Wave Video type mapping, Riverside settings, and WebinarGeek shadow-DOM selectors.
- Live/browser validation of `08-platform-sources/creator-live-cam-sources.md` token/tip payloads, private-message handling, generated selectors, hidden-tab behavior, and app source-window parity.
- Live/browser validation of `08-platform-sources/popout-chat-only-sources.md` exact chat-only URL setup, donation/viewer-count paths, iframe behavior, and app source-window parity.
- Live/browser validation of `08-platform-sources/event-and-community-sources.md` event/community chat, Q&A rows, viewer/donation paths, upstream source type, and app source-window parity.
- Live/browser validation of `08-platform-sources/independent-live-platform-sources.md` independent platform chat, viewer/tip/reply/join/image paths, DLive public routing, and app source-window parity.
- Live/browser validation of `08-platform-sources/video-broadcast-platform-sources.md` video/broadcast chat, Vimeo Q&A, Truffle/Restream source identity, PeerTube login, Steam iframe/avatar behavior, and app source-window parity.
- Live/browser validation of `08-platform-sources/community-membership-webapp-sources.md` Patreon toggle/viewer counts, Simps/Whop viewer counts, Circle/Patreon images, Wix embedded paths, NextCloud domain scope, Workplace routing, and app source-window parity.
- Live/browser validation of `08-platform-sources/regional-and-emerging-platform-sources.md` Bilibili URL variants, SharePlay shoutout/Blitz behavior, Tikfinity activity-feed payloads, Stream.place relayed rows, Substack live URL routing, Pump.fun/Retake tip rows, and inactive viewer helper paths.
- Live/browser validation of `08-platform-sources/special-case-platform-and-helper-sources.md` Joystick/Velora/VPZone mode split, Vertical Pixel Zone source identity, X live URL variants, Vercel helper consent flow, and top-level YouTube helper load status.
- Current source list matrix generated from `manifest.json`, `docs/js/sites.js`, and `sources/`.
- Line-level mapping of popup controls to setting definitions, storage keys, live reload behavior, and desktop app parity against `04-standalone-app-source-windows.md`.
