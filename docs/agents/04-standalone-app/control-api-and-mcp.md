# Standalone App Control API And MCP Server

Status: deep extraction pass on 2026-07-22 from `ssapp/main.js`, `ssapp/resources/electron-control-api.js` (API version 1.1.3), `ssapp/resources/ssapp-mcp.js` (MCP 1.0.1), `ssapp/index.html` (renderer bridge), and `docs/skills/control-social-stream/`. Source-backed; endpoints verified against the ssapp e2e tests (`tests/electron/llm-control-headless-e2e.js`, `ssapp-mcp-e2e.js`).

## Purpose

Use this page for how external programs — scripts, LLM agents, MCP clients — observe and control the standalone app. For the operational how-to (token hygiene, workflows), use `../../skills/control-social-stream/SKILL.md`; this page is the implementation-level reference. For in-app AI chat features (Ollama, chatbots), use `../09-api-and-integrations/ai-features.md` — that is a separate surface.

## Architecture At A Glance

```
MCP client (Claude etc.)
  └─ stdio JSON-RPC → ssapp/resources/ssapp-mcp.js  (adapter, no SDK)
                       └─ HTTP → 127.0.0.1:17777 control API
Python/script agents ──────HTTP──┘  (X-SSAPP-Token auth)
                                   └─ main.js router → electron-control-api.js
                                        └─ commands → renderer bridge
                                             (window.SSAppStreamDeckBridge.handleCommand,
                                              index.html:7452-7480)
```

## Enabling The API

- Off by default. Enable via:
  - Menu: File → "AI / LLM Control" → Enable Control API (persists `controlApi.enabled`, needs restart) (`main.js:16883-16950`).
  - CLI: `--ssapp-control-api`, or `--ssapp-headless-control` (also hides all windows), or legacy `--remote-control`.
  - Env: `SSAPP_CONTROL_API`, `SSAPP_HEADLESS_CONTROL` (`main.js:1875-1886`).
- Port: default 17777, `--ssapp-control-port` / `SSAPP_CONTROL_PORT` (`main.js:1887-1895`). Bound to loopback only (`server.listen(port, '127.0.0.1')`, `main.js:2554`).

## Authentication And Token Lifecycle

- Every request (except `/ping`) needs the token via `X-SSAPP-Token` header or `?token=` query param (`main.js:2214-2222`), compared with `crypto.timingSafeEqual` (`main.js:1926-1930`).
- Token precedence: token file → env `SSAPP_CONTROL_TOKEN` → CLI flag → stored/generated (`main.js:1896-1921`). Auto-generated 64-hex token persisted in electron-store `controlApi.token`.
- Rotation: File → "AI / LLM Control" → Rotate Control Token (`main.js:16927-16943`). "Copy Control Connection" copies `{url, token, ssappVersion}` JSON for agent config.
- Query-param token exists for SSE `EventSource` clients; the credential-leak risk is tracked in `../issues/ISSUE-006-control-api-token-in-query-param.md`.

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

Gated at `main.js:2252`: `/ping` (always available, `:2242`), `/queue-file-selection` (`:2257`), `/youtube-auth` (`:2273`), `/twitch-auth` (`:2341`), `/kick-auth` (`:2348`), `/create-youtube-source` (`:2281-2339`), `/create-kick-source` (`:2356`), and **`/exec` arbitrary JS execution** (`:2521-2544`).

`/exec` contradicts the documented "no arbitrary JavaScript execution" guarantee — tracked as `../issues/ISSUE-005-exec-arbitrary-js-endpoint.md`. Do not claim the app never exposes JS execution without the legacy-mode caveat.

## MCP Server (`resources/ssapp-mcp.js`)

- Dependency-free stdio MCP server (newline-delimited JSON-RPC 2.0, `:177-229`); Node stdlib only. Run with `npm run mcp` (`package.json:32`) or `node resources/ssapp-mcp.js`.
- Protocol version `2025-06-18`, serverInfo `{name: 'social-stream-ninja', version: '1.0.1'}` (`:189-192`). Capabilities: `tools` only (no resources/prompts).
- Config via env: `SSAPP_CONTROL_URL`, `SSAPP_CONTROL_TOKEN` or `SSAPP_CONTROL_TOKEN_FILE` (`:86-95`).
- Methods: `initialize`, `tools/list`, `tools/call`; everything else → `-32601`.
- 12 tools (`:14-53`), thin wrappers over the HTTP commands: `ssapp_get_status`, `ssapp_get_capabilities`, `ssapp_list_sources`, `ssapp_add_source`, `ssapp_update_source`, `ssapp_start_source`, `ssapp_stop_source`, `ssapp_reload_source`, `ssapp_remove_source`, `ssapp_get_settings`, `ssapp_update_settings`, `ssapp_shutdown`.
- Tools are filtered at runtime against the app's advertised capabilities (`:124-152`), and every result embeds `ssappVersion`/`apiVersion` (`:168-174`) — so an older app simply exposes fewer tools.

## Companion Skill And Tests

- `docs/skills/control-social-stream/` (this repo): SKILL.md + `references/control-api.md` + `scripts/ssapp_control.py`. The Python script is a thin client for this exact API (`GET /api/v1/capabilities` `:51`, `GET /api/v1/status` `:53`, `POST /api/v1/command` `:61`, header `X-SSAPP-Token` `:18`).
- ssapp's own e2e test runs that exact script against a headless app (`llm-control-headless-e2e.js:251-259`) — contract parity is enforced in CI.
- `ssapp/AGENTS.md:55-59` mandates the skill be updated whenever the API changes; version history lives in `docs/skills/control-social-stream/references/version-log.md`.

## Do Not Overclaim

- The control API is loopback-only; do not describe it as remote/LAN reachable without user reconfiguration (there is no supported non-loopback bind).
- The MCP adapter is not an SDK-based server and exposes no resources/prompts — tools only.
- The settings allowlist is small by design; do not promise arbitrary settings control.
- `/exec` exists in legacy mode (ISSUE-005); the "no arbitrary JS" claim only holds for the versioned `/api/v1/*` surface.

## Follow-Up Extraction Needs

- Settings-allowlist growth per API version (currently only in version-log.md bullets).
- Whether `--remote-control` legacy endpoints are slated for removal.
