# Objective Coverage And Readiness Audit

Status: coverage audit pass on 2026-06-24. This page maps Steve's broad AI-documentation objective to the current agent docs. It is not a claim that the objective is fully complete or runtime-tested.

## Purpose

Use this page to answer:

- Which parts of the requested SSN AI documentation set are covered?
- Which docs prove that coverage exists?
- Which areas are only orientation/source-backed and still need line-level or runtime validation?
- What should be worked on next before declaring the whole goal complete?

This page should be updated after major new extraction, validation, or support-history passes.

For concrete runtime validation recipes and evidence templates, use `16-runtime-validation-playbooks.md`. For actual runtime validation results, use `17-runtime-validation-evidence-log.md`.

For existing npm aliases, Node tests, browser fixtures, Playwright scripts, and feature-to-test routing, use `12-development/test-asset-matrix.md`.

## Objective Requirements

Steve asked for comprehensive AI-focused documentation around:

- Common SSN questions.
- Commands and API actions.
- URL options, popup settings, and modes.
- Supported sites and source/platform behavior.
- Standalone app and Chrome extension/social_stream behavior.
- How to make custom plugins, overlays, sources, and integrations.
- Feature support and whether things are free or external/paid.
- Support history, Discord knowledge base material, and recurring support wording.
- A resource/checklist framework so future agents do not repeat the same extraction or miss files.

## Coverage Matrix

| Requirement | Current Coverage Docs | Evidence Strength | Remaining Gap |
| --- | --- | --- | --- |
| Agent workspace scope and rules | `AGENT.md`, `00-inventory-and-plan.md` | covered-heavy | Keep updated if write boundary or source priority changes. |
| Resource inventory and extraction checklist | `02-resource-manifest.md`, `01-extraction-checklist.md`, `02-resource-processing-ledger.md` | covered-heavy | Continue adding pass rows after every new extraction/validation pass. |
| Agent-doc navigation and link hygiene | `docs/index.html`, `docs/agents/SITEMAP.md`, section `docs/agents/*/SITEMAP.md` files, `99-agent-index.md`, `AGENT.md`, `19-navigation-and-link-audit.md`, section indexes | covered-quick plus focused docs audit plus static viewer/sitemaps | Current audit covers 167 Markdown files with zero unreferenced non-template pages, zero broken exact agent-doc Markdown refs, and zero ambiguous bare section-index filenames. Browser smoke passed for default doc load, deep link load, section sitemap link traversal, raw link state, sidebar filter, and zero console errors. Re-run after major page additions, renames, or section index changes; current audit does not validate external/source links or all rendered anchors. |
| Common question routing and evidence status | `11-support-kb/question-intent-router.md`, `11-support-kb/common-question-fast-path.md`, `11-support-kb/common-question-evidence-status.md`, `11-support-kb/common-question-proof-pack.md`, `11-support-kb/common-question-test-set.md`, `11-support-kb/support-question-phrasebook.md`, `11-support-kb/common-question-coverage-map.md` | covered-heavy plus prompt benchmark | Add new paraphrased support wording after future QA exports and add runtime evidence only after actual validation. Use the proof pack before stronger claims and the test set to check common prompt routing and safe-answer behavior. |
| Short support answers and response phrasing | `11-support-kb/support-answer-bank.md`, `support-response-playbook.md`, `support-macro-routing.md`, `support-intake-templates.md` | covered-heavy | Source-check fragile platform claims before sending final answers. |
| Support-history evidence and stale-claim handling | `11-support-kb/mining-method.md`, `support-history-refresh-playbook.md`, `support-topic-frequency-index.md`, `historical-issues.md`, `support-evidence-ledger.md`, `unresolved-or-stale-claims.md`, `stevesbot-resource-inventory.md` | covered-heavy/frequency-pass plus repeatable refresh workflow | Promote or reject historical claims only after current source or runtime validation. Use the refresh playbook to rerun aggregate support-history counts without leaking raw support data. |
| Product overview and install surfaces | `01-product-map.md`, `02-installation-and-surfaces.md`, `13-reference/install-update-version-guide.md` | covered-heavy | Reconcile exact release/version/update behavior before public final docs. |
| Extension architecture | `03-extension-architecture.md`, `05-message-flow-and-event-contracts.md`, `06-settings-sessions-and-storage.md` | covered-heavy | Line-level background/service-worker routing and migration validation. |
| Standalone app behavior | `04-standalone-app-architecture.md`, `04-standalone-app-source-windows.md`, `13-reference/app-extension-mode-crosswalk.md`, `10-troubleshooting/desktop-app-issues.md`, `08-platform-sources/tiktok-standalone-app.md` | covered-heavy/source-backed | Real Electron app e2e validation, source-window lifecycle, auth, settings, backup/import/export, and TikTok connector runtime behavior. |
| App auth/sign-in issues | `10-troubleshooting/auth-and-sign-in.md`, `04-standalone-app-source-windows.md` | covered-heavy/source-backed | Validate OAuth callbacks, ports, external browser/profile behavior, and platform sign-in paths against current app runtime. |
| Supported site list and setup type | `08-platform-sources/supported-sites-lookup.md`, `public-site-support-status.md`, `public-site-implementation-map.md`, `18-focused-validation-evidence-log.md` | covered-heavy/generated-source inventory plus focused metadata validation | Runtime health validation against real platform pages; reconcile stale/duplicate public cards, including duplicate `On24`/`ON24` metadata. |
| Source file and manifest routing | `08-platform-sources/source-inventory.md`, `source-file-processing-matrix.md`, `manifest-content-scripts.md`, `manifest-row-matrix.md` | covered-heavy/generated-source inventory | Source-check newly added files and validate content-script behavior in browser/app. |
| Platform capability support | `08-platform-sources/priority-platform-answer-matrix.md`, `08-platform-sources/priority-platform-validation-ledger.md`, `08-platform-sources/platform-capability-matrix.md`, individual platform docs | covered-heavy/orientation | Intense validation for send-back, moderation, gifts, rewards, raids, follows, viewer counts, auth, and app parity. |
| Priority platforms | `youtube.md`, `tiktok.md`, `tiktok-standalone-app.md`, `twitch.md`, `kick.md`, `rumble.md`, `facebook.md`, `instagram.md`, `discord.md` | covered-heavy | Runtime and line-level validation for volatile auth/API/DOM/app-connector changes. |
| Long-tail platform/source families | grouped `08-platform-sources/*.md` docs | covered-heavy/grouped | Browser/live validation for fragile DOM selectors and exact URL modes. |
| Custom/generic sources | `08-platform-sources/generic-and-custom-sources.md`, `12-development/adding-a-source.md` | covered-heavy | Validate sample payloads and app/extension parity for new-source workflow. |
| Commands and API actions | `13-reference/control-surface-crosswalk.md`, `commands-and-actions.md`, `action-command-index.md`, `command-action-source-trace.md`, `api-command-validation-matrix.md`, `api-command-proof-ledger.md`, `api-command-examples.md`, `09-api-and-integrations/websocket-http-api.md`, `18-focused-validation-evidence-log.md` | covered-heavy/source-trace plus focused examples consistency check plus evidence ledger | Runtime-validate HTTP/WebSocket examples, target labels, numbered content channels, callbacks, and high-risk actions. |
| URL options and page parameters | `13-reference/control-surface-crosswalk.md`, `options-settings-proof-ledger.md`, `url-parameters.md`, `url-parameter-index.md`, `url-option-examples.md`, `url-parameter-source-trace.md`, `root-page-url-parameter-matrix.md`, `subpage-url-parameter-matrix.md`, `18-focused-validation-evidence-log.md` | covered-heavy/generated/source-trace plus focused metadata validation plus evidence ledger | Runtime-validate page-specific options, server modes, labels, themes, games, and WebSocket source pages; reconcile duplicate `password` and normalized `strokecolor` URL metadata findings. |
| Popup settings and storage | `13-reference/control-surface-crosswalk.md`, `options-settings-proof-ledger.md`, `settings-and-toggles.md`, `settings-key-index.md`, `settings-session-storage-source-trace.md`, `settings-change-impact-matrix.md`, `06-settings-sessions-and-storage.md`, `18-focused-validation-evidence-log.md` | covered-heavy/generated/source-trace plus focused metadata validation plus evidence ledger | Validate live-update vs reload-required behavior, generated-link/OBS refresh behavior, generated docs UI behavior, and app/extension migration/backup paths. |
| Modes and surface selection | `13-reference/control-surface-crosswalk.md`, `app-extension-mode-crosswalk.md`, `modes-and-capability-matrix.md`, `workflow-setup-decision-tree.md`, `surface-url-cheatsheet.md`, `preflight-checklists.md` | covered-heavy | Add tested app/source/page examples after runtime validation. |
| Feature support yes/depends/free/dev answers | `13-reference/features-and-capabilities.md`, `feature-support-decision-matrix.md`, `free-paid-and-support-boundaries.md`, `public-claims-boundary-matrix.md` | covered-heavy | Provider/platform-specific pricing and capability changes need refresh. |
| Broad public claim boundaries | `13-reference/public-claims-boundary-matrix.md`, `11-support-kb/public-docs-coverage.md`, `common-misconceptions-and-boundaries.md`, `support-evidence-ledger.md` | covered-heavy/source-backed orientation | Promote exact 100+/120+ site, two-way, no-API-key, app, AI/TTS, plugin, support, and service claims only after current source/runtime validation. |
| Plugin/customization paths | `13-reference/customization-path-decision-matrix.md`, `13-reference/customization-source-trace.md`, `13-reference/customization-validation-ledger.md`, `13-reference/customization-plugin-recipes.md`, `custom-plugins-and-extensions.md`, `07-overlays-and-pages/custom-overlays.md`, `12-development/adding-a-source.md` | covered-heavy/source-trace plus evidence ledger | Validate local `custom.js`, uploaded custom user function behavior, custom overlay payloads, and hosted/local/app differences. |
| OBS and overlay workflows | `07-overlays-and-pages/index.md`, `dock.md`, `featured.md`, `multi-alerts.md`, `page-capability-matrix.md`, `10-troubleshooting/obs-overlay-display.md` | covered-heavy | Controlled browser/OBS payload validation and page-specific behavior checks. |
| Games, themes, tool pages, and helpers | `game-pages.md`, `theme-pages.md`, `event-effect-overlays.md`, `live-display-utilities.md`, `diagnostic-helper-pages.md`, `specialized-legacy-pages.md`, `page-processing-matrix.md` | covered-heavy | Browser/OBS validation for rendering, storage, channel, payload, and import/export behavior. |
| TTS and AI | `09-api-and-integrations/tts.md`, `ai-features.md`, `07-overlays-and-pages/ai-cohost-pages.md`, `free-paid-and-support-boundaries.md`, `18-focused-validation-evidence-log.md` | covered-heavy plus focused AI prompt, moderation, local model, provider fallback, local asset, and RAG fixture evidence | Provider-by-provider source/runtime validation, OBS audio checks, model download/runtime checks, real RAG upload/delete/provider workflows, app behavior, live moderation quality, local model setup, live AI prompt generation, `aioverlay.html` runtime/OBS behavior, and costs/quotas remain needed. Piper focused asset test currently fails. |
| Event Flow, Streamer.bot, StreamDeck, OBS control | `09-api-and-integrations/event-flow-editor.md`, `streamerbot.md`, `streamdeck-companion.md`, `obs.md`, `api-command-examples.md`, `18-focused-validation-evidence-log.md` | covered-heavy plus focused Event Flow Node-test evidence | Runtime integration tests and exact trigger/action/payload validation remain needed for editor UI, Flow Actions overlay, OBS, Streamer.bot, StreamDeck, webhooks, relay, TTS, Spotify, MIDI, points, and send-message actions. |
| Privacy, secrets, cost, and support boundaries | `13-reference/privacy-security-and-secrets.md`, `free-paid-and-support-boundaries.md`, `support-resources-and-escalation.md`, `common-misconceptions-and-boundaries.md` | covered-heavy | Keep aligned with public Terms/Privacy/support docs and external-provider changes. |
| Runtime validation workflow and evidence log | `14-validation-and-refresh-roadmap.md`, `16-runtime-validation-playbooks.md`, `17-runtime-validation-evidence-log.md`, `12-development/testing-and-validation.md` | covered-heavy plus narrow browser validation evidence | Continue executing and recording real runtime validation before promoting claims to tested. |
| Existing test asset routing | `12-development/test-asset-matrix.md`, `testing-and-validation.md`, `18-focused-validation-evidence-log.md` | covered-heavy plus focused validation evidence | Continue running focused assets and recording results before using them as evidence; current focused evidence includes settings config JSON validation, generated metadata validation with findings, and selected Node/browser-fixture checks. Many scripts are sanity checks, not full runtime validation. |
| Development, testing, release boundaries | `12-development/index.md`, `repo-map.md`, `shared-code-rules.md`, `provider-cores-and-shared-utils.md`, `testing-and-validation.md`, `test-asset-matrix.md`, `build-and-release-boundaries.md` | covered-heavy | Add exact file responsibility maps as code evolves; real testing still required for app/runtime claims. |

## Readiness Labels

| Label | Meaning |
| --- | --- |
| `answer-ready orientation` | Enough docs exist to route a question and give cautious first guidance. |
| `source-backed` | Current repo source/docs were inspected, but not every line or runtime side effect is validated. |
| `generated inventory` | Generated from code/config/site metadata; useful for lookup, not proof of runtime health. |
| `source-trace` | Specific handlers/settings/parsers were traced, but real app/browser/OBS behavior still needs validation. |
| `runtime-tested` | Only use after actual browser, app, OBS, API, or platform workflow validation is performed and recorded. |

Most current docs are `answer-ready orientation`, `source-backed`, `generated inventory`, or `source-trace`. Very few should be treated as `runtime-tested`.

## Current Answer Readiness By Question Type

| Question Type | Readiness | Safe Current Behavior |
| --- | --- | --- |
| "What is SSN?" | answer-ready orientation | Answer directly from product/support docs. |
| "What is the fastest safe answer path for a common question?" | answer-ready orientation | Start with `common-question-fast-path.md`, then open the routed proof docs before exact claims. |
| "How strong is the evidence for this common answer?" | answer-ready orientation | Start with `common-question-evidence-status.md`, then inspect `common-question-proof-pack.md`, routed docs, and runtime evidence before stronger wording. |
| "What proof is needed before a stronger answer?" | answer-ready orientation | Start with `common-question-proof-pack.md`, then gather the exact source/config/focused/runtime evidence required by the question family. |
| "Which support macro should I use?" | answer-ready orientation | Start with `support-macro-routing.md`, then source-check the routed topic docs before exact platform or app claims. |
| "Is SSN free?" | answer-ready orientation | Say SSN is free/open source; third-party providers/platforms can cost money. |
| "Can I repeat the public 100+/120+/two-way/no-API-key claim?" | answer-ready orientation | Use `public-claims-boundary-matrix.md`; narrow by platform, mode, provider, and validation level. |
| "Should I use app or extension?" | answer-ready orientation | Explain tradeoffs; avoid promising app parity without validation. |
| "Is this site supported?" | generated inventory + support-status | Route by exact public card, setup type, source file, and mode; do not promise every feature. |
| "Does this site support send-back/rewards/gifts/moderation?" | needs-intense | Use capability docs as orientation, then source-check exact platform/mode. |
| "What command/action should I send?" | source-backed/source-trace plus focused examples consistency check plus evidence ledger | Use exact action docs; use `api-command-validation-matrix.md` and `api-command-proof-ledger.md` for accepted-vs-acted-on caveats and proof requirements. A focused docs check found no example actions missing from `action-command-index.md`, but runtime-validate high-risk commands before final recipes. |
| "Is this a command, setting, URL option, mode, label, source, or plugin?" | answer-ready orientation | Use the crosswalk to classify the control surface before giving exact syntax. |
| "What URL option controls this?" | generated inventory/source-trace plus evidence ledger | Check generated index plus page-specific parser and `options-settings-proof-ledger.md`; many options are page/load-time specific. |
| "What setting controls this?" | generated inventory/source-trace plus evidence ledger | Check setting index, UI/source file, storage behavior, `settings-change-impact-matrix.md`, and `options-settings-proof-ledger.md` for reload/reconnect triage and proof needs. |
| "Can I make a plugin?" | answer-ready orientation | Start with the customization path matrix, explain extension points and boundaries, use `customization-validation-ledger.md` for proof status, and do not invent a marketplace/zip installer flow. |
| "How do I make a custom overlay/source?" | source-backed | Use custom overlay/new source docs; validate payload and app/extension behavior for final development work. |
| "Why is OBS blank?" | answer-ready orientation | Run dock/source/session/browser-first checks; actual OBS behavior still requires runtime validation. |
| "Why did app sign-in fail?" | source-backed, needs-runtime | App docs route the issue; exact OAuth/login behavior needs current runtime/app validation. |
| "Can AI/TTS/RAG/generated overlays do X and is it free?" | answer-ready orientation plus focused fixture/static/browser-smoke evidence for selected local paths | Split SSN integration from provider cost/account/quotas/hardware; source-check exact provider behavior. RAG fixture tests, AI prompt builder smoke tests, local model registry checks, and OpenCode Zen fallback checks passed for deterministic paths, but real user document/provider/model/generated-overlay workflows still need validation. |
| "Can I share this URL/log/screenshot?" | answer-ready orientation | Route to privacy docs and redact secrets. |
| "Has any runtime validation been recorded?" | partial runtime evidence | Start with `17-runtime-validation-evidence-log.md`; current evidence is narrow and does not remove broader runtime gaps. |
| "Has any focused non-runtime validation been recorded?" | partial focused evidence | Start with `18-focused-validation-evidence-log.md`; current evidence covers selected Event Flow Node tests, Twitch subgift provider normalization, AI prompt builder smoke behavior, profanity/moderation static checks, local browser model registry checks, OpenCode Zen fallback checks, Kokoro/Kitten/Transformers static asset wiring, RAG fixture/benchmark behavior, API command examples documentation consistency, and a failed Piper asset expectation. It does not prove UI/app/OBS/live-platform/API relay behavior. |

## What Would Prove Completion

The documentation objective should not be marked complete until current evidence proves:

1. All major question families route to a canonical doc.
2. High-value docs contain enough direct setup/troubleshooting guidance to answer common questions without broad re-mining.
3. Every public supported-site card has a route to source/manifest/setup docs and stale-risk notes.
4. Commands, URL options, settings, modes, custom/plugin paths, cost boundaries, and feature support have both narrative docs and lookup tables.
5. Support-history summaries are represented without copying private transcripts and are clearly separated from current source truth.
6. All new docs are indexed from `AGENT.md`, `99-agent-index.md`, and the relevant section indexes.
7. Extraction checklist and resource ledger show which files/data have been processed and at what level.
8. Remaining validation gaps are explicitly listed in `14-validation-and-refresh-roadmap.md`, actionable through `16-runtime-validation-playbooks.md`, and cross-checked against existing assets in `12-development/test-asset-matrix.md`.
9. Runtime-tested claims have actual runtime evidence, not only static/source inspection.
10. Docs-only validation passes and no files outside the approved docs scope, `docs/index.html` plus `docs/agents`, were changed for the documentation work.

Items 1 through 8 are mostly covered. Item 6 now has focused docs-navigation audit support from `19-navigation-and-link-audit.md`, which found zero unreferenced non-template Markdown pages, zero broken exact agent-doc Markdown references, and zero ambiguous bare section-index filenames across 167 Markdown files. Items 9 and 10 must be rechecked at the end of every continuation. Item 9 remains the largest reason not to mark the full objective complete.

Current runtime evidence is partial. As of 2026-06-24, `17-runtime-validation-evidence-log.md` records controlled local browser validation for `scoreboard.html` preview/local scoring behavior and `reactions.html` popup URL parsing, synthetic bridge/payload rendering, fake server-mode joins, and controlled TikTok-like target routing. It also records a failed `multi-alerts.html` validation attempt that timed out waiting for the preview iframe overlay API. This evidence does not validate OBS, hosted pages, the real extension/app bridge, live platform/source payloads, real WebSocket relay delivery, labels/password/session behavior outside the tested URLs, or long-running persistence.

Focused non-runtime evidence is also partial. As of 2026-06-24, `18-focused-validation-evidence-log.md` records passing settings config JSON validation and Event Flow Node tests for custom JS allow/block detection, custom JS trigger/action behavior, compare-property triggers, template variables, counters, OBS system triggers, and `playTenorGiphy` duration behavior. It also records generated metadata validation for settings, URL parameters, and public site cards; that check confirmed current counts and required-field coverage but found duplicate URL aliases for `password` and normalized `strokecolor`, plus duplicate public `On24`/`ON24` cards. It also records passing focused tests for Twitch subgift provider normalization, AI prompt builder smoke behavior, profanity/moderation static checks, local browser model registry checks, OpenCode Zen fallback checks, Kokoro asset wiring, Kitten TTS asset wiring, Transformers local defaults, RAG browser-fixture/benchmark behavior, and API command examples documentation consistency, plus a failing Piper asset wiring test on an expected fallback remote-base string. The API examples consistency check found 29 extracted action examples and, after docs updates, zero missing entries across action index, validation matrix, and source trace. This evidence does not validate the Event Flow editor UI, Flow Actions overlay, OBS, extension runtime, standalone app runtime, live source payloads, model download/runtime behavior, browser audio, live moderation quality, real RAG upload/provider workflows, live provider availability/pricing, live AI prompt generation, generated overlay quality, settings UI/storage behavior, generated docs UI behavior, page-specific URL parsing, public supported-sites UI behavior, API relay behavior, action callbacks, target labels, numbered content channels, or external integration actions.

## Highest-Value Remaining Work

1. Runtime-validate command/API examples from `api-command-examples.md`, `command-action-source-trace.md`, and `api-command-validation-matrix.md`.
2. Runtime-validate URL parameter behavior for `dock.html`, `featured.html`, theme pages, games, WebSocket source pages, and utility pages.
3. Validate public supported-site health for stale-risk cards in `public-site-implementation-map.md`.
4. Validate standalone app source-window, OAuth, settings, backup/import/export, and TikTok connector/signing/reply workflows in a real app run.
5. Validate OBS/browser rendering for dock, featured, multi-alerts, themes, games, and diagnostic/helper pages.
6. Execute the priority platform validation ledger with real source-line and runtime proof for YouTube, TikTok, Twitch, Kick, Facebook, Instagram, Rumble, and Discord.
7. Re-run support-history mining after new curated QA exports and update `support-question-phrasebook.md` and `support-topic-frequency-index.md`.
