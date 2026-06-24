# Runtime Validation Playbooks

Status: runtime-validation planning pass on 2026-06-24. These are playbooks for future validation work. They do not mean the workflows below have already been tested.

## Purpose

Use this page when a source-backed or support-derived claim needs to be promoted to `browser-validated`, `app-e2e-validated`, `obs-validated`, or another runtime evidence label.

This page turns the queue in `14-validation-and-refresh-roadmap.md` into practical recipes. Actual runtime results belong in `17-runtime-validation-evidence-log.md`.

It covers:

- Commands and API actions.
- URL parameters, sessions, labels, and server modes.
- Settings, storage, backups, and reload behavior.
- Public supported-site/source health.
- Standalone app source windows and auth.
- OBS/browser-source overlays.
- Event Flow, Streamer.bot, StreamDeck, and OBS control.
- TTS, AI, and provider-backed behavior.
- Support claim promotion.

## Source Anchors

- `14-validation-and-refresh-roadmap.md`
- `15-objective-coverage-and-readiness-audit.md`
- `17-runtime-validation-evidence-log.md`
- `12-development/testing-and-validation.md`
- `12-development/test-asset-matrix.md`
- `13-reference/control-surface-crosswalk.md`
- `13-reference/command-action-source-trace.md`
- `13-reference/api-command-examples.md`
- `13-reference/url-parameter-source-trace.md`
- `13-reference/settings-session-storage-source-trace.md`
- `08-platform-sources/public-site-implementation-map.md`
- `07-overlays-and-pages/page-capability-matrix.md`

## Evidence Rule

Do not write "tested" unless a real runtime workflow was exercised.

Allowed labels:

| Label | Use Only When |
| --- | --- |
| `source-checked` | Current source/docs were inspected. |
| `line-validated` | Exact code paths and state transitions were traced. |
| `browser-validated` | A browser page/source/overlay workflow was actually run. |
| `app-e2e-validated` | The Electron app was run and the real user workflow was verified. |
| `obs-validated` | OBS or equivalent browser-source behavior was verified. |
| `api-runtime-validated` | HTTP/WebSocket relay command behavior was actually exercised. |
| `support-refreshed` | Curated support material was re-mined and summarized safely. |
| `blocked` | Runtime validation could not be completed; the blocker and next step were recorded. |

## Runtime Evidence Template

Copy this shape into the relevant topic doc or validation note:

```text
Validation date:
Validator:
Area:
Evidence label:
Product surface:
OS/browser/app version:
Source/page/platform:
URL shape:
Session/channel/label notes:
Input payloads or actions:
Observed result:
Logs/errors:
What was not tested:
Follow-up:
```

Never record real session IDs, passwords, API keys, OAuth tokens, private endpoints, private channel names, or private support identities.

## Playbook: Commands And API Actions

Use for `sendChat`, `sendEncodedChat`, `clearOverlay`, `nextInQueue`, waitlist/poll/timer actions, StreamDeck buttons, and WebSocket clients.

Start docs:

- `13-reference/control-surface-crosswalk.md`
- `13-reference/action-command-index.md`
- `13-reference/command-action-source-trace.md`
- `13-reference/api-command-examples.md`
- `09-api-and-integrations/websocket-http-api.md`

Minimum setup:

1. Use a private test session.
2. Open the target page, such as `dock.html`, `featured.html`, `waitlist.html`, `poll.html`, or `timer.html`.
3. Enable required remote API/chat relay toggles.
4. If testing labels, open the page with `&label=TEST_LABEL`.
5. Send a harmless command first, such as queue/clear/test payload behavior.
6. Test HTTP and WebSocket forms separately if both are documented.
7. Record whether the relay accepted the command and whether the target page actually acted.

Required outcomes:

- Action name and value shape.
- Required target page/source.
- Required toggles.
- Whether labels work.
- Whether a successful HTTP/WebSocket response is enough to prove target behavior.
- Unsupported or no-op cases.

Do not validate send-chat, moderation, ban/delete, paid-provider, or public platform side effects on a live stream unless that exact side effect is intended and safe.

## Playbook: URL Parameters, Sessions, Labels, And Server Modes

Use when a parameter works on one page but not another, or when `server`, `server2`, `server3`, `localserver`, `label`, or `session` behavior needs proof.

Start docs:

- `13-reference/url-parameter-source-trace.md`
- `13-reference/root-page-url-parameter-matrix.md`
- `13-reference/subpage-url-parameter-matrix.md`
- `13-reference/url-option-examples.md`
- `13-reference/surface-url-cheatsheet.md`

Minimum setup:

1. Pick one page family: dock, featured, theme, game, WebSocket source page, utility page, or overlay.
2. Start with only `session=TEST_SESSION`.
3. Send a controlled payload that the page should display or act on.
4. Add one parameter at a time.
5. Refresh/reopen the page after each URL change.
6. Test `label` only with an API action that targets the label.
7. Test server modes separately and record channels/connection behavior only after observing it.

Required outcomes:

- Parameter is read or ignored by the target page.
- Value parsing behavior: presence flag, boolean, number, string, list, JSON, base64, URL.
- Whether refresh is required.
- Whether hosted/local/OBS behavior differs.
- Any conflict with popup settings or page localStorage.

## Playbook: Settings, Storage, Backups, And Reload Behavior

Use when a setting does not stick, an option is missing, backup/import/export is unclear, or app/extension behavior differs.

Start docs:

- `13-reference/settings-and-toggles.md`
- `13-reference/settings-key-index.md`
- `13-reference/settings-session-storage-source-trace.md`
- `06-settings-sessions-and-storage.md`
- `10-troubleshooting/settings-loss-and-backups.md`

Minimum setup:

1. Identify exact setting key or UI label.
2. Record whether it is generated from `shared/config/settingsDefinitions.js`, manually present in `popup.html`, or page-only.
3. Change the setting in a private profile or app test profile.
4. Verify storage after save/reload.
5. Verify whether source page, dock, overlay, or app source window needs reload.
6. Test export/import/backup only with dummy/private test settings.
7. For app claims, run the real app workflow before using `app-e2e-validated`.

Required outcomes:

- Exact key and storage layer.
- Live-update or reload-required.
- Extension vs app parity.
- Export/import/backup behavior.
- Failure mode and recovery path.

## Playbook: Public Supported-Site Health

Use to promote `public-site-implementation-map.md` rows from generated inventory to current health notes.

Start docs:

- `08-platform-sources/supported-sites-lookup.md`
- `08-platform-sources/public-site-support-status.md`
- `08-platform-sources/public-site-implementation-map.md`
- `08-platform-sources/manifest-row-matrix.md`
- Exact platform/grouped source doc.

Minimum setup:

1. Pick one public site card or stale-risk group.
2. Confirm card name, setup type, source file, source-page asset, manifest row, and grouped doc route.
3. Use a safe test page/account where possible.
4. Verify the extension/app injects or opens the intended source path.
5. Send or wait for a new rendered message/event; do not rely only on old page history.
6. Record what was tested: basic chat only, viewer counts, gifts/tips, reactions, send-back, moderation, app parity, Firefox, or OBS output.
7. Mark unavailable validation as blocked instead of tested.

Required outcomes:

- Current status: works, partial, stale-risk, blocked, historical-only, or not verified.
- Exact URL/mode tested.
- Basic capture result.
- Rich-event/send-back/app-parity status if tested.
- Public-card duplicate/stale notes.

## Playbook: Standalone App Source Windows And Auth

Use for app-vs-extension parity, source-window lifecycle, embedded login, OAuth callback, app state, backup/import/export, and TikTok app workflows.

Start docs:

- `04-standalone-app-architecture.md`
- `04-standalone-app-source-windows.md`
- `10-troubleshooting/desktop-app-issues.md`
- `10-troubleshooting/auth-and-sign-in.md`
- `12-development/testing-and-validation.md`

Minimum setup:

1. Run the Electron app in an isolated profile/environment when possible.
2. Record app version, OS, source mode, and source window URL shape.
3. Open one source window and verify load, source injection/bridge, session, and visible chat/new events.
4. Compare extension behavior only if the claim is app-vs-extension parity.
5. For OAuth/sign-in, record callback flow without secrets.
6. For settings/backup, use dummy data and verify restart/import/export behavior.
7. Keep the app open long enough to observe persistence, reloads, reconnects, or repeated events when relevant.

Required outcomes:

- `app-e2e-validated` only for the workflow actually run.
- Source-window lifecycle notes.
- Session partition/login notes.
- OAuth callback limits or port/profile behavior.
- What extension parity was or was not checked.

## Playbook: OBS And Browser-Source Overlays

Use for dock/featured/theme/multi-alerts/games/helper pages that need visible stream output or audio.

Start docs:

- `07-overlays-and-pages/page-capability-matrix.md`
- `10-troubleshooting/obs-overlay-display.md`
- `13-reference/surface-url-cheatsheet.md`
- Exact overlay/page doc.

Minimum setup:

1. Test the URL in a normal browser first.
2. Send a controlled payload that the page is designed to consume.
3. Verify visible output, animation, clearing, persistence, and timing in browser.
4. Load the same URL in OBS or equivalent browser-source environment.
5. Verify dimensions, transparency, refresh/cache behavior, custom CSS, and audio where relevant.
6. Record if OBS was not available; do not call it `obs-validated`.

Required outcomes:

- Browser result.
- OBS/browser-source result.
- Required payload family.
- Required page state/localStorage.
- Any difference between hosted and local file use.

## Playbook: Event Flow, Streamer.bot, StreamDeck, And OBS Control

Use when a user asks whether automation can trigger media, OBS scenes, TTS, webhooks, Streamer.bot actions, or StreamDeck buttons.

Start docs:

- `09-api-and-integrations/event-flow-editor.md`
- `09-api-and-integrations/streamerbot.md`
- `09-api-and-integrations/streamdeck-companion.md`
- `09-api-and-integrations/obs.md`
- `13-reference/action-command-index.md`

Minimum setup:

1. Use a private session and harmless actions.
2. Confirm trigger source and payload.
3. Confirm target page, output surface, or external tool is open and connected.
4. Run a simple flow/button/action first.
5. Add state, filters, media, OBS, webhook, or custom JS only after the basic path works.
6. Record external tool versions and auth/password handling without secrets.

Required outcomes:

- Trigger condition.
- Action payload shape.
- Output page/tool needed.
- Success/failure result.
- Side effects and safety notes.

## Playbook: TTS, AI, And Provider Behavior

Use for TTS not playing, provider keys, local model paths, AI cohost, generated overlays, or "is this free" provider claims.

Start docs:

- `09-api-and-integrations/tts.md`
- `09-api-and-integrations/ai-features.md`
- `07-overlays-and-pages/ai-cohost-pages.md`
- `13-reference/free-paid-and-support-boundaries.md`
- `13-reference/privacy-security-and-secrets.md`

Minimum setup:

1. Confirm ordinary chat reaches dock first.
2. Identify provider family: browser/system, local model, cloud provider, custom endpoint, cohost, generated overlay.
3. Use dummy prompts/text and non-secret test keys/endpoints where possible.
4. Test in a normal browser before OBS when audio/display is the issue.
5. For local models, record hardware/browser/runtime assumptions.
6. For cloud providers, do not record keys; record only provider family and observed error class.

Required outcomes:

- Provider path.
- Page that produces audio/output.
- Browser/app/OBS audio behavior if tested.
- Cost/account/quota boundary.
- Privacy/secret handling notes.

## Playbook: Support Claim Promotion

Use when a support-history pattern should become current guidance.

Start docs:

- `11-support-kb/support-evidence-ledger.md`
- `11-support-kb/unresolved-or-stale-claims.md`
- `11-support-kb/support-question-phrasebook.md`
- Current source/platform/topic docs.

Minimum setup:

1. Identify the exact claim.
2. Label current evidence: support-derived, historical-only, source-checked, line-validated, or runtime-tested.
3. Check current `social_stream` source/docs.
4. Check current `ssapp` source/docs if app behavior is involved.
5. Use support history only for symptom wording and frequency unless current source/runtime supports the claim.
6. Move unsupported or volatile claims to `unresolved-or-stale-claims.md`.

Required outcomes:

- Claim text.
- Evidence label.
- Docs that use the claim.
- Current support wording.
- Next validation target or stale-risk reason.

## Documentation Updates After Any Runtime Pass

After a validation pass, update:

1. The narrow topic doc.
2. `17-runtime-validation-evidence-log.md`.
3. `01-extraction-checklist.md`.
4. `02-resource-processing-ledger.md`.
5. `14-validation-and-refresh-roadmap.md` if queue status changed.
6. `15-objective-coverage-and-readiness-audit.md` if readiness changed.
7. `11-support-kb/support-evidence-ledger.md` if support claims were promoted or narrowed.
8. `99-agent-index.md` if a new entry point was created.

Then run docs-only validation and scope checks.

## Docs-Only Validation Commands

From `C:\Users\steve\Code\social_stream`:

```powershell
git diff --check -- docs/agents
rg -n "[^\x00-\x7F]" docs/agents
rg -n "[ \t]+$" docs/agents
git status --short | Where-Object { $_ -notmatch '^(..|\?\?) docs/agents/' }
```

Also check `C:\Users\steve\Code\ssapp` remains clean when docs-only work should not touch it:

```powershell
git status --short
```
