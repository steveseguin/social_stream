# Provider Cores And Shared Utilities

Status: heavy development pass started from `providers/*`, `shared/*`, and manifest web-accessible resources.

## Purpose

Use this page when changing newer provider modules, shared utilities, or source scripts that dynamically load reusable code. It explains which files are reusable cores, which are browser-facing helpers, and which manifest/resource rules matter.

## Source Anchors

- `providers/kick/core.js`
- `providers/twitch/chatClient.js`
- `providers/youtube/liveChat.js`
- `providers/youtube/contextResolver.js`
- `providers/youtube/proto/stream_list.proto`
- `shared/utils/scriptLoader.js`
- `shared/utils/html.js`
- `shared/utils/twitchEmotes.js`
- `shared/aiPrompt/overlayStore.js`
- `shared/ai/browserModelCatalog.js`
- `shared/ai/kokoroAssetCatalog.js`
- `shared/ai/localBrowserLLM.js`
- `shared/vendor/socket.io.min.js`
- `shared/vendor/tmi.js`
- `shared/vendor/tmi.module.js`
- `manifest.json`
- `docs/agents/12-development/shared-code-rules.md`

## Current Provider Files

| File | Role | Export/Interface Summary | Notes |
| --- | --- | --- | --- |
| `providers/kick/core.js` | Kick normalization helpers | Channel/token normalization, badge/image normalization, event-name mapping, profile-cache helpers, profile-detail merge helpers | Pure helper module. Keep it free of DOM, Chrome, and Electron assumptions. |
| `providers/twitch/chatClient.js` | Twitch IRC/tmi chat client core | `normalizeTwitchChannel`, `createTwitchChatClient`, `createTmiClientFactory`, `TWITCH_CHAT_EVENTS`, `TWITCH_CHAT_STATUS` | Requires an adapter/factory to provide tmi.js. Handles reconnect, normalized chat/membership/raid/notice events, and `sendMessage`. |
| `providers/youtube/liveChat.js` | YouTube live chat streaming client | `createYouTubeLiveChat`, `YOUTUBE_LIVE_CHAT_EVENTS`, `YOUTUBE_LIVE_CHAT_STATUS` | Stream mode is implemented around YouTube liveChat `messages:stream`. Poll mode currently throws a not-implemented error. Requires token, live chat ID, fetch, and AbortController support. |
| `providers/youtube/contextResolver.js` | YouTube channel/video/live-chat resolver | `createYouTubeLiveChatContextResolver`, `resolveYouTubeLiveChatContext` | Uses YouTube Data API, requires OAuth token, resolves direct chat ID, video ID, or channel to live chat context. |
| `providers/youtube/proto/stream_list.proto` | YouTube stream protobuf reference | Data schema/reference file | Treat as provider protocol support material, not a runtime browser helper by itself. |

## Current Shared Files

| File | Role | Notes |
| --- | --- | --- |
| `shared/utils/scriptLoader.js` | Script loading helper | Exports script load helpers. Browser-facing and listed as web-accessible. |
| `shared/utils/html.js` | HTML/text escaping helper | Exports safe HTML/text conversion helpers. |
| `shared/utils/twitchEmotes.js` | Twitch native emote parsing/rendering | Exports parse/stringify/render helpers for Twitch emote ranges. |
| `shared/aiPrompt/overlayStore.js` | AI prompt overlay package/local state helper | UMD-style wrapper usable in browser/global and CommonJS-like contexts. |
| `shared/ai/browserModelCatalog.js` | Local browser model metadata/helper | UMD-style wrapper. Used for browser-local model choices. |
| `shared/ai/kokoroAssetCatalog.js` | Kokoro TTS asset URL/path helper | UMD-style wrapper. Not currently listed in manifest web-accessible resources from the inspected group. |
| `shared/ai/localBrowserLLM.js` | Worker-backed local browser LLM client | UMD-style wrapper. Manages worker lifecycle, generation, status/progress callbacks, and cleanup. |
| `shared/vendor/socket.io.min.js` | Vendored Socket.IO client | Loaded locally; current manifest content-script entry is for Velora WebSocket source pages. |
| `shared/vendor/tmi.js` | Vendored tmi.js | Local Twitch IRC client dependency. |
| `shared/vendor/tmi.module.js` | Vendored tmi.js module build | Local module variant for Twitch provider/source use. |

## Manifest Web-Accessible Resources

The current manifest has two `web_accessible_resources` groups. The broad group exposes 15 resources to `<all_urls>`, including:

- `providers/kick/core.js`
- `providers/twitch/chatClient.js`
- `providers/youtube/liveChat.js`
- `providers/youtube/contextResolver.js`
- `shared/utils/scriptLoader.js`
- `shared/utils/html.js`
- `shared/utils/twitchEmotes.js`
- `shared/aiPrompt/overlayStore.js`
- `shared/vendor/socket.io.min.js`
- `shared/vendor/tmi.js`
- `shared/vendor/tmi.module.js`
- `shared/ai/browserModelCatalog.js`
- `shared/ai/localBrowserLLM.js`

Support/development note: if a content script dynamically imports or loads a provider/shared helper through the extension runtime, the file must be reachable through `web_accessible_resources`. Forgetting this can make a feature work on hosted/local pages but fail inside the packaged extension.

## Provider-Core Rules

Provider cores should remain environment-agnostic.

Do:

- Pass `fetch`, token providers, loggers, client factories, and clock/sanitize/avatar helpers as options where needed.
- Return plain data structures and normalized events.
- Keep reconnect/status/event emitters local to the provider interface.
- Keep secrets redacted in logs.
- Keep module APIs small and testable.

Avoid:

- Direct `chrome.*` calls.
- Direct Electron IPC calls.
- Direct DOM reads from a third-party platform page.
- Direct overlay/dock mutations.
- Remote executable imports.
- Hard-coded app-only or extension-only globals.

## Adapter Boundary

The expected split is:

- Provider core: normalize, connect, retry, parse provider events, and expose an interface.
- Source script or app handler: obtain credentials, load dependencies, talk to Chrome/Electron/runtime APIs, and forward normalized payloads into SSN.
- Overlay/dock/API layer: render, filter, route, and control messages after they are already normalized.

If a provider core needs a platform-specific API request, pass in `fetchImplementation` or an adapter option rather than binding to a specific runtime.

## Compatibility Notes

- Many existing browser-facing scripts still need Chrome 80-friendly syntax.
- Some provider/shared files use ESM exports and are loaded as modules from compatible contexts.
- Do not convert old content scripts or overlay pages to module syntax without checking Chrome extension, hosted, Lite, and Electron app consumers.
- Use local vendored dependencies from `shared/vendor`, `thirdparty`, or similar approved local paths. Do not add CDN executable scripts to extension code.

## Support Answer Rules

When a user asks about provider-backed behavior:

1. Identify whether they are using DOM capture, WebSocket source page, or standalone app provider/OAuth behavior.
2. Check whether a provider core is involved or whether the platform still uses a classic source script only.
3. Check whether auth/token/API setup is required.
4. Check whether the provider has implemented the requested mode. Example: current YouTube live chat provider stream mode exists, but poll mode throws not implemented in the inspected core.
5. Do not promise event coverage or send-chat support from the provider file alone; check the adapter/source handler that forwards data into SSN.

## Extraction Gaps

Needed intense passes:

- Trace exact dynamic import/load paths from source scripts into each provider/shared helper.
- Map provider-core normalized events to final SSN event payloads.
- Verify app-vs-extension loading paths for provider modules.
- Add unit or sanity test references for provider helpers where tests exist.
- Decide whether `shared/ai/kokoroAssetCatalog.js` should be added to web-accessible resources if extension contexts need it.
