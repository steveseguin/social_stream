# Generic And Custom Sources

Status: heavy extraction pass started from repo docs, source examples, and custom script templates.

## Source Anchors

- `sources/generic.js`
- `sources/README.md`
- `sources/websocket/*.html`
- `sources/websocket/*.js`
- `sample_wss_source.html`
- `custom_sample.js`
- `custom_actions.js`
- `README.md`
- `docs/commands.html`
- `parameters.md`
- `manifest.json`

## What Counts As "Custom" In SSN

SSN has several customization paths. They solve different problems and should not be described as one single plugin system.

| Need | Recommended Path | Notes |
| --- | --- | --- |
| Change visual style | URL parameters or CSS | Best first step for overlay appearance. |
| Build a full custom visual surface | Custom overlay HTML | Use `sampleoverlay` or a fork/local HTML page. |
| Add custom dock/featured behavior | Local `custom.js` from `custom_sample.js` | Requires local/hosted page context that can load the file. |
| Filter/modify/respond to messages globally | Uploaded `custom_actions.js` style `window.customUserFunction` | Runs in the background processing path when enabled. |
| Send messages from an external source | API, WebSocket, or `sample_wss_source.html` pattern | Good for bots, tools, donation sources, and custom apps. |
| Add a first-class platform integration | New `sources/*.js` or `sources/websocket/*` files plus manifest/settings/docs | Developer workflow; see `12-development/adding-a-source.md`. |

Use precise wording in support answers: SSN supports scriptable customization and plugin-like workflows, but a normal user should usually choose one of the paths above rather than look for a package manager or marketplace.

## Generic DOM Capture

`sources/generic.js` is a broad DOM-capture script. It tries to recognize common chat/message structures rather than targeting one platform's exact markup.

Confirmed behavior from the current file:

- It defines broad message selectors such as chat/message/comment row classes and common test IDs.
- It has helper logic to collect content nodes, preserve images when not in text-only mode, and avoid obvious timestamp/metadata elements.
- It deduplicates repeated username/message pairs over a short time window.
- It builds SSN-style message objects with fields such as `chatname`, `chatmessage`, `textonly`, and `type`.
- It sends captured messages through `chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, ...)`.

Use generic capture when:

- A site has ordinary DOM chat and no special API/transport needs.
- The goal is quick proof-of-concept support.
- The source can tolerate imperfect selectors or needs a starting point for a proper source.

Avoid relying on generic capture when:

- The platform uses virtualized/shadow DOM that hides message data.
- Message identity/deletion/moderation sync matters.
- Events, gifts, donations, or membership metadata need normalized fields.
- The platform has a stable WebSocket/API path that gives cleaner data.

## Local `custom.js`

`custom_sample.js` documents a local `custom.js` path for dock/featured pages.

Pattern:

- Rename `custom_sample.js` to `custom.js`.
- Edit `applyCustomActions(data)` for dock behavior.
- Edit `applyCustomFeatureActions(data)` for featured overlay behavior.
- Open the local/hosted `dock.html` or `featured.html` that can load that custom file.

Important limits:

- The sample says this is not uploaded through the menu.
- The sample says it will not work from hosted `https://socialstream.ninja/dock.html` when expecting a local `custom.js`.
- The sample uses URL parameters such as `&auto1` to opt into behavior.
- Returning `null` from `applyCustomActions(data)` stops processing; returning the modified `data` continues.

Good use cases:

- Auto-response experiments.
- Local-only helper behavior.
- Stream-specific message tweaks.
- Testing a custom dock/featured behavior before building a full overlay.

## Uploaded Custom User Function

`custom_actions.js` is a template for a custom user function uploaded/enabled through SSN settings.

Entry point:

```javascript
window.customUserFunction = function(data) {
  return data;
};
```

Confirmed processing path:

- `background.js` defines a default `window.customUserFunction(data)`.
- When `settings.customJsEnabled` is true, the background processing path calls `customUserFunction(data)`.
- The template shows returning modified `data` to continue processing.
- The template shows returning `false` to block/drop a message.
- The template can call helpers such as `sendCustomReply(data, message)`, which builds a response and sends it through `sendMessageToTabs(...)`.

Example tasks suited to this path:

- Block all-caps messages.
- Add custom VIP styling.
- Replace keywords.
- Track questions in memory.
- Send auto replies for simple commands.
- Forward donation metadata to a private webhook.

Agent warning: because this logic runs in the message-processing path, bad code can block messages or flood chat. Tell users to test with a low-risk session before using it live.

## Custom External Source Via WebSocket

`sample_wss_source.html` shows how a custom browser page can send SSN-shaped content into a session.

Core pattern:

1. Read `session`, `s`, or `id` from the URL.
2. Connect to `wss://io.socialstream.ninja` or `ws://127.0.0.1:3000` with `localserver`.
3. Join the room with an output/input channel pair.
4. Build a data object with SSN message fields.
5. Send it as JSON.

Minimal message fields:

```json
{
  "chatname": "steve",
  "chatmessage": "Some test message here.",
  "chatimg": "https://socialstream.ninja/sources/images/unknown.png",
  "type": "external",
  "textonly": true
}
```

Useful optional fields:

- `hasDonation`
- `membership`
- `contentimg`
- `chatbadges`
- `sourceName`
- `sourceImg`
- `event`
- `meta`
- `id`

Use this path when the source is already outside the browser extension, such as:

- A local bot.
- A private donation service.
- A dashboard or CRM.
- A custom game/app.
- A data source that can produce JSON but should not become an extension content script.

## WebSocket Source Pages

`sources/websocket/` contains source pages and helpers for services where an API/WebSocket path is cleaner than DOM capture.

Examples in the current folder include:

- `youtube.html` / `youtube.js`
- `twitch.html` / `twitch.js`
- `kick.html` / `kick.js`
- `facebook.html` / `facebook.js`
- `rumble.html` / `rumble.js`
- `irc.html` / `irc.js`
- `streamlabs.html` / `streamlabs.js`
- `bilibili.html` / `bilibili.js`
- `velora.html` / `velora.js`
- `vpzone.html` / `vpzone.js`
- `nostr.html` / `nostr.js`

These are often used when:

- The platform has an API/SDK/socket.
- OAuth or creator-owned tokens are required.
- Rich events are needed.
- DOM capture is unreliable.
- The standalone app needs a source page it can load directly.

## URL Parameters For Customization

Common custom-source/custom-overlay parameters:

- `session`, `s`, `id`: session ID.
- `password`: session password.
- `label`: target label for a page instance.
- `server`, `server2`, `server3`: custom WebSocket server routing.
- `localserver`: use local WebSocket server where supported.
- `css`, `cssb64`: custom CSS.
- `js`, `base64js`, `b64js`: custom JavaScript in trusted contexts.
- `postserver`, `putserver`: send selected/featured data to external endpoints.
- `h2rurl`, `h2r`, `spxserver`, `singular`: production graphics integrations.

Use `parameters.md` for the full list before answering exact parameter support.

## Support Triage

When custom behavior fails, ask:

- Is the user using hosted `socialstream.ninja` pages or local/forked files?
- Is the custom behavior meant for dock/featured, background processing, or an external source?
- Is the page using the same session ID?
- Is the API/server toggle enabled if using WebSocket/HTTP?
- Is the browser console showing JavaScript errors?
- Is the custom script returning `data`, `false`, or `null`?
- Did the user URL-encode custom JS/CSS/API values?
- Does the same workflow work with a simple `clearOverlay` or test message first?

## Safety Notes

- Treat user-supplied JavaScript as powerful and risky.
- Do not recommend pasting untrusted scripts into a live production stream.
- Session IDs and webhook URLs should not be shared publicly.
- Custom responses can get platform accounts rate-limited or banned if they spam chat.
- For platform ToS-sensitive automation, remind users to use bot/timed-message features responsibly.

## Follow-Up Extraction Needs

- Inspect `sampleoverlay` implementation and document exact custom overlay message listener pattern.
- Build a table of `sources/websocket/*` setup requirements.
- Mine support history for common custom JS mistakes.
- Document Lite customization separately if its behavior differs from the main extension/app pages.
