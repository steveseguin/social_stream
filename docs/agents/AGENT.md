# SSN AI Documentation Agent Brief

This folder is a temporary, AI-focused documentation workspace for Social Stream Ninja. It is not a release artifact, not a ZIP package, and should not be treated as end-user website docs unless Steve later asks for that.

## Scope

Create exhaustive markdown documentation for:

- Social Stream Ninja Chrome extension in `C:\Users\steve\Code\social_stream`
- Social Stream Ninja standalone Electron app in `C:\Users\steve\Code\ssapp`
- Shared behavior between the extension and app, especially source scripts, overlays, sessions, APIs, settings, and troubleshooting
- Support knowledge from `C:\Users\steve\Code\stevesbot`, filtered to SSN-related material

## Write Boundary

Only write inside:

`C:\Users\steve\Code\social_stream\docs\agents`

Do not edit project code, generated docs, release files, app files, or support bot files while building this documentation set unless Steve explicitly changes the scope.

Current explicit scope exception: Steve approved a static, human-facing Markdown viewer at `C:\Users\steve\Code\social_stream\docs\index.html` and sitemap Markdown files under `docs/agents`. Do not edit other public docs unless Steve asks.

## Source Priority

Use sources in this order:

1. Current code in `social_stream` and `ssapp`
2. Existing repo docs in `social_stream`, especially `README.md`, `api.md`, `parameters.md`, `docs/event-reference.html`, `docs/customoverlays.md`, `docs/ssapp.html`, `docs/tiktok-guide.html`, `docs/local-tts.html`, and `docs/tts.html`
3. Current app docs in `ssapp`, especially `README.md`, `RELEASE.md`, and test files that document expected behavior
4. Curated support material in `stevesbot/resources/instructions` and `stevesbot/resources/learnings`
5. SQLite summaries in `stevesbot/resources/knowledge.sqlite`, `stevesbot/data/sqlite/knowledge.sqlite`, and `stevesbot/data/sqlite/stevesbot.sqlite`
6. Raw Discord archive data only when needed to confirm real-world symptoms, wording, or frequency

## Exclusions

Do not use or document from:

- `C:\Users\steve\Code\ssapp\resources\social_stream_fallback`
- `C:\Users\steve\Code\stevesbot\resources\secrets`
- Non-SSN support content unless it directly clarifies an SSN integration
- Raw private support identities unless they are needed as anonymized examples

## Documentation Style

Write for future AI agents first, but keep the content usable by humans. Prefer factual, source-backed notes over generic guidance.

Each topic page should include:

- Purpose
- Where the relevant code and docs live
- How the feature works
- How users set it up
- Common failure modes
- Troubleshooting steps
- Known differences between Chrome extension and standalone app
- Open questions or areas needing deeper review

When support data conflicts with current code, mark it as historical and verify against source before turning it into current guidance.

## Current Navigation

Start with:

- `docs/agents/99-agent-index.md`: master index, current coverage summary, and suggested next passes.
- `docs/agents/SITEMAP.md`: static viewer navigation source and grep-free folder map.
- `docs/agents/01-extraction-checklist.md`: extraction levels, pass history, and checklist status.
- `docs/agents/02-resource-manifest.md`: source inventory for code, docs, support data, and historical archives.
- `docs/agents/02-resource-processing-ledger.md`: current processing depth by resource group.
- `docs/agents/14-validation-and-refresh-roadmap.md`: remaining intense/live-validation queue and pass protocol.
- `docs/agents/15-objective-coverage-and-readiness-audit.md`: objective requirement coverage, answer-readiness labels, completion evidence, and remaining proof gaps.
- `docs/agents/16-runtime-validation-playbooks.md`: concrete runtime validation recipes and evidence templates for promoting source-backed claims to tested claims.
- `docs/agents/17-runtime-validation-evidence-log.md`: actual runtime validation evidence entries, currently including controlled browser validation for `scoreboard.html` and `reactions.html`, plus a failed `multi-alerts.html` validation attempt.
- `docs/agents/18-focused-validation-evidence-log.md`: deterministic focused validation evidence that is useful but not full runtime testing, currently including settings config JSON, generated settings/URL/public-site metadata checks, Event Flow, Twitch provider, AI prompt builder, AI moderation, local model registry, provider fallback, local TTS, local AI asset, RAG fixture tests, and API command examples documentation consistency.
- `docs/agents/19-navigation-and-link-audit.md`: docs-navigation audit results for agent Markdown discoverability, broken agent-doc references, ambiguous bare section-index filenames, and wildcard reference caveats.

For support-style answers:

- `docs/agents/11-support-kb/index.md`: first-answer router, support section map, and evidence checklist.
- `docs/agents/11-support-kb/question-intent-router.md`: plain-language user wording to canonical doc route, first disambiguation question, and wrong-route warnings.
- `docs/agents/11-support-kb/common-question-fast-path.md`: compact answer-shape matrix for common questions, with required checks and overclaims to avoid.
- `docs/agents/11-support-kb/common-question-evidence-status.md`: evidence-strength and runtime-proof status for common answer families.
- `docs/agents/11-support-kb/common-question-test-set.md`: benchmark-style prompt set for testing common-question routing and safe-answer behavior.
- `docs/agents/11-support-kb/support-question-phrasebook.md`: paraphrased support-history wording patterns tied to canonical docs and safe answer boundaries.
- `docs/agents/11-support-kb/support-macro-routing.md`: SSN-filtered support macros from curated support playbooks for safe intake, common short replies, and escalation routing.
- `docs/agents/11-support-kb/common-question-coverage-map.md`: objective-level map of common question families to current docs.
- `docs/agents/11-support-kb/common-misconceptions-and-boundaries.md`: common overclaims, stale-claim risks, and safer support wording.
- `docs/agents/08-platform-sources/priority-platform-answer-matrix.md`: safe phrasing and first checks for high-volume platform capability, rich-event, send-back, and app/extension platform questions.
- `docs/agents/08-platform-sources/priority-platform-validation-ledger.md`: proof status, evidence labels, and validation targets for high-risk YouTube, TikTok, Twitch, Kick, Rumble, Facebook, Instagram, and Discord claims.
- `docs/agents/13-reference/public-claims-boundary-matrix.md`: boundaries for broad public claims such as 100+/120+ sites, two-way chat, no API keys, free/open-source, AI/TTS, app behavior, plugins/customization, services, and support promises.
- `docs/agents/11-support-kb/support-response-playbook.md`: ready-to-send response templates and follow-up prompts.
- `docs/agents/11-support-kb/support-evidence-ledger.md`: support claim families, evidence status, and next validation targets.
- `docs/agents/11-support-kb/support-history-refresh-playbook.md`: safe support-history refresh workflow, aggregate query pack, redaction gate, and required downstream updates.
- `docs/agents/11-support-kb/stevesbot-resource-inventory.md`: support archive resource groups, safe/skip rules, and extraction depth.

For setup and troubleshooting:

- `docs/agents/13-reference/control-surface-crosswalk.md`: disambiguates commands, URL parameters, settings, sessions, labels, modes, source pages, Event Flow, custom JS, and plugin-like paths.
- `docs/agents/13-reference/app-extension-mode-crosswalk.md`: first-stop comparison for Chrome extension, standalone app, hosted pages, local pages, Lite, Firefox, WebSocket/API source pages, and custom sources.
- `docs/agents/13-reference/customization-path-decision-matrix.md`: first-stop routing for ambiguous customization, plugin, custom overlay, custom JS, API app, Event Flow, or source-file requests.
- `docs/agents/13-reference/customization-source-trace.md`: source-checked local `custom.js`, uploaded custom JavaScript, custom overlay, API/WebSocket source, Event Flow, and first-class source hook boundaries.
- `docs/agents/13-reference/api-command-validation-matrix.md`: source-checked API command routing, accepted-vs-acted-on caveats, callbacks, and runtime proof boundaries.
- `docs/agents/13-reference/workflow-setup-decision-tree.md`: choose source side, receiving page, transport, and options from the user goal.
- `docs/agents/13-reference/url-parameter-source-trace.md`: source-checked page-specific URL parameter parsing, socket/channel differences, and unsafe URL overclaims.
- `docs/agents/13-reference/settings-session-storage-source-trace.md`: source-checked extension/app settings storage split, session/password save flow, generated links, app backup layers, and reset guardrails.
- `docs/agents/13-reference/settings-change-impact-matrix.md`: source-checked reload/reconnect triage for popup settings, URL options, generated links, app source state, cached settings, provider/auth values, and page-local state.
- `docs/agents/10-troubleshooting/diagnostic-decision-tree.md`: classify vague or mixed "SSN is not working" reports.
- `docs/agents/10-troubleshooting/quick-triage.md`: compact first-pass troubleshooting flow.

For exact product behavior:

- `docs/agents/03-extension-architecture.md`: Chrome extension architecture.
- `docs/agents/04-standalone-app-architecture.md`: standalone Electron app architecture.
- `docs/agents/04-standalone-app-source-windows.md`: app source windows, source injection, app parity, and source state.
- `docs/agents/05-message-flow-and-event-contracts.md`: message flow, event contracts, and payload boundaries.
- `docs/agents/06-settings-sessions-and-storage.md`: settings, sessions, storage, and backup boundaries.

For feature-specific answers:

- `docs/agents/07-overlays-and-pages/index.md`: dock, overlays, pages, games, themes, alert tools, and helper pages.
- `docs/agents/08-platform-sources/index.md`: platform/source setup, capture modes, capability routing, and source-script families.
- `docs/agents/09-api-and-integrations/index.md`: WebSocket/HTTP API, TTS, AI, OBS, StreamDeck, Event Flow, and Streamer.bot.
- `docs/agents/12-development/index.md`: source development, repo map, shared-code rules, testing notes, and release boundaries.
- `docs/agents/12-development/test-asset-matrix.md`: existing Node tests, browser fixtures, Playwright scripts, npm aliases, setup assumptions, and feature-to-test routing.
- `docs/agents/13-reference/index.md`: commands, URL parameters, settings, feature matrices, public claim boundaries, costs, glossary, customization path routing, plugin recipes, and how-to recipes.

## Answer Workflow

1. Identify the user's intent: setup, troubleshooting, capability check, platform-specific behavior, commands/API, customization, app behavior, or development.
2. Start from the matching router: support KB index, workflow setup decision tree, diagnostic decision tree, platform index, overlay index, API/integration index, or development index.
3. Read the exact topic page before answering. Do not answer from the index alone for fragile claims.
4. Check `common-misconceptions-and-boundaries.md`, `public-claims-boundary-matrix.md`, `support-evidence-ledger.md`, and `common-question-evidence-status.md` before making broad claims about supported sites, app parity, send-back, costs, privacy, support, services, or testing.
5. Use `support-macro-routing.md` for short support-thread macros and `support-response-playbook.md` for fuller user-facing phrasing when the answer resembles a support reply.
6. Inspect current source code before presenting high-risk or final-grade claims about selectors, auth flows, command payloads, send-back, settings persistence, source windows, app parity, or rendered overlay behavior.

## Validation State

Most common question families now have heavy-pass routing and source-backed orientation docs. This is not the same as final validation.

Do not claim a feature was "tested" unless real functional in-app, browser, OBS, or end-to-end validation was performed. Static code review, generated matrices, support mining, and smoke checks are useful evidence, but they are not actual testing for this project.

Use `16-runtime-validation-playbooks.md` before promoting a command, URL option, source, app workflow, OBS page, integration, AI/TTS path, or support claim to a runtime-tested status. Record actual runtime validation results in `17-runtime-validation-evidence-log.md`. Record focused deterministic tests that are useful but not full runtime validation in `18-focused-validation-evidence-log.md`.

Use `19-navigation-and-link-audit.md` after large documentation-growth or rename passes to confirm agent docs remain discoverable and exact `docs/agents` Markdown references still resolve.

Remaining final-grade gaps include:

- Line-level command/action behavior.
- Live validation of page-specific URL parsing, server modes, labels, and custom CSS/JS behavior.
- Per-platform feature support, rich events, moderation/send-back, and app parity.
- Real Electron app validation for source windows, auth, settings, backups, and TikTok-related flows.
- Browser/OBS validation for overlays, themes, games, helper pages, fragile source selectors, and WebSocket/API source pages.
- Refreshing historical support claims against current `social_stream` and `ssapp` source before treating them as current guidance.
