# Message Flow And Event Contracts

Status: backbone extraction pass. Usable for orientation, not final-grade.

## Purpose

This page is the agent-facing source for how messages move through SSN and what payload shapes downstream pages should expect.

## Source Anchors

- `social_stream/docs/event-reference.html`
- `social_stream/about.md`
- `social_stream/api.md`
- `social_stream/background.js`
- `social_stream/dock.html`
- `social_stream/featured.html`
- `social_stream/sources/*.js`
- `ssapp/preload.js`
- `ssapp/main.js`

## Product Flow

The high-level flow confirmed from `about.md`:

1. A platform source captures chat, events, or source state.
2. The source sends normalized data to the extension/app background process.
3. The background process applies settings, routing, filtering, and integrations.
4. Data is distributed through P2P, hosted WebSocket servers, local WebSocket server mode, HTTP/API paths, or direct app/extension messaging.
5. Dock/dashboard views receive messages and can send moderation/control actions back.
6. Overlay pages such as featured chat, alerts, waitlists, polls, games, and custom overlays consume the same session-routed data.
7. External apps can use API/WebSocket/HTTP/SSE paths depending on feature and settings.

Session ID is the main routing key. Password is optional but can affect access/control paths.

## Extension Message Flow

Typical extension path:

1. A content/source script runs in a platform page and extracts data.
2. The script sends a runtime message.
3. `service_worker.js` checks whether the extension is enabled and whether `background.html` is ready.
4. If needed, the service worker creates or reuses a pinned inactive `background.html` tab.
5. Messages are queued while the background page is loading.
6. `background.js` receives the message, applies settings, and distributes it to docks, overlays, sockets, or API clients.

Important distinction: `service_worker.js` is intentionally a lightweight router/recovery layer because MV3 workers are temporary. Long-lived behavior belongs in `background.js`.

## Standalone App Message Flow

Typical standalone app path:

1. A Social Stream source page or source window calls `window.ninjafy`.
2. `preload.js` authenticates/normalizes the call and sends it through Electron IPC.
3. `main.js` handles app-side routing, platform helpers, auth, and window messaging.
4. Renderer/app state in `state.js` tracks source windows, groups, sessions, and source-specific settings.
5. Social Stream background/dock/overlay logic receives data through app bridge paths that imitate extension behavior where possible.

Support implication: "works in extension but not app" often means the failure is in Electron login context, preload bridge behavior, IPC, app state, or app-specific platform handling rather than the shared overlay/dock code.

## Dock, Overlay, And API Distribution

`background.js` has multiple output paths. Confirmed from the first pass:

- Dock/server fallback socket:
  - Local mode: `ws://127.0.0.1:3000`
  - Hosted mode: `wss://io.socialstream.ninja/dock`
  - Join shape: `{ join: streamID, out: 4, in: 3 }`
- API socket:
  - Local mode: `ws://127.0.0.1:3000`
  - Hosted mode: `wss://io.socialstream.ninja/api`
  - Join shape: `{ join: streamID, out: 2, in: 1 }`
- P2P/ninjaBridge path:
  - Sends `overlayNinja` payloads to known receiver labels such as `dock`, `aioverlay`, `cohost`, and `tipjar`.
  - Can broadcast when no specific receiver is available.
- VDO iframe fallback:
  - Uses `postMessage` with a `sendData` wrapper when needed.

These transport details should be documented separately from payload shape. The same event payload may travel through different transports depending on settings and connection state.

## Event Contract

`docs/event-reference.html` is the canonical event vocabulary. The current rule for future docs should be:

- Put standard event fields in the event reference.
- Put experimental, feature-specific, or integration-specific details under `meta` unless they are promoted to stable top-level fields.
- Treat platform-specific events as source-dependent unless the event reference says they are normalized.
- Note whether a feature requires WebSocket mode, DOM/source capture mode, or either.

Confirmed event-reference guidance:

- Stream events can be hidden with `&hideevents`, `&hideallevents`, or filtered with `&filterevents=...`.
- Most YouTube, Twitch, and Kick stream events require WebSocket mode.
- DOM mode is mostly chat/viewer/limited system events, with gift/donation behavior varying by source.
- `meta.messageId` is used for source-control delete synchronization.
- Event Flow can mark `meta.featured = true`.
- AI/cohost overlay commands use action payloads such as `{ action: "aiOverlay", target, meta }` or `{ action: "cohostOverlay", target, meta }`.

## Inbound Control Actions

The first pass found `background.js` handling inbound actions from the API/dock paths, including:

- `sendChat`
- `sendEncodedChat`
- `blockUser`
- `eventFlowEvent`
- `extContent`
- lightweight status/request actions such as `getHype`

These need an intense pass before being documented as stable public API. For now, treat them as confirmed code paths, not fully specified contracts.

## Compatibility Rules For Custom Overlays

Until a field-level pass is complete, custom overlay docs should follow these rules:

- Consume documented fields from `docs/event-reference.html`.
- Read optional behavior from `meta` defensively.
- Do not assume every platform sends every event type.
- Do not assume the transport path. A payload may arrive through P2P, hosted WebSocket, local WebSocket, iframe messaging, or app bridge.
- Use session ID routing consistently and document password requirements where a control path needs them.

## Extraction Notes

Deeper passes should build:

- Field-by-field chat payload contract.
- Event-type table for YouTube, TikTok, Twitch, Kick, Facebook, Instagram, Rumble, Discord, and generic/custom sources.
- API inbound command table with source references.
- Deletion/moderation/featured-message lifecycle.
- OBS/browser-source examples that show the same message through dock and featured overlay.
