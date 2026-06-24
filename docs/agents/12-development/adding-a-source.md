# Adding A Source

Status: framework only. Detailed extraction not started.

## Purpose

Document how to add or modify a platform source safely.

## Source Anchors

- `social_stream/sources/README.md`
- `social_stream/sources/*.js`
- `social_stream/manifest.json`
- `social_stream/background.js`
- `social_stream/docs/event-reference.html`
- `ssapp/tests/electron/source-url-parsing-regression.js`

## Starter Notes

Source scripts may run in both the extension and the app. They need compatibility with old-school browser scripts and should preserve event payload contracts.

## Planned Sections

- Source file pattern
- Manifest changes
- Icons and settings
- WebSocket source pattern
- Payload fields
- App compatibility
- Tests and docs updates
