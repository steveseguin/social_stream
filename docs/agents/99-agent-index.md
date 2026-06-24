# SSN AI Documentation Index

Status: framework plus source-backed backbone, product/install, overlays, API/integrations, common FAQ, custom-source, troubleshooting, priority platform, remaining platform source, manifest source-load, Event Flow/Streamer.bot, first support-mining, desktop-app support, development/provider, reference, settings, and feature passes.

## Start Here

- `AGENT.md`: scope, write boundary, source priority, and exclusions.
- `00-inventory-and-plan.md`: initial inventory and proposed structure.
- `01-extraction-checklist.md`: pass tracking, extraction levels, and status labels.
- `02-resource-manifest.md`: resource inventory for code, docs, and support data.

## Core Topic Pages

- `01-product-map.md`: heavy extraction pass started.
- `02-installation-and-surfaces.md`: heavy extraction pass started.
- `03-extension-architecture.md`: backbone extraction pass complete.
- `04-standalone-app-architecture.md`: backbone extraction pass complete.
- `05-message-flow-and-event-contracts.md`: backbone extraction pass complete.
- `06-settings-sessions-and-storage.md`: backbone extraction pass complete.

## Sections

- `07-overlays-and-pages/index.md`: dock, featured, multi-alerts, waitlist/polls/games, and custom overlay heavy passes started.
- `08-platform-sources/index.md`: source inventory, manifest content-script matrix, plus YouTube, TikTok, Twitch, Kick, Rumble, Facebook, Instagram, Discord, and generic/custom heavy passes started/complete.
- `09-api-and-integrations/index.md`: WebSocket/HTTP API, TTS, AI, OBS, StreamDeck/Companion, Event Flow, and Streamer.bot heavy passes started.
- `10-troubleshooting/index.md`: quick triage, extension capture, OBS overlay, desktop app, auth, settings/backup, and support-mined platform known-issue passes started/complete.
- `11-support-kb/common-questions.md`: repo-backed FAQ heavy pass started.
- `11-support-kb/mining-method.md`: support DB/file mining method, schemas, counts, safe-source map, and first term counts.
- `11-support-kb/historical-issues.md`: recurring support issue categories from curated support history.
- `11-support-kb/unresolved-or-stale-claims.md`: holding register for stale, volatile, or unverified claims.
- `12-development/index.md`: development section map and core rules.
- `12-development/adding-a-source.md`: heavy extraction pass started.
- `12-development/repo-map.md`: heavy extraction pass started.
- `12-development/shared-code-rules.md`: heavy extraction pass started.
- `12-development/provider-cores-and-shared-utils.md`: heavy extraction pass started.
- `12-development/testing-and-validation.md`: heavy extraction pass started.
- `12-development/build-and-release-boundaries.md`: heavy extraction pass started.
- `13-reference/index.md`: command/action, URL parameter, mode, cost/support, plugin/customization, support-resource, settings/toggles, and feature/capability reference pages.

## Suggested Next Pass

Run a heavy extraction pass on one of these areas:

1. Intense extraction for desktop source-window lifecycle, auth scopes/events, settings storage edge cases, and platform known-issue verification
2. Intense extraction for `08-platform-sources/rumble.md`, `facebook.md`, `instagram.md`, and `discord.md`
3. Intense extraction for `09-api-and-integrations/event-flow-editor.md` and `streamerbot.md`
4. Intense extraction for overlay/tool pages by tracing background command handlers, per-game pages, and Playwright overlay tests
5. Extend the manifest source-load matrix into a full public-site/content-script/provider health map
6. Source-check support-mined claims in `11-support-kb/*` against current `social_stream` and `ssapp` code
7. Intense validation for `13-reference/*` against line-level command handlers, settings definitions, page-specific parameter parsing, and feature/mode capability claims

The current heavy-pass docs identify the main architecture, storage boundaries, product surfaces, install/update paths, overlay modes and interactive tool pages, common API commands, custom/source options, TTS/AI/free-vs-paid boundaries, OBS and StreamDeck control workflows, Event Flow and Streamer.bot basics, extension/OBS troubleshooting, desktop app backup/auth/source-loading behavior, platform capture modes, manifest source-load behavior, provider/shared utility boundaries, development/release boundaries, reference-level command/option/mode/plugin/support/settings/feature routing, and the first mined support-history map. The biggest remaining gap is line-level/intense verification of fragile integrations, command handlers, settings/parameter behavior, feature/mode capability claims, and support-derived platform claims.
