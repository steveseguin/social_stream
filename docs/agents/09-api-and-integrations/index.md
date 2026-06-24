# API And Integrations Index

Status: framework plus WebSocket/HTTP API, TTS, AI, OBS, StreamDeck/Companion, Streamer.bot, and Event Flow heavy passes.

## Purpose

This section covers external APIs, automation, OBS, StreamDeck, Companion, Streamer.bot, Event Flow, TTS, and AI integrations.

## Pages

- `websocket-http-api.md`: heavy extraction pass started.
- `obs.md`: heavy extraction pass started.
- `streamdeck-companion.md`: heavy extraction pass started.
- `streamerbot.md`: heavy extraction pass started.
- `event-flow-editor.md`: heavy extraction pass started.
- `tts.md`: heavy extraction pass started.
- `ai-features.md`: heavy extraction pass started.

## Suggested Next Pass

- Intense extraction for `event-flow-editor.md` using line-level trigger/action execution paths in `EventFlowSystem.js`.
- Intense extraction for `streamerbot.md` by tracing the exact background WebSocket/DoAction request path.
- Intense extraction for `tts.md` provider behavior from `tts.js`.
- Intense extraction for `ai-features.md` provider/RAG/cohost behavior from `ai.js`, `background.js`, and tests.
- Intense pass on API command behavior by tracing `background.js`, `dock.html`, and special pages.
