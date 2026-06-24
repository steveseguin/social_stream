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

## Master Checklist

### Product And Existing Docs

- [ ] Quick: `social_stream/README.md`, `about.md`, `ai.md`
- [ ] Heavy: product surfaces, install modes, extension/app differences
- [ ] Intense: verify all claims against current code and public docs

- [ ] Quick: `social_stream/api.md`, `parameters.md`, `docs/event-reference.html`
- [ ] Heavy: API commands, URL params, event schema, message payload contract
- [ ] Intense: field-by-field payload and command behavior with source references

- [ ] Quick: `social_stream/docs/*.html`, `social_stream/docs/*.md`
- [ ] Heavy: public docs coverage map and stale-claim review
- [ ] Intense: only for docs that are canonical source references

### Extension Runtime

- [ ] Quick: `manifest.json`, `service_worker.js`, `background.html`, `background.js`
- [ ] Heavy: extension lifecycle, background routing, storage, source capture, messaging
- [ ] Intense: source-to-dock message flow and external API behavior

- [ ] Quick: `popup.html`, `popup.js`, `settings/*`, `shared/config/*`
- [ ] Heavy: settings UI, storage keys, session/password behavior, generated parameter docs
- [ ] Intense: settings migration, sync/local behavior, app parity

### Shared Pages And Overlays

- [ ] Quick: `dock.html`, `featured.html`, `multi-alerts.*`, `tts.*`
- [ ] Heavy: dock controls, featured overlay, alert routing, TTS behavior
- [ ] Intense: OBS/browser-source troubleshooting and payload/rendering edge cases

- [ ] Quick: overlay/tool pages listed in `02-resource-manifest.md`
- [ ] Heavy: high-use pages only: waitlist, poll, timer, tipjar, giveaway, actions, chatbot/cohost
- [ ] Intense: only pages tied to frequent support issues or APIs

### Platform Sources

- [ ] Quick: all active `social_stream/sources/*.js`
- [ ] Heavy: YouTube, TikTok, Twitch, Kick, Facebook, Instagram, Rumble, Discord, generic/custom sources
- [ ] Intense: TikTok, YouTube, Kick, Twitch, and any platform with recurring support failures

- [ ] Quick: `social_stream/sources/websocket/*`
- [ ] Heavy: WebSocket setup, auth, message sending, fallback behavior
- [ ] Intense: YouTube, TikTok-adjacent app behavior, Kick, Twitch EventSub, Rumble

- [ ] Quick: `social_stream/providers/*`, `shared/*`
- [ ] Heavy: provider core responsibilities and extension/app compatibility rules
- [ ] Intense: provider cores used by fragile/high-value integrations

### Event Flow And Integrations

- [ ] Quick: `actions/*`
- [ ] Heavy: Event Flow Editor, triggers, actions, state nodes, tests
- [ ] Intense: custom JS actions, media actions, Kick rewards, OBS actions

- [ ] Quick: `api.md`, `streamerbot.html`, `obs-websocket-test.html`, StreamDeck/Companion sections
- [ ] Heavy: integration setup, command paths, troubleshooting
- [ ] Intense: API command contract and OBS remote-control behavior

### Standalone App

- [ ] Quick: `ssapp/README.md`, `RELEASE.md`, `package.json`
- [ ] Heavy: app surfaces, build/run commands, release boundaries
- [ ] Intense: release docs only if doing release-related docs

- [ ] Quick: `ssapp/main.js`, `preload.js`, `state.js`, `index.html`, `renderer.js`
- [ ] Heavy: Electron app architecture, source loading, IPC, state persistence
- [ ] Intense: settings loss, source resolution, security/path validation, message bridge

- [ ] Quick: `ssapp/resources/electron-*-handler.js`, `kick-ws-client.js`
- [ ] Heavy: OAuth and platform handlers
- [ ] Intense: YouTube/Twitch/Facebook/Kick/Velora/VPZone auth flows

- [ ] Quick: `ssapp/tiktok/*`, `ssapp/tiktok-signing/*`, `ssapp/tests/tiktok/*`
- [ ] Heavy: TikTok modes, signing, fallbacks, regression expectations
- [ ] Intense: TikTok support/troubleshooting and current behavior docs

### Support Knowledge Base

- [ ] Quick: `stevesbot/resources/instructions/social-stream-support.md`
- [ ] Heavy: support answer style, top recurring advice, escalation rules
- [ ] Intense: verify every user-facing troubleshooting claim against code/docs

- [ ] Quick: `stevesbot/resources/learnings/social-stream-ninja-top-issues.md`
- [ ] Heavy: common issues and platform-specific support history
- [ ] Intense: stale/historical claim review

- [ ] Quick: SSN files in `stevesbot/resources/learnings/support-qa/*`
- [ ] Heavy: common Q&A extraction into troubleshooting pages
- [ ] Intense: scenario-by-scenario validation against current source

- [ ] Quick: `stevesbot/data/sqlite/knowledge.sqlite` and `resources/knowledge.sqlite`
- [ ] Heavy: category/platform/product queries for SSN support issues
- [ ] Intense: high-frequency platform support threads and contradiction checks

- [ ] Quick: `stevesbot/data/sqlite/stevesbot.sqlite`
- [ ] Heavy: curated support records and Q&A entries
- [ ] Intense: only for high-risk/high-volume claims

- [ ] Quick: `stevesbot/data/sqlite/archive.sqlite`
- [ ] Heavy: raw message search only to confirm real-world symptom wording or frequency
- [ ] Intense: anonymized deep dives only for unresolved or unclear support issues

### Tests And Validation Material

- [ ] Quick: `social_stream/tests/*`, `social_stream/scripts/playwright-*.cjs`
- [ ] Heavy: expected behavior and testable workflows
- [ ] Intense: only for features with current E2E coverage or fragile regressions

- [ ] Quick: `ssapp/tests/electron/*`, `ssapp/tests/tiktok/*`
- [ ] Heavy: app regression expectations and diagnostics
- [ ] Intense: settings loss, source URL parsing, TikTok connection behavior

## Row Template For New Detailed Tracking

Use this when a pass needs file-level status.

| Source | Type | Target doc | Current level | Last checked | Notes |
| --- | --- | --- | --- | --- | --- |
| `relative/path.ext` | code/doc/support/db | `planned-doc.md` | not-started |  |  |
