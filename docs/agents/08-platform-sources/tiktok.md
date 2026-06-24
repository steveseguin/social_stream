# TikTok Source

Status: framework only. Detailed extraction not started.

## Purpose

Document TikTok standard mode, WebSocket mode, signing, app-specific connection management, and common support problems.

## Source Anchors

- `social_stream/sources/tiktok.js`
- `ssapp/tiktok/connection-manager.js`
- `ssapp/tiktok-signing/electron-signer.js`
- `ssapp/tiktok-auth.js`
- `ssapp/tiktok-badges.js`
- `ssapp/tests/tiktok/*`
- `social_stream/docs/tiktok-guide.html`
- `stevesbot/resources/learnings/playbooks/playbook-tiktok-connection.md`

## Starter Notes

Support data repeatedly identifies TikTok as fragile. Known themes include API changes, standard mode throttling when hidden/minimized, WebSocket mode tradeoffs, duplicate gift behavior, and live/user ID setup mistakes.

## Planned Sections

- Standard mode
- WebSocket mode
- Signing providers
- App connection manager
- Gift/social event handling
- Common failures and escalation
- Historical vs current behavior
