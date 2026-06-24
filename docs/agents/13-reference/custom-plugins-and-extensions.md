# Custom Plugins And Extensions

Status: heavy reference pass started. This page explains what "plugin" means in SSN support answers.

## Source Anchors

- `README.md`
- `docs/commands.html`
- `docs/customoverlays.md`
- `parameters.md`
- `api.md`
- `custom_sample.js`
- `custom_actions.js`
- `sample_wss_source.html`
- `sources/generic.js`
- `sources/README.md`
- `manifest.json`
- `docs/agents/08-platform-sources/generic-and-custom-sources.md`
- `docs/agents/12-development/adding-a-source.md`

## Short Answer

SSN supports many plugin-like customization paths, but normal users should not be told there is one official plugin marketplace or installable plugin package flow.

## Choose The Right Customization Path

| Goal | Best Path | Skill Level |
| --- | --- | --- |
| Change colors/fonts/layout slightly | URL parameters or OBS custom CSS | Beginner |
| Use a prebuilt look | Themes/templates | Beginner |
| Build a fully custom visual overlay | Custom overlay HTML from sample overlay | Intermediate |
| Add local dock/featured behavior | Local `custom.js` from `custom_sample.js` | Intermediate |
| Modify/filter/reply to every message | Uploaded/enabled `window.customUserFunction` pattern from `custom_actions.js` | Advanced |
| Send data from a private app/bot | API/WebSocket/SSE or `sample_wss_source.html` pattern | Intermediate/advanced |
| Build automation visually | Event Flow editor | Intermediate |
| Integrate Streamer.bot/Companion/StreamDeck | Existing external integration pages/modules | Beginner/intermediate |
| Add a first-class source | New `sources/*.js` or `sources/websocket/*` plus manifest/docs | Developer |

## Path 1: URL Params And CSS

Use this first for appearance and simple behavior:

- URL params: `darkmode`, `scale`, `compact`, `showtime`, `autoshow`, filters, TTS, automation flags.
- OBS browser-source CSS: quick visual styling without file edits.
- `&css=` or `&b64css=`: URL-driven CSS when supported.

Best for:

- Colors/fonts.
- Hiding icons/timestamps/avatars.
- Basic animation/layout.
- Auto-show/queue/filter behavior.

Limit:

- It cannot rewrite source capture logic or create new platform support.

## Path 2: Custom Overlay

Use a custom overlay when the user wants a completely different visual output.

Starting points:

- `sampleoverlay`
- `docs/customoverlays.md`
- `docs/agents/07-overlays-and-pages/custom-overlays.md`

Typical pattern:

1. Open a hidden VDO.Ninja iframe or connect by WebSocket.
2. Listen for SSN payloads.
3. Render `chatname`, `chatmessage`, `chatimg`, `contentimg`, `hasDonation`, `event`, and `meta`.
4. Keep the same `session` as the sender.

Minimal iframe listener:

```javascript
window.addEventListener("message", (event) => {
  const payload = event.data && event.data.dataReceived && event.data.dataReceived.overlayNinja;
  if (payload !== undefined) {
    handlePayload(payload);
  }
});
```

Best for:

- Branded stream layouts.
- Game-themed chat displays.
- Special donation/member visuals.
- Full CSS/HTML control.

Limit:

- No built-in dock features unless the user implements them.

## Path 3: Local `custom.js`

`custom_sample.js` can be renamed to `custom.js`.

Main hooks:

```javascript
function applyCustomActions(data) {
  return data;
}

function applyCustomFeatureActions(data) {
  return data;
}
```

Important rules:

- The local page must be able to load local `custom.js`.
- Hosted `https://socialstream.ninja/dock.html` cannot load a user's disk file.
- The sample includes an `&auto1` trigger that responds to message `1`.
- Returning `null` from `applyCustomActions` stops processing for that message.

Best for:

- Stream-specific auto replies.
- Local experiments.
- Small dock/featured behavior changes.

Limit:

- Not a portable plugin package.
- Easy to break a live show with bad JavaScript.

## Path 4: Uploaded Custom User Function

`custom_actions.js` uses:

```javascript
window.customUserFunction = function(data) {
  return data;
};
```

Confirmed behavior:

- `background.js` has a default `customUserFunction`.
- When `settings.customJsEnabled` is true, incoming data can be passed through `customUserFunction(data)`.
- Returning modified `data` continues processing.
- Returning `false` can block/drop a message in the template pattern.
- Helper examples include `sendCustomReply(data, message)`.

Best for:

- Keyword replies.
- Message blocking/filtering.
- Custom VIP styling.
- Donation thank-yous.
- Lightweight moderation/routing experiments.

Risks:

- Bad code can drop messages.
- Auto replies can spam platforms.
- Secrets in custom scripts can leak.
- Test in a private session first.

## Path 5: External API / WebSocket Source

Use this when a separate app, bot, service, or script can emit SSN-shaped JSON.

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

Best for:

- Private donation/event sources.
- Local bots.
- CRM/dashboard integrations.
- Custom games.
- Tools that should not become browser content scripts.

Support checks:

- Session ID is correct.
- API toggles are enabled.
- Channel is correct.
- Payload has at least a meaningful message/content/event.
- Reconnection logic exists for WebSocket clients.

## Path 6: First-Class Source

Use this for a real platform integration.

Typical files:

- DOM source: `sources/platform.js`
- WebSocket/API source: `sources/websocket/platform.html` and `sources/websocket/platform.js`
- Manifest entries in `manifest.json`
- Icon in `sources/images/`
- Public site metadata in `docs/js/sites.js` when user-facing
- Event reference updates when emitting normalized events
- Agent docs if likely to become a support topic

Basic source payload fields:

```javascript
data.chatname = name;
data.chatmessage = message;
data.chatimg = avatarUrl || "";
data.chatbadges = badges || "";
data.hasDonation = "";
data.membership = "";
data.textonly = settings.textonlymode || false;
data.type = "platformname";
data.id = Date.now() + Math.floor(Math.random() * 1000000);
```

Developer rules:

- Keep `type` lowercase and stable.
- Prefer `meta` for source-specific details.
- Respect extension/app shared-code compatibility.
- Do not add remote executable code to the extension package.
- Update docs/tests where behavior changes.

## Event Flow As A Plugin-Like Tool

Event Flow lets users build automation without editing source files.

Good uses:

- Trigger alerts on gifts/rewards.
- Gate or throttle actions.
- Run OBS actions.
- Play media/TTS.
- Route events to external systems.

Boundary:

- Event Flow is not a platform-source SDK.
- Custom JS action support depends on runtime context and security restrictions.

## What To Tell Users Asking "Can I Make A Plugin?"

Recommended answer:

```text
Yes, but SSN has several customization paths rather than one plugin installer. For visuals, use URL params/CSS or a custom overlay. For message logic, use custom.js or custom_actions.js. For external data, send SSN-shaped JSON through the API/WebSocket. For a new platform, add a source file plus manifest/docs changes.
```

Then ask:

- Do you want to change the look?
- Do you want to react to messages?
- Do you want to send data from another app?
- Do you want to add a new platform?
- Does this need to work in the extension, standalone app, hosted pages, or all of them?

## Safety Checklist

- Never paste untrusted JavaScript into a live stream workflow.
- Keep API keys/tokens/session IDs out of screenshots and public repos.
- Test custom code with a private session.
- Rate-limit auto replies.
- Avoid platform automation that violates platform rules.
- Do not edit installed/unpacked files without keeping a copy, since updates can overwrite changes.
- For first-class sources, test both extension and standalone app if both are expected to work.
