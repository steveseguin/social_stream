# Support Evidence Ledger

Status: first evidence-routing pass started on 2026-06-24.

## Purpose

Use this file to avoid repeating support-history mining and to avoid promoting old support advice as current fact.

Each row maps a common support claim family to the best current evidence, the docs that already use it, and the next validation step. For objective-level question family coverage, use `common-question-coverage-map.md`. For evidence-strength by common answer type, use `common-question-evidence-status.md`. For support-history frequency signals, use `support-topic-frequency-index.md`. For repeatable support-history refreshes, use `support-history-refresh-playbook.md`. For broad-answer boundaries, use `common-misconceptions-and-boundaries.md`. For response phrasing, use `support-response-playbook.md`. This is not a final user-facing FAQ.

## Evidence Labels

| Label | Meaning |
| --- | --- |
| `source-backed` | Current repo code/docs have already been used for the agent docs. Still source-check before fragile or exact claims. |
| `support-derived` | Seen in curated support history or mined summaries, but not fully verified against current code. |
| `mixed` | Part of the claim is source-backed and part still comes from support history or inference. |
| `stale-risk` | Old, version-specific, platform-volatile, or generated support-bot claim. Keep cautious until verified. |
| `needs-live-validation` | Code/docs are not enough; behavior needs app/browser/OBS/platform validation. |

## Current Evidence Map

| Claim Family | Current Evidence | Docs That Use It | Next Validation |
| --- | --- | --- | --- |
| Broad public claims about 100+/120+ sites, most platforms, two-way chat, no API keys, free/open-source, AI/TTS, app benefits, plugins/customization, services, and support are useful orientation, not exact proof. | source-backed/stale-risk for exact behavior | `13-reference/public-claims-boundary-matrix.md`, `13-reference/features-and-capabilities.md`, `13-reference/feature-support-decision-matrix.md`, `11-support-kb/public-docs-coverage.md` | Promote only after exact source/runtime validation by platform, mode, provider, or support surface. |
| SSN is free and open source, but third-party services can cost money. | source-backed | `13-reference/free-paid-and-support-boundaries.md`, `13-reference/public-claims-boundary-matrix.md`, `support-answer-bank.md`, `common-questions.md` | Refresh only when public docs, Terms/Privacy, or provider integrations change. |
| Donations are gifts, not paid support contracts. | source-backed from support/public docs | `13-reference/free-paid-and-support-boundaries.md`, `support-answer-bank.md` | Keep wording aligned with public support pages. |
| Extension, standalone app, hosted pages, local pages, Lite, and Firefox have different capabilities. | source-backed, needs-live-validation for edge cases | `13-reference/modes-and-capability-matrix.md`, `02-installation-and-surfaces.md`, `04-standalone-app-source-windows.md` | Verify app-vs-extension parity with real workflows before final user-facing claims. |
| Unpacked extension updates should preserve settings; uninstalling can remove settings. | mixed | `10-troubleshooting/settings-loss-and-backups.md`, `support-answer-bank.md`, `common-questions.md` | Verify exact export/import UI and storage behavior after settings changes. |
| Chat missing from the dock is usually capture/session/source-mode related. | mixed | `10-troubleshooting/quick-triage.md`, `10-troubleshooting/extension-not-capturing.md`, `support-answer-bank.md` | Source-check exact platform mode and URL shape before platform-specific answers. |
| Dock works but OBS/overlay does not is usually session, URL, refresh, CSS, or display-state related. | mixed | `10-troubleshooting/obs-overlay-display.md`, `13-reference/surface-url-cheatsheet.md`, `support-answer-bank.md` | Validate common overlays in OBS/browser with controlled payloads. |
| Some sites require popout/chat-only URLs; others work on normal rendered pages or source pages. | source-backed by source inventory plus focused public-card metadata finding, needs-live-validation | `08-platform-sources/public-site-support-status.md`, `supported-sites-lookup.md`, platform docs | Replace heuristic site/source matches with exact generated public-site-to-manifest-to-source mapping and reconcile duplicate `On24`/`ON24` public cards. |
| Platform support depends on mode and feature; "supported" does not mean all events/send-back/moderation work. | source-backed, high-risk exact claims | `08-platform-sources/platform-capability-matrix.md`, `13-reference/feature-support-decision-matrix.md`, `13-reference/public-claims-boundary-matrix.md`, `support-answer-bank.md` | Line-level validation for send-back, moderation, reward, gift, raid, and auth claims. |
| Communication, meeting, assistant, and membership sources are privacy-sensitive and should be opt-in or redacted in support. | source-backed plus support-policy derived | `08-platform-sources/communication-and-sensitive-sources.md`, `11-support-kb/index.md` | Verify current toggle behavior and any send-back/background paths. |
| WebSocket/API source pages are setup/control pages, not normal OBS overlays. | source-backed | `08-platform-sources/websocket-source-pages.md`, `13-reference/surface-url-cheatsheet.md`, `support-answer-bank.md` | Line-level validation for auth, reconnect, send-back, and app bridge behavior. |
| Static/manual/helper source files are not always live chat parsers. | source-backed | `08-platform-sources/manual-static-and-helper-sources.md`, `special-case-platform-and-helper-sources.md`, `support-answer-bank.md` | Live/browser validation for helper behavior and manifest load status. |
| TikTok is volatile and should be diagnosed by mode, username, live state, visibility, app version, and signing/connector path. | mixed, stale-risk | `08-platform-sources/tiktok.md`, `historical-issues.md`, `unresolved-or-stale-claims.md`, `support-answer-bank.md` | Current intense pass through `sources/tiktok.js`, `ssapp/tiktok/*`, signing code, and real connection tests. |
| YouTube capture differs across popout, Studio/watch DOM paths, static helpers, and WebSocket/API mode. | mixed | `08-platform-sources/youtube.md`, `special-case-platform-and-helper-sources.md`, `historical-issues.md` | Verify gifts, moderation, helper-copy load status, and app OAuth behavior. |
| Twitch basic chat, EventSub/WebSocket events, channel points, moderation, and send-back need separate claims. | mixed, stale-risk for scopes | `08-platform-sources/twitch.md`, `platform-capability-matrix.md`, `unresolved-or-stale-claims.md` | Validate scopes, source-page auth, channel-point payloads, and app OAuth callback behavior. |
| Kick and Rumble auth/CAPTCHA issues are often provider/browser-context related. | support-derived plus partial source backing | `08-platform-sources/kick.md`, `rumble.md`, `10-troubleshooting/auth-and-sign-in.md`, `historical-issues.md` | Verify current app OAuth/external-browser flows and fallback instructions. |
| Facebook, Instagram, Discord, Slack, Zoom, Teams, Telegram, WhatsApp, and similar pages depend heavily on visible web UI and privacy boundaries. | source-backed with high live-DOM risk | platform docs, `communication-and-sensitive-sources.md`, `platform-known-issues.md` | Live browser validation of current selectors, login/toggle behavior, and safe support wording. |
| Standalone app embedded-browser login can fail even when Chrome extension capture works. | mixed | `10-troubleshooting/desktop-app-issues.md`, `auth-and-sign-in.md`, `04-standalone-app-source-windows.md`, `historical-issues.md` | Real app/e2e validation by platform and auth flow. |
| App source windows use Social Stream source files, session partitions, preload bridge behavior, and app-specific handlers. | source-backed, needs-live-validation | `04-standalone-app-source-windows.md`, `04-standalone-app-architecture.md` | Line-level renderer/main IPC trace and real app source-window validation. |
| Settings and URL parameters are split across popup settings, generated URL params, storage, page-specific parsing, app source state, and app cached state. | source-backed from generated config, focused metadata validation, storage source trace, and settings impact pass | `13-reference/settings-and-toggles.md`, `13-reference/settings-session-storage-source-trace.md`, `13-reference/settings-change-impact-matrix.md`, `settings-key-index.md`, `url-parameters.md`, `url-parameter-index.md` | Validate UI labels, live update behavior, generated-link/OBS refresh behavior, extension migration, app export/import/reset, and app parity in real runtime; reconcile duplicate generated URL aliases for `password` and normalized `strokecolor`. |
| Commands/actions differ across API actions, page actions, background/internal actions, viewer chat commands, MIDI/hotkey commands, and Event Flow actions. | source-backed, exact behavior still high-risk | `13-reference/commands-and-actions.md`, `action-command-index.md` | Line-level validation against handlers before rare/internal public recipes. |
| Event Flow and Streamer.bot are integration/control surfaces that need command-by-command validation. | source-backed overview | `09-api-and-integrations/event-flow-editor.md`, `streamerbot.md` | Validate trigger/action execution, state nodes, custom JS actions, and OBS/Streamer.bot payloads. |
| TTS, AI, moderation, and RAG provider behavior may involve external accounts, quotas, browser audio policy, OBS audio behavior, model runtime limits, user-uploaded documents, or provider-specific limits. | mixed plus focused fixture/static evidence for selected local paths | `09-api-and-integrations/tts.md`, `ai-features.md`, `free-paid-and-support-boundaries.md` | Verify provider paths, live moderation quality, real RAG upload/delete/provider workflows, local model runtime, OBS audio capture, and provider docs before exact cost/limit claims. |
| Custom overlays, custom JS, and custom sources are supported, but there is no generic plugin marketplace contract. | source-backed | `13-reference/customization-path-decision-matrix.md`, `13-reference/custom-plugins-and-extensions.md`, `12-development/adding-a-source.md`, `07-overlays-and-pages/custom-overlays.md` | Keep aligned with actual custom script templates, uploaded custom user function behavior, and extension/app source loading behavior. |
| Raw support history is useful for symptom wording and frequency, not final proof. | support-method rule | `11-support-kb/index.md`, `support-source-map.md`, `mining-method.md`, `unresolved-or-stale-claims.md` | Continue redacted/minimized extraction only for high-frequency unresolved topics. |

## Claim Promotion Rules

Before moving a support claim into a final answer or polished doc:

1. Find the current code path, public doc, generated config, or app source that confirms it.
2. Mark the applicable surface: extension, standalone app, hosted page, local page, Lite, Firefox, API, WebSocket source page, or overlay.
3. Mark the applicable mode: DOM capture, popout, static/manual helper, source page, WebSocket/API, app connector, OAuth/helper, or generated overlay.
4. Keep volatile platform advice cautious unless there is current source plus current support evidence.
5. Move contradicted or version-specific material to `unresolved-or-stale-claims.md`.

## Next Extraction Targets

- Add source-file references for the highest-volume support claims after intense passes.
- Add one row per high-frequency SQLite topic after deeper query passes.
- Split platform evidence rows into per-platform ledgers when a platform gets a full intense validation pass.
- Add a "tested in app/browser/OBS" column only after real e2e validation exists.
