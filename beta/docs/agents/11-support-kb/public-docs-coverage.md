# Public Docs Coverage Map

Status: heavy public-doc inventory pass started from current `docs/` files.

## Purpose

Use this page when deciding whether an existing public doc is a source of truth, a user-facing summary, a generated reference, or a stale-risk support artifact.

This page does not replace current code. If a public doc and source code disagree, verify the behavior in code before answering.

## Source Anchors

- `docs/*.html`
- `docs/*.md`
- `docs/md/*.md`
- `docs/js/sites.js`
- `docs/js/settings.js`
- `docs/data/services.json`
- `README.md`
- `api.md`
- `parameters.md`
- `docs/event-reference.html`
- `docs/settings.html`
- `docs/supported-sites.html`
- `docs/agents/02-resource-manifest.md`
- `docs/agents/13-reference/public-claims-boundary-matrix.md`

## Current Public Doc Inventory

Checked on 2026-07-26. This excludes `docs/agents/**` and static CSS/image assets.

| Area | Files | Agent Use |
| --- | --- | --- |
| Product/install/support | `docs/index.html`, `docs/download.html`, `docs/features.html`, `docs/guides.html`, `docs/knowledge-base.html`, `docs/support.html`, `docs/services.html`, `docs/platform-setup-picker.html`, `docs/export-settings-for-support.html` | Good user-facing summary and first-stop routing. Source-check precise claims before promising exact behavior. |
| API/commands/events/settings/sites | `docs/commands.html`, `docs/event-reference.html`, `docs/settings.html`, `docs/supported-sites.html`, `docs/event-flow-recipes.html`, `docs/llm-control-guide.html`, `docs/test-message-guide.html` | High-value references and workflow guides. `event-reference.html` is canonical for event vocabulary; settings/sites pages are generated from shared/public data. |
| Customization and overlay docs | `docs/customoverlays.md`, `docs/custom-fonts.html`, `docs/templates.html`, `docs/overlay-template-quick-start.html`, `docs/overlay-customization-guide.html`, `docs/on-screen-chat-overlay.html`, `docs/tip-jar-goal-meter.html`, `docs/media-hosting-event-flow.html` | Good practical coverage. Confirm local-vs-hosted limitations and event compatibility before giving exact setup instructions. |
| TTS/AI docs | `docs/tts.html`, `docs/tts-setup-guide.html`, `docs/local-tts.html`, `docs/ai-modes-guide.html`, `docs/chatbot-basics-guide.html`, `docs/ai-cohost-guide.html`, `docs/ai-overlay-builder-guide.html`, `docs/twitch-bot-account-chatbot.html` | Good setup coverage. Provider costs, model availability, API details, and multimodal support are volatile. |
| Platform-specific guides | `docs/source-types-guide.html`, `docs/tiktok-quick-start.html`, `docs/tiktok-guide.html`, `docs/tiktok-app-modes-guide.html`, `docs/youtube-setup-guide.html`, `docs/youtube-project-setup.html`, `docs/vdo-native-social-stream-guide.html`, `docs/zoom.md`, `docs/kick-channel-points-event-flow.md` | Useful setup guides. Platform details are volatile and should be source-checked. |
| OBS and display guides | `docs/obs-quick-start.html`, `docs/obs-troubleshooting.html`, `docs/on-screen-chat-overlay.html`, `docs/video-stats-bitrate.html` | Strong first-pass coverage for common OBS and on-screen display workflows. Exact OBS/app behavior still needs runtime checks. |
| Newer feature guides | `docs/first-time-chatters.html`, `docs/hype-train-top-bar.html`, `docs/tip-jar-goal-meter.html`, `docs/video-stats-bitrate.html` | Useful feature-specific docs. Check current settings/source behavior before treating as complete. |
| Standalone app docs | `docs/ssapp.html`, `docs/appImage.md` | Good public app guide. For exact app behavior, verify in `ssapp` source. |
| Planning/history | `docs/youtube-websocket-streaming-plan.md`, `docs/llm-control-finalization-plan.md`, `docs/local-media-library-plan.md` | Planning artifacts. Do not treat as implemented behavior without source proof. |
| Generated code/event indexes | `docs/md/*.md` | Useful for discovery and function/event inventory. Confirm generated date/source and current code before using as final behavior proof. |
| Public data/scripts | `docs/js/sites.js`, `docs/js/settings.js`, `docs/data/services.json` | Current public-page data sources. Good for site/settings/service inventory. |

## Canonical Or Near-Canonical References

Use these first when answering exact questions, then confirm with code when risk is high:

| File | Role | Caveats |
| --- | --- | --- |
| `api.md` | Root API command and transport reference. | Some commands still need line-level verification in `background.js`, `dock.html`, and tool pages. |
| `parameters.md` | Root URL parameter catalogue. | Some parameters are page-specific; check target page code. |
| `docs/event-reference.html` | Canonical event payload vocabulary. | Update whenever event fields/types change. |
| `docs/settings.html` | Public generated settings/URL parameter reference. | Depends on `docs/js/settings.js`, `shared/config/settingsDefinitions.js`, and `shared/config/urlParameters.js`. Focused metadata validation found duplicate generated URL aliases for `password` and normalized `strokecolor`; validate UI behavior separately. |
| `docs/supported-sites.html` | Public generated supported-site page. | Depends on `docs/js/sites.js`; focused metadata validation found duplicate `On24`/`ON24` cards. Check manifest/source for implementation and validate UI/live behavior separately. |
| `docs/customoverlays.md` | Custom overlay connection and payload handling. | Verify if transport patterns or payload fields change. |
| `docs/commands.html` | Public commands/API guide. | Broad user-facing guide; exact command behavior still needs code checks. |

## User-Facing Summary Docs

These docs are useful for tone, public positioning, install links, and broad capabilities, but they should not be the only proof for exact support answers:

| File | What It Covers | Common Risk |
| --- | --- | --- |
| `docs/features.html` | Feature families, broad product positioning, supported platform examples. | "Most platforms" and feature-support claims need platform/mode validation. |
| `docs/download.html` | Install options and release links. | Store/app links and OS support can change. |
| `docs/guides.html` | General setup and customization guide. | UI paths and install instructions can drift. |
| `docs/support.html` | Support paths, contribute/donate/service info. | Support channels and availability can change. |
| `docs/services.html` | Hire/freelancer/service page. | Business/support boundary claims can change. |
| `docs/templates.html` | Templates gallery. | Template availability and hosted links can change. |
| `docs/index.html` | Product homepage content. | Marketing-level claims need code/doc verification. |

## Platform And Feature Guides

| File | Main Use | Verification Needed |
| --- | --- | --- |
| `docs/tiktok-guide.html` | TikTok setup/troubleshooting. | Current TikTok source/app connection behavior, signing, age/region/account restrictions. |
| `docs/youtube-project-setup.html` | Google/YouTube project setup. | OAuth scopes, Google UI, app-vs-extension flows. |
| `docs/zoom.md` | Zoom app/setup note. | Current standalone app and Zoom capture behavior. |
| `docs/kick-channel-points-event-flow.md` | Kick rewards to Event Flow workflow. | Current Kick bridge/source fields and Event Flow trigger/action behavior. |
| `docs/first-time-chatters.html` | First-time chatter feature guide. | Current settings keys and detection logic. |
| `docs/hype-train-top-bar.html` | Hype train top bar guide. | Current top-bar settings and event fields. |
| `docs/ai-cohost-guide.html` | AI cohost setup. | Current AI provider request format, model support, image/multimodal support. |
| `docs/tts.html` | General TTS setup. | Provider settings, API keys, browser audio behavior. |
| `docs/local-tts.html` | Local AI TTS setup. | Model asset availability, hardware/browser support, local bridge behavior. |
| `docs/custom-fonts.html` | Self-hosted fonts and overlay styling. | Browser/OBS CORS and hosted/local asset behavior. |

## Generated Markdown In `docs/md`

Observed files:

- `docs/md/event-types-generated.md`
- `docs/md/events-canonical.md`
- `docs/md/events-message-types.md`
- `docs/md/function-index-social.md`
- `docs/md/function-index-ssapp.md`
- `docs/md/functions-core-catalog.md`
- `docs/md/functions-social.md`
- `docs/md/functions-ssapp-catalog.md`
- `docs/md/functions-ssapp.md`

Use these for:

- Finding functions or IPC surfaces.
- Finding event vocabulary candidates.
- Discovering large code areas for an intense pass.

Do not use these alone as final proof. Generated indexes can lag source, include generated artifacts, or describe function names without explaining runtime behavior.

## Public Data Files

| File | Role | Agent Handling |
| --- | --- | --- |
| `docs/js/sites.js` | Public site cards, setup type, setup instructions, notes. | Use for public support lookup; verify implementation in manifest/source. |
| `docs/js/settings.js` | Settings reference page behavior. | Use with `shared/config/settingsDefinitions.js` and `shared/config/urlParameters.js`. |
| `docs/data/services.json` | Public services/hire page data. | Do not infer support guarantees from service listings. |

## Stale-Claim Risk Rules

Treat a public doc claim as stale-risk when it is about:

- Third-party platform DOM/API behavior.
- OAuth scopes or provider dashboards.
- App store/release/store-review timing.
- AI model/provider support.
- TTS provider pricing, quotas, or model names.
- Browser/OBS autoplay/audio policies.
- Exact UI labels for settings that are generated or recently changed.
- Any "fixed in beta" or version-specific behavior.

When risk is high, answer with a dated/source-backed caveat or inspect current code before answering.

## Coverage Against Agent Docs

| Public Topic | Agent Doc Coverage |
| --- | --- |
| Product/install/surfaces | `01-product-map.md`, `02-installation-and-surfaces.md`, `13-reference/modes-and-capability-matrix.md` |
| Commands/API | `09-api-and-integrations/websocket-http-api.md`, `13-reference/commands-and-actions.md` |
| URL parameters | `13-reference/url-parameters.md`, `settings-and-toggles.md` |
| Settings | `06-settings-sessions-and-storage.md`, `13-reference/settings-and-toggles.md` |
| Supported sites | `08-platform-sources/source-inventory.md`, `supported-sites-lookup.md`, `manifest-content-scripts.md` |
| Broad public claims | `13-reference/public-claims-boundary-matrix.md`, `13-reference/features-and-capabilities.md`, `13-reference/feature-support-decision-matrix.md` |
| Custom overlays | `07-overlays-and-pages/custom-overlays.md`, `13-reference/how-to-recipes.md` |
| TTS | `09-api-and-integrations/tts.md` |
| AI/cohost | `09-api-and-integrations/ai-features.md` |
| OBS | `09-api-and-integrations/obs.md`, `10-troubleshooting/obs-overlay-display.md` |
| Standalone app | `04-standalone-app-architecture.md`, `10-troubleshooting/desktop-app-issues.md` |
| Platform guides | `08-platform-sources/*.md`, `10-troubleshooting/platform-known-issues.md` |
| Support and services | `11-support-kb/common-questions.md`, `support-resources-and-escalation.md`, `free-paid-and-support-boundaries.md` |

## Extraction Gaps

Needed intense passes:

- Runtime/source-promote rows from `13-reference/public-claims-boundary-matrix.md` against current source, docs, and real workflows.
- Add a generated public-doc freshness report with file modified dates and source anchors.
- Verify `docs/md` generated indexes against current code generation process.
- Promote verified public-doc facts into topic docs and move stale claims into `unresolved-or-stale-claims.md`.

## Prioritized Public Guide Gaps

Second-pass priority review on 2026-07-26:

| Priority | Suggested Public Guide | Why It Matters | Readiness / Risk |
| --- | --- | --- | --- |
| Added | [Safe updates, backups, and settings recovery](../../safe-updates-backups.html) | Install/update questions and lost settings recur, while `export-settings-for-support.html` is support-package focused rather than an upgrade-safety walkthrough. | Verified 2026-07-26 against current extension controls and SSApp 0.4.7 menus; settings and encrypted full-session transfer tests passed. |
| Added | [Twitch setup and EventSub mode guide](../../twitch-eventsub-setup.html) | Twitch is a major source, but the public docs only had the separate bot-account chatbot guide. Users need normal capture vs EventSub/WebSocket, OAuth/scopes, rewards, replies, and first checks. | Verified 2026-07-26 against the current Twitch source, OAuth scopes, EventSub subscription list, official Twitch references, and subscription-gift test. |
| Added | [Kick setup and authentication guide](../../kick-setup-authentication.html) | The public Kick material focused on channel-point Event Flow, not basic capture, app/WebSocket choices, login, rewards, or common failures. | Verified 2026-07-26 against the packaged Kick source, current bridge scopes and subscriptions, and Kick's official OAuth/scopes/event references. |
| P1 | Desktop app login and authentication guide | App-vs-browser sign-in failures are common and scattered across mode and troubleshooting pages. | Agent auth/app docs provide structure; verify current external-browser and OAuth flows in the real app. |
| Added | [Sessions, passwords, and relay/server modes explained](../../sessions-passwords-relay-modes.html) | Session mismatch and routing problems cause many blank dock/overlay cases; current guidance was split across quick starts, settings, commands, and troubleshooting. | Verified 2026-07-26 against current popup labels, page-specific generated-link routing, and link-generation regression tests. |
| Added | [Events and alerts compatibility guide](../../events-alerts-compatibility.html) | `event-reference.html` defines payloads, but users still need a plain-language map from platform/mode events to Multi Alerts, Event Flow, TTS, goals, and API consumers. | Verified 2026-07-26 against current platform sources, Multi Alerts classification, TTS filtering, goal behavior, and the Multi Alerts end-to-end test. |
| P2 | Firefox, Chromium, desktop app, and Lite limitations | Install surfaces are listed, but a concise capability comparison would prevent users choosing a surface that cannot support their required source or workflow. | Much of the comparison exists in agent docs; confirm current Firefox packaging and app parity. |

Remaining priorities: desktop app login/authentication, then a verified Firefox/Chromium/desktop/Lite capability comparison.
