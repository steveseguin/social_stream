---
name: control-social-stream
description: Control the Social Stream Ninja standalone Electron app through its opt-in localhost API. Use when a local agent needs to inspect app/source status, add or remove sources, start/stop/reload sources, or read and change supported settings.
---

# Control Social Stream

Use SSApp's declarative control API. Do not use renderer execution or UI automation when a supported command exists.

## Start SSApp

Prefer enabling **Local AI / Automation** from SSApp's File menu. The API listens only on
`127.0.0.1` and does not require a token.

For SSApp 0.4.7 and newer, choose **Copy MCP Setup** from the same menu after restart. Use
that configuration when MCP tools are not already connected. It launches the downloaded app
with `--ssapp-mcp`; do not require Node, Python, or a source checkout.

MCP 1.0.5 in SSApp 0.4.11 and newer advertises its complete stable tool set even when the
main app is offline during MCP startup. The tools become usable after SSApp starts because
each version-gated call re-checks live capabilities. With older adapters, start SSApp before
the MCP client or reconnect the MCP server after SSApp starts.

Headless mode is separate. To hide windows and also allow a local agent, pass both
`--ssapp-headless-control` and `--ssapp-control-api`. Headless mode alone does not open the
API. Environment variables are also supported.

Do not use this localhost API as a cloud remote-control interface. Remote users and Stream
Deck use Social Stream's existing WebRTC or WebSocket transport instead.

## Control workflow

1. Call `ssapp_get_capabilities`, or `GET /api/v1/capabilities` when using HTTP directly, before assuming a command exists. Record `ssappVersion` and `apiVersion`.
2. Call `ssapp_get_status`, or `GET /api/v1/status` over HTTP, and identify sources by stable `id`.
3. Prefer a read command before a mutation.
4. Invoke one mutation at a time and inspect its structured result.
5. Re-read the affected source or settings after mutation.
6. Use confirmation-required bulk, reload, and shutdown operations only when the user requested them.

Prefer SSApp's MCP tools when the agent supports MCP. Otherwise call the loopback HTTP
endpoints directly using [references/control-api.md](references/control-api.md). Read
[references/version-log.md](references/version-log.md) for minimum-version compatibility.
Runtime capabilities are authoritative.

## Safety

- Treat `removeSource`, bulk stop/restart, `reloadApp`, and `shutdownApp` as destructive or disruptive.
- Stop an active source before using `updateSource` to change its URL, username, video ID, connection mode, visibility, mute state, reply-only state, account role, or custom session. Use `setSourceMute` and `setSourceVisibility` for live mute and visibility changes.
- Never guess source IDs; list sources first.
- Do not retry a mutation blindly after a timeout. Read status to determine whether it succeeded.
- Do not request or expose sign-in cookies, API keys, filesystem paths, or arbitrary renderer execution.
