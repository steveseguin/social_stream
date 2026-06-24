# Kick Source

Status: framework only. Detailed extraction not started.

## Purpose

Document Kick capture modes, auth, WebSocket bridge behavior, channel points/rewards, and support issues.

## Source Anchors

- `social_stream/sources/kick.js`
- `social_stream/sources/kick_new.js`
- `social_stream/sources/websocket/kick.html`
- `social_stream/sources/websocket/kick.js`
- `social_stream/providers/kick/core.js`
- `ssapp/resources/electron-kick-handler.js`
- `ssapp/resources/kick-ws-client.js`
- `social_stream/docs/kick-channel-points-event-flow.md`

## Starter Notes

Support guidance says Kick often requires pop-out chat and sign-in. Captcha or "verifying human" flows can be platform-side and may affect the standalone app differently than Chrome.

## Planned Sections

- Standard source
- WebSocket source
- App bridge behavior
- OAuth/sign-in
- Channel points/rewards
- Event Flow setup
- Common failures
