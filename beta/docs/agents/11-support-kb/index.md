# Support Knowledge Base Index

Status: support routing pass started on 2026-06-24.

## Purpose

Use this section when an AI agent needs to answer SSN support questions quickly without losing the boundary between confirmed current behavior, support-history patterns, and stale or unverified claims.

Start here when the user asks a practical question in plain language, then route to the narrower page before giving platform-specific or feature-specific advice.

## Pages

- `common-questions.md`: longer repo-backed FAQ and triage notes.
- `question-intent-router.md`: plain-language user wording to canonical doc route, first disambiguation question, and wrong-route warnings.
- `common-question-fast-path.md`: compact matrix of common user questions to fast answer shape, required checks, overclaims to avoid, and proof docs.
- `support-question-phrasebook.md`: paraphrased support-history wording patterns tied to canonical docs and safe answer boundaries.
- `common-question-coverage-map.md`: objective-level coverage map for common question families and remaining validation gaps.
- `common-question-evidence-status.md`: evidence-strength and runtime-proof status for common SSN answer families.
- `common-question-proof-pack.md`: evidence requirements before stronger answers about commands, options, supported sites, modes, customization, costs, privacy, testing, and platform behavior.
- `common-question-test-set.md`: benchmark-style prompt set for checking whether agents can route and answer common SSN questions without guessing or overclaiming.
- `../15-objective-coverage-and-readiness-audit.md`: objective requirement coverage, answer-readiness labels, completion evidence, and remaining proof gaps.
- `../16-runtime-validation-playbooks.md`: runtime validation recipes and evidence templates for promoting support claims from source-backed to tested.
- `common-misconceptions-and-boundaries.md`: common overclaims, safe answer boundaries, and safer phrasing patterns.
- `support-answer-bank.md`: concise answer patterns for common support replies.
- `support-response-playbook.md`: ready-to-send support answer templates with safe follow-up questions and no-overclaim rules.
- `support-macro-routing.md`: SSN-filtered support macros from curated playbooks, including safe intake, overlay blank, TikTok, Twitch auth, platform-change, API no-op, app, AI/TTS, plugin, and escalation packet routing.
- `support-intake-templates.md`: copyable intake/repro templates for collecting useful details without secrets.
- `../13-reference/privacy-security-and-secrets.md`: central privacy, redaction, webhook, settings export, and secret-handling guide.
- `historical-issues.md`: recurring support issue categories from curated support history.
- `support-evidence-ledger.md`: common support claim families, evidence status, docs that use them, and next validation targets.
- `support-history-refresh-playbook.md`: safe aggregate-query workflow for refreshing support-history priorities, prompt shapes, phrasebook entries, stale claims, and tracking docs.
- `support-topic-frequency-index.md`: anonymized SSN-filtered support topic counts from curated QA exports, with routing priorities.
- `mining-method.md`: how support databases and loose support files were inspected safely.
- `public-docs-coverage.md`: current public docs inventory and stale-risk rules.
- `../13-reference/public-claims-boundary-matrix.md`: boundaries for broad public claims like 100+/120+ sites, two-way chat, no API keys, free/open-source, AI/TTS, app, plugins, services, and support promises.
- `support-source-map.md`: which support/history sources have been used and how.
- `stevesbot-resource-inventory.md`: support archive resource groups, safe/skip rules, current extraction depth, and future mining queues.
- `unresolved-or-stale-claims.md`: claims that need current source or live validation before reuse.

## First-Answer Router

| User Intent | Start With | Then Check |
| --- | --- | --- |
| "What is SSN?" | `question-intent-router.md` | `support-answer-bank.md` product basics, `01-product-map.md` |
| "What is the fastest safe answer path for this common question?" | `common-question-fast-path.md` | Routed topic docs and current source |
| "Can I test whether an agent answers common SSN questions correctly?" | `common-question-test-set.md` | Routed topic docs, common overclaim docs, and runtime evidence where required |
| "What proof do I need before making a stronger answer?" | `common-question-proof-pack.md` | Routed topic docs, source/config, and runtime evidence where required |
| "Is it free?" | `question-intent-router.md` | `support-answer-bank.md` product basics, `13-reference/free-paid-and-support-boundaries.md`, `13-reference/public-claims-boundary-matrix.md` |
| "What should I not overpromise?" | `common-misconceptions-and-boundaries.md` | Routed topic docs and current source |
| "Can I repeat a public claim like 120+ sites, free, two-way, or no API keys?" | `../13-reference/public-claims-boundary-matrix.md` | Routed topic docs and current source |
| "Can I share this URL, screenshot, log, settings file, or key?" | `../13-reference/privacy-security-and-secrets.md` | `support-intake-templates.md`, `support-resources-and-escalation.md` |
| "Should I use the app or extension?" | `13-reference/app-extension-mode-crosswalk.md` | `13-reference/modes-and-capability-matrix.md`, `04-standalone-app-source-windows.md`, `10-troubleshooting/desktop-app-issues.md` |
| "How do I install or update?" | `13-reference/install-update-version-guide.md` | `02-installation-and-surfaces.md`, `13-reference/how-to-recipes.md` |
| "Why is my version different or behind?" | `13-reference/install-update-version-guide.md` | `02-installation-and-surfaces.md`, `10-troubleshooting/settings-loss-and-backups.md` |
| "What should I check before going live or after updating?" | `13-reference/preflight-checklists.md` | `13-reference/how-to-recipes.md`, relevant troubleshooting docs |
| "Chat is not showing up." | `question-intent-router.md` | `support-answer-bank.md` capture troubleshooting, `10-troubleshooting/diagnostic-decision-tree.md`, `10-troubleshooting/quick-triage.md`, `10-troubleshooting/extension-not-capturing.md` |
| "OBS overlay is blank." | `support-answer-bank.md` OBS and overlays | `10-troubleshooting/obs-overlay-display.md`, `13-reference/surface-url-cheatsheet.md` |
| "Is this site supported?" | `question-intent-router.md` | `support-answer-bank.md` platform quick answers, `08-platform-sources/supported-sites-lookup.md`, `08-platform-sources/public-site-support-status.md`, `08-platform-sources/public-site-implementation-map.md` |
| "Does this platform support gifts, rewards, raids, send-back, or moderation?" | `support-answer-bank.md` platform quick answers | `08-platform-sources/platform-capability-matrix.md`, exact platform doc |
| "This source file looks confusing." | `support-answer-bank.md` platform quick answers | `08-platform-sources/manual-static-and-helper-sources.md`, `08-platform-sources/websocket-source-pages.md`, `08-platform-sources/special-case-platform-and-helper-sources.md` |
| "What URL or page should I open?" | `13-reference/surface-url-cheatsheet.md` | `13-reference/how-to-recipes.md` |
| "Can you show me an overlay URL example?" | `13-reference/url-option-examples.md` | `13-reference/url-parameters.md`, `13-reference/url-parameter-index.md` |
| "Why does this URL parameter not work on this page?" | `13-reference/url-parameter-source-trace.md` | `13-reference/url-parameters.md`, `13-reference/url-option-examples.md`, target page source |
| "What should I use for this setup?" | `13-reference/workflow-setup-decision-tree.md` | `13-reference/modes-and-capability-matrix.md`, `13-reference/how-to-recipes.md` |
| "Is this a command, URL option, setting, mode, label, source, or plugin path?" | `13-reference/control-surface-crosswalk.md` | routed narrow docs and current source |
| "What command/action should I use?" | `question-intent-router.md` | `13-reference/commands-and-actions.md`, `13-reference/action-command-index.md`, `13-reference/command-action-source-trace.md`, `09-api-and-integrations/websocket-http-api.md` |
| "Can you show me an API command example?" | `13-reference/api-command-examples.md` | `13-reference/action-command-index.md`, `09-api-and-integrations/websocket-http-api.md` |
| "What setting or URL parameter controls this?" | `question-intent-router.md` | `13-reference/settings-and-toggles.md`, `13-reference/settings-change-impact-matrix.md`, `13-reference/settings-session-storage-source-trace.md`, `13-reference/settings-key-index.md`, `13-reference/url-parameters.md`, `13-reference/url-parameter-index.md`, `13-reference/url-parameter-source-trace.md` |
| "Can I customize it or make a plugin/source?" | `question-intent-router.md` | `13-reference/customization-path-decision-matrix.md`, `13-reference/customization-plugin-recipes.md`, `13-reference/custom-plugins-and-extensions.md`, `12-development/adding-a-source.md`, `07-overlays-and-pages/custom-overlays.md` |
| "TTS or AI is not working." | `09-api-and-integrations/tts.md`, `09-api-and-integrations/ai-features.md` | `13-reference/free-paid-and-support-boundaries.md` |
| "Standalone app source windows are not working." | `10-troubleshooting/desktop-app-issues.md` | `04-standalone-app-source-windows.md` |
| "Is this a bug?" | `13-reference/support-resources-and-escalation.md` | Relevant troubleshooting/platform docs, then current source |
| "I need a polished support reply." | `support-response-playbook.md` | Routed topic docs and current source |
| "Is there a short macro for this support thread?" | `support-macro-routing.md` | `support-response-playbook.md`, routed topic docs and current source |
| "What information should I ask the user for?" | `support-intake-templates.md` | Routed topic docs and current source |
| "Do these AI docs already cover this kind of question?" | `common-question-coverage-map.md` | The routed topic docs and current source |
| "How close are these AI docs to done?" | `../15-objective-coverage-and-readiness-audit.md` | `../14-validation-and-refresh-roadmap.md`, checklist, ledger |
| "How strong is the evidence for this common answer?" | `common-question-evidence-status.md` | `common-question-proof-pack.md`, routed topic docs, `support-evidence-ledger.md`, runtime evidence if any |
| "How do I safely refresh support-history counts and prompt patterns?" | `support-history-refresh-playbook.md` | `stevesbot-resource-inventory.md`, `mining-method.md`, `support-source-map.md` |
| "Can I say this was tested?" | `../16-runtime-validation-playbooks.md` | `support-evidence-ledger.md`, routed topic docs, current source |
| "How do users usually phrase this problem?" | `support-question-phrasebook.md` | `question-intent-router.md`, routed topic docs, current source |
| "What support topics appear most often?" | `support-topic-frequency-index.md` | `common-question-coverage-map.md`, `support-evidence-ledger.md` |

## Triage Evidence Checklist

Collect only what is needed for the question:

- SSN surface: extension, standalone app, hosted page, local page, Lite, API, or WebSocket source page.
- Version/source: Chrome Web Store, manual GitHub install, app build, Firefox, or modified local repo.
- Exact SSN page URL without secrets: page name, session presence, and important URL parameters.
- Platform/source URL shape: platform, popout/chat page, source page, studio page, watch page, or helper page.
- Whether chat is visible and actively updating on the source page.
- Whether the dock receives messages before testing overlays.
- Whether the same session ID is used on source, dock, overlay, API, and app.
- Console errors, app logs, or screenshots with private data redacted.
- Recent changes: extension reload, app update, browser update, platform layout change, settings import, or moved unpacked-extension folder.

## Safety And Privacy Rules

- Do not paste raw support transcripts or private database records into these docs.
- Redact session IDs, passwords, API keys, OAuth tokens, webhook URLs, private channel names, private server names, and personal contact details.
- Treat communication, meeting, assistant, and membership sources as privacy-sensitive even when capture is technically possible.
- Say "supported in this mode" instead of broadly saying a platform supports everything.
- Do not promise send-chat, moderation, rewards, gifts, purchases, analytics, or API access without checking the platform-specific doc and current source.

## How To Use Support History

Support history is useful for symptom wording, frequency, and likely failure points. It is not final proof of current behavior.

Use this order:

1. Current `social_stream` code and docs.
2. Current `ssapp` code/docs for desktop app behavior.
3. Curated `stevesbot` support material.
4. Raw or mined support data only as summarized, redacted evidence.

If a support-history claim conflicts with current source, route it to `unresolved-or-stale-claims.md` instead of repeating it as fact.

## Follow-Up Extraction Needs

- Add anonymized top-answer examples after the raw support history is mined more deeply.
- Source-check the first-answer router against current code after major platform-source or app changes.
- Expand `support-evidence-ledger.md` with source-file references and high-frequency SQLite topic rows after deeper validation passes.
- Re-run `support-topic-frequency-index.md` after new curated QA exports and compare topic deltas.
- Validate the support wording against real in-app/e2e testing for Electron-specific claims, using `../16-runtime-validation-playbooks.md` to record evidence.
