# Desktop App Issues

Status: framework only. Detailed extraction not started.

## Purpose

Document common standalone app issues and differences from the Chrome extension.

## Source Anchors

- `ssapp/main.js`
- `ssapp/preload.js`
- `ssapp/state.js`
- `ssapp/README.md`
- `ssapp/tests/electron/*`
- `stevesbot/resources/instructions/social-stream-support.md`

## Starter Notes

The app can hit embedded browser login restrictions, settings/persistence issues, source loading issues, and platform-specific differences. It uses the `social_stream` repo as source of truth for loaded Social Stream files.

## Planned Sections

- Source window issues
- Embedded auth blocks
- App state/persistence
- Source file resolution
- App update/build confusion
- When to recommend Chrome extension instead
