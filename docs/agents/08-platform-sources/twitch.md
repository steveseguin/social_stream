# Twitch Source

Status: framework only. Detailed extraction not started.

## Purpose

Document Twitch capture, WebSocket/EventSub behavior, OAuth, chat sending, badges/emotes, and known support issues.

## Source Anchors

- `social_stream/sources/twitch.js`
- `social_stream/sources/websocket/twitch.html`
- `social_stream/sources/websocket/twitch.js`
- `social_stream/providers/twitch/chatClient.js`
- `ssapp/resources/electron-twitch-handler.js`
- `social_stream/tests/twitch-chatClient-subgift.test.js`

## Starter Notes

Twitch has classic source behavior plus newer WebSocket/EventSub paths and provider-core code. Support history mentions sign-in/auth loops on some versions.

## Planned Sections

- Standard capture
- WebSocket/EventSub capture
- OAuth
- Send/reply behavior
- Emotes and badges
- Common failures
