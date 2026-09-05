# Standalone App: Social Stream Loading And Injection

Status: deep extraction pass on 2026-07-22 from `ssapp/index.html`, `ssapp/main.js`, `ssapp/preload.js`, `ssapp/scripts/updateSocialStreamFallback.js`. Source-backed with line anchors; not runtime-tested.

## Purpose

Use this page for how the standalone app obtains and runs Social Stream code: page resolution order (remote → cache → packaged fallback), content-script injection mechanics, and the `chrome.runtime` emulation bridge. For window lifecycle, use `main-process-lifecycle.md`. For the older backbone summary, use `../04-standalone-app-architecture.md`.

## Source Anchors

- `ssapp/index.html` (`resolveSocialStreamPage` `:786-915`, frames `:205-222`, `createWindowWSSFromSource` `:8849`)
- `ssapp/main.js` (injection `:11853-12493`, chrome.runtime mock `:12431-12493`, asset resolution `:3350-3754`)
- `ssapp/preload.js` (`ninjafy` bridge `:445-681`)
- `ssapp/scripts/updateSocialStreamFallback.js` (`:6-7`, `:95`)
- `social_stream/background.js` (`fromMain` bridge `:751-780`)

## Core Model

The app does **not** load the extension as an extension. It re-hosts the extension's pages inside iframes and hidden windows, and emulates the `chrome.*` APIs those pages expect.

| Extension concept | App equivalent |
| --- | --- |
| Background service worker | Hidden iframe `#frame2` in `index.html` (`index.html:211`, src set `:12849-12855`) running `background.html`/`background.js` |
| Popup | Iframe `#frame1` (`index.html:205`, `:12902-12947`) running `popup.html`; `#frame3` and a Stream Deck setup frame also exist (`index.html:217,222`) |
| Manifest-declared content scripts | Main process reads the JS file text and injects it into hidden source windows (`main.js:11853-11916`, `:12143-12168`) |
| `chrome.runtime` APIs | Injected mock shim (`main.js:12431-12493`) + preload `ninjafy` bridge (`preload.js:445-681`) |
| manifest.json | Still fetched and parsed to decide script sets and match rules (`index.html:12818-12829`, `:8801-8810`) |

## Page Resolution Order

`resolveSocialStreamPage` (`index.html:786-915`) resolves each Social Stream page (background.html, popup.html, sources/websocket/*.html, overlays) through, in order:

1. **Local filesource** — `--filesource <path>` CLI flag or saved local source path (dev mode, `--running-from-source`; `package.json:10-12`, `main.js:7283-7374`).
2. **Remote** — `https://cache.socialstream.ninja` (and `/beta`) then `https://(beta.)socialstream.ninja` (`index.html:770-784`), validated with a fetch, 5 s timeout.
3. **On-disk HTTP cache** — `socialstream:resolve-cache-url` (`main.js:3754`).
4. **Packaged fallback** — `resources/social_stream_fallback/{main,beta}` (`main.js:3350`), shipped as asarUnpacked (`package.json:140-143`).

Support implication: the default app tracks the live website, so app behavior can change without an app update. The packaged fallback is only used when remote and cache both fail. The fallback bundle is generated from the git repo by `scripts/updateSocialStreamFallback.js:95` and is explicitly disposable (`resources/README.md`) — never treat it as source documentation.

## Classic (DOM) Capture Injection

1. Renderer sends `ipcRenderer.sendSync('createWindow', {source: 'sources/<platform>.js', ...})` (`index.html:8816-8838`).
2. Main creates a hidden BrowserWindow (`main.js:11069`) pointed at the live platform page.
3. Main obtains the content-script text: local filesource (`main.js:11853-11916`) or fetched from `https://raw.githubusercontent.com/steveseguin/social_stream/{branch}/...` (`main.js:12143-12168`).
4. The script is wrapped in a chrome.runtime mock shim (`main.js:12431-12493`) and injected via `executeJavaScriptInIsolatedWorld(0, ...)` (`main.js:12492`).

## WebSocket Source Pages

`createWindowWSSFromSource` (`index.html:8849`) loads `sources/websocket/<target>.html` (same remote/fallback resolution, `index.html:8872`) in a hidden window. The page's own `<target>.js` runs with `chrome.runtime` mocked plus the `ninjafy` preload bridge (`preload.js:445+`). This keeps the shared sources/websocket scripts compatible with both extension and app, per the repo's AGENTS.md rules.

App-only exceptions that bypass source pages entirely:

- **TikTok**: main-process connector (`createTikTokConnection`, `main.js:17848`; `tiktok/connection-manager.js`). No `sources/websocket/tiktok*` file exists. See `../08-platform-sources/tiktok-standalone-app.md`.
- **Kick**: main-process WS client (`kick-ws-connect`, `main.js:18469`; `resources/kick-ws-client.js`).

## chrome.runtime Emulation And Message Routing

- Preload exposes `ninjafy` with `sendMessage` → `ipcRenderer.send('postMessage')` (`preload.js:457-476`). Messages carry an auth token + injected-script flag (`main.js:2790`, `preload.js:448`).
- Main routes messages between the background iframe, popup iframe (`frame.postMessage("fromMain", ...)`, `main.js:8228-8236`), and source windows (`sendToTab`, `main.js:12916`).
- App-native producers (TikTok connector, Kick WS client) post payloads straight into the background iframe: `postTikTokPayloadToBackground` (`connection-manager.js:10220`) finds the background frame (`isSocialStreamBackgroundFrame`, `:10197`) and calls `frame.postMessage('fromMain', payload)`. `background.js:751-780` receives `fromMain` (including batches at `:760-769`) and feeds payloads into its normal `chrome.runtime.onMessage` pipeline — from there it is the standard SSN flow.

Support implication: an app-captured TikTok message and an extension-captured TikTok message converge at `background.js`; differences before that point are app-specific, differences after are shared-code bugs.

## Anti-Detection Extras The Extension Lacks

- Chrome UA override + header rewriting (`main.js:14923-14964`).
- Kasada/fingerprint normalization preloads (`preload-mock.js:1-60,806`, `preload-kasada.js`).
- Per-platform cookie partitions (`persist:<platform>`).

## Do Not Overclaim

- "The app bundles Social Stream version X" is wrong by default; it prefers live remote assets. Only the fallback bundle is version-pinned to the build.
- `resources/social_stream_fallback` contents are generated; do not edit or cite them as source behavior.

## Follow-Up Extraction Needs

- Cache invalidation rules for the on-disk HTTP cache (`main.js:3436-3437`).
- Exact branch selection (main vs beta) matrix with `betaMode`.
