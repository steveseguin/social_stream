# Standalone App Source Windows And App Parity

Status: heavy extraction pass from `ssapp/main.js`, `ssapp/preload.js`, `ssapp/state.js`, and current agent docs on 2026-06-24. This is usable for support routing and architecture orientation, but not a replacement for in-app/e2e testing.

## Purpose

Document how standalone app source windows behave, why they can differ from the Chrome extension, and what agents should check before saying a source is "broken in the app."

For Social Stream feature behavior, use `<social_stream repo>` as source of truth. For Electron shell behavior, source windows, app auth, local source loading, and state repair, use `<ssapp repo>`.

## Source Anchors

- `ssapp/main.js`
- `ssapp/preload.js`
- `ssapp/state.js`
- `ssapp/renderer.js`
- `ssapp/resources/electron-*-handler.js`
- `ssapp/tiktok/connection-manager.js`
- `ssapp/tiktok-signing/electron-signer.js`
- `docs/agents/04-standalone-app-architecture.md`
- `docs/agents/10-troubleshooting/desktop-app-issues.md`
- `docs/agents/10-troubleshooting/auth-and-sign-in.md`
- `docs/agents/08-platform-sources/platform-capability-matrix.md`
- `docs/agents/08-platform-sources/tiktok-standalone-app.md`

Do not use `ssapp/resources/social_stream_fallback` as source documentation material during normal app work. It is a disposable fallback mirror.

## Mental Model

The app has two related but different concepts:

| Concept | Where It Lives | What It Means |
| --- | --- | --- |
| Source state | `ssapp/state.js` localStorage state, `sources` map, group state, session bindings | The user's saved source entry, target, URL, username, mode, visibility, mute, auto-activate, custom session, and platform flags. |
| Source window | `ssapp/main.js` Electron `BrowserWindow` stored in `browserViews` | The actual running Electron window that loads a platform page or SSN source page and injects Social Stream source code. |
| Preload bridge | `ssapp/preload.js` as `window.ninjafy` | App-side substitute for Chrome extension APIs. It forwards messages, exposes auth helpers, and provides app-specific APIs. |
| Shared source script | `social_stream/sources/*` or `social_stream/sources/websocket/*` | The capture code used by both the extension and the app when compatible. |

Support implication: editing a saved source entry is not the same as proving the running source window reloaded and is using the expected source script/session.

## Source State Lifecycle

`state.js` stores app state under `socialStreamState` and reconstructs maps for sources and groups at startup.

Important source fields:

| Field | Meaning | Support Note |
| --- | --- | --- |
| `target` | Platform/source key such as `youtube`, `twitch`, `kick`, `tiktok` | Used for source ID generation, WebSocket support checks, default sessions, and platform routing. |
| `url` | Source page or platform page URL | URL changes can change source ID/session-binding keys. |
| `username`, `channelId`, `videoId` | Platform-specific identity fields | Used in source IDs and remembered session keys. |
| `connectionMode` | Source mode, with TikTok-specific defaults | TikTok defaults can be affected by global classic/legacy settings. |
| `activeConnectionMode` | Runtime mode currently active when known | Useful for TikTok/WebSocket fallback debugging. |
| `isVisible` | Whether the source window should be visible | Hidden windows can still exist and run. Visibility is not the same as capture health. |
| `isMuted` | Source-window audio mute state | Useful for app source pages that play audio or previews. |
| `autoActivate` | Whether the source should be activated automatically | Recurring reopen complaints should check this first. |
| `replyOnly` | App injection mode that drops normal capture forwarding but allows status/reply paths | Useful for send-only or response workflows. |
| `supportsWSS` | Whether app believes the target has WebSocket/source-page support | Derived from known targets and Social Stream manifest inspection. |
| `customSession` | App session partition choice | Controls which Electron cookie/storage partition is used for the source window. |
| `accountRole` | Normalized app role metadata | Forwarded into some app-side platform payload metadata. |

Add/update/remove source behavior:

- `addSource` generates a source ID from video ID, username, URL, or fallback random suffix.
- Duplicate IDs are kept by appending `-dup-N`.
- App source entries default to visible unless `isVisible` is explicitly false.
- TikTok source defaults use app-level classic/legacy preference fields.
- `updateSource` merges updates into the saved source and refreshes remembered session bindings if custom session or identity keys changed.
- Removing a source also removes it from its group list.

## Session Binding

The app can remember a non-default custom session for a source.

Session binding keys can include:

- target plus group ID
- target plus username
- target plus channel ID
- target plus video ID
- target plus normalized URL
- target plus explicit `sessionBindingKey`

Default, blank, and `AUTO` style sessions are not remembered as durable custom session bindings. If a user says a source keeps opening in the "wrong account," check the source identity fields, custom session value, group moves, and whether the custom session is a meaningful non-default value.

## Source Window Creation

`main.js` creates Electron `BrowserWindow` instances for app source windows.

Confirmed behavior:

- If a `sourceId` already has a live window, the app returns the existing window ID instead of creating a duplicate.
- If a `tab` is passed, the existing window can be updated and reloaded with the new URL.
- The app chooses an Electron session partition before loading the URL.
- Custom sessions become `persist:custom-...` partitions, with compatibility handling for older `default` names.
- Without a custom session, the partition is platform based, such as `persist:twitch` or another resolved platform key.
- Source windows are created hidden first to avoid focus stealing.
- Visible source windows use `showInactive`.
- Hidden source windows are parked with app-specific stealth-hide handling and skip taskbar behavior.
- Source windows have `backgroundThrottling: false`.
- App source windows track remembered bounds separately for classic and WebSocket/source-page modes.
- Some activated classic windows can auto-close on unexpected navigation when `closeOnNavigate` config is set.

Support implication: a source can be "active" in app state while the window is hidden, parked, using a custom session partition, or reusing an older live window for the same source ID.

## Preload And `window.ninjafy`

`preload.js` exposes `window.ninjafy` through Electron `contextBridge` when context isolation is enabled, and directly assigns it when context isolation is disabled.

Important bridge areas:

| Area | App Behavior |
| --- | --- |
| Message forwarding | `ninjafy.sendMessage` adds an app auth token and sends through Electron IPC. |
| Legacy postMessage | Preload still accepts specific legacy message shapes such as `message`, `delete`, `getSettings`, `cmd`, and WSS status. |
| Background commands | `type: "toBackground"` requests can be routed to `ssapp:background-command`. |
| Settings | Injected scripts can request cached settings through mocked `chrome.runtime.sendMessage({ getSettings: true })`. |
| Source window config | Source pages can call `getSourceWindowConfig`. |
| OAuth | YouTube, Twitch, Facebook, Velora, Kick, and VPZone helpers call app IPC handlers. |
| Kick WebSocket | App exposes start/stop/status/event methods for Kick bridge behavior. |
| Rumble/no-CORS | App exposes no-CORS and Rumble fetch helpers where needed. |
| TTS/files/media | App exposes TTS, file, save dialog, stream, and media upload helpers. |

Support implication: source scripts often run through an app shim that mocks enough Chrome runtime behavior to work, but not every browser-extension API is identical in Electron.

## Source Script Injection

The app can inject Social Stream source scripts from local files or remote/cached/bundled sources.

Local source path behavior:

- `--filesource` or a saved `localSourcePath` can point at a Social Stream source root.
- A valid root must contain `manifest.json`, `background.html`, `popup.html`, and `sources/twitch.js`.
- Local source paths can be normal file paths or file URLs.
- If local source files are missing, the app clears the saved local source path and retries with online/packaged scripts.

Remote/cache/fallback behavior:

- When local injection is not used, selected source files are loaded from the configured Social Stream branch or URL.
- If remote fetch is unavailable, the app may use cache or bundled fallback and queue a warning toast.
- Fallback use is a runtime recovery path, not the source of truth for documentation or edits.

Injection compatibility behavior:

- The app creates a `chrome.runtime` mock for injected source scripts.
- `chrome.runtime.sendMessage` is redirected to `window.ninjafy.sendMessage` where available.
- `chrome.runtime.onMessage.addListener` is connected through app send-to-tab handling.
- Reply-only mode drops normal non-status messages at the injection shim level.
- YouTube WebSocket/source-page status hooks are patched in app injection when upstream does not provide enough status.

Support implication: if a source behaves differently in app classic mode, check whether it is local-source injection, remote-source injection, cache/fallback injection, or source-page/WebSocket mode.

## App Vs Extension Parity Matrix

| Area | Chrome Extension | Standalone App | Support Risk |
| --- | --- | --- | --- |
| Browser session/cookies | User's normal Chrome/Chromium profile | Electron partition per platform/custom session | Login state can differ. |
| Source code location | Packaged extension files | Remote, local, cached, or bundled source injection | App may be running different source code than expected. |
| Runtime APIs | Real `chrome.*` extension APIs | `window.ninjafy` plus Chrome runtime mock | Some APIs may be missing or shimmed. |
| Settings storage | `chrome.storage.sync/local` plus page storage | App localStorage state, cached state, electron-store, backups | Settings can look different or be repaired/mirrored. |
| Window behavior | Browser tabs/popouts | Electron windows with hidden/visible/parked states | Hidden source windows can confuse users. |
| Throttling | Browser may throttle hidden/minimized tabs | App disables background throttling for source windows | App can help, but not for platform/API/login failures. |
| OAuth/sign-in | Normal browser or extension flow | Loopback handlers and Electron/default-browser flows | Port conflicts and embedded-browser blocking are app-specific. |
| WebSocket/API source pages | Extension page/context | Electron source page with preload bridge | Status and auth helpers can differ. |
| TikTok | DOM source in browser; app has extra connector modes | App connector/signing/legacy/WebSocket paths; route details through `08-platform-sources/tiktok-standalone-app.md` | Always ask app mode, signing provider, live/account state, and whether replies are expected. |
| Kick | Browser DOM or source page | App OAuth/helper plus Kick WebSocket client paths | CAPTCHA/scopes/token state can differ. |

## First Support Questions

Ask or infer these before debugging an app source issue:

- Which app version and OS?
- Is this the standalone app or the Chrome extension?
- Which source target and exact source mode: classic/DOM, WebSocket/API, TikTok connector, or custom?
- Is the source window visible, hidden, auto-activated, muted, or reply-only?
- Is the source using a custom session?
- Does the same platform source work in Chrome extension mode?
- Is `--filesource`, saved local source, ZIP import, beta branch, or prefer-local-assets involved?
- Did the app show a cache/fallback/local source warning?
- For auth: which loopback port/error and which external browser/profile opened?
- For TikTok/Kick/YouTube/Twitch: which app-side OAuth/connector path is active?

## Common App-Parity Answers

### "It works in Chrome but not in the app."

Use:

```text
The app uses Electron source windows and app-specific bridge code, not the exact same browser profile as Chrome. Check the app source mode, Electron session/custom session, OAuth/login path, and whether local/remote source injection is using the expected Social Stream source files.
```

### "The source keeps reopening."

Use:

```text
Check whether the source or group has auto-activate enabled, whether a saved source entry is being restored, and whether the app is reusing a live source window for the same source ID. If the source list is stale, try Clear All Sources before doing a full reset.
```

### "The app is using the wrong version of Social Stream."

Use:

```text
Check `--filesource`, saved local source path, ZIP import, beta/stable branch, prefer-local-assets, and any cache/fallback warning. Source edits belong in `<social_stream repo>`, not the app fallback mirror.
```

### "Login works in browser but not app."

Use:

```text
The app may use an Electron partition, loopback OAuth handler, or default browser callback. Check platform, custom session, port conflicts, blocked embedded browser/CAPTCHA behavior, and whether the Chrome extension works as a control test.
```

## Do Not Overclaim

Avoid saying:

- The app and extension behave identically.
- A logged-in Chrome profile means the app source window is logged in.
- Local source edits in `ssapp/resources/social_stream_fallback` are the right fix.
- Hidden app windows cannot be the cause of capture symptoms.
- App testing is complete without running the actual Electron workflow.

## Follow-Up Extraction Needs

- Intense source-window lifecycle trace from renderer UI events through `state.js` and `main.js` window creation.
- Exact source setup UI labels and mode names from `ssapp/renderer.js`.
- Line-level app parity table by high-volume platform: YouTube, Twitch, Kick, Rumble, Facebook, Instagram, Discord. TikTok has a dedicated app connector page, but still needs real Electron runtime validation.
- Real in-app/e2e validation for hidden window, auto-activate, source reload, custom sessions, and local/remote source fallback.
