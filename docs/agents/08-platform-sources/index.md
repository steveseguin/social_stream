# Platform Sources Index

Status: framework plus heavy passes for source inventory, manifest content-script matrix, YouTube, TikTok, Twitch, Kick, Rumble, Facebook, Instagram, Discord, and generic/custom sources.

## Purpose

This section tracks platform-specific source capture behavior.

## High-Priority Pages

- `source-inventory.md`: heavy inventory pass started.
- `manifest-content-scripts.md`: manifest source-load matrix and special content-script flags.
- `youtube.md`: heavy extraction pass complete.
- `tiktok.md`: heavy extraction pass complete.
- `twitch.md`: heavy extraction pass complete.
- `kick.md`: heavy extraction pass complete.
- `facebook.md`: heavy extraction pass started.
- `instagram.md`: heavy extraction pass started.
- `rumble.md`: heavy extraction pass started.
- `discord.md`: heavy extraction pass started.
- `generic-and-custom-sources.md`: heavy extraction pass started.

## Source Anchors

- `social_stream/sources/*.js`
- `social_stream/sources/websocket/*`
- `social_stream/providers/*`
- `ssapp/resources/electron-*-handler.js`
- `ssapp/tiktok/*`
- `stevesbot/resources/learnings/social-stream-ninja-top-issues.md`

## Suggested Next Pass

Continue with one of:

- Intense extraction on TikTok app mode and signing.
- Intense extraction on Kick bridge event normalization and `kick.js` vs `kick_new.js` runtime loading.
- Intense extraction on Rumble API/SSE payloads and popup URL generation.
- Intense extraction on Facebook OAuth/Graph API behavior and viewer-mode support claims.
- Intense extraction on Instagram/Discord popup settings and support-history validation.
- API/Event Flow pass to connect platform events to integration docs.
- Full manifest-to-public-site matrix with all 155 rows, public setup types, and health/status notes.
