# SSApp Control API

## Connection

- Origin: `http://127.0.0.1:17777` by default.
- Authentication: `X-SSAPP-Token: TOKEN` header or `?token=TOKEN` query parameter.
- Responses use JSON and include `ok: true` with `payload`, or `ok: false` with a structured `error`.

CLI flags:

```text
--ssapp-control-api
--ssapp-headless-control
--ssapp-control-port=17777
--ssapp-control-token=LONG_RANDOM_TOKEN
```

Equivalent environment variables are `SSAPP_CONTROL_API=1`, `SSAPP_HEADLESS_CONTROL=1`, `SSAPP_CONTROL_PORT`, and `SSAPP_CONTROL_TOKEN`.

## Discovery and status

```text
GET /api/v1/capabilities
GET /api/v1/status
```

Status includes app version, session, headless/visibility state, local-media server state, and normalized sources.

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
{"action":"restartSource","value":{"sourceId":"SOURCE_ID"}}
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

## Limits

Headless means no visible Electron windows; Chromium still runs because capture sources require a browser runtime. The API binds only to loopback. It does not expose arbitrary JavaScript execution, secrets, cookies, unrestricted settings, or raw filesystem access.
