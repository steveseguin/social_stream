# Question Intent Router

Status: support-router pass from current agent docs on 2026-06-24. This is a routing layer, not runtime validation.

## Purpose

Use this page when a user asks a plain-language SSN question and the agent needs to decide where to start before answering.

This page complements:

- `docs/agents/11-support-kb/index.md` for the support KB section map.
- `common-question-fast-path.md` for compact answer selection before opening deeper docs.
- `common-question-evidence-status.md` for evidence-strength and runtime-proof status by common answer type.
- `common-question-proof-pack.md` for evidence requirements before stronger common-question answers.
- `support-answer-bank.md` for short answer patterns.
- `support-question-phrasebook.md` for paraphrased real support wording patterns.
- `support-macro-routing.md` for short macro-style replies from curated support playbooks.
- `common-question-coverage-map.md` for objective-level coverage.
- `common-misconceptions-and-boundaries.md` for overclaim checks.
- `../13-reference/public-claims-boundary-matrix.md` for broad public wording such as 100+/120+ sites, two-way chat, no API keys, free/open-source, AI/TTS, app, plugin, services, and support promises.
- `../13-reference/control-surface-crosswalk.md` for command/setting/URL/mode/plugin disambiguation.
- `../13-reference/customization-path-decision-matrix.md` for ambiguous plugin/customization/source requests.
- `../08-platform-sources/priority-platform-answer-matrix.md` for safe high-volume platform phrasing before exact source validation.
- `../08-platform-sources/priority-platform-validation-ledger.md` for proof status and validation targets behind high-volume platform claims.
- `../13-reference/index.md` for broad reference routing.

Rule: do not stop at this page for fragile claims. If the answer depends on selectors, exact platform support, send-back, auth, settings persistence, app parity, command payloads, or runtime behavior, open the routed topic doc and current source before giving a final-grade answer.

## Fast Intent Map

| User Wording | Intent | First Doc | Confirm Before Answering |
| --- | --- | --- | --- |
| "What is SSN?" | Product overview | `../01-product-map.md` | Whether user means extension, app, hosted pages, Lite, or API. |
| "Is it free?" | Cost boundary | `../13-reference/free-paid-and-support-boundaries.md` | Any third-party provider: AI, TTS, donation, platform, graphics, cloud. |
| "Is support paid?" | Support expectation | `../13-reference/support-resources-and-escalation.md` | Support is best-effort; donations are not service contracts. |
| "Should I use app or extension?" | Surface choice | `../13-reference/app-extension-mode-crosswalk.md` | Browser cookies vs app source windows, login/OAuth limits, throttling issue. |
| "What version should I install?" | Install/update path | `../13-reference/install-update-version-guide.md` | Chrome Web Store/manual/app/Firefox source and settings backup risk. |
| "How do I update?" | Safe update flow | `../13-reference/install-update-version-guide.md` | Do not recommend uninstalling before export/backup warnings. |
| "I lost settings" | Settings/storage recovery | `../10-troubleshooting/settings-loss-and-backups.md` | Extension storage, app state, backup file, moved/uninstalled extension. |
| "Chat is not showing" | Broad capture troubleshooting | `../10-troubleshooting/diagnostic-decision-tree.md` | Dock first, then overlay/OBS/API; same session; source page visible. |
| "Dock is empty" | Source/session issue | `../10-troubleshooting/extension-not-capturing.md` | Extension on, site permission, exact source URL/mode, reload after extension reload. |
| "OBS is blank" | Overlay display issue | `../10-troubleshooting/obs-overlay-display.md` | Test same URL in normal browser before OBS-specific advice. |
| "Chat stops when hidden" | Throttling/mode issue | `../13-reference/modes-and-capability-matrix.md` | Source visibility, app/WebSocket mode availability, platform support. |
| "Is this site supported?" | Public site lookup | `../08-platform-sources/supported-sites-lookup.md` | Setup type and support-strength notes, not just the public card name. |
| "Which source file handles this site?" | Implementation lookup | `../08-platform-sources/public-site-implementation-map.md` | Manifest row/source-page/stale-risk notes. |
| "Why is a listed site broken?" | Supported-site caveat | `../08-platform-sources/public-site-support-status.md` | Exact URL, mode, current source, platform layout changes. |
| "Does this platform support raids/rewards/gifts/follows?" | Rich event support | `../08-platform-sources/priority-platform-answer-matrix.md` | `../08-platform-sources/priority-platform-validation-ledger.md`, exact platform doc, capability matrix, and mode-specific source before promising. |
| "Can SSN send chat back?" | Send-back support | `../08-platform-sources/priority-platform-answer-matrix.md` | `../08-platform-sources/priority-platform-validation-ledger.md`, source mode, login/auth, permissions, send path, platform policy. |
| "This is a private chat/meeting/work app" | Sensitive source | `../08-platform-sources/communication-and-sensitive-sources.md` | Opt-in toggle, visible web panel, privacy redaction, no assumed send-back. |
| "What source mode is this?" | Capture mode classification | `../13-reference/modes-and-capability-matrix.md` | DOM, popout, static/manual, injected helper, WebSocket/API source page, app window. |
| "Which page should I open?" | Surface URL routing | `../13-reference/surface-url-cheatsheet.md` | Source page vs overlay page vs API test page vs diagnostic helper. |
| "What should I use for my setup?" | Workflow selection | `../13-reference/workflow-setup-decision-tree.md` | Source side, receiving page, transport, options, validation checks. |
| "How do I get chat in OBS?" | OBS setup | `../13-reference/how-to-recipes.md` | Same session, dock/featured/theme choice, OBS browser-source refresh. |
| "Which overlay supports this?" | Page capability routing | `../07-overlays-and-pages/page-capability-matrix.md` | What else must be open and first failure check. |
| "Why is a game/theme/helper blank?" | Page-family troubleshooting | `../07-overlays-and-pages/index.md` | Exact page family: game, theme, event/effect, live display, diagnostic helper. |
| "What command do I use?" | Command-system classification | `../13-reference/commands-and-actions.md` | Viewer command vs API action vs URL parameter vs Event Flow action. |
| "Is this a command, option, setting, mode, source, or plugin?" | Control-surface disambiguation | `../13-reference/control-surface-crosswalk.md` | Where the user is applying it and what surface should own it. |
| "What exact action exists?" | API/action lookup | `../13-reference/action-command-index.md` | `../13-reference/api-command-validation-matrix.md` for accepted-vs-acted-on caveats. |
| "Can you give an API example?" | Copy/paste command examples | `../13-reference/api-command-examples.md` | Remote API toggle, session, channel, URL encoding, target page/label. |
| "Why did my API command do nothing?" | API troubleshooting | `../13-reference/api-command-validation-matrix.md` | Target page open, same session, channel, label, page action support. |
| "Can StreamDeck/Companion control SSN?" | External control | `../09-api-and-integrations/streamdeck-companion.md` | Remote API enabled and exact action name. |
| "Can Streamer.bot control SSN?" | External automation | `../09-api-and-integrations/streamerbot.md` | Transport, session, action payload, page target. |
| "Can Event Flow automate this?" | Visual automation | `../09-api-and-integrations/event-flow-editor.md` | Trigger/action support and runtime validation for high-risk flows. |
| "What URL option changes this?" | URL parameter family | `../13-reference/url-parameters.md` | Page-specific parser and reload requirement. |
| "What exact URL parameter/alias exists?" | Generated URL option lookup | `../13-reference/url-parameter-index.md` | Target page actually reads it; use source trace for page-specific behavior. |
| "Why does this option work on one page but not another?" | Page parser difference | `../13-reference/url-parameter-source-trace.md` | The target HTML/JS parser and server/channel branch. |
| "What setting controls this?" | Popup setting/toggle lookup | `../13-reference/settings-and-toggles.md` | Generated setting key, UI source, storage/source behavior. |
| "What exact setting key exists?" | Generated setting lookup | `../13-reference/settings-key-index.md` | Some UI-only controls can exist outside generated definitions. |
| "Does this setting require reload?" | Storage/live-update behavior | `../13-reference/settings-change-impact-matrix.md` | Classify popup setting, URL parameter, generated link, app source state, page-local state, or provider/auth value before claiming live update. |
| "I changed a setting/link/URL option but nothing happened" | Change-impact triage | `../13-reference/settings-change-impact-matrix.md` | Current page/source/OBS/app window refreshed or reopened; exact key/param/page support. |
| "Can SSN do X?" | Feature support answer | `../13-reference/feature-support-decision-matrix.md` | Whether answer is Yes, Depends, External, Dev, or No/Not Primary. |
| "What are the main capabilities?" | Feature overview | `../13-reference/features-and-capabilities.md` | Mode-specific caveats and cost/support boundaries. |
| "Can I say 120+ sites/two-way/no API keys?" | Public claim boundary | `../13-reference/public-claims-boundary-matrix.md` | Exact platform, mode, provider, and current source/runtime evidence before making a precise claim. |
| "Is AI/TTS free?" | Provider cost boundary | `../13-reference/free-paid-and-support-boundaries.md` | Provider account/key/quota/pricing and local hardware. |
| "TTS is not working" | TTS integration | `../09-api-and-integrations/tts.md` | Provider path, key/endpoint, audio capture, browser/app mode. |
| "AI chatbot/cohost is not working" | AI integration | `../09-api-and-integrations/ai-features.md` | Provider/local model, key/endpoint, privacy, prompt/settings. |
| "Can I make a plugin?" | Customization path | `../13-reference/customization-path-decision-matrix.md` | Which path: URL/CSS, theme, overlay, custom JS, API client, Event Flow, new source. |
| "Is there a plugin marketplace/zip installer?" | Plugin boundary | `../13-reference/customization-path-decision-matrix.md` | SSN has plugin-like paths, not one normal official plugin package flow. |
| "How do custom overlays work?" | Custom visual output | `../07-overlays-and-pages/custom-overlays.md` | Session, transport, payload fields, hosted-vs-local code limits. |
| "How do I add a new platform?" | Developer source path | `../12-development/adding-a-source.md` | Check the customization matrix first if this might be a one-off API/custom overlay integration; otherwise confirm manifest/docs/site metadata, payload compatibility, app/extension validation. |
| "Where is the code?" | Repo orientation | `../12-development/repo-map.md` | Source of truth is `social_stream`; do not edit app fallback mirror. |
| "Can I share logs/settings/screenshots?" | Privacy/redaction | `../13-reference/privacy-security-and-secrets.md` | Session IDs, keys, webhooks, private URLs, credentials, OAuth data. |
| "Is this a bug?" | Escalation/support | `../13-reference/support-resources-and-escalation.md` | Repro details, versions, exact mode, current source, safe evidence. |
| "What should I ask the user for?" | Intake template | `support-intake-templates.md` | Only collect relevant details and redact secrets. |
| "How strong is the evidence for this answer?" | Evidence status | `common-question-evidence-status.md` | Do not say runtime-tested unless exact runtime evidence exists. |
| "What proof do I need before I say this works?" | Strong answer evidence | `common-question-proof-pack.md` | Match proof to the exact surface, mode, command, option, page, platform, or provider. |
| "Is there a short macro for this?" | Support macro | `support-macro-routing.md` | Confirm routed docs and avoid overclaims. |
| "Can you write the support reply?" | Response template | `support-response-playbook.md` | Confirm routed docs and avoid overclaims. |

## First Disambiguation Questions

Ask the fewest needed. Do not ask all of these at once.

| Ambiguous User Phrase | Best First Question |
| --- | --- |
| "It does not work" | "Where does it fail: source page, dock, overlay/OBS, app source window, or API?" |
| "The command fails" | "Is this a viewer chat command, an SSN API action, a URL parameter, or an Event Flow action?" |
| "The site is supported" | "Which exact URL/mode are you using: normal page, popout/chat-only page, app source window, or WebSocket/API source page?" |
| "I use the app" | "Which app version and which source window/source type are you using?" |
| "OBS is broken" | "Does the same SSN overlay URL work in a normal browser with the same session?" |
| "TTS is broken" | "Which TTS path: browser/system voice, local model, or cloud provider with API key?" |
| "AI is broken" | "Which provider/local model and which page: chatbot settings, cohost page, cohost overlay, or generated overlay?" |
| "I want a plugin" | "Do you need styling, an overlay, message logic, external data, automation, or a new platform source?" |
| "Can SSN do this?" | "Is this a core SSN feature, a third-party provider, a platform-specific event, or custom development?" |
| "My settings disappeared" | "Was this after uninstalling/reloading the extension, moving the unpacked folder, changing browser profile, importing settings, or using the desktop app?" |

## Common Wrong First Routes

| User Asked | Wrong Route | Better Route |
| --- | --- | --- |
| "Supported site broken" | Assume the public card proves current runtime support. | Check `supported-sites-lookup.md`, then `public-site-implementation-map.md`, then source/current platform doc. |
| "Public page says 100+/120+/most/free/two-way" | Repeat the broad wording as exact support proof. | Check `../13-reference/public-claims-boundary-matrix.md`, then the routed source, mode, provider, or cost doc. |
| "Can I reply to chat?" | Say "yes" because chat capture works. | Check send-back support by platform/mode in `platform-capability-matrix.md` and source docs. |
| "What command clears this?" | Give any action named `clear`. | Classify command system first; route to `commands-and-actions.md` and `action-command-index.md`. |
| "URL option does not work" | Assume the generated option applies to every page. | Check `url-parameter-source-trace.md`, `settings-change-impact-matrix.md`, or the target page source. |
| "AI/TTS is free?" | Say everything is free. | Say SSN is free; providers/accounts/keys/quotas/hardware can cost money. |
| "Use the app?" | Present app as a universal fix. | App helps source-window/throttling workflows but has embedded login/OAuth differences. |
| "Plugin?" | Invent a marketplace/package installer. | Route to `../13-reference/customization-path-decision-matrix.md`: URL/CSS, overlay, custom JS, API, Event Flow, source file. |
| "This was tested?" | Treat source inspection as testing. | Only runtime browser/app/OBS/e2e validation counts as tested. |
| "Private chat capture?" | Treat it like a normal public source. | Check privacy/toggle/source docs and avoid encouraging bypasses. |
| "Send me the settings/log" | Accept raw secrets. | Use intake templates and privacy redaction rules. |

## Answer Assembly Pattern

Use this compact structure for most final support answers:

1. Direct answer in one sentence.
2. Mode/surface: extension, app, hosted/local page, Lite, API, WebSocket source page, or custom integration.
3. First practical check or setup step.
4. Boundary: platform/mode/cost/privacy/testing caveat if relevant.
5. Link or route to the narrower doc if the answer is for another agent.

Example skeleton:

```text
Yes, but only in the supported mode. Start with [surface/source/page]. Check [first concrete prerequisite]. Do not assume [common overclaim]. For exact setup, route to [topic doc] and source-check [file/family] before final platform-specific advice.
```

## High-Risk Claims That Need Source Or Runtime Evidence

Always inspect a narrower doc and current source before making these claims:

- A platform supports send-chat, moderation, ban/delete, rewards, channel points, gifts, follows, raids, viewer counts, purchases, auctions, or private-message capture.
- The desktop app behaves the same as Chrome for a platform login or OAuth flow.
- A URL parameter works on a specific theme, game, WebSocket source page, or helper page.
- An API action reaches a specific page label, channel, or Event Flow node.
- A setting updates live without reload.
- A source file is actively manifest-loaded rather than a helper, graveyard file, fallback mirror, or stale copy.
- AI/TTS provider behavior, cost, model names, or quotas are current.
- OBS/browser/app runtime behavior has been tested.

## Follow-Up Extraction Needs

- Add examples of real question wording from future redacted support summaries.
- Add a one-line confidence column after more source/runtime validation exists.
- Re-run this router after major changes to public supported-site data, command handlers, generated settings, or app source-window behavior.
