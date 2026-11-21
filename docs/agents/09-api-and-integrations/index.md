# API And Integrations Index

Status: framework plus WebSocket/HTTP API, TTS, AI, OBS, StreamDeck/Companion, Streamer.bot, Event Flow, action lookup, API command validation heavy passes, focused Event Flow Node-test evidence, focused AI prompt builder/moderation/local-model/provider-fallback evidence, and focused RAG fixture evidence.

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
- `../07-overlays-and-pages/ai-cohost-pages.md`: page-level AI/cohost routing for `cohost.html`, `cohost-overlay.html`, `aiprompt.html`, and `aioverlay.html`.
- `../13-reference/action-command-index.md`: exact action-name lookup for API/page/background/Event Flow commands.
- `../13-reference/command-action-source-trace.md`: source-checked command/action routing notes and handler caveats.
- `../13-reference/api-command-validation-matrix.md`: command/API acceptance versus target page/source action, callbacks, false positives, and runtime proof boundaries.
- `../13-reference/url-parameter-source-trace.md`: source-checked URL parser, server/channel, and page-specific parameter caveats.
- `../13-reference/surface-url-cheatsheet.md`: hosted page, API endpoint, and WebSocket source-page URL routing.
- `../07-overlays-and-pages/page-capability-matrix.md`: page dependency matrix for API/Event Flow/OBS/tool targets.
- `../18-focused-validation-evidence-log.md`: focused non-runtime validation evidence, currently including Event Flow, Twitch provider, AI prompt builder, AI moderation, local model registry, provider fallback, local TTS, local AI asset, and RAG fixture tests.

## Suggested Next Pass

- Intense extraction for `event-flow-editor.md` using line-level trigger/action execution paths in `EventFlowSystem.js`.
- Intense extraction for `streamerbot.md` by tracing the exact background WebSocket/DoAction request path.
- Intense extraction for `tts.md` provider behavior from `tts.js`.
- Intense extraction for `ai-features.md` provider/RAG/cohost behavior from `ai.js`, `background.js`, and tests.
- Intense extraction for `../07-overlays-and-pages/ai-cohost-pages.md` by tracing dock cohost commands, overlay labels, generated overlay storage, and local model workers.
- Runtime validation of `../13-reference/api-command-validation-matrix.md`, `../13-reference/command-action-source-trace.md`, and `../13-reference/action-command-index.md` with controlled HTTP/WebSocket/API server tests.
- Runtime validation of `../13-reference/url-parameter-source-trace.md` for `server`, `server2`, `server3`, `localserver`, and `label` combinations.
- Intense validation of `../07-overlays-and-pages/page-capability-matrix.md` for API target page requirements, labels, and channel pairs.
