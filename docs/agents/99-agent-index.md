# SSN AI Documentation Index

Status: framework plus first source-backed backbone pass.

## Start Here

- `AGENT.md`: scope, write boundary, source priority, and exclusions.
- `00-inventory-and-plan.md`: initial inventory and proposed structure.
- `01-extraction-checklist.md`: pass tracking, extraction levels, and status labels.
- `02-resource-manifest.md`: resource inventory for code, docs, and support data.

## Core Topic Pages

- `01-product-map.md`: framework only.
- `02-installation-and-surfaces.md`: framework only.
- `03-extension-architecture.md`: backbone extraction pass complete.
- `04-standalone-app-architecture.md`: backbone extraction pass complete.
- `05-message-flow-and-event-contracts.md`: backbone extraction pass complete.
- `06-settings-sessions-and-storage.md`: backbone extraction pass complete.

## Sections

- `07-overlays-and-pages/index.md`
- `08-platform-sources/index.md`
- `09-api-and-integrations/index.md`
- `10-troubleshooting/index.md`
- `11-support-kb/mining-method.md`
- `12-development/repo-map.md`

## Suggested Next Pass

Run a heavy extraction pass on one of these areas:

1. `08-platform-sources/youtube.md`, `tiktok.md`, `twitch.md`, and `kick.md`
2. `09-api-and-integrations/websocket-http-api.md` plus `social_stream/api.md`
3. `07-overlays-and-pages/dock.md` and `featured.md`
4. `10-troubleshooting/extension-not-capturing.md`, `desktop-app-issues.md`, and `settings-loss-and-backups.md`
5. File-level support mining in `11-support-kb/*`

The backbone pages now identify the main architecture and storage boundaries. The next passes should fill in exact setup steps, source files processed, platform differences, and support-confirmed failure modes.
