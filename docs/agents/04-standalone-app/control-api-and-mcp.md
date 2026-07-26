# Standalone App Control API And MCP Server

Status: updated 2026-07-26 from `ssapp/main.js`, `ssapp/resources/electron-control-api.js` (API version 1.1.5), `ssapp/resources/ssapp-mcp.js` (MCP 1.0.2), `ssapp/index.html` (renderer bridge), and `docs/skills/control-social-stream/`. Source-backed; endpoints verified against the ssapp e2e tests (`tests/electron/llm-control-headless-e2e.js`, `ssapp-mcp-e2e.js`).

## Purpose

Use this page for how same-machine programs — scripts, local LLM agents, and MCP clients — observe and control the standalone app. For the operational workflow, use `../../skills/control-social-stream/SKILL.md`; this page is the implementation-level reference. Remote users and Stream Deck use Social Stream's existing WebRTC/WebSocket command path, not this API. For in-app AI chat features (Ollama, chatbots), use `../09-api-and-integrations/ai-features.md` — that is a separate surface.

## Architecture At A Glance

```
MCP client (Claude etc.)
  └─ stdio JSON-RPC → ssapp/resources/ssapp-mcp.js  (adapter, no SDK)
                       └─ HTTP → 127.0.0.1:17777 control API
Local scripts ─────────────HTTP──┘
                                   └─ main.js router → electron-control-api.js
                                        └─ commands → renderer bridge
                                             (window.SSAppStreamDeckBridge.handleCommand,
                                              index.html:7452-7480)
```

## Enabling The API

- Off by default. Enable via:
  - Menu: File → "Local AI / Automation" → Enable Local Control API (persists `controlApi.enabled`, needs restart).
  - CLI: `--ssapp-control-api`.
  - Env: `SSAPP_CONTROL_API=1`.
- Port: default 17777, `--ssapp-control-port` / `SSAPP_CONTROL_PORT` (`main.js:1887-1895`). Bound to loopback only (`server.listen(port, '127.0.0.1')`, `main.js:2554`).
- `--ssapp-headless-control` is only a window mode and does not enable the API. Pass both flags when a local agent controls a headless app.

## Local Boundary

- `/api/v1/*` has no token or authentication setup. Its boundary is the fixed `127.0.0.1` listener.
- Do not document port forwarding, public proxies, or this API as cloud remote control.
- The unrelated `--remote-control` Electron test harness keeps a separate `SSAPP_REMOTE_CONTROL_TOKEN` gate for its renderer-execution endpoints.

## HTTP Endpoints

Versioned router in `resources/electron-control-api.js:211-247`:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/capabilities` | Advertised commands + versions. |
| `GET /api/v1/status` | App/source status snapshot. |
| `GET /api/v1/events` | SSE stream; resumable via `Last-Event-ID`, 15 s heartbeat, 500-event ring buffer (`:122-145`). |
| `GET /api/v1/operations/{id}` | Async operation result polling. |
| `POST /api/v1/command` | Body `{"action": "...", "value": {...}}`. |

Every response includes `apiVersion`, `ssappVersion`, `requestId` (`:95-109`). Mutations return operation IDs (`op_<uuid>`) and publish `operation.started/completed/failed` + `status.changed` events on the SSE stream (`:185-206`).

### Command actions (`electron-control-api.js:11-34`)

| Class | Actions |
| --- | --- |
| Read-only | `getCapabilities`, `getSources`, `getSource`, `getSettings`, `getOperation` |
| Mutating | `addSource`, `updateSource`, `startSource`, `stopSource`, `restartSource`, `removeSource`, `setSourceMute`, `toggleSourceMute`, `setSourceVisibility`, `toggleSourceVisibility`, `setSourceConnectionMode`, `startAllSources`, `stopAllSources`, `restartAllSources`, `updateSettings` |
| Confirm-gated (`confirm:true` required, `:170-172`) | `removeSource`, `stopAllSources`, `restartAllSources`, `reloadApp`, `shutdownApp` |

Renderer-side execution and allowlists live in `index.html`: global settings allowlist `:6936-6946` (`betaMode`, `youtubeAutoAdd`, `youtubeAutoCleanup`, `youtubeCheckInterval`, `forceTikTokClassic`, `preferTikTokLegacy`, `lastTikTokMode`), platform/mode definitions `:6957-6971`, URL building restricted to http/https `:6983-7014`. Normalized sources deliberately omit stored `url` (may contain credentials).

What the API **cannot** do: read chat messages, send chat messages, or drive overlays — no such commands exist. Chat data still flows only through the normal SSN session transport.

## Legacy Endpoints (`--remote-control` only)

Gated by `--remote-control` plus `SSAPP_REMOTE_CONTROL_TOKEN`: `/ping`, `/queue-file-selection`, `/youtube-auth`, `/twitch-auth`, `/kick-auth`, `/create-youtube-source`, `/create-kick-source`, and **`/exec` arbitrary JS execution**.

`/exec` contradicts the documented "no arbitrary JavaScript execution" guarantee — tracked as `../issues/ISSUE-005-exec-arbitrary-js-endpoint.md`. Do not claim the app never exposes JS execution without the legacy-mode caveat.

## MCP Server (`resources/ssapp-mcp.js`)

- Dependency-free stdio MCP server (newline-delimited JSON-RPC 2.0, `:177-229`); Node stdlib only. Run with `npm run mcp` (`package.json:32`) or `node resources/ssapp-mcp.js`.
- Protocol version `2025-06-18`, serverInfo `{name: 'social-stream-ninja', version: '1.0.2'}`. Capabilities: `tools` only (no resources/prompts).
- Config via `SSAPP_CONTROL_URL` when the local API uses a non-default port.
- Methods: `initialize`, `tools/list`, `tools/call`; everything else → `-32601`.
- 12 tools (`:14-53`), thin wrappers over the HTTP commands: `ssapp_get_status`, `ssapp_get_capabilities`, `ssapp_list_sources`, `ssapp_add_source`, `ssapp_update_source`, `ssapp_start_source`, `ssapp_stop_source`, `ssapp_reload_source`, `ssapp_remove_source`, `ssapp_get_settings`, `ssapp_update_settings`, `ssapp_shutdown`.
- Tools are filtered at runtime against the app's advertised capabilities (`:124-152`), and every result embeds `ssappVersion`/`apiVersion` (`:168-174`) — so an older app simply exposes fewer tools.

## Companion Skill And Tests

- `docs/skills/control-social-stream/` (this repo): SKILL.md plus the API and compatibility references.
- ssapp's e2e test runs the MCP adapter and the versioned API against a real headless Electron app.
- `ssapp/AGENTS.md:55-59` mandates the skill be updated whenever the API changes; version history lives in `docs/skills/control-social-stream/references/version-log.md`.

## Do Not Overclaim

- The control API is loopback-only and local-only; do not describe tunnelling it as the supported remote path.
- Headless mode does not enable the API. Remote headless operation uses the existing Social Stream WebRTC/WebSocket dispatcher.
- The MCP adapter is not an SDK-based server and exposes no resources/prompts — tools only.
- The settings allowlist is small by design; do not promise arbitrary settings control.
- `/exec` exists in legacy mode (ISSUE-005); the "no arbitrary JS" claim only holds for the versioned `/api/v1/*` surface.

## Follow-Up Extraction Needs

- Settings-allowlist growth per API version (currently only in version-log.md bullets).
- Whether `--remote-control` legacy endpoints are slated for removal.
