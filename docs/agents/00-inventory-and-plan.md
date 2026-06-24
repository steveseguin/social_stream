# SSN AI Documentation Inventory And Plan

Checked on 2026-06-23.

## Goal

Build an exhaustive markdown documentation set for AI agents that need to answer questions about Social Stream Ninja, including both the Chrome extension in `social_stream` and the standalone Electron app in `ssapp`.

This first pass creates the working folder, records what already exists, and lays out the proposed documentation structure. It does not create the full documentation set yet.

## Write Location

All new AI documentation should live under:

`C:\Users\steve\Code\social_stream\docs\agents`

No other files should be edited for this documentation project unless Steve explicitly changes the scope.

## Existing Source Map

### `C:\Users\steve\Code\social_stream`

Primary source for the Chrome extension, public web overlays, shared source scripts, and code loaded by the standalone app.

Observed structure:

- `manifest.json`: Chrome extension Manifest V3 config. Version observed: `3.50.1`.
- `service_worker.js`: extension service worker and routing shim into the background page.
- `background.html` / `background.js`: long-running extension background page logic.
- `popup.html` / `popup.js`: main extension settings UI.
- `dock.html`: dashboard/control surface for incoming messages, pinning, queues, TTS, OBS control, and related workflows.
- `featured.html`: featured-message overlay.
- `sources/`: platform source scripts. This is the largest folder observed, with classic content scripts, platform icons, and `sources/websocket/*` connector pages/scripts.
- `providers/`: newer environment-agnostic provider cores, currently including Kick, Twitch, and YouTube.
- `shared/`: shared utilities and vendors used across extension, app, and some standalone pages.
- `actions/`: Event Flow Editor and action-flow system.
- `settings/`: extension options pages and config JSON.
- `themes/`, `media/`, `icons/`, `audio/`, `games/`, `lite/`: user-facing pages/assets and standalone surfaces.
- `scripts/`: test, validation, sync, and Playwright helper scripts.
- `tests/`: regression and RAG tests.
- `docs/`: existing public docs site content.

Approximate top-level source counts from `rg --files`:

- `sources`: 381 files
- `thirdparty`: 114 files
- `icons`: 86 files
- `themes`: 68 files
- `docs`: 51 files
- `scripts`: 39 files
- `tests`: 35 files
- `actions`: 28 files
- `lite`: 18 files
- `games`: 17 files
- `translations`: 16 files
- `shared`: 12 files
- `providers`: 5 files

Existing docs worth mining first:

- `README.md`: product overview, supported sites, extension install, standalone version, customization, TTS, API, known issues, Zoom, OBS remote scenes.
- `about.md`: compact AI integration overview.
- `api.md`: WebSocket API, HTTP API, command routing, featured/dock/waitlist/battle controls, StreamDeck, Bitfocus Companion.
- `parameters.md`: URL parameters for dock, overlays, TTS, donation/member handling, OBS integration, automation, debugging.
- `docs/event-reference.html`: canonical event payload vocabulary and message fields.
- `docs/customoverlays.md`: custom overlay connection methods and payload handling.
- `docs/ssapp.html`: standalone app public documentation.
- `docs/tiktok-guide.html`: TikTok setup and troubleshooting.
- `docs/local-tts.html` and `docs/tts.html`: TTS setup and providers.
- `docs/services.html`, `docs/settings.html`, `docs/supported-sites.html`, `docs/guides.html`, `docs/support.html`: user-facing setup and support material.
- `docs/kick-channel-points-event-flow.md`: recent Event Flow guide for Kick rewards.
- `actions/event-flow-guide.html` and `actions/STATE_NODES_EXPLANATION.md`: action-flow behavior.

Important repo instruction already present:

- `sources/` and `sources/websocket/` scripts are shared by the Chrome extension and Electron app.
- Browser-facing code should stay Chrome 80 friendly unless Steve says otherwise.
- Provider cores should remain environment agnostic.
- Remote executable scripts/WASM should not be introduced into extension code.
- `docs/event-reference.html` is the canonical event payload reference.

### `C:\Users\steve\Code\ssapp`

Standalone Electron app source. This app uses Social Stream source files from `C:\Users\steve\Code\social_stream` as the primary runtime source. The fallback bundle is disposable and was intentionally not inspected.

Observed structure:

- `main.js`: main Electron process. Very large; handles windows, source loading, IPC, app lifecycle, OAuth handlers, local services, and platform-specific glue.
- `preload.js`: exposes `window.ninjafy` and Electron IPC bridges to extension-style pages/scripts.
- `state.js`: app state manager, source modes, session bindings, localStorage migration/compatibility, and TikTok/YouTube global state.
- `index.html`, `main.css`, `renderer.js`: app UI shell.
- `tiktok/connection-manager.js`: TikTok connection management and WebSocket/legacy handling.
- `tiktok-signing/electron-signer.js`: TikTok signing helper.
- `resources/electron-*-handler.js`: OAuth and integration handlers for YouTube, Twitch, Facebook, Kick, Velora, VPZone, Spotify, and others.
- `resources/kick-ws-client.js`: Kick WebSocket bridge client.
- `tests/electron/*`: diagnostics and regression tests for settings, stability, IPC, path security, source URL parsing, and TTS.
- `tests/tiktok/*`: TikTok integration/regression harnesses.
- `scripts/*`: build, fallback update, dependency patching, VirusTotal submit, and related automation.

Observed app package info:

- Package name: `SocialStream`
- Version observed: `0.3.129`
- Main entry: `main.js`
- Key commands: `npm run start`, `npm run start2`, `npm run start3`, `npm run update:fallback`, `npm run build:*`, and targeted regression scripts.

Existing docs worth mining:

- `README.md`: standalone features, download, build, usage, YouTube OAuth troubleshooting, configuration.
- `RELEASE.md`: release boundaries and critical rule that app releases belong in `steveseguin/social_stream`, not `ssapp`.
- `CONTRIBUTING.md`: development setup and contribution notes.
- `CODE_SIGNING.md`: signing verification notes.
- `tests/*`: expected behavior and known regressions.

Do not mine for normal docs:

- `resources/social_stream_fallback`: disposable fallback bundle, not source of truth.

### `C:\Users\steve\Code\stevesbot`

Historical support and knowledge base material. This is a supporting evidence source, not the product source of truth.

Observed structure:

- `resources/instructions/social-stream-support.md`: concise current support guidance for SSN, SSN Desktop App, Electron Capture, and Caption.Ninja.
- `resources/learnings/social-stream-ninja-top-issues.md`: generated summary of common SSN support issues.
- `resources/learnings/support-qa/social-stream-qa.md`: larger social-stream support Q&A.
- `resources/learnings/support-qa/social-stream-qa-expanded.md`: expanded support Q&A.
- `resources/learnings/support-qa/social-stream-configuration.md`: configuration-focused support notes.
- `resources/learnings/product-notes/social-stream-architecture.md`: architecture-oriented notes.
- `resources/learnings/playbooks/playbook-obs-overlay-issues.md`: OBS overlay troubleshooting.
- `resources/learnings/playbooks/playbook-tiktok-connection.md`: TikTok connection troubleshooting.
- `resources/learnings/playbooks/triage-macros.md` and related rapid-response files: support triage material.
- `data/mined-threads/*.jsonl`: mined support-thread summaries.
- `data/sqlite/knowledge.sqlite` and `resources/knowledge.sqlite`: summarized mined-thread database.
- `data/sqlite/stevesbot.sqlite`: curated records, Q&A entries, transcripts, workflow data.
- `data/sqlite/archive.sqlite`: raw archived Discord messages.

Observed database tables and counts:

- `knowledge.sqlite`
  - Main table: `mined_threads`
  - Count observed: 2,264 rows
  - Useful columns: thread name, channel, source URL, timestamps, message count, participants JSON, summary, problem statement, solution, resolved flag, keywords/products/platforms/error signals JSON, category, searchable text.
- `stevesbot.sqlite`
  - Useful tables: `support_records`, `qa_entries`, `transcripts`
  - Counts observed: `support_records` 499, `qa_entries` 358, `transcripts` 13,272
- `archive.sqlite`
  - Useful table: `archived_messages`
  - Count observed: 47,600 messages

Exclusions:

- `resources/secrets`: never read or document from this folder.
- VDO.Ninja, Raspberry Ninja, and unrelated product material should be ignored unless it directly affects SSN setup or integration.
- Raw Discord archive data should be treated as private support evidence and summarized/anonymized.

## Proposed Documentation Structure

The documentation set should be split by job-to-be-done, not only by code folder. That makes it easier for AI agents to answer support, setup, and development questions.

```text
docs/agents/
  AGENT.md
  00-inventory-and-plan.md
  01-product-map.md
  02-installation-and-surfaces.md
  03-extension-architecture.md
  04-standalone-app-architecture.md
  05-message-flow-and-event-contracts.md
  06-settings-sessions-and-storage.md
  07-overlays-and-pages/
    dock.md
    featured.md
    multi-alerts.md
    waitlist-polls-games.md
    custom-overlays.md
  08-platform-sources/
    index.md
    youtube.md
    tiktok.md
    twitch.md
    kick.md
    facebook.md
    instagram.md
    rumble.md
    discord.md
    generic-and-custom-sources.md
  09-api-and-integrations/
    websocket-http-api.md
    obs.md
    streamdeck-companion.md
    streamerbot.md
    event-flow-editor.md
    tts.md
    ai-features.md
  10-troubleshooting/
    quick-triage.md
    extension-not-capturing.md
    desktop-app-issues.md
    auth-and-sign-in.md
    obs-overlay-display.md
    settings-loss-and-backups.md
    platform-known-issues.md
  11-support-kb/
    mining-method.md
    support-source-map.md
    common-questions.md
    historical-issues.md
    unresolved-or-stale-claims.md
  12-development/
    repo-map.md
    adding-a-source.md
    shared-code-rules.md
    testing-and-validation.md
    build-and-release-boundaries.md
  99-agent-index.md
```

## Proposed Page Roles

### `01-product-map.md`

Explain what SSN is, what the extension does, what the standalone app does, which pages are overlays/tools, and how users typically combine SSN with OBS.

### `02-installation-and-surfaces.md`

Cover Chrome extension install/update, extension stores, standalone app install, beta/stable distinction, hosted pages, local files, and when to use each surface.

### `03-extension-architecture.md`

Document extension runtime flow: Manifest V3 service worker, background page, popup settings UI, content scripts, storage, messaging, source windows, and permissions.

### `04-standalone-app-architecture.md`

Document Electron windows, `window.ninjafy`, IPC bridges, source-file resolution, OAuth handlers, TikTok/Kick/YouTube special handling, state persistence, and app-specific differences.

### `05-message-flow-and-event-contracts.md`

Make one agent-friendly source of truth for message payloads, event types, `meta`, source-to-background-to-dock/overlay flow, VDO.Ninja bridge flow, WebSocket API flow, and compatibility expectations.

### `06-settings-sessions-and-storage.md`

Document session IDs, passwords, Chrome sync/local storage, app localStorage/electron-store behavior, export/import, settings loss, source bindings, and URL parameter interactions.

### `07-overlays-and-pages/*`

Break out dock, featured overlay, alert pages, queue/waitlist/poll/game pages, custom overlays, styling, CSS variables, and OBS browser source behavior.

### `08-platform-sources/*`

Create one page per high-value platform with setup steps, source file locations, modes, auth requirements, known failure modes, and support-derived guidance. Start with YouTube, TikTok, Twitch, Kick, Facebook, Instagram, Rumble, Discord, and generic/custom sources.

### `09-api-and-integrations/*`

Cover external control and integration: WebSocket/HTTP API, channels, OBS remote scene control, StreamDeck, Bitfocus Companion, Streamer.bot, Event Flow Editor, TTS providers, and AI/cohost features.

### `10-troubleshooting/*`

Convert support knowledge into practical triage pages. Each page should include symptoms, likely causes, exact checks, known platform quirks, and when to escalate as a platform-side breakage.

### `11-support-kb/*`

Document how the support data was mined, which sources are trusted, how claims are validated against code, which support answers are historical, and which questions still need source verification.

### `12-development/*`

Document how to safely change SSN: repo map, adding new platform sources, shared-code compatibility rules, tests that matter, Electron differences, build commands, release boundaries, and event-reference update rules.

### `99-agent-index.md`

Final navigation index for AI agents. This should be generated last, after the detailed pages exist.

## Suggested Build Order

1. Product map and install/surface docs.
2. Message flow and event contract docs, because many other pages depend on these.
3. Extension architecture and standalone app architecture.
4. Settings/session/storage docs.
5. Overlay/page docs.
6. Platform source docs, starting with the highest support volume: TikTok, YouTube, Kick, Twitch, Rumble.
7. API/integration docs.
8. Troubleshooting docs from support data.
9. Development docs.
10. Final agent index.

## Verification Method

For each page:

- Link claims back to specific source files or existing docs.
- Prefer current code over historical support answers.
- Mark support-derived claims as historical until source-confirmed.
- Keep extension/app differences explicit.
- Add an "Open Questions" section when a behavior is inferred but not confirmed.

## First-Pass Open Questions

- Which support categories in `stevesbot` should be considered in scope beyond SSN Desktop App, Electron Capture, Caption.Ninja, and OBS overlays?
- Should this documentation include exact UI labels from `popup.html`, or summarize behavior and reference source locations?
- Should raw support examples be anonymized into scenario pages, or only used to rank common problems?
- Should generated agent docs eventually be moved into public docs, or remain temporary/private under `docs/agents`?
