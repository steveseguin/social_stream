# Common Question Proof Pack

Status: heavy support-evidence routing pass on 2026-06-24. This is not runtime validation.

## Purpose

Use this page when an agent already has a likely short answer, but needs to know what evidence is required before giving a stronger or more exact answer.

This page complements:

- `common-question-fast-path.md` for fast answer shape.
- `support-answer-bank.md` for short practical replies.
- `common-question-evidence-status.md` for evidence-strength labels.
- `support-response-playbook.md` for ready-to-send support wording.
- `../13-reference/feature-cost-claims-proof-ledger.md` for feature, cost, provider, support, service, app-vs-extension, and public-claim proof boundaries.
- `../16-runtime-validation-playbooks.md` for actual runtime validation recipes.

Rule: a proof pack does not prove a claim by itself. It lists what must be checked. Use the linked docs and current source before making exact claims.

## Evidence Levels

| Level | Good For | Not Good For |
| --- | --- | --- |
| `answer-route` | Picking the right doc and first caveat. | Saying a feature works. |
| `source-backed` | Explaining current code/doc behavior cautiously. | Saying it was tested in browser/app/OBS/live platform. |
| `generated-inventory` | Counts, lookup tables, setting keys, URL params, public cards. | Runtime health or platform availability. |
| `source-trace` | Explaining handlers, parser paths, storage, command acceptance, and caveats. | External side effects or user workflow success. |
| `focused-test` | Narrow deterministic behavior, fixtures, or static checks. | Broad user-facing runtime claims. |
| `runtime-proof` | Saying a specific workflow was tested, within its exact limits. | Broader surfaces, modes, pages, platforms, or account states not covered by the run. |

## Strong Answer Gate

Before answering with "yes, this works", "this is supported", "this command does X", "this option controls Y", or "this was tested", collect:

1. The exact user goal and surface: extension, app, hosted page, local page, OBS, API, WebSocket source page, Lite, or Firefox.
2. The exact mode: DOM capture, popout/chat-only, static/manual helper, WebSocket/API source, app source window, Event Flow, API command, URL parameter, or popup setting.
3. The canonical doc route.
4. The current source/config/metadata route when the claim is exact.
5. The proof type: answer-route, source-backed, generated-inventory, source-trace, focused-test, or runtime-proof.
6. What was not checked.

## Proof Packs By Common Question

| Question Family | Short Answer Allowed From Routing Docs | Evidence To Inspect Before Strong Claim | Strong Claim Requires | Do Not Say |
| --- | --- | --- | --- | --- |
| What is SSN? | SSN captures chat/events and routes them to dock, overlays, API, TTS, AI, and automation. | `01-product-map.md`, `13-reference/features-and-capabilities.md`, `13-reference/feature-cost-claims-proof-ledger.md` | Only needed for exact feature/surface claims. | "It is only an OBS overlay." |
| Is SSN free? | SSN itself is free/open source; third-party services can cost money. | `13-reference/free-paid-and-support-boundaries.md`, `13-reference/public-claims-boundary-matrix.md`, `13-reference/feature-cost-claims-proof-ledger.md` | Current provider/platform docs for exact pricing, quotas, or limits. | "Everything is free." |
| Is support paid or guaranteed? | Support is best-effort; donations are gifts, not support contracts. | `13-reference/support-resources-and-escalation.md`, `support-evidence-ledger.md` | Public support/donation wording refresh if this changes. | "A donation guarantees support." |
| How many sites are supported? | SSN has a large public supported-site list; current generated docs route 139 public cards. | `08-platform-sources/supported-sites-lookup.md`, `public-site-support-status.md`, `public-site-implementation-map.md`, `13-reference/feature-cost-claims-proof-ledger.md`, `docs/js/sites.js` | Re-run generated extraction and public-card validation; runtime health validation for "works today." | "Every listed site fully works." |
| Is this site supported? | Check public card, setup type, source route, and mode. | `supported-sites-lookup.md`, `public-site-support-status.md`, `public-site-implementation-map.md`, `manifest-row-matrix.md`, `13-reference/feature-cost-claims-proof-ledger.md`, exact source doc | Browser/app/live page validation for current health. | "Listed means every URL and feature works." |
| Platform rich events, gifts, rewards, follows, viewer counts, moderation, send-back | Depends on platform, source mode, auth, role, scopes, and event family. | `priority-platform-answer-matrix.md`, `priority-platform-validation-ledger.md`, `platform-capability-matrix.md`, `13-reference/feature-cost-claims-proof-ledger.md`, exact platform doc/source | Source-line trace plus live/app/API proof for that exact platform/mode/event. | "Plain chat support means rich events/send-back work." |
| Extension or standalone app? | Extension for normal browser/cookie workflows; app for managed source windows or some throttling/source-window workflows. | `13-reference/app-extension-mode-crosswalk.md`, `modes-and-capability-matrix.md`, `04-standalone-app-source-windows.md` | Real app and extension comparison for the exact platform/workflow. | "The app fixes every login problem." |
| Install or update manually | Load unpacked from a stable extracted folder; update by replacing files and reloading, not uninstalling first. | `13-reference/install-update-version-guide.md`, `02-installation-and-surfaces.md`, `10-troubleshooting/settings-loss-and-backups.md` | Runtime check only for exact browser/app update behavior. | "Uninstall first" without backup/export warning. |
| Chat not appearing anywhere | Split source capture from display; prove dock first. | `10-troubleshooting/diagnostic-decision-tree.md`, `quick-triage.md`, `extension-not-capturing.md`, exact platform doc | Current platform/source validation if the issue is platform-specific. | "OBS is broken" before dock/source checks. |
| Dock works but OBS/overlay is blank | Capture likely works; check overlay URL/session/page purpose/browser preview/OBS refresh/CSS. | `10-troubleshooting/obs-overlay-display.md`, `surface-url-cheatsheet.md`, `07-overlays-and-pages/page-capability-matrix.md` | Browser or OBS validation for that exact page and payload. | "Reinstall SSN first." |
| Which page or URL should I open? | Pick by job: source page, dock, featured, theme, tool page, API test page, or diagnostic helper. | `13-reference/surface-url-cheatsheet.md`, `workflow-setup-decision-tree.md`, `how-to-recipes.md` | Page-specific runtime validation for exact parameter or payload behavior. | "Always open dock only." |
| What command/action should I use? | First classify viewer command, API action, URL parameter, Event Flow action, MIDI/hotkey, or page-local control. | `13-reference/control-surface-crosswalk.md`, `commands-and-actions.md`, `action-command-index.md`, `api-command-proof-ledger.md` | Source-trace or runtime proof for high-side-effect or rare actions. | "All commands use the same syntax." |
| API command says success but nothing changes | Relay acceptance is not proof the target acted. | `api-command-validation-matrix.md`, `api-command-proof-ledger.md`, `command-action-source-trace.md`, `websocket-http-api.md`, target page doc | Runtime proof with exact action, transport, session, channel, target page/source, label, and observed result. | "The API success response proves it worked." |
| What URL option controls this? | Use generated URL parameter lookup, then verify target page parser. | `url-parameter-index.md`, `url-parameter-source-trace.md`, `root-page-url-parameter-matrix.md`, `subpage-url-parameter-matrix.md`, `options-settings-proof-ledger.md` | Runtime proof for exact page/option/load-time behavior. | "Every parameter works on every page." |
| Setting changed but nothing happened | Classify popup setting, URL parameter, generated link, app source state, provider/auth value, or page-local state. | `settings-change-impact-matrix.md`, `settings-session-storage-source-trace.md`, `settings-key-index.md`, `url-parameter-index.md`, `options-settings-proof-ledger.md` | Browser/app/runtime validation for live update, reload, migration, export/import, or app parity. | "All settings update live." |
| Make a plugin or customize SSN | "Plugin" can mean custom overlay, URL/CSS, local custom JS, uploaded user function, Event Flow, API client, or first-class source. | `customization-path-decision-matrix.md`, `customization-plugin-recipes.md`, `custom-plugins-and-extensions.md`, `customization-source-trace.md`, `customization-validation-ledger.md` | Runtime proof for local/hosted/app path, payload handling, custom code loading, and security boundaries. | "There is one plugin zip installer." |
| Add a new source/platform | Add source file, manifest route, site/docs metadata, payload compatibility, and extension/app validation. | `12-development/adding-a-source.md`, `08-platform-sources/generic-and-custom-sources.md`, `manifest-content-scripts.md`, `manifest-row-matrix.md` | Code review plus extension/app/browser validation with controlled payloads. | "Only edit the app fallback mirror." |
| TTS or AI is free/available | SSN integrates with local/system and provider-backed paths; external providers control keys, quotas, pricing, and limits. | `09-api-and-integrations/tts.md`, `ai-features.md`, `free-paid-and-support-boundaries.md`, `public-claims-boundary-matrix.md`, `13-reference/feature-cost-claims-proof-ledger.md` | Current provider docs plus runtime/provider validation for exact availability, pricing, model, voice, audio, or RAG workflow. | "All AI/TTS modes are free." |
| Privacy, logs, screenshots, settings, URLs | Share only redacted evidence. | `13-reference/privacy-security-and-secrets.md`, `support-intake-templates.md`, `support-resources-and-escalation.md` | File-by-file privacy review for logs/settings/screenshots. | "Paste your key/session/webhook." |
| Was this tested? | Only real browser/app/OBS/API/platform workflows count as tested. | `16-runtime-validation-playbooks.md`, `17-runtime-validation-evidence-log.md`, `18-focused-validation-evidence-log.md` | A dated evidence entry matching the exact claim. | "Source-checked means tested." |

## Minimum Proof Artifacts

| Claim Type | Minimum Artifact |
| --- | --- |
| Capture works | Source/platform/mode, new message or controlled payload, dock receipt, same session proof, surface used, not-tested notes. |
| Overlay/page works | Page URL with secrets redacted, source payload, browser preview or OBS result, page mode/label/session, not-tested notes. |
| API action works | Action name, transport, encoded payload, target page/source open, session/channel/label, observed page/source effect, callback/error behavior. |
| URL parameter works | Target page, exact parameter/value, load/refresh behavior, observed DOM/behavior change, conflicting setting/default notes. |
| Setting works | Setting key, UI/app surface, stored value, source/page reload or live update behavior, extension/app parity notes. |
| Platform rich event works | Platform/mode/auth role, sample payload, downstream dock/API/overlay receipt, event field notes, not-tested event families. |
| Send-back works | Platform/mode, signed-in account, scopes/role, source-control path, safe sent message, failure behavior, policy caveat. |
| Customization works | Path used, local/hosted/app boundary, payload sample, error behavior, secret review, fallback/rollback plan. |
| AI/TTS/RAG works | Provider/local path, model/voice/settings, input, output, cost/key/secret boundary, browser/app/OBS/audio notes. |

## How To Record A Promoted Claim

When a common question moves from cautious orientation to stronger evidence:

1. Add runtime evidence to `../17-runtime-validation-evidence-log.md` or focused evidence to `../18-focused-validation-evidence-log.md`.
2. Update the narrow topic doc.
3. Update `common-question-evidence-status.md` if the common answer strength changed.
4. Update `support-evidence-ledger.md` if a support claim was promoted, narrowed, or rejected.
5. Add a row to `../01-extraction-checklist.md`.
6. Update `../15-objective-coverage-and-readiness-audit.md` only if objective-level readiness changed.

## Current Non-Completion Boundary

This page improves answer discipline for common questions, but it does not complete runtime validation. It should make agents less likely to overclaim while they continue validating commands, options, supported sites, modes, customization paths, AI/TTS, app workflows, OBS overlays, and platform behavior.
