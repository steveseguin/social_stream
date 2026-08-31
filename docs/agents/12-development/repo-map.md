# Development Repo Map

Status: heavy extraction pass started on 2026-06-24.

## Purpose

This page tells agents where SSN code lives and which repository should be changed for common work.

## Source Anchors

- `social_stream/AGENTS.md`
- `ssapp/AGENTS.md`
- `social_stream/manifest.json`
- `social_stream/package.json`
- `ssapp/package.json`
- `ssapp/RELEASE.md`
- `ssapp/resources/README.md`

## Repository Roles

`<social_stream repo>`

- Primary Social Stream Ninja source of truth.
- Chrome extension source.
- Hosted web pages and overlays.
- Platform content scripts under `sources/`.
- WebSocket/bridge source pages under `sources/websocket/`.
- Shared cross-surface utilities under `shared/`.
- Provider cores under `providers/`.
- Public docs under `docs/` plus root docs such as `README.md`, `api.md`, and `parameters.md`.
- The only place this documentation project writes: `docs/agents/`.

`<ssapp repo>`

- Electron standalone app wrapper.
- App-specific main/preload/renderer/state code.
- App-specific platform handlers and IPC/security code.
- Build/package/release artifact generation for the desktop app.
- Loads Social Stream source from `<social_stream repo>` during development.

## Source Of Truth Rule

For Social Stream source behavior, edit `social_stream`.

Do not treat:

```text
ssapp/resources/social_stream_fallback
```

as primary source. The app instructions and `ssapp/resources/README.md` both say it is a generated bundle mirror for packaged/distributed builds and is rebuilt on build/update.

Normal app work should not read, browse, edit, or spend time in that fallback folder.

## social_stream Layout

High-value directories:

- `sources/`: platform DOM/content scripts loaded by the extension and often used by the app.
- `sources/websocket/`: bridge/source pages that can run in extension and Electron contexts.
- `providers/`: platform provider cores, intended to stay environment-agnostic.
- `shared/`: cross-surface utilities and shared AI/provider/browser helpers.
- `settings/`: settings UI/config pieces.
- `actions/`: Event Flow editor/system/guides/examples.
- `themes/`: overlay theme examples.
- `games/`: individual game pages.
- `docs/`: public docs and event reference.
- `docs/agents/`: AI-focused documentation set created by this project.
- `scripts/`: Playwright checks, model/AI checks, asset sync helpers.
- `tests/`: Node/browser regression tests and fixtures.
- `lite/`: standalone web app surfaces deployed independently.
- `thirdparty/`, `shared/vendor/`, `lite/vendor/`: local vendored dependencies.

Important root files:

- `manifest.json`: MV3 extension manifest, content scripts, permissions, web-accessible resources.
- `service_worker.js`: extension service worker bootstrap.
- `background.js` / `background.html`: extension runtime and message routing.
- `popup.html` / `popup.js`: extension settings/control UI.
- `dock.html`, `featured.html`, `multi-alerts.html`, `actions.html`, etc.: overlay/tool pages.
- `api.md`, `parameters.md`, `docs/event-reference.html`: public API/parameter/payload references.

## ssapp Layout

Important app files:

- `main.js`: Electron main process.
- `preload.js`: bridge exposed to renderer/source pages.
- `renderer.js`: app renderer UI behavior.
- `state.js`: app state persistence.
- `index.html`, `main.css`: app shell.
- `resources/electron-*-handler.js`: OAuth/platform handlers.
- `resources/kick-ws-client.js`: Kick WebSocket client.
- `tiktok/`: TikTok connection management.
- `tiktok-signing/`: TikTok signing helper.
- `tests/electron/`: app diagnostics/regression scripts.
- `tests/tiktok/`: TikTok mode/regression scripts.
- `scripts/updateSocialStreamFallback.js`: generated fallback bundle updater.
- `scripts/submit-virustotal.js`: release submission helper.

Avoid normal edits in:

- `resources/social_stream_fallback/`
- generated build outputs such as `dist/`
- secrets/certs/env files unless the task explicitly requires release/signing work and Steve has approved it

## Extension Manifest Notes

`manifest.json` is MV3:

- `manifest_version: 3`
- background service worker: `service_worker.js`
- CSP allows extension pages to load self scripts and `wasm-unsafe-eval`, but not arbitrary remote executable scripts
- many host permissions and content-script matches
- `web_accessible_resources` exposes shared/provider modules such as provider cores and `shared/utils/*`

When adding a shared script used by content scripts or extension pages, update the manifest if extension access requires it.

## What To Change Where

Platform capture bug:

- Start in `social_stream/sources/<platform>.js` or `sources/websocket/<platform>.*`.
- If app-only auth/IPC is involved, also inspect `ssapp/resources/electron-*-handler.js` or `ssapp/preload.js`.

Overlay behavior:

- Start in the specific root overlay/tool page: `dock.html`, `featured.html`, `multi-alerts.*`, `waitlist.html`, `poll.html`, `timer.html`, etc.
- Shared payload contract changes need `docs/event-reference.html`.

Event Flow:

- `actions/EventFlowEditor.js`
- `actions/EventFlowSystem.js`
- `actions/*.html` guides
- `tests/eventflow-*.test.js`

Standalone app source-window or state behavior:

- `ssapp/main.js`
- `ssapp/preload.js`
- `ssapp/state.js`
- `ssapp/renderer.js`
- app tests under `ssapp/tests/electron/`

Release/build:

- `ssapp/package.json`
- `ssapp/RELEASE.md`
- `ssapp/scripts/*`
- public release artifacts in `steveseguin/social_stream` releases, not `ssn_app` releases

## Remaining Extraction Targets

- Build a file-by-file source map for all top-level pages in `social_stream`.
- Add a provider-core map for `providers/*`.
- Add a source-script load map by parsing `manifest.json` content scripts.
