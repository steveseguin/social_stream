# Adding A Source

Status: heavy extraction pass started from manifest/source patterns. This is a developer guide, not a full code tutorial.

## Source Anchors

- `sources/*.js`
- `sources/websocket/*.html`
- `sources/websocket/*.js`
- `sources/generic.js`
- `manifest.json`
- `background.js`
- `api.md`
- `docs/event-reference.html`
- `docs/js/sites.js`
- `README.md`
- `custom_sample.js`
- `sample_wss_source.html`
- `docs/agents/13-reference/customization-path-decision-matrix.md`
- `C:\Users\steve\Code\ssapp\AGENTS.md`

## Before Adding A Source

Start with `../13-reference/customization-path-decision-matrix.md` when the user says "plugin", "custom source", or "integration" without a clear maintainer-level platform request. Many requests fit URL/CSS, a custom overlay, API/WebSocket input, Event Flow, or a local custom hook better than a first-class source file.

Confirm the intended integration type:

| Integration Type | Use When | Typical Files |
| --- | --- | --- |
| DOM content script | Chat is visible in a web page or popout | `sources/platform.js`, `manifest.json` |
| Static/manual picker | User manually selects a post/comment | `sources/static/platform.js`, manifest entry |
| Injected helper | Need page-context access to WebSocket/local variables | `sources/inject/*.js`, `web_accessible_resources`, content script |
| WebSocket/API source page | Platform has cleaner API/socket/token flow | `sources/websocket/platform.html`, `sources/websocket/platform.js`, manifest entry |
| External custom source | Third-party app can emit SSN JSON | API or `sample_wss_source.html` pattern |
| Generic proof of concept | Platform has ordinary chat DOM | Start with `sources/generic.js` ideas |

Do not add a full source when a small user-specific custom script or API integration is enough.

## Source File Pattern

Most DOM sources follow this shape:

1. Wrap code in an IIFE to avoid leaking globals.
2. Define helpers for text extraction, HTML escaping, image/avatar handling, and deduplication.
3. Request SSN settings:

```javascript
chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function(response) {
  // response.state, response.streamID, response.settings
});
```

4. Watch the chat container with `MutationObserver` or platform-specific events.
5. Parse each new message into an SSN payload.
6. Send the payload:

```javascript
chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function() {});
```

7. Listen for responses/commands if the source supports sending chat back to the platform.

Common field baseline:

```javascript
const data = {};
data.chatname = name;
data.chatmessage = message;
data.chatimg = avatarUrl || "";
data.chatbadges = badges || "";
data.backgroundColor = "";
data.textColor = "";
data.contentimg = "";
data.hasDonation = "";
data.membership = "";
data.textonly = settings.textonlymode || false;
data.type = "platformname";
data.id = Date.now() + Math.floor(Math.random() * 1000000);
```

Keep `type` lowercase and stable. It controls default source icon lookup and downstream CSS selectors.

## Manifest Changes

Add or update a `content_scripts` entry in `manifest.json`:

```json
{
  "js": ["./sources/platform.js"],
  "matches": ["https://example.com/live/*"]
}
```

Also check whether the source needs:

- `host_permissions` entries for API/fetch calls or broader URL access.
- `web_accessible_resources` if the page needs to load extension-packaged scripts, providers, SDKs, or injected helpers.
- `run_at` if the script must run before normal document idle timing.
- `all_frames` if chat is embedded in an iframe.
- Equivalent handling for store/MV3/firefox build variants if those files differ.

Current `manifest.json` already has many source entries and broad host permissions. Copy the local pattern for similar sources rather than inventing a new structure.

## Icons And Source Metadata

For a new `type`, add/confirm:

- Source icon in `sources/images/`.
- Any public supported-sites metadata in `docs/js/sites.js`.
- README support note if the setup is user-facing or unusual.
- Event reference entry if the source emits normalized events.
- Platform agent doc if it is a major source or has recurring support needs.

If `sourceImg` is used, make sure it represents a sub-source/channel and does not duplicate the default `type` icon unnecessarily.

## Payload Contract

Follow the documented payload contract in `api.md` and `docs/event-reference.html`.

Important fields:

- `chatname`: display name.
- `chatmessage`: message body. Sanitized HTML is allowed only when `textonly` is false.
- `chatimg`: avatar URL or small data URI.
- `type`: lowercase source identifier.
- `textonly`: applies only to `chatmessage`; true means render `chatmessage` as plain text, false means `chatmessage` may contain sanitized/renderable HTML. Do not use it to describe `chatname`, `membership`, `hasDonation`, or other normal text fields.
- `hasDonation`: donation/gift/bits amount label.
- `membership`: member/subscription state.
- `subtitle`: short secondary membership/donation detail.
- `event`: normalized event name when this is not a normal chat message. Do not set `event: "donation"` just because a normal chat/tip row has `hasDonation`.
- `meta`: structured extra details for event/UI/integration consumers only when that data is actually needed and no existing field already represents it.
- `id`: stable-enough unique message ID for deletion/dedup/routing.
- `userid`: platform user ID when available.

Do not create new top-level fields casually. Use existing fields first; put source-specific details in `meta` only when they need to be transmitted and are not already sufficiently handled.

## Event Support

Use `docs/event-reference.html` as the source of truth for normalized event names and field meanings.

Confirmed rules from current docs:

- To hide events in dock/featured pages, users can use `&hideevents`, `&hideallevents`, or `&filterevents=...`.
- Donation-style messages should still populate `hasDonation` even if `event` is blank or source-specific.
- Normal chat/tip rows with donations should usually leave `event` blank; `hasDonation` is the donation signal.
- YouTube, Twitch, and Kick need WebSocket mode for many richer stream events.
- DOM capture is usually enough for chat and limited system events, but not always enough for follows, raids, subscriptions, or detailed gifts.

When adding events:

- Reuse existing event names when possible.
- Document source-specific gaps.
- Include sample payloads in the event reference for major platforms.
- Keep human labels short enough for overlays.

## Sending Chat Back

Some sources support auto-reply or API `sendChat` behavior. Before implementing outbound chat:

- Verify the page has an input field and submit path that can be automated safely.
- Check platform restrictions and rate limits.
- Respect source settings and user toggles.
- Avoid sending duplicate replies from multiple open tabs.
- Confirm Firefox/app support if using Chromium-only APIs.

Auto-responder/debugger behavior may be Chromium-only and can show the browser debugging bar unless Chrome is launched with `--silent-debugger-extension-api`.

## WebSocket/API Source Pages

Use `sources/websocket/` for source pages that connect to platform APIs or sockets.

Typical pieces:

- HTML page for configuration/login/user input.
- JS source that connects to platform API/socket.
- CSS when needed.
- Manifest entry that injects the helper on hosted/local source-page URLs.
- Provider/shared utility entries in `web_accessible_resources` if loaded from extension package.

Supported local/dev URL patterns in manifest often include:

- `https://socialstream.ninja/sources/websocket/platform*`
- `https://beta.socialstream.ninja/sources/websocket/platform*`
- `file:///.../sources/websocket/platform.html*`
- `http://localhost:8080/*/platform.html*`
- `http://localhost:8181/*/platform.html*`

Match the existing hosted/local/beta pattern for the closest source.

## Standalone App Compatibility

Per `ssapp` project instructions, Social Stream source edits belong in `C:\Users\steve\Code\social_stream`. The standalone app loads Social Stream source files remotely from that repo at startup. Do not make source changes in `ssapp/resources/social_stream_fallback` during normal work; that folder is a rebuilt fallback bundle.

When adding a source, consider:

- Does the source need normal browser cookies/session behavior that Electron may not have?
- Does OAuth/sign-in work inside Electron, or does it need an app-side helper?
- Does the app need source URL parsing or default-source metadata updates?
- Does the source assume `chrome.*` extension APIs that need app shims?
- Does a WebSocket source page work better for app mode?

If app behavior changes, verify in the actual app. Syntax checks are not enough for this project.

## Testing Checklist

Minimum source validation:

- Load the exact matching URL in the extension.
- Confirm the extension is enabled.
- Confirm `getSettings` succeeds and respects `textonlymode`.
- Send a normal chat message and inspect dock payload.
- Confirm duplicate messages are not emitted.
- Confirm avatars, badges, membership, donation, and content images render when available.
- Confirm message deletion/moderation sync if the source supports it.
- Confirm sending chat back, if implemented.
- Confirm visibility/background behavior.
- Confirm hosted/local/beta WebSocket source URL patterns if relevant.
- Confirm standalone app behavior if the source is expected to work there.

Docs/support updates:

- Update README if setup steps matter to users.
- Update `docs/js/sites.js` if the public site list should include it.
- Update `docs/event-reference.html` if it emits standardized events.
- Update agent docs when the source is likely to become a support topic.

## Code Review Risks

Look specifically for:

- DOM selectors that are too broad and capture duplicates.
- Message HTML inserted without escaping when `textonly` is true.
- Huge data URIs or avatars/content images.
- Missing `type` or inconsistent source type names.
- Unbounded Maps/Sets/timeouts.
- MutationObservers attached to `document.body` without filtering.
- Reconnect loops with no backoff.
- Chat send automation that can spam or duplicate replies.
- Tokens/API keys logged to console or embedded in committed files.
- Platform-specific assumptions that break extension/app parity.

## Useful References

- `sources/generic.js`: broad DOM-capture reference.
- `sources/bandlab.js`, `sources/bigo.js`, `sources/chatroll.js`: straightforward DOM-source patterns.
- `sources/websocket/youtube.js`, `sources/websocket/twitch.js`, `sources/websocket/kick.js`: richer source-page patterns.
- `sample_wss_source.html`: minimal external-source API pattern.
- `custom_actions.js`: message-processing customization template.
- `api.md`: payload and API command reference.

## Follow-Up Extraction Needs

- Create a per-source implementation matrix from `manifest.json`.
- Add exact app-side source URL parsing notes from `ssapp` tests/code.
- Build a source template with placeholders and required manifest/docs changes.
- Add examples for injected-helper sources such as StreamElements/Whatnot/VPZone.
