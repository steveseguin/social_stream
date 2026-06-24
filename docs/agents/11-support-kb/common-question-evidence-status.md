# Common Question Evidence Status

Status: evidence-status pass on 2026-06-24. This is a confidence and validation ledger for common SSN answers, not a user-facing FAQ and not runtime-test evidence.

## Purpose

Use this page when an agent has already found the likely answer route, but needs to know how strongly the current docs support the answer.

This complements:

- `common-question-fast-path.md` for fast answer shape.
- `question-intent-router.md` for first-route selection.
- `common-question-coverage-map.md` for objective coverage.
- `support-evidence-ledger.md` for support-history claim families.
- `13-reference/public-claims-boundary-matrix.md` for broad public claims.
- `15-objective-coverage-and-readiness-audit.md` for the whole docs objective.
- `16-runtime-validation-playbooks.md` for runtime proof requirements.
- `18-focused-validation-evidence-log.md` for deterministic focused tests that are useful but not full runtime proof.

## Evidence Status Labels

| Status | Meaning | How To Answer |
| --- | --- | --- |
| `answer-ready orientation` | Enough docs exist to give cautious practical guidance. | Answer, but name the surface/mode and route to proof docs. |
| `source-backed` | Current source/docs/config were inspected. | Answer more concretely, but avoid saying "tested" unless runtime proof exists. |
| `generated inventory` | A script/config/source inventory produced the list or lookup. | Use for routing and counts, not as proof that runtime behavior currently works. |
| `source-trace` | Specific handlers/parsers/storage paths were traced. | Use for exact code-path caveats; runtime effects still need validation. |
| `support-derived` | Curated support history supports the pattern. | Treat as symptom/frequency evidence, not current truth. |
| `runtime-needed` | Real browser/app/OBS/API/platform behavior is required before a strong claim. | Do not promise exact behavior; collect evidence or run the validation playbook. |
| `runtime-tested` | A real runtime workflow was performed and recorded. | Only use if the exact tested surface, page, command, platform, and limits match. |

Current baseline: most common SSN answers are `answer-ready orientation`, `source-backed`, `generated inventory`, or `source-trace`. Do not label them `runtime-tested` unless a specific runtime evidence note exists.

## Common Question Status Matrix

| Question Family | Current Status | Safe Answer Now | Stronger Claim Needs |
| --- | --- | --- | --- |
| What is SSN? | answer-ready orientation | SSN captures chat/events from supported sources and routes them to dock, overlays, API, TTS, AI, and automation surfaces. | None for a broad product answer; narrow by surface for exact setup. |
| Is SSN free? | source-backed | SSN itself is free/open source; external providers, platforms, payment processors, graphics tools, and hardware can cost money. | Refresh public docs/provider terms before provider-specific pricing claims. |
| Is support paid or guaranteed? | source-backed | Support is best-effort through public/community/project paths; donations are gifts, not support contracts. | Public support/donation wording refresh if those pages change. |
| How many sites are supported? | generated inventory plus focused metadata finding and public-claim boundary | Current agent docs route 139 public site cards from `docs/js/sites.js`; focused metadata validation found no missing required public-card fields but did find duplicate `On24`/`ON24` cards. Normal answers should say SSN has a large public supported-site list. | Re-run the site extraction, reconcile duplicate/stale public cards, and validate public docs before exact counts. |
| Is this site supported? | generated inventory plus source-backed routing | Check the public card, setup type, implementation map, and source/mode docs. | Live platform health validation before saying it works right now. |
| Does a supported site support gifts, raids, rewards, follows, viewer counts, moderation, or send-back? | answer-ready orientation, runtime-needed | It depends on platform, source mode, auth, and event family; check the platform capability matrix and exact source. | Line-level and live validation for that platform/mode/event family. |
| Should I use the extension or standalone app? | source-backed orientation | Use the extension for normal browser/cookie workflows; use the app for managed source windows or some throttling/source-window workflows. | Real Electron app e2e validation before exact parity or login claims. |
| Does the app behave exactly like Chrome? | source-backed, runtime-needed | No broad parity promise; Electron windows, sessions, source injection, OAuth handlers, and embedded login can differ. | App workflow validation for the exact platform/source. |
| Which page or URL should I open? | source-backed orientation | Pick by job: source page for capture/API setup, dock for control, featured/theme pages for OBS output, sample API for command testing. | Runtime validation only when claiming page-specific option behavior. |
| How do I get chat into OBS? | answer-ready orientation | Keep source, dock, and overlay on the same session; add the intended overlay/page URL as an OBS browser source. | OBS/browser-source validation for the exact page, CSS, audio, and payload. |
| Dock is empty. | mixed, support-derived plus source-backed routing | Debug source capture first: source URL/mode, extension/app state, visibility, session, and source toggles. | Platform-specific source validation before exact fix claims. |
| OBS overlay is blank but dock works. | mixed, runtime-needed | Test the same URL in a normal browser, verify session/page purpose/CSS, then refresh OBS browser source. | OBS/browser-source validation for the exact page and payload. |
| Chat stops when hidden/minimized. | source-backed orientation | Browser throttling can affect rendered-page capture; use visible source windows or alternate app/WebSocket/API modes where supported. | Runtime validation for the exact platform/browser/app mode. |
| What command should I use? | source-backed orientation | First classify viewer command, API action, URL parameter, popup setting, Event Flow action, or page-local control. | Line-level or runtime validation for rare/internal/high-side-effect actions. |
| What exact API action exists? | source-backed/source-trace | Use `action-command-index.md` and `api-command-validation-matrix.md`; a relay success does not prove the target acted. | Runtime command proof with exact transport, action, target page/source, session, label, callback, and observed result. |
| Why did my API command do nothing? | source-trace | Check API toggles, session, channel, target page open/connected, label, action support, value shape, and URL encoding. | Runtime proof on the same command transport and target page. |
| What URL parameter controls this? | generated inventory plus focused metadata finding and source-trace | Use the generated parameter index, then verify the target page actually parses that parameter. Focused metadata validation found duplicate generated aliases for `password` and normalized `strokecolor`. | Runtime validation for page-specific behavior, especially themes, games, helper pages, WebSocket source pages, and OBS; reconcile duplicate generated alias metadata before relying on lookup uniqueness. |
| Why did changing a URL option not work? | source-trace | Many options are page/load-time specific; replace the URL or refresh the exact target page/OBS source. | Runtime validation for live-vs-reload behavior on that page. |
| What setting controls this? | generated inventory plus focused metadata validation and source-trace | Use setting docs and exact key index, then check reload/reconnect/app-window rules. Focused metadata validation confirmed current generated setting counts and required-field/category coverage. | Browser/app runtime validation for live update, migration, export/import, and app parity. |
| My settings disappeared. | mixed, runtime-needed | Ask about uninstall/reload, moved unpacked folder, browser profile, app state, import/export, and backups. | Real extension/app settings export/import/reset validation. |
| Can I make a plugin? | source-backed orientation | In SSN, plugin-like work can mean custom overlay, API client, Event Flow, custom JS/user function, or a new source. Pick the smallest path. | Runtime validation for local `custom.js`, uploaded custom user functions, custom overlay payloads, hosted/local/app differences. |
| Can hosted pages load my local JS? | source-backed orientation | Do not promise local disk JS loading on hosted pages; use local/forked pages or trusted supported custom-code paths. | Current source/runtime validation of the exact hosted/local/custom-code path. |
| How do I add a new platform/source? | source-backed | Use a source script, manifest/site metadata/docs, payload compatibility, and extension/app validation. | Implementation-specific code review and runtime checks. |
| Is AI or RAG free? | answer-ready orientation plus focused local-asset, local-model, provider-fallback, and RAG fixture evidence | SSN integrates with AI paths; local AI may be self-hosted, while cloud providers can require keys, accounts, quotas, and payment. Transformers defaults, local model registry wiring, OpenCode Zen fallback, and RAG fixture tests have focused evidence, but local model runtime, live provider availability/pricing, and real user document/provider workflows are not validated by that. | Provider-specific source/runtime and current pricing/terms checks. |
| Is TTS free? | answer-ready orientation plus focused local-asset evidence | Browser/system TTS is generally free; cloud/provider TTS can require account/key/quota/payment and OBS audio behavior differs. Kokoro and Kitten static asset wiring have focused evidence; Piper focused asset test currently fails. | Provider/runtime/OBS validation before exact provider or app claims. |
| Can AI moderate chat? | answer-ready orientation plus focused static moderation evidence, runtime-needed | AI moderation/censoring is optional and best-effort; provider prompts/settings/privacy matter. Focused profanity/moderation tests passed for selected data and source snippets, but that does not prove live moderation quality. | Current provider/settings/runtime validation before strong reliability claims. |
| Can I share logs, screenshots, settings, URLs, or keys? | source-backed | Share only redacted evidence; never share session IDs, passwords, API keys, OAuth tokens, webhooks, private endpoints, or private URLs. | None for the safety rule; exact file contents may need privacy review. |
| Is this a bug? | answer-ready orientation | Collect reproducible surface/mode/source/version/session details, rule out setup/session/source issues, and escalate with redacted evidence. | Current source review or runtime reproduction before labeling it a bug. |
| Was this tested? | source-backed policy | Only real browser/app/OBS/API/platform workflows count as tested. Static source inspection and generated matrices are not actual testing. | A runtime evidence note matching the exact claim. |

## Stronger-Claim Gate

Before upgrading an answer beyond cautious orientation, record:

1. Exact user question and target surface.
2. Exact docs used.
3. Exact source file, generated config, public data row, or support-history source.
4. Whether the evidence is source-backed, generated, support-derived, or runtime-tested.
5. What was not validated.

Do not use a narrow runtime check to support a broader claim. For example, a working `clearOverlay` test does not prove `sendChat`, app parity, OBS audio, or platform moderation.

## Runtime-Tested Claim Template

Only add a runtime-tested note after a real workflow was performed:

```text
Runtime evidence, 2026-06-24:
Surface:
Page/source/platform:
Command/setting/option/workflow:
Input:
Observed:
Not tested:
Evidence files or logs:
```

If a field is not available, say so rather than filling it with assumptions.

## Follow-Up Needs

- Add a runtime evidence subsection per question family only when validation exists.
- Split platform-specific rows into per-platform mini ledgers after intense passes for YouTube, TikTok, Twitch, Kick, Facebook, Instagram, Rumble, and Discord.
- Add a provider-specific AI/TTS status table after provider source/runtime validation.
- Re-run this page after `common-question-fast-path.md`, `support-evidence-ledger.md`, or `public-claims-boundary-matrix.md` changes.
