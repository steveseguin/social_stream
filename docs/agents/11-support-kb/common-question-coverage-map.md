# Common Question Coverage Map

Status: objective coverage pass started on 2026-06-24.

## Purpose

Use this page to check whether the current AI docs cover the common SSN question family a user is asking about.

This is a coverage map, not a final answer page. Route to the listed docs, then inspect current code/source when the answer involves a fragile platform, exact command behavior, exact setting behavior, send-back, moderation, auth, or app parity.

For support-history frequency and priority signals, use `support-topic-frequency-index.md`.

For plain-language user wording and first-route selection, use `question-intent-router.md` before choosing a narrow topic page. For a compact answer-shape matrix, use `common-question-fast-path.md`. For evidence strength and runtime-proof status by common answer type, use `common-question-evidence-status.md`. For a benchmark-style prompt set that tests whether agents route and answer common questions without overclaiming, use `common-question-test-set.md`. For paraphrased real-world wording patterns from support history, use `support-question-phrasebook.md`. For short macro-style support replies from curated playbooks, use `support-macro-routing.md`.

## Coverage Labels

| Label | Meaning |
| --- | --- |
| `covered-heavy` | A usable source-backed agent doc exists. |
| `covered-quick` | An orientation or file matrix exists, but detailed behavior still needs source inspection. |
| `mixed` | Some parts are source-backed, while exact user-facing claims still need validation. |
| `needs-intense` | A high-risk area where final answers need line-level source or real runtime validation. |

## Core Product Questions

| Question Family | Coverage | Start With | Check Next |
| --- | --- | --- | --- |
| What is SSN? | covered-heavy | `01-product-map.md` | `13-reference/features-and-capabilities.md` |
| What is the fastest safe answer path for a common question? | covered-heavy | `11-support-kb/common-question-fast-path.md` | routed topic docs and current source/runtime evidence |
| Can an agent test common SSN prompt routing and safe-answer behavior? | covered-heavy | `11-support-kb/common-question-test-set.md` | routed topic docs, common overclaim docs, and runtime evidence where required |
| How strong is the evidence for a common answer? | covered-heavy | `11-support-kb/common-question-evidence-status.md` | routed topic docs, `support-evidence-ledger.md`, runtime evidence if any |
| Is SSN free? | covered-heavy | `13-reference/free-paid-and-support-boundaries.md` | `11-support-kb/support-evidence-ledger.md` |
| What can cost money? | covered-heavy | `13-reference/free-paid-and-support-boundaries.md` | `09-api-and-integrations/tts.md`, `ai-features.md` |
| Can I repeat broad public claims like 100+/120+ sites, most platforms, two-way chat, no API keys, or free? | covered-heavy | `13-reference/public-claims-boundary-matrix.md` | routed topic docs and current source/runtime evidence |
| Is support paid or guaranteed? | covered-heavy | `13-reference/support-resources-and-escalation.md` | `11-support-kb/support-answer-bank.md` |
| What are the common overclaims or misconceptions? | covered-heavy | `11-support-kb/common-misconceptions-and-boundaries.md` | routed topic docs and current source |
| What is the difference between extension, standalone app, hosted pages, Lite, local pages, and Firefox? | covered-heavy | `13-reference/modes-and-capability-matrix.md` | `02-installation-and-surfaces.md`, `04-standalone-app-source-windows.md` |
| Which version/install path should a user pick? | covered-heavy | `02-installation-and-surfaces.md` | `13-reference/how-to-recipes.md` |
| What should I use for this setup? | covered-heavy | `13-reference/workflow-setup-decision-tree.md` | `13-reference/modes-and-capability-matrix.md`, `13-reference/how-to-recipes.md` |
| How should a user update without losing settings? | mixed | `10-troubleshooting/settings-loss-and-backups.md` | `06-settings-sessions-and-storage.md`, current settings source |

## Capture And Source Questions

| Question Family | Coverage | Start With | Check Next |
| --- | --- | --- | --- |
| Is this site supported? | covered-heavy | `08-platform-sources/supported-sites-lookup.md` | `08-platform-sources/public-site-support-status.md` |
| What exact page or popout URL should be opened? | mixed | `08-platform-sources/supported-sites-lookup.md` | exact platform doc and manifest row |
| Why does the supported-site list not prove every feature works? | covered-heavy | `08-platform-sources/public-site-support-status.md` | `08-platform-sources/platform-capability-matrix.md` |
| Which source file handles a public site card? | covered-heavy | `08-platform-sources/public-site-implementation-map.md` | `source-file-processing-matrix.md`, `manifest-content-scripts.md`, `manifest-row-matrix.md` |
| What is the difference between standard DOM capture, popout capture, static helper, injected helper, and WebSocket/API source page? | covered-heavy | `13-reference/modes-and-capability-matrix.md` | `08-platform-sources/manual-static-and-helper-sources.md`, `websocket-source-pages.md` |
| Does a platform support gifts, tips, raids, rewards, follows, viewer counts, or moderation events? | mixed, needs-intense | `08-platform-sources/priority-platform-answer-matrix.md` | `08-platform-sources/platform-capability-matrix.md`, exact platform doc, and current source |
| Can SSN send chat back to a platform? | mixed, needs-intense | `08-platform-sources/priority-platform-answer-matrix.md` | `platform-capability-matrix.md`, `websocket-source-pages.md`, exact platform source |
| Can SSN capture private chats, meetings, or assistant pages? | covered-heavy, needs-live-validation | `08-platform-sources/communication-and-sensitive-sources.md` | privacy/toggle/source checks |
| Are helper files real chat parsers? | covered-heavy | `08-platform-sources/manual-static-and-helper-sources.md` | `08-platform-sources/special-case-platform-and-helper-sources.md` |
| How do Joystick, Velora, VPZone, X, Vertical Pixel Zone, Vercel helper, or top-level YouTube helper copies fit? | covered-heavy, needs-live-validation | `08-platform-sources/special-case-platform-and-helper-sources.md` | exact source file and manifest row |

## Troubleshooting Questions

| Question Family | Coverage | Start With | Check Next |
| --- | --- | --- | --- |
| Chat is not appearing anywhere. | covered-heavy | `10-troubleshooting/diagnostic-decision-tree.md` | `support-response-playbook.md`, `10-troubleshooting/quick-triage.md`, `10-troubleshooting/extension-not-capturing.md` |
| User says "SSN is not working" without enough detail. | covered-heavy | `10-troubleshooting/diagnostic-decision-tree.md` | `11-support-kb/index.md`, `support-response-playbook.md` |
| Dock works but overlay or OBS is blank. | covered-heavy | `10-troubleshooting/obs-overlay-display.md` | `support-response-playbook.md`, `13-reference/surface-url-cheatsheet.md` |
| Extension captures nothing from a page. | covered-heavy | `10-troubleshooting/extension-not-capturing.md` | exact platform doc |
| Login or auth is blocked. | mixed | `10-troubleshooting/auth-and-sign-in.md` | standalone app source-window and OAuth handler docs |
| The standalone app behaves differently from Chrome. | mixed, needs-live-validation | `10-troubleshooting/desktop-app-issues.md` | `04-standalone-app-source-windows.md` |
| Settings are missing or wiped. | mixed | `10-troubleshooting/settings-loss-and-backups.md` | `13-reference/settings-session-storage-source-trace.md`, `06-settings-sessions-and-storage.md` |
| Is this a known platform issue? | mixed | `10-troubleshooting/platform-known-issues.md` | `11-support-kb/historical-issues.md`, `unresolved-or-stale-claims.md` |
| Is this support advice current or historical? | covered-heavy | `11-support-kb/support-evidence-ledger.md` | current source and stale-claim register |
| How should I phrase a support answer safely? | covered-heavy | `11-support-kb/support-response-playbook.md` | routed topic docs and current source |
| Which short macro should I use for this support thread? | covered-heavy | `11-support-kb/support-macro-routing.md` | `support-response-playbook.md`, routed topic docs and current source |

## Overlay, Page, And OBS Questions

| Question Family | Coverage | Start With | Check Next |
| --- | --- | --- | --- |
| How do I get chat into OBS? | covered-heavy | `13-reference/how-to-recipes.md` | `07-overlays-and-pages/dock.md`, `featured.md` |
| Which SSN page should I open? | covered-heavy | `13-reference/surface-url-cheatsheet.md` | `07-overlays-and-pages/page-capability-matrix.md` |
| What does `dock.html` do? | covered-heavy | `07-overlays-and-pages/dock.md` | `13-reference/commands-and-actions.md` |
| What does `featured.html` do? | covered-heavy | `07-overlays-and-pages/featured.md` | `10-troubleshooting/obs-overlay-display.md` |
| How do alerts, hype, confetti, word cloud, or leaderboard pages work? | covered-heavy | `07-overlays-and-pages/event-effect-overlays.md` | page-specific runtime validation |
| How do emotes, reactions, scoreboard, ticker, or map pages work? | covered-heavy | `07-overlays-and-pages/live-display-utilities.md` | page-specific runtime validation |
| How do games work? | covered-heavy | `07-overlays-and-pages/game-pages.md` | game page source and OBS/browser validation |
| How do themes work? | covered-heavy | `07-overlays-and-pages/theme-pages.md` | local-file/OBS rendering validation |
| How do tip jar and credits work? | covered-heavy | `07-overlays-and-pages/tipjar-credits.md` | webhook/payment privacy checks |
| How do diagnostic/replay/import/helper pages work? | covered-heavy | `07-overlays-and-pages/diagnostic-helper-pages.md` | controlled test payloads |
| Which page supports a feature? | covered-heavy | `07-overlays-and-pages/page-capability-matrix.md` | exact page source |
| Which overlay/tool files have been processed? | covered-quick | `07-overlays-and-pages/page-processing-matrix.md` | heavy/intense page pass as needed |

## Commands, API, Settings, And Options

| Question Family | Coverage | Start With | Check Next |
| --- | --- | --- | --- |
| What command system is this? | covered-heavy | `13-reference/commands-and-actions.md` | `13-reference/action-command-index.md`, `13-reference/api-command-validation-matrix.md` |
| What exact API action exists? | covered-heavy | `13-reference/action-command-index.md` | `13-reference/api-command-validation-matrix.md`, `09-api-and-integrations/websocket-http-api.md` |
| How do I receive chat in another app? | covered-heavy | `09-api-and-integrations/websocket-http-api.md` | sample client/source docs |
| How do I send commands from StreamDeck or Companion? | covered-heavy | `09-api-and-integrations/streamdeck-companion.md` | exact action index |
| How does Streamer.bot work? | covered-heavy | `09-api-and-integrations/streamerbot.md` | current Streamer.bot page/source |
| How does Event Flow work? | covered-heavy, needs-intense | `09-api-and-integrations/event-flow-editor.md` | action source and tests |
| What URL parameter controls this? | covered-heavy | `13-reference/url-parameters.md` | `13-reference/url-parameter-index.md` |
| What exact URL parameter or alias exists? | covered-heavy | `13-reference/url-parameter-index.md` | page-specific parser source |
| What setting/toggle controls this? | covered-heavy | `13-reference/settings-and-toggles.md` | `13-reference/settings-key-index.md` |
| What exact popup setting key exists? | covered-heavy | `13-reference/settings-key-index.md` | current UI and storage source |
| Does a setting, generated link, URL option, or app source change update live or require reload? | mixed, source-checked | `13-reference/settings-change-impact-matrix.md` | `13-reference/settings-session-storage-source-trace.md`, exact page/source/app behavior, then runtime validation |

## AI, TTS, Automation, And Integrations

| Question Family | Coverage | Start With | Check Next |
| --- | --- | --- | --- |
| How does TTS work? | covered-heavy | `09-api-and-integrations/tts.md` | provider-specific current source |
| Is TTS free? | mixed | `13-reference/free-paid-and-support-boundaries.md` | provider docs/source before exact price claims |
| How do AI features work? | covered-heavy | `09-api-and-integrations/ai-features.md` | `07-overlays-and-pages/ai-cohost-pages.md` |
| Is AI free? | mixed | `13-reference/free-paid-and-support-boundaries.md` | provider account/quota docs |
| How do AI cohost and generated overlays work? | covered-heavy | `07-overlays-and-pages/ai-cohost-pages.md` | runtime/browser/OBS validation |
| How does OBS remote control work? | covered-heavy | `09-api-and-integrations/obs.md` | OBS WebSocket/browser-source validation |
| How do donation/payment webhooks work? | mixed | `07-overlays-and-pages/tipjar-credits.md` | external provider docs and webhook privacy |
| How do graphics integrations work? | mixed | `13-reference/url-parameters.md` | exact integration docs/source |

## Customization, Plugins, And Development Questions

| Question Family | Coverage | Start With | Check Next |
| --- | --- | --- | --- |
| Which customization path should I use? | covered-heavy | `13-reference/customization-path-decision-matrix.md` | `13-reference/customization-plugin-recipes.md`, exact source/runtime path |
| Can I make my own plugin? | covered-heavy | `13-reference/customization-path-decision-matrix.md` | `13-reference/custom-plugins-and-extensions.md`, decide custom overlay/API/Event Flow/source path |
| How do custom overlays work? | covered-heavy | `07-overlays-and-pages/custom-overlays.md` | `docs/customoverlays.md`, sample overlay |
| How do custom JavaScript hooks work? | mixed | `13-reference/customization-path-decision-matrix.md` | `13-reference/custom-plugins-and-extensions.md`, exact current hook/source path |
| How do generic/custom sources work? | covered-heavy | `08-platform-sources/generic-and-custom-sources.md` | `12-development/adding-a-source.md` |
| How do I add a new platform source? | covered-heavy | `12-development/adding-a-source.md` | manifest/source/event-contract source |
| Where is code organized? | covered-heavy | `12-development/repo-map.md` | `12-development/shared-code-rules.md` |
| What provider/shared utilities exist? | covered-heavy | `12-development/provider-cores-and-shared-utils.md` | current provider source |
| What testing standard applies? | mixed | `12-development/testing-and-validation.md` | `12-development/test-asset-matrix.md`, real app/browser/OBS validation |
| Which existing test or Playwright script covers this? | covered-heavy | `12-development/test-asset-matrix.md` | `16-runtime-validation-playbooks.md`, routed feature docs |
| What are build/release boundaries? | covered-heavy | `12-development/build-and-release-boundaries.md` | release docs before release work |

## Platform-Specific Coverage

| Platform Family | Coverage | Start With | Check Next |
| --- | --- | --- | --- |
| YouTube | covered-heavy, needs-intense | `08-platform-sources/youtube.md` | gifts, moderation, app OAuth, helper-copy behavior |
| TikTok | covered-heavy, needs-intense | `08-platform-sources/tiktok.md` | `08-platform-sources/tiktok-standalone-app.md` for app modes, signing, replies, fallbacks, and tests; live/app validation still needed |
| Twitch | covered-heavy, needs-intense | `08-platform-sources/twitch.md` | EventSub scopes, channel points, moderation, send-back |
| Kick | covered-heavy, needs-intense | `08-platform-sources/kick.md` | OAuth/app bridge, CAPTCHA, rewards/moderation |
| Rumble, Facebook, Instagram, Discord | covered-heavy, needs-intense | respective platform docs | exact URL/auth/source-mode validation |
| Static/manual/helper sources | covered-heavy, needs-live-validation | `08-platform-sources/manual-static-and-helper-sources.md` | browser helper behavior |
| WebSocket/API source pages | covered-heavy, needs-intense | `08-platform-sources/websocket-source-pages.md` | auth, reconnect, CORS, send-back |
| Communication/sensitive sources | covered-heavy, needs-live-validation | `08-platform-sources/communication-and-sensitive-sources.md` | opt-in/privacy/current selectors |
| Embedded chat widgets | covered-heavy, needs-live-validation | `08-platform-sources/embedded-chat-widget-sources.md` | iframe/current widget selectors |
| Live commerce | covered-heavy, needs-live-validation | `08-platform-sources/live-commerce-sources.md` | auction/product/WS payload samples |
| Webinar/event sources | covered-heavy, needs-live-validation | `08-platform-sources/webinar-and-event-sources.md` | Q&A/sidebar selectors |
| Creator/live-cam sources | covered-heavy, needs-live-validation | `08-platform-sources/creator-live-cam-sources.md` | token/tip/private-message behavior |
| Popout/chat-only sources | covered-heavy, needs-live-validation | `08-platform-sources/popout-chat-only-sources.md` | exact chat-only URLs and app parity |
| Event/community sources | covered-heavy, needs-live-validation | `08-platform-sources/event-and-community-sources.md` | Q&A/viewer/source identity |
| Independent live platforms | covered-heavy, needs-live-validation | `08-platform-sources/independent-live-platform-sources.md` | viewer/tip/reply/join behavior |
| Video/broadcast platforms | covered-heavy, needs-live-validation | `08-platform-sources/video-broadcast-platform-sources.md` | Q&A/source-icon/login/app parity |
| Community/membership web apps | covered-heavy, needs-live-validation | `08-platform-sources/community-membership-webapp-sources.md` | login/toggles/privacy/app parity |
| Regional/emerging platforms | covered-heavy, needs-live-validation | `08-platform-sources/regional-and-emerging-platform-sources.md` | URL variants/activity-feed/tips |
| Special-case platform/helper sources | covered-heavy, needs-live-validation | `08-platform-sources/special-case-platform-and-helper-sources.md` | mode split and helper-copy status |

## Completion Gaps For This Objective

The objective is broad enough that coverage and validation are separate.

Current docs now cover the major question families. The remaining work is mostly validation quality:

- Line-level validation for exact command/action behavior.
- Page-specific URL parameter parsing beyond generated indexes.
- Exact send-back/moderation/reward/event support by platform and mode.
- Real app/e2e validation for standalone app source windows, auth flows, settings, settings change impact, and TikTok.
- Browser/OBS validation for overlays, themes, games, helper pages, and fragile rendered-page sources.
- Deeper support-history mining only where it improves wording, frequency, or stale-claim detection.
