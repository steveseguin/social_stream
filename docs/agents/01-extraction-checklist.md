# SSN Documentation Extraction Checklist

Last updated on 2026-06-24.

## Purpose

Use this file to track which source files and support datasets have been processed for the SSN AI documentation set. The goal is to support multiple AI passes without redoing the same work or skipping important resource areas.

Only write extraction notes and status changes inside `C:\Users\steve\Code\social_stream\docs\agents`.

## Extraction Levels

### Quick

Use quick extraction when the goal is coverage and orientation.

Record:

- What the file/dataset is for
- Major concepts, pages, features, or workflows
- Obvious links to planned docs
- Any high-risk unknowns needing deeper review

Expected output: short notes, source map entries, and candidate doc sections.

### Heavy

Use heavy extraction when a source is important to product behavior or user support.

Record:

- Function/page/component responsibilities
- Message flows, settings, storage, APIs, URL params, and runtime boundaries
- User setup steps
- Common failure modes
- Chrome extension vs standalone app differences
- Source-backed claims with file references

Expected output: usable topic documentation.

### Intense

Use intense extraction for source-of-truth behavior, fragile integrations, or high-volume support issues.

Record:

- Line-level behavior and key state transitions
- Edge cases, retries, fallbacks, cleanup, persistence, and security boundaries
- Cross-checks against current code, existing docs, tests, and support history
- Known stale/historical claims
- Repro or validation notes when practical

Expected output: final-grade documentation and troubleshooting pages.

## Status Values

Use these labels in pass notes:

- `not-started`
- `quick-complete`
- `heavy-complete`
- `intense-complete`
- `needs-refresh`
- `blocked`
- `skip`

## Pass Log

Add one entry per extraction pass.

| Date | Agent | Scope | Level | Output files | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-06-23 | Codex | Initial repo/support inventory | Quick | `00-inventory-and-plan.md`, `01-extraction-checklist.md`, `02-resource-manifest.md` | quick-complete | Created tracker and manifest. No detailed extraction yet. |
| 2026-06-23 | Codex | Documentation framework and starter pages | Quick | Topic files under `01-*` through `12-*`, `_templates/`, `99-agent-index.md` | quick-complete | Created starter files and section scaffolds. Detailed extraction still not started. |
| 2026-06-24 | Codex | Backbone architecture, flow, storage, and triage notes | Heavy | `03-extension-architecture.md`, `04-standalone-app-architecture.md`, `05-message-flow-and-event-contracts.md`, `06-settings-sessions-and-storage.md`, `10-troubleshooting/quick-triage.md`, `AGENT.md`, `99-agent-index.md` | heavy-complete | First source-backed pass using manifest, service worker, background, app preload/state/main notes, and support history. Needs field-level/intense passes later. |
| 2026-06-24 | Codex | Priority platform sources: YouTube, TikTok, Twitch, Kick | Heavy | `08-platform-sources/index.md`, `youtube.md`, `tiktok.md`, `twitch.md`, `kick.md`, `99-agent-index.md` | heavy-complete | Added source-backed capture modes, setup notes, payload/event notes, app-vs-extension differences, support failures, and deeper extraction targets. |
| 2026-06-24 | Codex | Product map, install surfaces, API, common FAQ, custom/source development | Heavy | `01-product-map.md`, `02-installation-and-surfaces.md`, `09-api-and-integrations/websocket-http-api.md`, `11-support-kb/common-questions.md`, `08-platform-sources/generic-and-custom-sources.md`, `12-development/adding-a-source.md`, indexes | heavy-complete | Source-backed pass using README, api.md, parameters.md, commands docs, download docs, site metadata, manifest/source patterns, custom script templates, and sample WSS source. Support DB mining remains pending. |
| 2026-06-24 | Codex | Overlay pages, TTS, AI, OBS, StreamDeck/Companion, capture/display troubleshooting | Heavy | `07-overlays-and-pages/dock.md`, `featured.md`, `index.md`, `09-api-and-integrations/tts.md`, `ai-features.md`, `obs.md`, `streamdeck-companion.md`, `10-troubleshooting/extension-not-capturing.md`, `obs-overlay-display.md`, indexes | heavy-complete | Added source-backed setup modes, command/control references, free-vs-paid AI/TTS boundaries, OBS audio/control notes, and troubleshooting matrices. Needs line-level behavior and support DB mining later. |
| 2026-06-24 | Codex | Support KB mining method, historical issue map, stale-claim register, platform known-issue matrix | Heavy | `11-support-kb/mining-method.md`, `historical-issues.md`, `unresolved-or-stale-claims.md`, `support-source-map.md`, `10-troubleshooting/platform-known-issues.md`, indexes | heavy-complete | Safe support-source pass using curated instructions, generated top issues, Q&A exports, playbooks, SQLite schemas/counts, and topic-frequency queries. Raw archive was schema/count checked only; no raw conversation extraction. |
| 2026-06-24 | Codex | Desktop app issues, auth/sign-in, settings loss and backups | Heavy | `10-troubleshooting/desktop-app-issues.md`, `auth-and-sign-in.md`, `settings-loss-and-backups.md`, indexes | heavy-complete | Source-backed pass using `ssapp/main.js`, `state.js`, OAuth handlers, backup/transfer modules, and settings diagnostics. Does not include real in-app/e2e testing. |
| 2026-06-24 | Codex | Event Flow, Streamer.bot, Rumble, Facebook, Instagram, Discord | Heavy | `09-api-and-integrations/event-flow-editor.md`, `streamerbot.md`, `08-platform-sources/rumble.md`, `facebook.md`, `instagram.md`, `discord.md`, indexes | heavy-complete | Source-backed pass using Event Flow editor/system/tests/guides, Streamer.bot setup page, Rumble DOM/API bridge, Facebook DOM/Graph bridge, Instagram live/feed scripts, and Discord content script. Needs line-level/intense validation later. |
| 2026-06-24 | Codex | Multi-alerts, waitlist/polls/timer/giveaway/games, custom overlays | Heavy | `07-overlays-and-pages/multi-alerts.md`, `waitlist-polls-games.md`, `custom-overlays.md`, indexes | heavy-complete | Source-backed pass using `multi-alerts.*`, `waitlist.html`, `poll.html`, `timer.html`, `giveaway*.html`, `games.html`, `docs/customoverlays.md`, `sampleoverlay.html`, and `api.md`. Needs per-game and command-handler intense checks later. |
| 2026-06-24 | Codex | Development repo map, shared code rules, testing, build/release boundaries | Heavy | `12-development/index.md`, `repo-map.md`, `shared-code-rules.md`, `testing-and-validation.md`, `build-and-release-boundaries.md`, `99-agent-index.md` | heavy-complete | Source-backed pass using `social_stream/AGENTS.md`, `manifest.json`, package scripts, `ssapp/AGENTS.md`, `ssapp/package.json`, `ssapp/RELEASE.md`, and app resource notes. |
| 2026-06-24 | Codex | Cross-cutting reference pages for commands, URL options, modes, costs, plugin paths, and support resources | Heavy | `13-reference/index.md`, `commands-and-actions.md`, `url-parameters.md`, `modes-and-capability-matrix.md`, `free-paid-and-support-boundaries.md`, `custom-plugins-and-extensions.md`, `support-resources-and-escalation.md`, `99-agent-index.md` | heavy-complete | Source-backed reference pass using README, `api.md`, `parameters.md`, `docs/commands.html`, support/download/guides pages, custom script templates, source/dev docs, and current agent pages. Needs line-level/intense validation against command handlers, settings definitions, and page-specific parameter parsing. |
| 2026-06-24 | Codex | Supported-site and source inventory | Heavy | `08-platform-sources/source-inventory.md`, `08-platform-sources/index.md`, `99-agent-index.md`, `01-extraction-checklist.md` | heavy-complete | Parsed `docs/js/sites.js`, `manifest.json`, `sources/*.js`, `sources/static/*`, `sources/inject/*`, and `sources/websocket/*` into counts and public setup groups. Needs generated manifest-to-site mapping and health/status reconciliation later. |
| 2026-06-24 | Codex | Generated settings, toggles, URL parameter counts, and feature capability map | Heavy | `13-reference/settings-and-toggles.md`, `features-and-capabilities.md`, `13-reference/index.md`, `11-support-kb/common-questions.md`, indexes | heavy-complete | Parsed `shared/config/settingsDefinitions.js` and `shared/config/urlParameters.js`; mapped 327 popup settings, 255 generated URL parameters, generated setting categories, and public feature families from `docs/features.html`. Needs line-level storage/live-update/app-parity validation later. |
| 2026-06-24 | Codex | Manifest source-load matrix and provider/shared utility map | Heavy | `08-platform-sources/manifest-content-scripts.md`, `12-development/provider-cores-and-shared-utils.md`, indexes | heavy-complete | Parsed `manifest.json` content-script buckets, special `document_start`/`all_frames` entries, web-accessible provider/shared resources, and provider-core exports for Kick, Twitch, and YouTube. Needs full 155-row public-site mapping and adapter/event-payload tracing later. |

## Master Checklist

### Product And Existing Docs

- [x] Quick: `social_stream/README.md`, `about.md`, `ai.md`
- [x] Heavy: product surfaces, install modes, extension/app differences
- [ ] Intense: verify all claims against current code and public docs

- [x] Quick: `social_stream/api.md`, `parameters.md`, `docs/event-reference.html`
- [x] Heavy: API commands, URL params, event schema, message payload contract
- [x] Heavy: cross-topic reference pages for command/action buckets, URL parameter families, mode selection, free/paid boundaries, plugin/custom paths, and support resources
- [x] Heavy: generated setting category map, popup/URL setting distinction, and broad feature/capability routing
- [ ] Intense: field-by-field payload and command behavior with source references

- [ ] Quick: `social_stream/docs/*.html`, `social_stream/docs/*.md`
- [ ] Heavy: public docs coverage map and stale-claim review
- [ ] Intense: only for docs that are canonical source references

### Extension Runtime

- [ ] Quick: `manifest.json`, `service_worker.js`, `background.html`, `background.js`
- [ ] Heavy: extension lifecycle, background routing, storage, source capture, messaging
- [ ] Intense: source-to-dock message flow and external API behavior

- [x] Heavy: manifest content-script buckets, source-load flags, and helper/source-page classification

- [x] Quick: `popup.html`, `popup.js`, `settings/*`, `shared/config/*`
- [x] Heavy: settings UI, storage keys, session/password behavior, generated parameter docs
- [ ] Intense: settings migration, sync/local behavior, app parity

### Shared Pages And Overlays

- [x] Quick: `dock.html`, `featured.html`, `multi-alerts.*`, `tts.*`
- [x] Heavy: dock controls, featured overlay, alert routing, TTS behavior, waitlist/poll/timer/giveaway/games, and custom overlays
- [ ] Intense: OBS/browser-source troubleshooting and payload/rendering edge cases

- [x] Quick: overlay/tool pages listed in `02-resource-manifest.md`
- [x] Heavy: high-use pages only: waitlist, poll, timer, giveaway, actions/Event Flow, custom overlays, multi-alerts
- [ ] Intense: only pages tied to frequent support issues or APIs

### Platform Sources

- [ ] Quick: all active `social_stream/sources/*.js`
- [x] Heavy: public supported-site/source inventory counts and setup-type groups
- [x] Heavy: manifest content-script source-load matrix and special load flags
- [x] Heavy: YouTube, TikTok, Twitch, Kick
- [x] Heavy: Facebook, Instagram, Rumble, Discord
- [x] Heavy: generic/custom sources
- [ ] Intense: TikTok, YouTube, Kick, Twitch, and any platform with recurring support failures

- [ ] Quick: `social_stream/sources/websocket/*`
- [ ] Heavy: WebSocket setup, auth, message sending, fallback behavior
- [ ] Intense: YouTube, TikTok-adjacent app behavior, Kick, Twitch EventSub, Rumble

- [ ] Quick: `social_stream/providers/*`, `shared/*`
- [x] Heavy: provider core responsibilities and extension/app compatibility rules
- [ ] Intense: provider cores used by fragile/high-value integrations

### Event Flow And Integrations

- [x] Quick: `actions/*`
- [x] Heavy: Event Flow Editor, triggers, actions, state nodes, tests
- [ ] Intense: custom JS actions, media actions, Kick rewards, OBS actions

- [x] Quick: `api.md`, `streamerbot.html`, `obs-websocket-test.html`, StreamDeck/Companion sections
- [x] Heavy: integration setup, command paths, troubleshooting
- [ ] Intense: API command contract and OBS remote-control behavior

- [x] Heavy: TTS providers, AI features, OBS integration, StreamDeck/Companion control
- [ ] Intense: provider/API behavior, OBS control paths, and command contract from line-level code

### Standalone App

- [ ] Quick: `ssapp/README.md`, `RELEASE.md`, `package.json`
- [x] Heavy: app build/run commands and release boundaries from `AGENTS.md`, `RELEASE.md`, and `package.json`
- [ ] Intense: release docs only if doing release-related docs

- [x] Quick: `ssapp/main.js`, `preload.js`, `state.js`, `index.html`, `renderer.js`
- [x] Heavy: Electron app architecture, source loading, IPC, state persistence
- [ ] Intense: settings loss, source resolution, security/path validation, message bridge

- [x] Quick: `ssapp/resources/electron-*-handler.js`, `kick-ws-client.js`
- [x] Heavy: OAuth and platform handlers
- [ ] Intense: YouTube/Twitch/Facebook/Kick/Velora/VPZone auth flows

- [ ] Quick: `ssapp/tiktok/*`, `ssapp/tiktok-signing/*`, `ssapp/tests/tiktok/*`
- [ ] Heavy: TikTok modes, signing, fallbacks, regression expectations
- [ ] Intense: TikTok support/troubleshooting and current behavior docs

### Support Knowledge Base

- [x] Quick: `stevesbot/resources/instructions/social-stream-support.md`
- [x] Heavy: support answer style, top recurring advice, escalation rules
- [ ] Intense: verify every user-facing troubleshooting claim against code/docs

- [x] Quick: `stevesbot/resources/learnings/social-stream-ninja-top-issues.md`
- [x] Heavy: common issues and platform-specific support history
- [ ] Intense: stale/historical claim review

- [x] Quick: SSN files in `stevesbot/resources/learnings/support-qa/*`
- [x] Heavy: common Q&A extraction into troubleshooting pages
- [ ] Intense: scenario-by-scenario validation against current source

- [x] Quick: repo-backed common questions from `README.md`, `api.md`, `parameters.md`, and public docs
- [x] Heavy: repo-backed common questions and support triage baseline
- [x] Heavy: historical support method, issue map, stale claim register, and platform known-issues matrix
- [x] Heavy: support resource routing, escalation criteria, and bug-report evidence checklist
- [ ] Intense: resolve stale/contradictory claims against current source

- [x] Quick: `stevesbot/data/sqlite/knowledge.sqlite`
- [ ] Quick: `stevesbot/resources/knowledge.sqlite`
- [x] Heavy: category/platform/product queries for SSN support issues
- [ ] Intense: high-frequency platform support threads and contradiction checks

- [x] Quick: `stevesbot/data/sqlite/stevesbot.sqlite`
- [x] Heavy: curated support records and Q&A entries
- [ ] Intense: only for high-risk/high-volume claims

- [x] Quick: `stevesbot/data/sqlite/archive.sqlite`
- [ ] Heavy: raw message search only to confirm real-world symptom wording or frequency
- [ ] Intense: anonymized deep dives only for unresolved or unclear support issues

### Tests And Validation Material

- [ ] Quick: `social_stream/tests/*`, `social_stream/scripts/playwright-*.cjs`
- [ ] Heavy: expected behavior and testable workflows
- [ ] Intense: only for features with current E2E coverage or fragile regressions

- [x] Quick: `ssapp/tests/electron/*`
- [ ] Quick: `ssapp/tests/tiktok/*`
- [x] Heavy: app regression expectations and diagnostics
- [ ] Intense: settings loss, source URL parsing, TikTok connection behavior

## Row Template For New Detailed Tracking

Use this when a pass needs file-level status.

| Source | Type | Target doc | Current level | Last checked | Notes |
| --- | --- | --- | --- | --- | --- |
| `relative/path.ext` | code/doc/support/db | `planned-doc.md` | not-started |  |  |
