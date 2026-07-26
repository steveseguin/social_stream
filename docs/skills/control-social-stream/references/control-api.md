# SSApp Control API

## Connection

- Origin: `http://127.0.0.1:17777` by default.
- Authentication: none. Loopback binding limits the interface to programs on the same machine.
- Responses use JSON and include `ok: true` with `payload`, or `ok: false` with a structured `error`.
- Responses include `ssappVersion`, `apiVersion`, and `requestId`. Use capabilities, not a guessed version comparison, to decide which commands are available.

CLI flags:

```text
--ssapp-control-api
--ssapp-headless-control
--ssapp-control-port=17777
```

Equivalent environment variables are `SSAPP_CONTROL_API=1`, `SSAPP_HEADLESS_CONTROL=1`, and
`SSAPP_CONTROL_PORT`. `--ssapp-headless-control` only hides app windows; it does not enable
the API. Pass both mode flags when a local agent needs to control a headless instance.

## Discovery and status

```text
GET /api/v1/capabilities
GET /api/v1/status
GET /api/v1/events
GET /api/v1/operations/OPERATION_ID
```

Status includes app version, session, headless/visibility state, local-media server state, and normalized sources. `app.mainWindowVisible` reports the actual show/hide state; SSApp 0.4.7 and newer track it explicitly so a window hidden to the tray is not incorrectly reported as visible on Linux. As of API 1.1.3, normalized sources deliberately omit the stored `url` because it may contain credentials; use the numeric `tabId` to address an active source window.

The events endpoint is a Server-Sent Events stream. It emits bounded, resumable status and operation events and accepts the standard `Last-Event-ID` header. Mutation responses include an operation ID that can be inspected independently.

## Commands

Send commands to `POST /api/v1/command`:

```json
{"action":"getSources","value":{}}
```

Supported source actions:

- `getSources`, `getSource`
- `addSource`, `removeSource`, `updateSource`
- `startSource`, `stopSource`, `restartSource`
- `startAllSources`, `stopAllSources`, `restartAllSources`
- `setSourceMute`, `toggleSourceMute`
- `setSourceVisibility`, `toggleSourceVisibility`
- `setSourceConnectionMode`

Supported settings actions:

- `getSettings`
- `updateSettings`

Controllable settings are returned by `getCapabilities`. The initial set is `betaMode`, `youtubeAutoAdd`, `youtubeAutoCleanup`, `youtubeCheckInterval`, `forceTikTokClassic`, `preferTikTokLegacy`, and `lastTikTokMode`.

Connection-mode changes are validated against the source platform's advertised `connectionModes`; a globally known mode is not necessarily valid for every platform.

As of API 1.1.4 (SSApp 0.4.6), `updateSource` rejects URL, username, video ID, connection mode, visibility, mute state, reply-only state, account role, and custom-session changes while a source has live connection handles. Stop the source first, or use `setSourceMute` and `setSourceVisibility` for those two supported live changes. `autoActivate` can still be changed while a source is active because it applies to future app starts.

App actions `reloadApp` and `shutdownApp` require `{"confirm":true}`.

## Examples

Add an inactive Twitch source:

```json
{
  "action": "addSource",
  "value": {
    "target": "twitch",
    "username": "channel_name",
    "autoActivate": false
  }
}
```

Start, reload, or stop one source:

```json
{"action":"startSource","value":{"sourceId":"SOURCE_ID"}}
{"action":"restartSource","value":{"sourceId":"SOURCE_ID","confirm":true}}
{"action":"stopSource","value":{"sourceId":"SOURCE_ID"}}
```

Update an inactive source:

```json
{
  "action": "updateSource",
  "value": {
    "sourceId": "SOURCE_ID",
    "updates": {"username":"new_name","connectionMode":"websocket"}
  }
}
```

Reload all active sources:

```json
{"action":"restartAllSources","value":{"activeOnly":true,"confirm":true}}
```

Change a setting:

```json
{"action":"updateSettings","value":{"settings":{"youtubeAutoCleanup":true}}}
```

Gracefully stop a headless app:

```json
{"action":"shutdownApp","value":{"confirm":true}}
```

## MCP

SSApp 0.4.7 and newer let the downloaded application run its dependency-free stdio MCP
adapter with `--ssapp-mcp`. Enable **File > Local AI / Automation**, restart, then choose
**Copy MCP Setup** to copy the exact executable path, platform arguments, and
`SSAPP_CONTROL_URL` into the local agent's MCP configuration. A source checkout and separate
Node installation are not required.

The adapter discovers capabilities at runtime, filters unavailable tools, and includes
`ssappVersion` and `apiVersion` in every tool result. Linux configurations add
`--ozone-platform=headless` so the lightweight adapter process does not need a second X
display; the main capture application still needs a desktop session or Xvfb.

Call `ssapp_get_capabilities` first. Do not assume a tool described by a newer skill revision is present in an older running app.

## Limits

Headless means no visible Electron windows; Chromium still runs because capture sources require a browser runtime. The API binds only to loopback and is intended for same-machine agents, not remote cloud control. It does not expose arbitrary JavaScript execution, secrets, cookies, unrestricted settings, or raw filesystem access. Remote operators use Social Stream's existing WebRTC or WebSocket control path.
