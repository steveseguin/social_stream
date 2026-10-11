# Customization And Plugin Recipes

Status: heavy reference pass started on 2026-06-24.

## Purpose

Use this page when a user asks how to customize SSN, make a plugin, build a custom overlay, add custom logic, send data from another app, or add a new source.

SSN has several plugin-like paths. Do not frame them as one official plugin marketplace, zip package, or installer flow.

If the user has not already chosen a path, start with `customization-path-decision-matrix.md`. Use this page after that for recipe-level setup and first-failure checks. Use `customization-validation-ledger.md` before making stronger claims about what is source-backed, focused-tested, runtime-tested, or not supported.

## Source Anchors

- `customization-path-decision-matrix.md`
- `customization-source-trace.md`
- `customization-validation-ledger.md`
- `custom-plugins-and-extensions.md`
- `07-overlays-and-pages/custom-overlays.md`
- `09-api-and-integrations/websocket-http-api.md`
- `09-api-and-integrations/event-flow-editor.md`
- `12-development/adding-a-source.md`
- `custom_sample.js`
- `custom_actions.js`
- `sampleoverlay.html`
- `sample_wss_source.html`
- `api.md`
- `parameters.md`
- `docs/customoverlays.md`
- `docs/event-reference.html`
- `manifest.json`
- `sources/README.md`

## Fast Decision

| User Goal | Start With | Why |
| --- | --- | --- |
| Change colors, size, fonts, visibility, or simple overlay behavior | URL parameters and OBS custom CSS | Lowest risk; no code packaging needed. |
| Use a different existing look | Theme pages | Built-in pages already handle SSN payloads. |
| Build a fully custom visual output | Custom overlay HTML | Good when the user controls layout/rendering. |
| Change dock or featured behavior locally | Local `custom.js` | Good for local/forked pages, not hosted pages. |
| Filter, rewrite, style, or reply to messages programmatically | Custom user function / `custom_actions.js` pattern | Good for trusted-user message processing experiments. |
| Send private app, bot, game, donation, or dashboard data into SSN | API/WebSocket source | Keeps external logic outside the browser extension. |
| Build visual automation without editing files | Event Flow | Better for user-facing trigger/action workflows. |
| Add a supported platform | First-class source file plus manifest/docs | Developer path for maintained platform integrations. |
| Share a reusable customization | Forked/local page or documented setup steps | SSN does not have one official plugin package installer. |

## Safety Rules

- Keep custom code out of a live show until it has been tested in a private session.
- Do not paste untrusted JavaScript into `custom.js`, custom actions, overlays, Event Flow custom code, or browser-source pages.
- Do not put API keys, OAuth tokens, webhook URLs, private session IDs, or passwords in shared custom scripts.
- Hosted pages such as `https://socialstream.ninja/dock.html` cannot load a user's local disk `custom.js`.
- Custom overlays and API clients should tolerate missing optional payload fields.
- Auto replies and moderation actions should be rate-limited and platform-rule aware.
- Do not edit `ssapp/resources/social_stream_fallback`; it is a disposable fallback mirror, not the source of truth.

## Recipe: Style An Overlay Without Code

Use this when the user only wants visual changes.

1. Start with the normal page URL, usually `dock.html` or a theme page.
2. Add safe URL parameters for behavior, scale, filters, queue mode, compact mode, or labels.
3. Use OBS browser-source custom CSS for local visual changes.
4. Use `&css=` or `&b64css=` only when that page supports URL-driven CSS.
5. Keep the same `session` across source, dock, and overlay.

Use `url-option-examples.md` for safe copy/paste URL patterns and `url-parameters.md` for option families.

Best answer pattern:

```text
If you only need styling, do not build a plugin first. Start with URL parameters or OBS custom CSS, then move to a custom overlay only if you need full layout control.
```

## Recipe: Build A Custom Overlay

Use this when the user wants a custom visual page for OBS, a browser, or a local display.

Start from:

- `sampleoverlay.html`
- `docs/customoverlays.md`
- A built-in theme page close to the desired look
- `07-overlays-and-pages/custom-overlays.md`

Common implementation flow:

1. Load a hidden VDO.Ninja/SSN bridge iframe or connect through the documented WebSocket path.
2. Listen for SSN payloads.
3. Verify message source when using `window.postMessage`.
4. Render broad payload fields, not just one platform's shape.
5. Test normal chat, memberships/subscriptions, donations/gifts, stickers/images, and system events separately.

Fields a custom overlay should expect:

- `type`
- `chatname`
- `chatmessage`
- `chatimg`
- `chatbadges`
- `nameColor`
- `hasDonation`
- `membership`
- `contentimg`
- `event`
- `userid`
- `bot`
- `mod`
- `host`
- `vip`
- `tid`
- `meta`

Do not assume every platform sends every field. A good custom overlay renders something useful with only `chatname`, `chatmessage`, and `type`.

First failure checks:

- Wrong or missing `session`.
- Dock is not receiving messages before testing the overlay.
- Overlay is listening on the wrong transport/channel.
- Browser source blocked a local file or mixed local/hosted asset.
- Payload listener accepts all `postMessage` events without source checking.
- The theme is a featured-message style and is waiting for selected messages, not normal chat.

## Recipe: Add Local Dock Or Featured Behavior With `custom.js`

Use this for local experiments or custom behavior on local/forked pages. For exact host-loading and return-value behavior, use `customization-source-trace.md`.

Typical hooks:

```javascript
function applyCustomActions(data) {
  return data;
}

function applyCustomFeatureActions(data) {
  return data;
}
```

Practical steps:

1. Copy or rename `custom_sample.js` to `custom.js` in the expected local page context.
2. Open a local/forked page that can actually load that file.
3. Change one behavior at a time.
4. Test with multiple source types, not only one platform.
5. Keep a copy of the script outside any install/update path that might be overwritten.

Important boundary:

```text
Hosted SSN pages cannot read a custom.js file sitting on a user's computer. If the user needs custom.js, they need a local/forked page or another path such as an API client, custom overlay, or Event Flow.
```

## Recipe: Filter Or Modify Messages With A Custom User Function

Use this when the user wants to alter message data before it continues through SSN. For the current upload, setting, storage, and constrained-loader caveats, use `customization-source-trace.md`.

Template shape:

```javascript
window.customUserFunction = function(data) {
  return data;
};
```

Safe behavior:

- Return modified `data` to continue processing.
- Return `false` only when intentionally blocking/dropping a message.
- Add keyword replies carefully and rate-limit them.
- Treat all custom code as trusted-user code.
- Keep secrets out of the script.

Good uses:

- Keyword-based replies.
- Message cleanup.
- VIP/member styling.
- Donation thank-yous.
- Blocking a known unwanted message pattern.

Bad uses:

- Running unreviewed code from support chats.
- Storing platform login tokens.
- Auto-replying to every viewer message.
- Assuming send-back works equally on every platform.

## Recipe: Send Data From An External App

Use this when another app, bot, local script, game, donation service, or dashboard can emit SSN-shaped JSON.

Minimal payload:

```json
{
  "chatname": "External User",
  "chatmessage": "Hello from my app",
  "type": "external",
  "textonly": true
}
```

Useful optional fields:

- `chatimg`
- `contentimg`
- `hasDonation`
- `membership`
- `subtitle`
- `event`
- `meta`
- `id`

Use this path instead of a first-class source when:

- The integration is private to one stream.
- The data does not come from a browser chat page.
- The app already has an API, webhook, socket, or local process.
- The user does not need the integration listed as an official supported site.

First failure checks:

- API or WebSocket mode is not enabled.
- Wrong session/channel/label.
- Payload is not valid JSON.
- Payload has no meaningful `chatmessage`, `contentimg`, or `event`.
- Client does not reconnect after a network drop.
- User copied a secret-bearing URL into a public place.

Use `api-command-examples.md` and `09-api-and-integrations/websocket-http-api.md` for command and transport examples.

## Recipe: Use Event Flow Instead Of Code

Use Event Flow when the user wants automation but does not need a new source parser.

Good fits:

- Trigger an alert on a gift, membership, reward, or keyword.
- Route a message to OBS, TTS, media, or an external webhook.
- Add delay, gate, throttle, or conditional behavior.
- Keep logic visible and editable by a non-developer operator.

Poor fits:

- Scraping a new platform.
- Replacing a custom overlay renderer.
- Running sensitive custom JavaScript from an untrusted source.
- Handling private API secrets without a safe storage design.

Use `09-api-and-integrations/event-flow-editor.md` for deeper routing.

## Recipe: Add A First-Class Platform Source

Use this when the goal is maintained platform support in the extension/app ecosystem.

Before coding, confirm:

- The platform is not already supported under another source name.
- Chat is visible in the browser or available through a stable API/socket.
- The integration should be generally useful, not only private to one streamer.
- The platform's terms and login requirements do not make support unrealistic.
- The standalone app parity expectation is clear.

Typical file work:

- DOM source: `sources/platform.js`
- WebSocket/API source page: `sources/websocket/platform.html` and `sources/websocket/platform.js`
- Manifest match or helper entries in `manifest.json`
- Icons in `sources/images/`
- Public site metadata in `docs/js/sites.js` when user-facing
- Event docs/agent docs when it creates recurring support questions

Payload baseline:

```javascript
const data = {};
data.chatname = name;
data.chatmessage = message;
data.chatimg = avatarUrl || "";
data.chatbadges = badges || "";
data.contentimg = "";
data.hasDonation = "";
data.membership = "";
data.textonly = settings.textonlymode || false;
data.type = "platformname";
data.id = Date.now() + Math.floor(Math.random() * 1000000);
```

Developer checks:

- Keep `type` lowercase and stable.
- Prefer `meta` for source-specific details.
- Use existing provider cores/shared utilities where they already exist.
- Check whether the source needs `all_frames`, `run_at`, injected helpers, or web-accessible resources.
- Update Firefox/store/app variants only when that repo pattern requires it.
- Test both browser extension and standalone app when shared support is expected.

Use `12-development/adding-a-source.md` for the developer guide.

## Recipe: Package Or Share Custom Work

SSN custom work is usually shared as documented setup, source files, a fork, or a PR. Do not tell users there is a normal official plugin zip installer unless current source/docs prove one exists.

Safer sharing options:

- A local custom overlay HTML file plus setup instructions.
- A hosted custom overlay the user controls.
- A `custom.js` or custom action snippet with exact local-page limitations.
- An API/WebSocket helper app with clear session, channel, and secret instructions.
- An upstream PR for a first-class source or broadly useful feature.

Include:

- Which SSN surface it targets: extension, standalone app, hosted page, local page, OBS, API, or WebSocket.
- What files the user changes or opens.
- Which settings or URL parameters are required.
- What data is private and must not be shared.
- How to disable or roll back the customization.
- Known unsupported platforms or modes.

Avoid:

- Bundling secrets.
- Requiring edits in disposable fallback mirrors.
- Instructions that only work on the author's local path.
- Promising app/extension parity before it has been tested.

## Bad Answers To Avoid

| Bad Answer | Safer Answer |
| --- | --- |
| "Install the plugin from the marketplace." | "SSN has several customization paths; choose based on whether you need styling, overlay rendering, message logic, external data, or a new source." |
| "Just edit the core files." | "Use URL/CSS, custom overlay, custom.js, API, or Event Flow first; edit source files only for maintained development work." |
| "Put custom.js next to the hosted dock page." | "Hosted pages cannot load local disk custom.js; use a local/forked page or another integration path." |
| "Paste this JavaScript into your live setup." | "Review and test custom code in a private session first, and keep secrets out of scripts." |
| "Adding a source is just one selector." | "A first-class source needs payload compatibility, manifest routing, setup docs, and app/extension validation." |
| "Edit the standalone app fallback copy." | "Use `social_stream` as source of truth; the app fallback mirror is rebuilt/disposable." |

## Troubleshooting Matrix

| Symptom | First Checks |
| --- | --- |
| Custom overlay is blank | Same session everywhere; dock receives messages; correct transport/channel; listener parses SSN payload shape; browser source can load all assets. |
| `custom.js` does not run | Confirm the page is local/forked and can load the file; hosted pages cannot load disk files; check console errors. |
| Custom user function drops messages | Check return value; `false` blocks; thrown errors can break processing; test with simple pass-through first. |
| External app data does not arrive | API/WebSocket enabled; correct endpoint/session/channel; valid JSON; payload contains meaningful fields; reconnect logic works. |
| Send-back/replies do not work | Confirm the platform/source supports send-back in that mode; check login and source page state; do not assume parity across app/extension. |
| New source does not inject | Manifest match pattern, reload extension/app, correct frame, `run_at` timing, site URL variant, and content security restrictions. |
| Custom page works in browser but not OBS | OBS local-file permissions, mixed assets, URL encoding, cache, browser-source dimensions, and same session. |

## Intake Questions For Custom Work

Ask only what is needed:

- What do you want to change: look, message logic, external data, automation, or platform support?
- Which surface must it work in: Chrome extension, standalone app, hosted page, local page, OBS, API, or WebSocket?
- Does it need to be private to one stream or shared publicly?
- Is there any send-back/reply/moderation requirement?
- Does it involve API keys, webhooks, OAuth, private servers, or private chats?
- What exact page/file/URL are you using, with secrets redacted?
- What is the smallest test message or payload that should work?

## Route To Deeper Docs

- Styling and URLs: `url-option-examples.md`, `url-parameters.md`, `url-parameter-index.md`
- Custom overlays: `07-overlays-and-pages/custom-overlays.md`
- Plugin meaning and boundaries: `custom-plugins-and-extensions.md`
- Exact hook/source trace: `customization-source-trace.md`
- API/WebSocket: `api-command-examples.md`, `09-api-and-integrations/websocket-http-api.md`
- Event Flow: `09-api-and-integrations/event-flow-editor.md`
- New sources: `12-development/adding-a-source.md`, `12-development/shared-code-rules.md`
- Secrets and privacy: `privacy-security-and-secrets.md`
- Support boundaries: `free-paid-and-support-boundaries.md`
