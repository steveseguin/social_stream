# Customization Source Trace

Status: source-check pass on 2026-06-24. No browser, OBS, Chrome extension runtime, standalone app runtime, or live platform validation was performed.

## Purpose

Use this page when a user asks how to make a plugin, custom overlay, custom source, custom script, or external app for SSN and the recipe pages are not precise enough.

This page traces the current customization hooks and boundaries from source. It does not prove the hooks behave correctly in every runtime mode.

Related pages:

- `customization-path-decision-matrix.md`
- `customization-plugin-recipes.md`
- `custom-plugins-and-extensions.md`
- `07-overlays-and-pages/custom-overlays.md`
- `12-development/adding-a-source.md`
- `09-api-and-integrations/websocket-http-api.md`
- `09-api-and-integrations/event-flow-editor.md`

## Source Anchors

Files checked:

- `custom_sample.js`
- `custom_actions.js`
- `sampleoverlay.html`
- `sample_wss_source.html`
- `docs/customoverlays.md`
- `dock.html`
- `featured.html`
- `background.js`
- `popup.js`
- `popup.html`
- `shared/config/settingsDefinitions.js`
- `api.md`
- `manifest.json`
- `sources/README.md`

## Main Boundary

SSN has plugin-like extension points, but current source does not show one universal plugin package or marketplace flow.

Answer "can I make a plugin?" by first choosing the surface:

| Surface | Current Source Path | Best For | Do Not Promise |
| --- | --- | --- | --- |
| URL parameters / OBS CSS | Page URL parsers, popup-generated links, OBS browser source CSS | Styling and simple page behavior | New platform support or global message rewriting. |
| Custom overlay page | `sampleoverlay.html`, `docs/customoverlays.md`, theme pages | Custom visual output | Built-in dock behavior unless the overlay implements it. |
| Local `custom.js` | `custom_sample.js`, `dock.html`, `featured.html` | Local/forked dock or featured behavior | Hosted `socialstream.ninja` page customization from a local disk file. |
| Uploaded custom user function | `custom_actions.js`, `popup.js`, `background.js`, `customJsEnabled` | Trusted advanced message-processing experiments | A general arbitrary-JS plugin runtime without runtime validation. |
| API/WebSocket external source | `sample_wss_source.html`, `api.md` | Private apps, bots, dashboards, games, donation feeds | Automatic reconnect/production reliability unless implemented by the client. |
| Event Flow | `actions/*`, Event Flow docs/tests | Visual automation from existing events/messages | New source scraping or unvalidated external side effects. |
| First-class source | `sources/*`, `sources/websocket/*`, `manifest.json`, `docs/js/sites.js` | Maintained platform support | One-selector quick fixes without payload, docs, manifest, and app-parity work. |

## Local `custom.js` Trace

Source-checked behavior:

- `custom_sample.js` is for local dock/featured pages and says to rename it to `custom.js`.
- It defines `applyCustomActions(data)` for `dock.html`.
- It defines `applyCustomFeatureActions(data)` for `featured.html`.
- `dock.html` attempts to load `custom.js` only outside the known hosted domains checked in the current dock source.
- `featured.html` also attempts to load `custom.js` outside its hosted-domain check, but its current host check is narrower than the dock page check.
- `dock.html` calls `applyCustomActions(data)` while processing messages when live side effects are not suppressed.
- In dock handling, returning `false` or `null` cancels processing; returning an object replaces the message; returning `undefined` leaves the message unchanged.
- `featured.html` calls `applyCustomFeatureActions(payload)` when it receives `overlayNinja` payloads from the iframe path. The return value is not used as a replacement in the traced block.

Support wording:

```text
`custom.js` is for local or self-hosted/forked pages. It is not something the hosted dock page can read from your computer.
```

First checks when it fails:

- Is the page local, self-hosted, or forked rather than the hosted SSN page?
- Is `custom.js` in the same path the page is loading from?
- Does the browser console show a syntax error?
- Is the hook name exactly `applyCustomActions` or `applyCustomFeatureActions`?
- Is the user expecting the featured hook to rewrite data even though the traced source treats it as a side-effect hook?

Runtime validation still needed:

- Local `dock.html` load of `custom.js`.
- Local `featured.html` load of `custom.js`.
- Hosted, beta, cfpages, Pages, file, and local-server host differences.
- OBS browser-source behavior for local/forked custom pages.
- Standalone app parity.

## Uploaded Custom User Function Trace

Source-checked behavior:

- `custom_actions.js` defines the intended template shape: `window.customUserFunction = function(data) { ... }`.
- `popup.html` has a Custom JavaScript settings section with an enable checkbox and upload/delete buttons.
- `popup.js` handles upload and delete button clicks.
- Upload sends a runtime message with `cmd: "uploadCustomJs"` and file contents.
- Delete sends `cmd: "deleteCustomJs"`.
- `background.js` stores uploaded code in `localStorage.customJavaScript`.
- `shared/config/settingsDefinitions.js` defines `customJsEnabled` as a boolean in the `custom_javascript` category.
- During background setup, `background.js` loads the stored custom JavaScript only when `settings.customJsEnabled` is truthy; otherwise it resets the custom function.
- During message processing, `background.js` calls `customUserFunction(data)` when `settings.customJsEnabled` is enabled.

Important source caveat:

The current `loadCustomJs(code)` source extracts a `window.customUserFunction = function(data) { ... };` shape, but it also uses a constrained wrapper path and comments about not directly evaluating code because of CSP. Do not promise that every arbitrary helper or every line in `custom_actions.js` will execute exactly as a normal pasted script without runtime testing.

Support wording:

```text
SSN has an uploaded custom JavaScript setting for trusted advanced users, but treat it as experimental/source-dependent. Test a tiny pass-through function first before using it on a live show.
```

First checks when it fails:

- Was the script uploaded through the popup menu rather than saved as `custom.js`?
- Is `customJsEnabled` enabled after upload?
- Does the uploaded file match the expected `window.customUserFunction = function(data) { ... };` shape?
- Does the browser/background console report extraction or load errors?
- Does a pass-through function return the original `data` before adding blocking/reply behavior?
- Is the user relying on helpers, network calls, or auto replies that were not runtime-validated?

Runtime validation still needed:

- Upload, enable, disable, and delete flow in the extension.
- Same flow in the standalone app if exposed there.
- Return behavior for `data`, modified objects, `false`, `null`, thrown errors, and async code.
- Send-back helper behavior from custom code on a source that supports replies.

## Custom Overlay Trace

Source-checked behavior:

- `docs/customoverlays.md` recommends a hidden VDO.Ninja iframe bridge for normal visual overlays.
- `sampleoverlay.html` includes editing guidance for AI agents and documents its own WebRTC iframe / WebSocket behavior.
- Custom overlays normally need the same `session` as the source/dock side.
- A password-protected session needs a matching password parameter.
- `label=dock` is the normal live feed label in the custom overlay docs.
- `sampleoverlay.html` also supports a WebSocket path for advanced/direct use.

Support wording:

```text
For a custom visual overlay, start from the iframe bridge pattern unless you specifically need to own WebSocket reconnects and channel routing.
```

First checks when it fails:

- Does the dock or another known page receive messages with the same session?
- Is the overlay using the same session and password?
- Is it listening to the right bridge/label/channel?
- Is it checking the iframe message source before trusting payloads?
- Does it handle missing optional fields like `chatimg`, `contentimg`, `membership`, and `event`?
- Is OBS blocking local files or cached assets?

Runtime validation still needed:

- Minimal iframe custom overlay in a browser.
- Same overlay as an OBS browser source.
- Direct WebSocket overlay behavior.
- Payload coverage for chat, donations, memberships, stickers/images, and event payloads.

## External API/WebSocket Source Trace

Source-checked behavior:

- `sample_wss_source.html` reads `session`, `s`, or `id` from the URL.
- If opened as a file with no session, it prompts for a session ID.
- It uses `wss://io.socialstream.ninja` by default.
- With `localserver`, it uses `ws://127.0.0.1:3000`.
- On open, it sends a join message with the current room ID and channel pair `{ "out": 1, "in": 3 }`.
- Its test button sends a direct SSN-shaped payload with fields such as `chatname`, `chatmessage`, `chatimg`, `hasDonation`, `membership`, `contentimg`, `type`, `textonly`, and `id`.

Support wording:

```text
If your custom data already comes from an app, bot, webhook, or local script, send SSN-shaped JSON through the API/WebSocket path before building a full browser source.
```

First checks when it fails:

- Is the remote API/WebSocket setting enabled where required?
- Is the session correct and redacted before sharing?
- Is the channel pair correct for the direction the user wants?
- Is the payload valid JSON and SSN-shaped?
- Does the client reconnect after socket close?
- Are secrets, webhook URLs, or session IDs being logged or pasted publicly?

Runtime validation still needed:

- Hosted WebSocket relay for a minimal external payload.
- Local server mode.
- Reconnect behavior.
- Channel routing and listener behavior.
- App/extension parity.

## First-Class Source Trace

Source-checked development path:

- DOM content script sources live under `sources/*.js`.
- API/socket source pages live under `sources/websocket/*.html` and `sources/websocket/*.js`.
- Manifest routing lives in `manifest.json`.
- User-facing site cards live in `docs/js/sites.js`.
- Source icons normally live in `sources/images/`.
- Event/payload documentation belongs in `docs/event-reference.html` and agent docs when the source is important or recurring in support.

Use a first-class source only when:

- The integration is useful beyond one private stream.
- The platform has a stable DOM, API, or socket path.
- The source can produce normalized SSN payloads.
- The maintenance burden is acceptable.
- App parity expectations are clear.

Do not use a first-class source when:

- A private API/WebSocket source is enough.
- The source requires private credentials that should stay in a user app.
- The target site is too unstable, blocked, or against platform rules.
- The user only wants visual styling or simple automation.

Runtime validation still needed:

- Exact manifest match and injection.
- Settings retrieval and text-only behavior.
- Normal chat payload.
- Rich events, if claimed.
- Deletion/moderation, if claimed.
- Send-back, if claimed.
- Standalone app behavior, if claimed.

## Safe Answer Patterns

For a user asking "can I make a plugin?":

```text
Yes, but SSN does not use one universal plugin installer. If you want styling, use URL parameters or OBS CSS. If you want a visual output, build a custom overlay. If you want message logic, use local custom.js or the uploaded custom JavaScript path after testing. If you want data from another app, use the API/WebSocket. If you want a new public platform, that is a source file plus manifest/docs work.
```

For a user asking "where do I put custom.js?":

```text
Use `custom.js` only with a local/self-hosted/forked dock or featured page. The hosted SSN pages cannot read a custom.js file from your computer.
```

For a user asking "can I upload this script?":

```text
Only upload trusted code, enable it in the Custom JavaScript setting, and test a tiny pass-through function first. Current source shows a constrained loader, so do not assume arbitrary plugin code works until the exact script is runtime-tested.
```

For a user asking "should I add a source?":

```text
If the integration is private to your stream, use API/WebSocket ingest first. Build a first-class source only when it should become maintained platform support with manifest, metadata, payload, docs, and app-parity checks.
```

## Evidence Level

This pass is `source-checked`.

It proves:

- Which files define the customization hooks.
- Which settings and message commands are involved.
- Which return-value and host-boundary caveats are visible in source.
- Which customization paths are separate and should not be collapsed into "plugins."

It does not prove:

- Runtime behavior in Chrome, Firefox, OBS, hosted pages, local files, or the standalone app.
- Safety or correctness of arbitrary uploaded JavaScript.
- Whether a specific custom overlay renders correctly.
- Whether send-back from custom code succeeds on a specific platform.
- Whether a first-class source works on a live third-party site.
