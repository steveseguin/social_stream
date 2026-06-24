# Settings Loss And Backups

Status: framework only. Detailed extraction not started.

## Purpose

Document settings loss, export/import, backup/restore, and app/extension storage differences.

## Source Anchors

- `ssapp/state.js`
- `ssapp/settings-backup.js`
- `ssapp/transfer-backup.js`
- `ssapp/transfer-restore-runner.js`
- `ssapp/tests/electron/settings-*.js`
- `social_stream/popup.js`
- `stevesbot/resources/instructions/social-stream-support.md`

## Starter Notes

Support guidance says standalone app settings loss is recurring and can be caused by cleanup tools, AV, updates, or storage cleanup. Extension uninstalling can also delete settings.

## Planned Sections

- Where settings live
- Export/import guidance
- App backup/restore
- Extension update without uninstalling
- Known failure causes
- Recovery steps
