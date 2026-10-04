# Feature, Cost, And Public Claim Proof Ledger

Status: heavy evidence-ledger pass on 2026-06-24. This is a source-backed claim discipline page, not runtime validation and not a pricing/legal audit.

## Purpose

Use this page when a user asks whether SSN can do something, whether a feature is free or paid, whether a public claim can be repeated, or whether a broad feature claim applies to the standalone app, Chrome extension, OBS, Lite, Firefox, a platform, or a provider.

This page does not replace the feature matrix or public-claim matrix. It tells agents what proof is enough before making a stronger answer.

## Related Pages

- `features-and-capabilities.md`
- `feature-support-decision-matrix.md`
- `free-paid-and-support-boundaries.md`
- `public-claims-boundary-matrix.md`
- `modes-and-capability-matrix.md`
- `app-extension-mode-crosswalk.md`
- `../08-platform-sources/public-site-support-status.md`
- `../08-platform-sources/public-site-implementation-map.md`
- `../08-platform-sources/platform-capability-matrix.md`
- `../08-platform-sources/priority-platform-validation-ledger.md`
- `../09-api-and-integrations/ai-features.md`
- `../09-api-and-integrations/tts.md`
- `../11-support-kb/common-question-proof-pack.md`
- `../11-support-kb/common-question-evidence-status.md`
- `../11-support-kb/support-evidence-ledger.md`
- `../16-runtime-validation-playbooks.md`
- `../18-focused-validation-evidence-log.md`

## Evidence Labels

| Label | Meaning | Safe Use |
| --- | --- | --- |
| `answer-route` | A routing doc or matrix points to the right topic. | Give cautious orientation and ask for exact platform/mode if needed. |
| `source-backed` | Current repo docs/source/config support the general claim. | Explain current behavior without saying it was tested. |
| `generated-inventory` | A generated or parsed inventory produced a count, list, setting, URL parameter, or site card. | Use for lookup/routing, not runtime health. |
| `focused-tested` | A deterministic static, Node, fixture, or browser-smoke test supports a narrow internal path. | Mention the narrow checked path and what it does not prove. |
| `provider-current-needed` | External provider pricing, quota, account, API, model, voice, or terms may change. | Do not give exact pricing or availability without current provider docs/runtime checks. |
| `runtime-needed` | Real browser, app, OBS, API, or live platform behavior is required. | Do not say "works" or "tested" for the exact user workflow yet. |
| `do-not-promise` | The broad claim is too strong or unsupported without narrowing. | Rephrase to the narrower evidence-backed answer. |

## Current Evidence Summary

| Claim Area | Current Evidence | Safe Agent Action | Stronger Claim Needs |
| --- | --- | --- | --- |
| Product/free/open-source baseline | `README.md`, download/support docs, `free-paid-and-support-boundaries.md` | Say SSN itself is free/open source. | Current public docs review if wording changes. |
| External costs | Provider docs are not version-pinned in these agent docs. | Say providers, platforms, payment tools, graphics systems, and hardware can cost money. | Current provider/platform pricing and terms check. |
| Broad supported-site count/list | `docs/js/sites.js`, generated public-site docs, focused metadata validation. | Say SSN has a large public supported-site list and route to the exact platform. | Re-run inventory and validate public docs before exact counts; live validation before "works today." |
| Platform support | Public card, manifest/source maps, grouped platform docs. | Classify setup type and mode; do not infer every feature from the listing. | Source-line and live/app/browser validation for the exact platform and URL mode. |
| Feature support | `features-and-capabilities.md` and `feature-support-decision-matrix.md`. | Answer yes/depends/external/dev with mode and proof caveats. | Runtime proof for exact page/platform/app/OBS/provider workflow. |
| Two-way chat/send-back/moderation/rich events | Platform capability docs and priority platform ledgers. | Say it depends on platform, auth, role, scope, and source mode. | Line-level source trace plus live/app/API proof. |
| Standalone app benefits | App architecture, source-window docs, app crosswalk. | Say the app can help with source windows and some throttling workflows. | Real Electron app validation for the exact platform/login/source behavior. |
| AI/TTS/RAG/cohost/generated overlays | AI/TTS docs plus focused local/model/RAG/prompt/moderation tests. | Split SSN integration from provider/local setup, cost, privacy, and runtime limits. | Provider-current checks plus browser/app/OBS/runtime validation for the exact model, voice, or workflow. |
| Customization/plugins | Customization docs and `customization-validation-ledger.md`. | Explain the real extension point: URL/CSS, theme, custom overlay, custom JS, API/Event Flow, or source file. | Runtime proof for the chosen custom path and surface. |
| API/commands | Command docs and `api-command-proof-ledger.md`. | Use command proof docs; relay acceptance is not target action proof. | Runtime command proof with exact transport, session, target page/source, label, callback, and observed result. |
| URL options/settings | Options/settings proof ledger and generated lookup docs. | Use option/setting proof docs; page parser and reload behavior matter. | Runtime proof for exact page/setting/option/app state behavior. |
| Support/services/community expectations | Support resources, services page notes, donation/support boundaries. | Say support is best-effort and services are community/user-handled unless current public docs say otherwise. | Current public support/services review before stronger service/support wording. |

## Claim Ledger

| User Or Public Claim | Status | Safe Answer | Required Proof Before Stronger Wording |
| --- | --- | --- | --- |
| "SSN is free." | source-backed | SSN itself is free/open source. External providers, platforms, payment processors, graphics tools, and hardware can still cost money. | Current provider/platform docs for exact cost or quota claims. |
| "Everything is free." | do-not-promise | No. SSN is free, but third-party services and hardware may cost money. | Do not promote. Split SSN cost from provider/platform cost. |
| "No API keys are needed." | do-not-promise | Many rendered-page capture modes do not need SSN-specific API keys, but some platform/API/provider modes need login, OAuth, tokens, or API keys. | Exact platform/source/provider route and current source/provider docs. |
| "120+ sites all fully work." | do-not-promise | SSN has a large public supported-site list; exact setup and feature support vary by platform and mode. | Re-run public-card inventory, reconcile duplicates/stale rows, and validate representative live flows. |
| "Supported means send-back, gifts, rewards, moderation, and viewer counts work." | do-not-promise | Supported usually means a capture/setup path exists. Rich events and send-back are separate platform/mode claims. | Platform capability source-line trace and live/app/API validation. |
| "The standalone app fixes hidden/minimized throttling for every source." | do-not-promise | The app can help with managed source windows and some throttling workflows, but embedded browser, login, CAPTCHA, platform, and source behavior can differ from Chrome. | Exact app workflow validation. |
| "AI is built in and free." | do-not-promise | SSN includes AI integration paths. Local/self-hosted paths may be free after setup; cloud providers can require keys, accounts, quotas, and payment. | Current provider docs plus runtime validation for exact model/workflow. |
| "TTS is built in and free." | source-backed with external caveat | Browser/system and local TTS paths can be free, while provider-backed TTS can require accounts, keys, quotas, and payment. | Runtime audio/OBS/app validation and provider-current checks for exact provider claims. |
| "RAG/document answers work." | focused-tested only for fixtures | Fixture RAG tests passed for deterministic local data, but real user upload/delete/provider workflows are not proven by that. | Real document/provider/runtime workflow validation. |
| "AI moderation works." | focused-tested only for selected checks | AI moderation is optional and best-effort. Focused moderation/profanity checks do not prove live moderation quality. | Live provider/settings/runtime validation and failure-mode review. |
| "Premium TTS is included." | do-not-promise | SSN can integrate with provider TTS. The provider controls account access, pricing, quotas, voices, and availability. | Provider-current docs and browser/app/OBS audio validation. |
| "Plugins install from a zip or marketplace." | do-not-promise | SSN has customization paths, not one generic plugin marketplace/zip installer path. | Route to `customization-validation-ledger.md` and validate the chosen extension point. |
| "This API command works because it returned success." | do-not-promise | Success can mean the relay accepted the request; target page/source action still needs proof. | Route to `api-command-proof-ledger.md` and runtime-validate the target effect. |
| "This URL option or popup setting works everywhere." | do-not-promise | URL options and settings are page/surface/load-time specific. | Route to `options-settings-proof-ledger.md` and validate exact target behavior. |
| "Support is guaranteed because SSN has Discord/services/donations." | do-not-promise | Support is best-effort. Donations are not service contracts. Community services are not an official guarantee unless public docs change. | Current support/services public docs review. |
| "A public source listing proves the app and extension both work." | do-not-promise | Public listing is a routing signal; app and extension behavior can differ. | Browser extension and Electron app validation for the exact source. |

## Minimum Proof Pack By Claim Type

| Claim Type | Minimum Evidence Before Strong Answer |
| --- | --- |
| Exact feature support | Feature matrix route, exact platform/page/source/mode, source/config route, and runtime-needed note if untested. |
| Exact platform support | Public card or source file, setup type, manifest/source route, target URL mode, and current live/browser/app validation before "works today." |
| Exact free/paid claim | SSN public docs plus current provider/platform/payment/hardware pricing or terms if external services are involved. |
| Exact AI/TTS provider claim | Provider settings/source route, account/key/privacy/cost boundary, model/voice, and browser/app/OBS/runtime evidence. |
| Exact app-vs-extension claim | Source-window/app docs, matching extension source route, and real Electron plus Chrome workflow evidence. |
| Exact public-count claim | Current generated inventory, duplicate/stale reconciliation, public docs wording, and date of extraction. |
| Exact customization/plugin claim | Chosen customization path, source hook, hosted/local/app boundary, payload sample, security review, and runtime proof. |
| Exact command/API claim | Action name, transport, session/channel/label, target page/source, callback behavior, and observed target effect. |
| Exact option/setting claim | Setting key or URL parameter, target page/surface, storage/parser path, reload/live-update behavior, and observed result. |

## Update Rules

When a feature, cost, or public claim changes:

1. Update the narrow topic doc first.
2. Update `feature-support-decision-matrix.md`, `free-paid-and-support-boundaries.md`, or `public-claims-boundary-matrix.md` if the answer route changed.
3. Update this ledger if the proof status, evidence label, or do-not-promise boundary changed.
4. Update `../11-support-kb/common-question-evidence-status.md` and `../11-support-kb/support-evidence-ledger.md` when support wording changes.
5. Record runtime evidence in `../17-runtime-validation-evidence-log.md` or focused evidence in `../18-focused-validation-evidence-log.md` before promoting a claim.
6. Add a pass-log row to `../01-extraction-checklist.md`.

## Current Non-Completion Boundary

This ledger improves answer safety for common feature, cost, and public-claim questions. It does not complete the full docs objective because many exact claims still require runtime app, extension, OBS, platform, provider, settings, command, and custom-code validation.
