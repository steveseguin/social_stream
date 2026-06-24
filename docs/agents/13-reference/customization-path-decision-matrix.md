# Customization Path Decision Matrix

Status: heavy source-check pass on 2026-06-24, plus focused Event Flow Node-test evidence. No browser, OBS, Chrome extension, or standalone app runtime validation was performed.

## Purpose

Use this page when a user asks how to customize SSN, make a plugin, build a custom overlay, add custom logic, connect a bot/app, or add a new platform.

This is the fast "which path should I choose?" layer over:

- `customization-plugin-recipes.md`
- `customization-source-trace.md`
- `custom-plugins-and-extensions.md`
- `07-overlays-and-pages/custom-overlays.md`
- `12-development/adding-a-source.md`
- `09-api-and-integrations/websocket-http-api.md`
- `09-api-and-integrations/event-flow-editor.md`

## Source Anchors

Source and public docs checked:

- `README.md`
- `parameters.md`
- `api.md`
- `docs/customoverlays.md`
- `docs/guides.html`
- `custom_sample.js`
- `custom_actions.js`
- `sampleoverlay.html`
- `sample_wss_source.html`
- `dock.html`
- `featured.html`
- `background.js`
- `manifest.json`
- `sources/README.md`
- `docs/js/sites.js`
- `docs/event-reference.html`
- `docs/agents/13-reference/customization-plugin-recipes.md`
- `docs/agents/13-reference/customization-source-trace.md`
- `docs/agents/13-reference/custom-plugins-and-extensions.md`
- `docs/agents/07-overlays-and-pages/custom-overlays.md`
- `docs/agents/12-development/adding-a-source.md`

## Main Rule

Do not answer every customization question with "make a plugin."

SSN has several extension points, and most user goals need the smallest path that solves the job:

1. URL parameter or OBS CSS.
2. Existing theme/template.
3. Custom overlay page.
4. Local `custom.js` for dock/featured behavior.
5. Uploaded/custom user function for message processing.
6. API/WebSocket external app or bot.
7. Event Flow automation.
8. First-class source file.

There is no single official plugin marketplace, zip-plugin installer, or one package format that covers all of these paths.

## Fast Path Matrix

| User Goal | Best Path | Edit/Host Surface | Skill Level | Portable To Other Users? | First Failure Checks |
| --- | --- | --- | --- | --- | --- |
| Change colors, fonts, scale, padding, transparency, badges, avatars, or simple display filters | URL parameters, OBS custom CSS, or page-supported `css`/`b64css` params | OBS browser source, page URL, hosted/local page | Beginner | Yes, as a URL/CSS snippet | Wrong page, unsupported param, stale OBS URL, CSS specificity, page not refreshed. |
| Use a different existing look | Built-in theme page or featured style | `themes/**/*.html` URL | Beginner | Yes, as a URL | Theme waits for normal chat vs featured messages; local assets; wrong session. |
| Build a fully custom visual output | Custom overlay HTML/CSS/JS | User-hosted/local/forked overlay page | Intermediate | Yes, as files or hosted page | Wrong session/password/label, dock receives no messages, no `postMessage` source check, missing optional payload fields. |
| Change local dock or featured page behavior | Local `custom.js` from `custom_sample.js` | Local/forked `dock.html` or `featured.html` | Intermediate | Only if user can run/host local files | Hosted page cannot read disk `custom.js`; hook not loaded; bad JS blocks processing. |
| Filter, rewrite, block, or auto-reply to messages before normal processing | Custom user function / `custom_actions.js` pattern | Extension/app custom JS setting path and background processing | Advanced | Maybe, but only as trusted-user code | `customJsEnabled` not enabled, upload failed, arbitrary JS behavior not runtime-validated, auto replies can spam. |
| Send a private app, bot, game, or donation feed into SSN | API/WebSocket external source | External script/app using SSN API payloads | Intermediate/advanced | Yes, as a script/app, not a source listing | API toggles, wrong session/channel, bad JSON, no reconnect, leaked session/webhook URL. |
| Automate reactions to events without editing files | Event Flow | Event Flow editor plus Flow Actions page when needed | Intermediate | Yes, as documented flow/export if supported | Trigger not matched, action page closed, target label/session mismatch, missing OBS/page permissions. |
| Integrate StreamDeck, Companion, Streamer.bot, or OBS control | Existing API/integration path | External tool config and SSN API/page URLs | Beginner/intermediate | Yes, as config steps | Remote API not enabled, wrong action, target page closed, label mismatch. |
| Add support for a new public platform | First-class source file plus manifest/docs/site metadata | `sources/*`, `sources/websocket/*`, `manifest.json`, docs/site data | Developer | Yes, through repo contribution/fork | Wrong integration type, unstable selectors/API, missing type/icon/docs, app parity not checked. |
| Share reusable customization with others | Documented URL/CSS, hosted page, fork, or PR | Depends on path | Varies | Yes, but not as a universal plugin zip | Missing setup steps, secrets in code, user expects one-click install. |

## Decision Tree

1. Is the user only changing the look?
   - Start with URL parameters, OBS CSS, or an existing theme.
   - Do not suggest `custom.js` or a new source first.
2. Is the user building a new visual page?
   - Start with `sampleoverlay.html` and `docs/customoverlays.md`.
   - Use the iframe bridge unless they specifically need direct WebSocket handling.
3. Is the user changing dock/featured logic only for themselves?
   - Use local `custom.js`.
   - Confirm they are running a local/forked page, not the hosted page.
4. Is the user modifying message data globally?
   - Consider the custom user-function path, but warn that trusted code and runtime validation are required.
   - For non-developers, Event Flow may be safer.
5. Is the user sending data from another system?
   - Use API/WebSocket payloads before writing a browser source.
6. Is the user automating existing SSN events/actions?
   - Use Event Flow or existing API commands.
7. Is the user adding a generally useful platform integration?
   - Use the first-class source path and update manifest/docs/site metadata.

## Path Notes

### URL Parameters And CSS

Use this for appearance and page-supported behavior.

Source-backed examples:

- `parameters.md` documents `css`, `b64css`, `base64css`, `scale`, fonts, colors, visibility, filters, and automation-style URL options.
- `dock.html` and `featured.html` parse `css` and base64 CSS aliases.
- Public guides describe OBS custom CSS and URL parameter customization.

Support boundary:

- URL parameters are page-specific and usually load-time.
- OBS custom CSS affects only that OBS browser source.
- `css`/`b64css` support is not guaranteed on every page or theme.

### Built-In Themes

Use this when the user wants a different look without owning all rendering logic.

Support boundary:

- Normal chat themes, featured-style themes, wrapper themes, and package themes behave differently.
- Featured-style themes may wait for selected/featured messages rather than all chat.
- Local-file and asset-loading behavior still needs browser/OBS validation.

### Custom Overlay Page

Use this when the user wants full visual control.

Source-backed behavior:

- `docs/customoverlays.md` recommends a hidden VDO.Ninja iframe bridge for most visual overlays.
- `sampleoverlay.html` creates a bridge iframe and checks `event.source` before reading `dataReceived.overlayNinja`.
- Direct WebSocket is available but more appropriate for advanced tools/integrations.

Minimum support checklist:

- Same `session` as source/dock.
- `password` if the session is protected.
- `label=dock` for normal chat/events unless intentionally targeting another feed.
- Validate `event.source` for iframe messages.
- Render safely when optional payload fields are missing.

### Local `custom.js`

Use this for local/forked dock or featured behavior. For exact host-loading and return-value behavior, use `customization-source-trace.md`.

Source-backed behavior:

- `custom_sample.js` says to rename it to `custom.js`.
- It defines `applyCustomActions(data)` for `dock.html`.
- It defines `applyCustomFeatureActions(data)` for `featured.html`.
- `dock.html` tries to load `custom.js` only in private/self-hosted contexts and then calls `applyCustomActions(data)`.
- Returning `false` or `null` cancels processing; returning a data object replaces the message.

Support boundary:

- Hosted `https://socialstream.ninja/dock.html` cannot load a local disk `custom.js`.
- Bad JavaScript can block messages.
- This is not a reusable plugin package.

### Uploaded Custom User Function

Use this only for trusted advanced users who need message processing before normal routing. For the current upload/storage/load path and loader caveat, use `customization-source-trace.md`.

Source-backed behavior:

- `custom_actions.js` defines the intended `window.customUserFunction = function(data) { ... }` template.
- `background.js` has `uploadCustomJs` and `deleteCustomJs` message handlers.
- Uploaded code is stored in `localStorage.customJavaScript`.
- `background.js` checks `settings.customJsEnabled` and calls `customUserFunction(data)` during message processing.

Important caveat:

The source path exists, but this pass did not runtime-test arbitrary custom JavaScript execution. The current source has a constrained loader/wrapper around the uploaded function path. Do not promise arbitrary plugin-like JavaScript behavior without testing the exact app/extension build and the exact custom function.

Support boundary:

- Treat uploaded custom JS as trusted-user code only.
- Do not store secrets in it.
- Rate-limit auto replies.
- Test in a private session before a live stream.

### API/WebSocket External Source

Use this when another app can produce SSN-shaped data.

Source-backed behavior:

- `sample_wss_source.html` sends a basic chat-like payload to the SSN WebSocket service.
- `api.md` documents HTTP, WebSocket, SSE, channel routing, and remote-control commands.
- `customization-plugin-recipes.md` provides a minimal external payload shape.

Good fits:

- Private local bots.
- Custom games.
- Internal dashboards.
- Donation or event sources that should not become browser content scripts.

Support boundary:

- API toggles and channels matter.
- Session IDs and webhook URLs are sensitive.
- Clients should reconnect and handle invalid JSON/network failures.

### Event Flow

Use this when the user wants automation from existing SSN events/actions without writing or hosting files.

Good fits:

- Trigger media, sounds, TTS, OBS actions, or webhooks.
- Gate, delay, throttle, or branch logic.
- Let non-developers edit behavior visually.

Support boundary:

- It is not a web scraper.
- It does not create a new platform source by itself.
- Runtime validation is needed for high-risk flows, target labels, and external actions.

Focused validation evidence:

- On 2026-06-24, focused Node tests passed for custom JS allow/block detection, custom JS trigger/action behavior, compare-property triggers, template variables, counters, OBS system triggers, and `playTenorGiphy` duration behavior.
- Evidence log: `18-focused-validation-evidence-log.md`.
- This evidence does not validate the editor UI, Flow Actions overlay, OBS, extension runtime, standalone app runtime, or external integration actions.

### First-Class Source

Use this when the integration should become maintained platform support.

Source-backed expected changes:

- DOM source: `sources/platform.js`.
- WebSocket/API source: `sources/websocket/platform.html` and `sources/websocket/platform.js`.
- Manifest row in `manifest.json`.
- Icon/metadata as needed.
- Public site card in `docs/js/sites.js` when user-facing.
- Event reference updates when new normalized events are emitted.
- App parity/source-window checks when expected to work in the standalone app.

Support boundary:

- Do not build a first-class source for a one-user private feed if API/WebSocket ingest is enough.
- Platform terms, auth, selectors, and anti-bot/CAPTCHA behavior can make support unrealistic.
- Source edits belong in `social_stream`, not the app fallback mirror.

## Shareability Matrix

| Path | Good Way To Share | Avoid |
| --- | --- | --- |
| URL/CSS customization | URL example plus CSS snippet | Sharing URLs with session IDs, passwords, or API keys. |
| Theme/template | Hosted URL or repo PR | Assuming every theme supports every dock parameter. |
| Custom overlay | Hosted page, local files, or fork | Asking users to edit `background.js`. |
| Local `custom.js` | Code snippet plus local-hosting steps | Claiming it works on hosted `socialstream.ninja` pages. |
| Uploaded custom user function | Trusted snippet with test instructions | Treating it as a safe marketplace plugin. |
| API/WebSocket app | Script/app plus redacted config docs | Publishing secret-bearing session/webhook URLs. |
| Event Flow | Flow description/export if supported | Claiming a flow is tested without running it. |
| First-class source | PR/fork with docs and tests | Editing `ssapp/resources/social_stream_fallback`. |

## Cost And Support Boundary

SSN customization paths are part of the free/open-source project. Costs can still appear outside SSN:

- Hosting a custom overlay or asset.
- Cloud AI/TTS providers.
- Paid graphics platforms.
- Platform API accounts or quotas.
- Third-party automation tools.
- Developer time for custom code.

Do not describe external providers or hosting as free unless current provider docs and the user's setup prove it.

## Good Support Answer Pattern

```text
You probably do not need a plugin first. If this is just styling, use URL parameters or OBS CSS. If you need a different visual layout, build a custom overlay from `sampleoverlay.html`. If you need automation, use Event Flow or the API. If you need a new platform to be generally supported, that is a first-class source file plus manifest/docs work.
```

## Runtime Validation Needed

- Test local `custom.js` in local `dock.html` and `featured.html`.
- Test uploaded custom user function behavior in extension and standalone app modes.
- Validate a minimal custom overlay in browser and OBS.
- Validate `sample_wss_source.html` or equivalent external-source JSON in a private session.
- Validate Event Flow import/export and action execution for common automation recipes.
- Validate a new-source template against extension and app source-window behavior.
