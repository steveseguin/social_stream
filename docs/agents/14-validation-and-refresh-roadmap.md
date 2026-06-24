# Validation And Refresh Roadmap

Status: framework queue created on 2026-06-24.

## Purpose

This file turns the remaining "needs intense/live validation" notes into a working queue. Use it when deciding what to validate next, how deep the pass should go, and which tracking files must be updated afterward.

This roadmap does not replace source inspection. It is a routing layer for future agents.

For concrete runtime validation recipes and evidence templates, use `16-runtime-validation-playbooks.md`. For actual runtime validation results, use `17-runtime-validation-evidence-log.md`. For useful focused tests that are not full runtime validation, use `18-focused-validation-evidence-log.md`.

## Validation Types

| Type | Meaning | Counts As Actual Testing? |
| --- | --- | --- |
| Source check | Read current source and docs, then update claims. | No. |
| Line-level validation | Trace exact functions, settings, handlers, selectors, state transitions, and command payloads. | No, unless paired with runtime checks. |
| Controlled browser validation | Run a page/source/overlay in a browser with controlled payloads or a real target page. | Yes, for that browser workflow only. |
| Standalone app e2e validation | Run the Electron app in an isolated profile and verify the real user workflow. | Yes, for the app workflow tested. |
| OBS validation | Load the target overlay/browser source in OBS or an equivalent browser-source environment and verify rendering, audio, timing, and persistence. | Yes, for the OBS workflow tested. |
| Support-history refresh | Mine curated support material or private archives safely, then source-check conclusions. | No, unless paired with runtime checks. |

Do not call a feature "tested" unless one of the runtime validation types was actually performed.

Current overlay runtime notes: `scoreboard.html` and `reactions.html` have narrow controlled browser evidence in `17-runtime-validation-evidence-log.md`. `multi-alerts.html` has a failed controlled browser validation attempt that timed out waiting for the preview iframe overlay API and must be rerun or replaced with a narrower validated workflow before any browser-validated claim.

Current focused validation notes: Event Flow custom JS, compare-property, template/counter, OBS system trigger, and play-media duration Node tests have focused evidence in `18-focused-validation-evidence-log.md`. Twitch subgift provider normalization, AI prompt builder smoke behavior, profanity/moderation static checks, local browser model registry checks, OpenCode Zen fallback checks, Kokoro asset wiring, Kitten TTS asset wiring, Transformers local defaults, RAG browser-fixture/benchmark behavior, settings config JSON validation, generated settings/URL/public-site metadata validation, and API command examples documentation consistency also have focused evidence there. Piper asset wiring has a failed focused test on an expected fallback remote-base string. The generated metadata check completed with duplicate URL alias findings for `password` and normalized `strokecolor`, plus duplicate public `On24`/`ON24` cards. The API examples consistency check found 29 extracted action examples and, after docs updates, zero missing entries across action index, validation matrix, and source trace, but it does not validate command behavior. These results do not validate Event Flow UI, Flow Actions overlay, OBS, app, extension, live platform behavior, browser audio, model runtime, real RAG uploads, live moderation quality, live LLM generation, generated overlay quality, provider calls, provider availability/pricing, popup/settings UI, generated docs UI, page-specific URL parsing, public supported-sites UI, API relay behavior, action callbacks, target labels, numbered content channels, or external integration behavior.

Current docs-navigation note: `19-navigation-and-link-audit.md` records a focused agent-doc navigation audit. The latest result found 163 Markdown files, zero unreferenced non-template pages, zero broken exact agent-doc Markdown references, and zero ambiguous bare section-index filenames. Re-run it after large documentation-growth, rename, or section-index changes.

## Priority Queue

| Priority | Area | Start Docs | Source/Runtime Targets | Needed Output |
| --- | --- | --- | --- | --- |
| P0 | Command/action behavior | `13-reference/api-command-validation-matrix.md`, `13-reference/command-action-source-trace.md`, `13-reference/action-command-index.md`, `13-reference/commands-and-actions.md`, `13-reference/api-command-examples.md`, `09-api-and-integrations/websocket-http-api.md` | `background.js`, `service_worker.js`, `dock.html`, `featured.html`, `actions/*`, `api.md` | Runtime-validated command matrix, exact payload rules, unsupported-action notes, controlled HTTP/WebSocket samples, and follow-up validation for numbered content channels such as `content4`. |
| P0 | Settings, sessions, and storage | `06-settings-sessions-and-storage.md`, `13-reference/settings-and-toggles.md`, `13-reference/settings-session-storage-source-trace.md`, `13-reference/settings-change-impact-matrix.md`, `13-reference/settings-key-index.md`, `13-reference/url-parameter-index.md` | `shared/config/settingsDefinitions.js`, `shared/config/urlParameters.js`, `popup.js`, `background.js`, `service_worker.js`, `ssapp/state.js`, `ssapp/main.js`, `ssapp/settings-backup.js` | Reload/live-update rules, generated-link and OBS refresh behavior, runtime storage migration checks, app parity notes, backup/restore validation, and reconciliation of duplicate URL alias metadata findings. |
| P0 | Page-specific URL parameters and socket modes | `13-reference/url-parameter-source-trace.md`, `13-reference/root-page-url-parameter-matrix.md`, `13-reference/subpage-url-parameter-matrix.md`, `13-reference/url-parameters.md`, `13-reference/url-option-examples.md`, `13-reference/surface-url-cheatsheet.md` | Root HTML pages, theme/game pages, WebSocket relay branches, OBS/browser pages | Runtime-validated page parameter matrix, exact `server`/`server2`/`server3`/`localserver` behavior, label-target notes, controlled payload samples. |
| P0 | Standalone app source windows and auth | `04-standalone-app-source-windows.md`, `04-standalone-app-architecture.md`, `10-troubleshooting/desktop-app-issues.md`, `10-troubleshooting/auth-and-sign-in.md` | `ssapp/main.js`, `preload.js`, `renderer.js`, `state.js`, OAuth handlers, TikTok app files | Electron e2e notes, source-window lifecycle trace, session partition behavior, auth callback limits, app-vs-extension parity fixes. |
| P0 | Support claim promotion | `13-reference/public-claims-boundary-matrix.md`, `11-support-kb/support-evidence-ledger.md`, `11-support-kb/common-question-coverage-map.md`, `11-support-kb/common-misconceptions-and-boundaries.md`, `11-support-kb/unresolved-or-stale-claims.md` | Current code/docs plus curated `stevesbot` support files | Move claims from broad public/historical/anecdotal to source-backed/current, or mark stale/unknown. |
| P1 | Public supported-site health map | `08-platform-sources/supported-sites-lookup.md`, `08-platform-sources/public-site-support-status.md`, `08-platform-sources/public-site-implementation-map.md`, `08-platform-sources/manifest-row-matrix.md`, `08-platform-sources/source-file-processing-matrix.md` | `docs/js/sites.js`, `manifest.json`, `sources/*`, real platform pages where possible | Runtime health/status validation for the public site map, duplicate `On24`/`ON24` and other stale-card reconciliation, and support-strength updates. |
| P1 | High-volume platform behavior | YouTube, TikTok, Twitch, Kick, Rumble, Facebook, Instagram, Discord docs, `08-platform-sources/priority-platform-validation-ledger.md`, and `08-platform-sources/platform-capability-matrix.md` | Platform source files, provider cores, app handlers, real/live test accounts where possible | Exact rich-event, send-back, auth, viewer count, app parity, and known-fragility matrix. |
| P1 | Dock, featured, and core overlays | `07-overlays-and-pages/dock.md`, `featured.md`, `multi-alerts.md`, `page-capability-matrix.md` | Root overlay HTML/JS, background handlers, WebSocket bridge, OBS/browser sources | Controlled payload validation, OBS behavior, command target labels, persistence and audio notes. |
| P1 | Event Flow and Streamer.bot | `09-api-and-integrations/event-flow-editor.md`, `streamerbot.md`, `13-reference/action-command-index.md` | `actions/*`, Event Flow tests/docs, Streamer.bot setup page, bridge commands | Trigger/action behavior, storage/import/export rules, integration failure notes. |
| P1 | Customization/plugin paths | `13-reference/customization-path-decision-matrix.md`, `13-reference/customization-source-trace.md`, `customization-plugin-recipes.md`, `custom-plugins-and-extensions.md`, `07-overlays-and-pages/custom-overlays.md`, `12-development/adding-a-source.md` | `custom_sample.js`, `custom_actions.js`, `dock.html`, `featured.html`, `background.js`, `popup.js`, `sampleoverlay.html`, `sample_wss_source.html`, `api.md`, Event Flow custom code paths | Runtime-validated path examples, hosted/local/app caveats, uploaded custom user function behavior, payload samples, and safe sharing boundaries. |
| P2 | Games, themes, and helper pages | `07-overlays-and-pages/game-pages.md`, `theme-pages.md`, `diagnostic-helper-pages.md`, `page-processing-matrix.md` | `games/*.html`, `themes/**/*.html`, replay/recover/import/helper pages, browser/OBS runtime | Rendering screenshots, controlled payload samples, storage/channel notes, local-file/hosted caveats. |
| P2 | Static/manual/helper source scripts | `08-platform-sources/manual-static-and-helper-sources.md` | `sources/static/*`, `sources/inject/*`, `sources/autoreload.js`, `capturevideo.js`, `grabvideo.js` | Browser validation for helper controls, source identity, injected WebSocket consumers, media publishing. |
| P2 | WebSocket/API source pages | `08-platform-sources/websocket-source-pages.md` | `sources/websocket/*`, local/hosted source pages, auth/token flows | Send-back, reconnect, CORS, token refresh, app bridge, and payload sample validation. |
| P2 | Private/meeting/communication sources | `08-platform-sources/communication-and-sensitive-sources.md` | ChatGPT/OpenAI, Slack, Telegram, WhatsApp, Meet, Teams, Zoom, Webex, Chime scripts | Opt-in toggle validation, privacy-safe claims, selectors, panel states, send-back limits. |
| P2 | Widget, commerce, webinar, creator, popout, event, independent, video, community, regional, and special-case source groups | Matching grouped pages under `08-platform-sources/` | Exact source files and current target pages listed in each grouped page | Live selector checks, platform-specific event samples, setup URL wording, app parity, and stale-risk notes. |
| P3 | Deeper raw support archive mining and refreshes | `11-support-kb/mining-method.md`, `support-history-refresh-playbook.md`, `historical-issues.md`, `support-source-map.md` | `stevesbot` SQLite DBs and mined-thread exports, excluding secrets | Aggregate/anonymized frequency summaries only; no raw identities; source-check before current guidance. |

## Pass Protocol

Before a pass:

1. Pick one queue row and one validation type.
2. Read `AGENT.md`, `01-extraction-checklist.md`, and `02-resource-processing-ledger.md`.
3. Read the relevant topic docs listed in the queue row.
4. Identify exact source files, runtime pages, test accounts, or external tools needed.
5. Open `16-runtime-validation-playbooks.md` for the matching validation recipe.
6. Decide whether the pass is quick, heavy, intense, or runtime validation.

During a pass:

1. Record exact files, docs, tables, runtime pages, and support datasets inspected.
2. Separate confirmed facts from assumptions.
3. Mark historical support claims as historical until current source or runtime checks support them.
4. Capture failed or unavailable validation honestly; do not convert blocked runtime checks into "tested" claims.
5. Prefer adding narrow evidence notes to existing topic docs over creating broad duplicate pages.

After a pass:

1. Update the topic doc(s) changed by the pass.
2. Add a row to `01-extraction-checklist.md`.
3. Update `02-resource-processing-ledger.md` if the resource depth changed.
4. Update `99-agent-index.md` if the pass creates a new entry point or changes suggested next-pass priorities.
5. Update `11-support-kb/support-evidence-ledger.md` when support claims are promoted, narrowed, or marked stale.
6. Run docs-only validation and scope checks.

## Evidence Labels For Future Notes

Use these labels inside topic docs when a claim needs status:

- `source-checked`: current code/docs were inspected.
- `line-validated`: exact code paths and state transitions were traced.
- `browser-validated`: a browser runtime workflow was verified.
- `app-e2e-validated`: the Electron app workflow was verified.
- `obs-validated`: OBS/browser-source behavior was verified.
- `support-refreshed`: curated or archived support material was re-mined and summarized.
- `historical-only`: support evidence exists, but current source/runtime confirmation is missing.
- `stale-risk`: claim depends on third-party platform behavior, selectors, APIs, or policy.
- `blocked`: validation could not be completed; include the blocker and next step.

## Minimum Output For Runtime Validation

A runtime validation note should include:

- Date.
- Product surface tested: extension, hosted page, local page, standalone app, OBS/browser source, or external integration.
- Browser/app/OS context when relevant.
- Exact URL/page/source/platform used.
- Session/password/channel details only when safe to record.
- Input payloads, commands, or user actions.
- Observed result.
- Logs/errors if relevant.
- What was not tested.

## Good Stopping Points

Stop a pass when one of these is true:

- The selected queue row has enough evidence to update its docs and tracking files.
- Runtime validation is blocked by credentials, platform access, OBS availability, account state, or a missing external dependency.
- The work reveals a source/code problem that should become a separate engineering task.
- The pass would require reading excluded paths or recording private support identities.
