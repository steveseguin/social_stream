# Common Question Fast Path

Status: heavy support-routing pass on 2026-06-24. This is a quick answer-selection layer, not runtime validation.

## Purpose

Use this page when an agent needs to answer a common SSN question quickly but still choose the right proof docs before making a precise claim.

This page is intentionally compact. It points to the deeper docs rather than restating all setup steps, commands, settings, platform caveats, or source behavior.

## Source Anchors

- `docs/agents/11-support-kb/question-intent-router.md`
- `docs/agents/11-support-kb/support-answer-bank.md`
- `docs/agents/11-support-kb/support-response-playbook.md`
- `docs/agents/11-support-kb/common-misconceptions-and-boundaries.md`
- `docs/agents/11-support-kb/support-evidence-ledger.md`
- `docs/agents/11-support-kb/common-question-evidence-status.md`
- `docs/agents/11-support-kb/common-question-proof-pack.md`
- `docs/agents/13-reference/index.md`
- `docs/agents/13-reference/public-claims-boundary-matrix.md`
- `docs/agents/15-objective-coverage-and-readiness-audit.md`

## How To Use

1. Match the user question to the closest row.
2. Use the "Fast Answer Shape" as the first sentence or answer outline.
3. Apply the "Must Check" column before making exact claims.
4. Avoid the "Do Not Say" wording unless the linked proof docs and runtime evidence support it.
5. Use `common-question-evidence-status.md` when deciding whether the answer is only orientation, source-backed, generated inventory, source-traced, support-derived, or runtime-tested.
6. Use `common-question-proof-pack.md` before upgrading a cautious answer into a stronger claim.

## Fast Path Matrix

| User Asks | Fast Answer Shape | Must Check | Do Not Say |
| --- | --- | --- | --- |
| "What is SSN?" | SSN captures chat/events from supported sources and routes them to dock, overlays, API, TTS, AI, and automation surfaces. | Whether user means extension, app, hosted page, local page, Lite, API, or source page. | "It is only an OBS overlay." |
| "Is it free?" | SSN itself is free/open source; external providers, platforms, cloud APIs, graphics tools, payment tools, or hardware can still cost money. | `13-reference/free-paid-and-support-boundaries.md`, `13-reference/public-claims-boundary-matrix.md` | "Everything is free." |
| "Is support paid?" | Support is best-effort through public/community paths; donations are gifts, not support contracts. | `13-reference/support-resources-and-escalation.md` | "A donation guarantees support or a feature." |
| "How many sites are supported?" | The public site list is large and current docs route 139 public cards from the latest extraction, but focused metadata validation found duplicate `On24`/`ON24` cards and exact site health/feature support still need source/mode checks. | `08-platform-sources/supported-sites-lookup.md`, `08-platform-sources/public-site-support-status.md`, `13-reference/public-claims-boundary-matrix.md` | "Every listed site fully works right now." |
| "Is this site supported?" | Check the public card, setup type, implementation map, and source/mode docs before answering. | `08-platform-sources/supported-sites-lookup.md`, `08-platform-sources/public-site-implementation-map.md`, exact platform doc | "Supported means all features work." |
| "Why is a listed site broken?" | A public listing is a setup route, not runtime proof; confirm exact URL, mode, source visibility, manifest/source load, and recent platform changes. | `08-platform-sources/public-site-support-status.md`, exact source file | "The list proves it cannot be broken." |
| "Can it send chat back?" | Maybe, depending on platform, source mode, login/auth, permissions, and current implementation. | `08-platform-sources/priority-platform-answer-matrix.md`, `08-platform-sources/priority-platform-validation-ledger.md`, `08-platform-sources/platform-capability-matrix.md`, `08-platform-sources/websocket-source-pages.md`, exact platform source | "Yes, because chat capture works." |
| "Does it support gifts, raids, rewards, follows, or viewer counts?" | Often platform/mode-specific; use priority/capability docs as orientation and source-check the exact event family. | `08-platform-sources/priority-platform-answer-matrix.md`, `08-platform-sources/priority-platform-validation-ledger.md`, `08-platform-sources/platform-capability-matrix.md`, platform doc, Event Flow docs | "All supported sites expose rich events." |
| "Should I use extension or app?" | Use the extension for normal browser/cookie workflows; use the app for managed source windows or some throttling/source-window workflows. | `13-reference/app-extension-mode-crosswalk.md`, `13-reference/modes-and-capability-matrix.md`, `04-standalone-app-source-windows.md` | "The app fixes every login or platform problem." |
| "Does the app behave like Chrome?" | Some behavior is shared, but Electron windows, sessions, source injection, OAuth handlers, and embedded login can differ. | `13-reference/app-extension-mode-crosswalk.md`, `04-standalone-app-source-windows.md`, `10-troubleshooting/desktop-app-issues.md` | "App and extension are identical." |
| "What page do I open?" | Pick by job: source page for capture/API setup, dock for control, featured/theme pages for OBS output, sampleapi for command testing. | `13-reference/surface-url-cheatsheet.md`, `13-reference/workflow-setup-decision-tree.md` | "Always open dock only." |
| "How do I get chat into OBS?" | Keep the source side and dock/overlay on the same session, then add the intended page URL as an OBS browser source. | `13-reference/how-to-recipes.md`, `10-troubleshooting/obs-overlay-display.md` | "OBS is the first suspect when dock is empty." |
| "OBS is blank." | Test the same URL in a normal browser, verify session, source-to-dock flow, page purpose, CSS/transparency, and OBS refresh. | `10-troubleshooting/obs-overlay-display.md`, `07-overlays-and-pages/page-capability-matrix.md` | "Reinstall SSN first." |
| "Dock is empty." | Start with source capture, session ID, extension/app state, source URL/mode, visibility, and source toggles. | `10-troubleshooting/extension-not-capturing.md`, `10-troubleshooting/diagnostic-decision-tree.md` | "OBS is broken." |
| "Chat stops when minimized." | Browser pages can throttle hidden/minimized tabs; keep source visible or use app/WebSocket/API mode where supported. | `13-reference/modes-and-capability-matrix.md`, exact platform mode doc | "The app always prevents throttling." |
| "What command do I use?" | First classify whether it is a viewer command, API action, URL parameter, setting, Event Flow action, or page-local control. | `13-reference/control-surface-crosswalk.md`, `13-reference/commands-and-actions.md`, `13-reference/action-command-index.md` | "All command systems use the same syntax." |
| "What exact API action exists?" | Use the generated/source-checked action index, then validate target page/session/label behavior. | `13-reference/action-command-index.md`, `13-reference/api-command-validation-matrix.md` | "If the relay returns success, the target acted." |
| "Can you give an API example?" | Use a safe example with remote API enabled, session redacted, correct channel/transport, and target page open. | `13-reference/api-command-examples.md`, `09-api-and-integrations/websocket-http-api.md` | "Paste your real session/key publicly." |
| "Why did my API command do nothing?" | Check API toggles, session, channel, target page open/connected, label, action support, and URL encoding. | `13-reference/api-command-validation-matrix.md` | "The command must be invalid." |
| "What URL parameter controls this?" | Use the generated parameter index, then verify the target page actually parses that parameter and reload the page. | `13-reference/url-parameter-index.md`, `13-reference/url-parameter-source-trace.md` | "Every parameter works on every page." |
| "Why did changing a URL not work?" | Many URL options are page/load-time specific; replace the OBS URL or refresh the exact target page. | `13-reference/settings-change-impact-matrix.md`, `13-reference/url-parameter-source-trace.md` | "Changing one URL changes all open pages live." |
| "What setting controls this?" | Use settings/toggles and exact key index, then check whether the source/page needs reload, reconnect, or app-window reopen. | `13-reference/settings-and-toggles.md`, `13-reference/settings-key-index.md`, `13-reference/settings-change-impact-matrix.md` | "All settings update live." |
| "My settings disappeared." | Ask about uninstall/reload, moved unpacked folder, browser profile, app state, import/export, and backups. | `10-troubleshooting/settings-loss-and-backups.md`, `13-reference/settings-session-storage-source-trace.md` | "Uninstall and reinstall without export." |
| "Can I make a plugin?" | In SSN, plugin-like work can mean custom overlay, API client, Event Flow, custom JS/user function, or a new source. Pick the smallest extension point. | `13-reference/customization-path-decision-matrix.md`, `13-reference/customization-plugin-recipes.md` | "There is one official plugin ZIP flow." |
| "Can I customize the overlay?" | Use URL options/CSS/theme for styling, custom overlay for rendering, API/Event Flow for logic, and source code only for first-class changes. | `07-overlays-and-pages/custom-overlays.md`, `13-reference/customization-path-decision-matrix.md` | "Edit core source for simple styling." |
| "Can hosted pages load my local JS?" | Not as a normal local disk file; use local/forked pages or trusted hosted custom-code paths. | `13-reference/custom-plugins-and-extensions.md`, `13-reference/customization-path-decision-matrix.md` | "Just point hosted SSN at a local JS file." |
| "How do I add a new source?" | Create/update a source script, manifest/site metadata/docs, preserve payload contracts, and validate extension/app behavior. | `12-development/adding-a-source.md`, `08-platform-sources/generic-and-custom-sources.md` | "Only edit the app fallback mirror." |
| "Is AI free?" | SSN's integration is included; local AI can be self-hosted, while cloud providers can require keys, accounts, quotas, and payment. | `09-api-and-integrations/ai-features.md`, `13-reference/free-paid-and-support-boundaries.md` | "AI is always free." |
| "Is TTS free?" | Browser/system TTS is generally free; cloud/provider TTS can require account/key/quota/payment and OBS audio behavior differs. | `09-api-and-integrations/tts.md`, `13-reference/free-paid-and-support-boundaries.md` | "All TTS modes are the same." |
| "Can AI moderate chat?" | Treat AI moderation/censoring as optional, best-effort automation; exact behavior needs setting/source checks and privacy caveats. | `09-api-and-integrations/ai-features.md`, `13-reference/settings-key-index.md` | "AI moderation is guaranteed." |
| "Can I share logs, screenshots, settings, URLs, or keys?" | Share only what is needed and redact sessions, passwords, API keys, OAuth tokens, webhooks, private endpoints, private URLs, and personal data. | `13-reference/privacy-security-and-secrets.md`, `11-support-kb/support-intake-templates.md` | "Send the raw file or key." |
| "Is this a bug?" | Gather reproducible mode/surface/source/version/session details, rule out setup/session/source issues, then escalate with redacted evidence. | `13-reference/support-resources-and-escalation.md`, `11-support-kb/support-intake-templates.md` | "It is a bug" without reproduction. |
| "Was this tested?" | Only real browser/app/OBS/API/e2e validation counts as tested; source inspection and generated matrices are supporting evidence only. | `16-runtime-validation-playbooks.md`, `12-development/testing-and-validation.md` | "Source-checked means tested." |

## Exact-Claim Escalation

Do not answer from this page alone when the question names:

- A specific platform feature such as send-back, moderation, rewards, gifts, raids, follows, viewer counts, product lists, auctions, Q&A, or private messages.
- A specific command/action, target label, channel, callback, or Event Flow action.
- A specific URL parameter on a theme, game, WebSocket source page, helper page, or utility page.
- A specific setting's live-update behavior or app/extension storage behavior.
- A specific AI/TTS provider model, price, quota, voice, key format, or endpoint.
- A claim that something was tested in Chrome, the standalone app, OBS, or a live platform.

For those, open the routed topic doc and current source/runtime evidence.

## Minimal Answer Formula

Use this formula for most common support replies:

```text
Short answer. In SSN this depends on [surface/mode/provider/platform]. First check [one concrete thing]. Do not assume [overclaim]. For exact setup or proof, use [routed doc].
```

## Follow-Up Needs

- Add confidence labels per row after runtime validation exists.
- Add source-file line references for high-risk exact claims after intense passes.
- Re-run this matrix when support topic frequency changes or new public feature claims are added.
