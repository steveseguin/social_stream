---
name: control-social-stream
description: Control the Social Stream Ninja standalone Electron app through its authenticated localhost API. Use when an agent needs to launch SSApp visibly or headlessly, inspect app/source status, add or remove sources, start/stop/reload sources, or read and change supported settings.
---

# Control Social Stream

Use SSApp's declarative control API. Do not use renderer execution or UI automation when a supported command exists.

## Start SSApp

Launch a packaged app or source checkout with an explicit random token:

```text
SocialStream.exe --ssapp-headless-control --ssapp-control-port=17777 --ssapp-control-token=LONG_RANDOM_TOKEN
```

For a visible app, replace `--ssapp-headless-control` with `--ssapp-control-api`.

Keep the server bound to `127.0.0.1`. Never publish the token or place the control port behind a public proxy.

## Control workflow

1. Call `GET /api/v1/capabilities` before assuming a command exists.
2. Call `GET /api/v1/status` and identify sources by stable `id`.
3. Prefer a read command before a mutation.
4. Invoke one mutation at a time and inspect its structured result.
5. Re-read the affected source or settings after mutation.
6. Use confirmation-required bulk, reload, and shutdown operations only when the user requested them.

Use `scripts/ssapp_control.py` for reliable HTTP calls. Read [references/control-api.md](references/control-api.md) for schemas and examples.

## Safety

- Treat `removeSource`, bulk stop/restart, `reloadApp`, and `shutdownApp` as destructive or disruptive.
- Stop an active source before changing its URL, username, video ID, or connection mode.
- Never guess source IDs; list sources first.
- Do not retry a mutation blindly after a timeout. Read status to determine whether it succeeded.
- Do not request or expose sign-in cookies, API keys, filesystem paths, or arbitrary renderer execution.
