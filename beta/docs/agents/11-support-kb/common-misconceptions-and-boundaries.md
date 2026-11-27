# Common Misconceptions And Boundaries

Status: support boundary pass started on 2026-06-24.

## Purpose

Use this page before answering broad or ambiguous SSN support questions. It collects the assumptions that most often lead to wrong answers.

This is not a replacement for source inspection. It is a guardrail page: use it to narrow the answer, then route to the exact feature, platform, command, page, or setting doc.

## Misconception Matrix

| Misconception | Correct Boundary | Route |
| --- | --- | --- |
| "Public feature text is exact support proof." | Public pages are broad positioning and inventory references. Use the boundary matrix and routed topic docs before turning 100+/120+ sites, free/open-source, no API keys, two-way chat, AI/TTS, app, plugin, service, or support wording into exact advice. | `13-reference/public-claims-boundary-matrix.md`, `11-support-kb/public-docs-coverage.md` |
| "SSN supports this site, so every feature works there." | A supported-site listing usually means a setup path exists. It does not prove gifts, raids, rewards, viewer counts, moderation, send-back, app parity, or every URL form. | `08-platform-sources/public-site-support-status.md`, `08-platform-sources/platform-capability-matrix.md` |
| "The app and extension behave the same." | They can share source logic, but the app uses Electron source windows, session partitions, preload bridges, and app-specific auth paths. Login, cookies, hidden windows, and app handlers can differ. | `04-standalone-app-source-windows.md`, `10-troubleshooting/desktop-app-issues.md` |
| "Use the standalone app; it fixes login problems." | The app can help with source-window management and browser throttling. It can also hit embedded-browser login, CAPTCHA, OAuth, or cookie restrictions. | `10-troubleshooting/auth-and-sign-in.md`, `04-standalone-app-source-windows.md` |
| "If the dock is blank, OBS is broken." | A blank dock usually means capture/source/session failure. OBS is only the first suspect when dock works and OBS/browser-source output does not. | `10-troubleshooting/diagnostic-decision-tree.md`, `10-troubleshooting/obs-overlay-display.md` |
| "If the HTTP API returns, the command worked." | A request can reach the relay while the target page/source is closed, on another session, missing a label, or does not support that action. | `09-api-and-integrations/websocket-http-api.md`, `13-reference/action-command-index.md` |
| "API actions, viewer commands, URL parameters, and Event Flow actions are the same thing." | They are separate command systems with different syntax, targets, and requirements. Identify the command system first. | `13-reference/commands-and-actions.md` |
| "A WebSocket/API source page is an OBS overlay." | Source pages capture or ingest data. Output still goes to dock, overlays, API clients, Event Flow, or tool pages. | `08-platform-sources/websocket-source-pages.md`, `13-reference/surface-url-cheatsheet.md` |
| "Changing a URL parameter changes all open pages live." | Many URL parameters are read on page load and only affect the page that supports them. Refresh the target page and verify page support. | `13-reference/url-parameters.md`, `13-reference/url-parameter-index.md`, `13-reference/settings-change-impact-matrix.md` |
| "Popup settings and URL parameters are interchangeable." | Popup settings persist in storage. URL parameters are page-level options. Some settings need reloads or have app/extension differences. | `13-reference/settings-and-toggles.md`, `13-reference/settings-change-impact-matrix.md`, `13-reference/settings-key-index.md` |
| "Everything in SSN is free." | SSN itself is free/open source. External AI, TTS, payment, graphics, platform, or cloud services can require accounts, keys, quotas, or payment. | `13-reference/free-paid-and-support-boundaries.md` |
| "Donations buy support or integrations." | Donations are gifts. They are not service contracts and do not guarantee support, fixes, or new platform integrations. | `13-reference/free-paid-and-support-boundaries.md`, `13-reference/support-resources-and-escalation.md` |
| "System TTS and cloud TTS have the same support profile." | System/browser TTS may be free but can be harder to capture in OBS. Cloud TTS may capture more predictably but depends on provider keys/costs. | `09-api-and-integrations/tts.md` |
| "AI moderation is guaranteed." | AI features are optional and best-effort. Providers, prompts, model limits, privacy, and mistakes matter. Do not promise perfect moderation. | `09-api-and-integrations/ai-features.md` |
| "A session ID is harmless." | Treat session IDs as private when they can control overlays, API actions, or webhook paths. Passwords, keys, OAuth tokens, webhooks, and private endpoints are also secrets. | `13-reference/free-paid-and-support-boundaries.md`, `11-support-kb/index.md` |
| "Donation webhook URLs are safe to share." | Public API docs say donation webhook paths do not verify platform signatures. Anyone with the URL may spoof events. | `13-reference/free-paid-and-support-boundaries.md` |
| "Private or meeting chat capture means bot/API access." | Communication and meeting sources are rendered web-page captures. They need user access, visible panels, toggles where required, and privacy redaction. | `08-platform-sources/communication-and-sensitive-sources.md` |
| "Custom plugin means one thing." | In SSN, "plugin" can mean custom overlay, API client, Event Flow, custom JS/user functions, generic/custom source, or new source file. Pick the smallest extension point. | `13-reference/customization-path-decision-matrix.md`, `13-reference/custom-plugins-and-extensions.md`, `13-reference/workflow-setup-decision-tree.md` |
| "Editing app fallback files is normal app source work." | `ssapp/resources/social_stream_fallback` is disposable fallback content. Edit the real `social_stream` source, not the fallback mirror. | `04-standalone-app-architecture.md` |
| "Source inspection means tested." | Static/source checks are useful, but Electron/app changes and user workflows are only tested after real in-app/e2e validation. | `12-development/testing-and-validation.md` |
| "Support history is current proof." | Support history is useful for patterns and wording. Current code/docs win, and stale or version-specific claims stay in the stale-claim register. | `11-support-kb/support-evidence-ledger.md`, `11-support-kb/unresolved-or-stale-claims.md` |

## Safe Phrasing Patterns

| User Claim | Safer Reply |
| --- | --- |
| "Is platform X supported?" | "There is a supported setup path for X. The exact URL/mode and requested feature still matter." |
| "Can it send messages back?" | "Maybe, depending on the platform, source mode, login, and permissions. I need to check that platform's send-back path." |
| "Is it free?" | "SSN is free/open source. The provider/platform used by this feature may still charge or require an account." |
| "Does it work in the app?" | "The app may support it, but Electron login/source-window behavior can differ from Chrome. Test the app path separately." |
| "The API command worked but nothing happened." | "The request may have reached SSN, but the target page/source still needs to be open, connected, on the right session, and support that action." |
| "Can I share this URL/log?" | "Share only the page name and non-secret options. Redact sessions, passwords, keys, OAuth tokens, webhook URLs, private endpoints, and personal data." |

## Quick Boundary Checklist

Before answering, identify:

- Surface: extension, app, hosted page, local page, Lite, API, or WebSocket source page.
- Mode: DOM, popout, static/manual helper, injected helper, source page/API, app connector, or external source.
- Target: dock, overlay, tool page, Event Flow, API client, TTS/AI page, or platform send-back.
- Cost boundary: SSN feature versus external provider/platform.
- Privacy boundary: session, password, token, key, webhook, endpoint, workspace, meeting, or private chat.
- Validation level: source-backed, support-derived, stale-risk, or live-tested.

## When To Escalate Instead Of Answering Broadly

Escalate or source-check when the question involves:

- Platform-specific send-back, deletion, ban, timeout, moderation, rewards, gifts, raids, follows, or channel points.
- OAuth scopes, external-browser login, app bridge behavior, or embedded-browser restrictions.
- Exact setting live-update behavior.
- Exact page-specific URL parameter behavior.
- Private/work/meeting/membership content.
- Historical support advice that names a version, time period, or platform workaround.
