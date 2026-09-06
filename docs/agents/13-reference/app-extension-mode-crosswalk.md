# App Extension Mode Crosswalk

Status: heavy support-routing crosswalk pass on 2026-06-24. This is source-backed orientation from current agent docs and app notes, but not a substitute for real Electron/browser/OBS validation.

## Purpose

Use this page when a user asks:

- Should I use the Chrome extension or the standalone app?
- Why does a source work in Chrome but not in the app?
- Does the desktop app fix browser throttling?
- Does the app use the same login/cookies as Chrome?
- Should I use hosted pages, local pages, Lite, Firefox, WebSocket/API source pages, or a custom source?
- Is this an app issue, extension issue, platform issue, source-mode issue, or overlay/session issue?

This page is a crosswalk. For deeper details, use:

- `modes-and-capability-matrix.md`
- `workflow-setup-decision-tree.md`
- `install-update-version-guide.md`
- `../04-standalone-app-source-windows.md`
- `../10-troubleshooting/desktop-app-issues.md`
- `../10-troubleshooting/auth-and-sign-in.md`
- `../08-platform-sources/platform-capability-matrix.md`
- `../08-platform-sources/tiktok-standalone-app.md`

## Short Answer Rules

| User Asks | Safe First Answer | Then Check |
| --- | --- | --- |
| Should I use the extension or app? | Use the extension for normal browser/cookie workflows. Use the app for managed source windows, source organization, and some hidden-window/throttling workflows. | Exact platform, source mode, login/auth need, and app version. |
| Does the app fix all source issues? | No. The app can help with browser window management and throttling, but it can still hit embedded login, OAuth, platform, source-mode, or bridge limits. | App source-window state and platform doc. |
| Is the app the same as Chrome? | No. The app uses Electron sessions, app source windows, and a preload bridge; Chrome uses the browser profile and real extension APIs. | `../04-standalone-app-source-windows.md`. |
| Does Chrome login mean the app is logged in? | No. App source windows use Electron partitions or custom sessions, not the user's normal Chrome profile. | App custom session and platform login path. |
| Does a listed site work in both app and extension? | Not automatically. A public site card gives a setup route, not proof of app parity or every event family. | `../08-platform-sources/public-site-support-status.md` and platform doc. |
| Should I use Lite? | Use Lite only for lightweight/simple workflows. It is not full extension or app parity. | `../02-installation-and-surfaces.md`. |
| Should I use Firefox? | Firefox can work for some flows, but Chromium-only capture/debugger/model/TTS paths can be limited. Reproduce in Chrome when diagnosing those features. | `modes-and-capability-matrix.md`. |
| Should I use hosted pages or local pages? | Hosted pages are best for normal users and OBS. Local/forked pages are for custom code, local `custom.js`, and development. | `customization-path-decision-matrix.md`. |

## Surface Crosswalk

| Surface | Best For | Strong Points | Main Risks | First Proof Check |
| --- | --- | --- | --- | --- |
| Chrome/Chromium extension | Normal source capture from a user's browser session | Uses existing browser cookies/profile; canonical extension workflow; broadest normal capture path | Hidden/minimized tabs can throttle; unpacked installs need manual updates; MV3/store lag can matter | Extension icon enabled, source page reloaded, dock receives messages |
| Manual unpacked extension | Latest source and development | Fastest access to GitHub changes; easy source inspection | User can move/delete folder; updates are manual; uninstall can delete settings | Install path, reload extension, backup/export settings before risky changes |
| Chrome Web Store extension | Low-friction install | Simple install and browser-managed update | Review lag; may not have newest fix; MV3 limitations | Version and install source |
| Firefox XPI | Firefox users | Avoids Chromium requirement for basic paths | Missing Chromium-only debugger/tab capture and some model/TTS paths | Reproduce in Chrome for Chromium-only issues |
| Standalone desktop app | Managed source windows and app-hosted workflows | Source windows can disable background throttling; app can manage sessions/windows/backups; no extension install | Electron login/cookies differ; source injection can be local/remote/cache/fallback; app bridge differs from real extension APIs | App version, source mode, custom session, source-window state |
| Hosted SSN pages | Normal dock/overlay/tool pages, especially OBS | Current hosted pages, easy URLs, no local file maintenance | Cannot load arbitrary local disk JS; depends on same session/channel and network access | Open same URL in normal browser before OBS |
| Local/forked pages | Custom overlays, local code, development | Can load local custom files and forked behavior | Manual updates; local-file and OBS quirks; easy to drift from hosted source | Browser console, file path, target page support |
| Lite web app | Quick/light/mobile workflows | Low setup | Limited features, sources, and customization | Confirm user is explicitly using Lite |
| WebSocket/API source pages | API/socket-backed platform capture where supported | Can expose richer events or more reliable background connection | Auth/scopes/token/room/reconnect differ by source; usually not OBS overlay pages | Source page connected and target platform mode documented |
| External API/custom source | Bots, private apps, unsupported data sources | User controls payload and integration logic | User owns reconnection, field quality, security, and maintenance | Payload shape, channel/session, dock/API receive path |

## Extension Vs App Decision Matrix

| Situation | Prefer Extension | Prefer App | Caveat |
| --- | --- | --- | --- |
| User is already logged into the platform in Chrome | Yes | Only if app also signs in or source mode avoids embedded login | App does not inherit Chrome cookies. |
| Platform blocks embedded browsers or uses CAPTCHA aggressively | Usually yes | Maybe, if app has platform-specific helper/OAuth path | Do not promise app bypasses platform restrictions. |
| Chat stops when source tab is hidden/minimized | Maybe, if source can stay visible | Often worth trying | App helps source-window throttling, not platform/API failures. |
| User wants one desktop tool to manage source windows | Maybe | Yes | Still test capture in dock before OBS. |
| User needs latest repo changes | Manual unpacked extension or local pages | App with validated local source path only if app flow is needed | Source edits belong in `social_stream`. |
| User needs custom local JS or custom overlay files | Local/forked pages | App only if app hosting/source windows are part of the workflow | Hosted pages cannot load arbitrary local disk JS. |
| User needs OBS overlay output | Extension or app source plus hosted overlay | Extension or app source plus hosted overlay | OBS page choice is separate from source surface. |
| User needs richer platform events | WebSocket/API source mode where supported | App only if that source page/app bridge supports it | DOM capture and API/source-page mode expose different event families. |
| User needs send-chat/send-back | Depends on platform/mode/auth | Depends on platform/mode/auth | Capture support does not prove send-back support. |
| User needs full app profile backup/transfer | No | Yes | Do not use full session transfer for simple settings export unless needed. |

## Common Confusion Points

### Source Side Vs Output Side

The extension/app/source page captures or feeds messages. The dock, overlays, themes, games, API listener, and OBS browser sources receive messages.

Do not diagnose OBS before proving the dock receives messages on the same session.

### App Source Window Vs Saved Source Entry

The app can have a saved source entry without proving the running Electron source window is loaded, visible, signed in, connected, and using the expected source script.

Ask for:

- app version and OS,
- source target,
- source mode,
- visible/hidden state,
- custom session,
- local/remote/fallback source warnings.

### Browser Login Vs App Login

Chrome extension capture runs inside the user's browser profile. The app uses Electron partitions and custom sessions. A user can be signed into Chrome and not signed into the app.

### Hosted Page Vs Local Page

Hosted `socialstream.ninja` pages are the normal answer for OBS and simple support. Local pages are for development, forks, and custom local JS.

### Lite Vs Full SSN

Lite is not a full replacement for the extension or app. If a user asks about source support, custom overlays, API behavior, or app parity, confirm they are not using Lite before answering.

## Troubleshooting Crosswalk

| Symptom | First Route | What Not To Assume |
| --- | --- | --- |
| Works in Chrome extension but not app | `../04-standalone-app-source-windows.md`, `../10-troubleshooting/desktop-app-issues.md` | Do not assume app and Chrome share login/cookies or runtime APIs. |
| Works in app but not OBS | `../10-troubleshooting/obs-overlay-display.md`, `surface-url-cheatsheet.md` | Do not assume source capture is broken if dock works. |
| App login fails | `../10-troubleshooting/auth-and-sign-in.md` | Do not assume app can bypass platform embedded-browser limits. |
| Chat stops when hidden | `modes-and-capability-matrix.md` | Do not promise app fixes every platform or API mode. |
| API command works in sample but target page does nothing | `api-command-validation-matrix.md` | Relay success does not prove target action. |
| URL option works on dock but not theme/game/source page | `url-parameter-source-trace.md` | Generated URL option support is not universal. |
| A public site card exists but app capture fails | `../08-platform-sources/public-site-support-status.md`, platform doc | Public listing does not prove app parity. |
| User wants "a plugin" | `customization-path-decision-matrix.md` | There is no single official plugin ZIP/marketplace flow. |

## Recommended Answer Shapes

### "Should I use app or extension?"

```text
Use the extension first when the site works in your normal browser session. Use the app when you want managed source windows or need to reduce browser-tab throttling. The app is not identical to Chrome: it uses Electron sessions and app bridge code, so login and source behavior can differ by platform.
```

### "The app should fix this, right?"

```text
The app can help with window management and some throttling problems, but it does not bypass platform login, CAPTCHA, API, or embedded-browser restrictions. First confirm the source works in the dock, then compare extension mode and app mode for the same platform.
```

### "Why does Chrome work but the app does not?"

```text
Chrome and the app do not share the same runtime. Chrome uses your browser profile and extension APIs. The app uses Electron source windows, app session partitions, and a preload bridge. Check app version, source mode, custom session, and whether the app is using local, remote, cached, or fallback Social Stream source files.
```

### "Should I use hosted or local pages?"

```text
Use hosted pages for normal OBS and dock workflows. Use local or forked pages only when you need custom local code, a fork, or development testing. Hosted pages cannot load arbitrary local disk JavaScript.
```

## Safe Follow-Up Questions

Ask only what matters:

- Are you using the Chrome extension, standalone app, Lite, hosted page, local page, or API/source page?
- What platform and exact source mode are you using?
- Does the dock receive messages before OBS is involved?
- Does the same source work in Chrome extension mode?
- If using the app, what app version, OS, source mode, and custom session?
- If using OBS, does the same overlay URL work in a normal browser?
- If using API/WebSocket, which channel/session and target page/label?
- If using custom code, is it hosted, local, forked, custom overlay, `custom.js`, Event Flow, API app, or source file work?

## Do Not Say

- "The app and extension are identical."
- "The app fixes all login problems."
- "A Chrome login means the app is logged in."
- "A supported site card proves app support."
- "OBS blank means source capture is broken."
- "Lite supports the same features."
- "Hosted pages can load any local JavaScript file."
- "Capture support means send-chat support."
- "Source review means app behavior was tested."

## Evidence Status

This crosswalk is answer-ready and source-backed from current agent docs. It is not runtime-tested.

Before making stronger claims:

- Use `../16-runtime-validation-playbooks.md`.
- Record actual app/browser/OBS/API evidence in `../17-runtime-validation-evidence-log.md`.
- Use `../18-focused-validation-evidence-log.md` only for deterministic focused checks, not app/runtime proof.

## Follow-Up Needs

- Real Electron e2e validation for app source windows, hidden windows, custom sessions, local/remote/fallback source loading, and app auth flows.
- Browser-vs-app comparison checks for YouTube, Twitch, Kick, Rumble, Facebook, Instagram, Discord, and TikTok app connector paths.
- OBS validation for hosted vs local pages after app and extension source capture are proven.
- Per-platform app-parity notes in `../08-platform-sources/platform-capability-matrix.md`.
