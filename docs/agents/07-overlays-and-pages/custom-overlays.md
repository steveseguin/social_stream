# Custom Overlays

Status: heavy extraction pass started on 2026-06-24.

## Purpose

Document how to build custom SSN overlay pages that receive normalized SSN messages without modifying the extension background/runtime code.

If the request is only styling, filtering, automation, or a new input source, first route through `../13-reference/customization-path-decision-matrix.md` to avoid overbuilding a custom overlay.

## Source Anchors

- `docs/agents/13-reference/customization-path-decision-matrix.md`
- `social_stream/docs/customoverlays.md`
- `social_stream/docs/event-reference.html`
- `social_stream/sampleoverlay.html`
- `social_stream/themes/sampleoverlay_reverse.html`
- `social_stream/themes/**`
- `docs/agents/07-overlays-and-pages/theme-pages.md`

## Recommended Pattern

For visual browser/OBS overlays, prefer the hidden VDO.Ninja iframe bridge. This matches the built-in overlays and avoids requiring direct WebSocket handling in simple custom pages.

Core URL inputs:

- `session`: required SSN session ID.
- `password`: optional session password.
- `label`: usually `dock` for normal chat/events unless the overlay is meant to receive targeted messages.

Typical iframe pattern:

```text
https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=PASSWORD&view=SESSION&label=dock&noaudio&novideo&cleanoutput&room=SESSION
```

Built-in overlays often also use:

- `push`
- `vd=0`
- `ad=0`
- `autostart`
- `notmobile`
- `solo`

Use the existing page closest to the desired behavior as the source example.

For prebuilt theme selection, use `theme-pages.md` first:

- Normal chat themes render ordinary incoming chat.
- Featured-style themes under `themes/featured-styles/` wait for selected/featured message payloads.
- Wrapper themes such as `pretty.html` and Neutron embed `dock.html` with preset URL parameters.
- Package themes may depend on local assets, bundled CSS, or image files.

## Message Listener Pattern

Custom pages should listen for messages from the iframe and verify the source:

```javascript
window.addEventListener("message", function (event) {
  if (event.source !== iframe.contentWindow) return;
  if (event.data &&
      event.data.dataReceived &&
      event.data.dataReceived.overlayNinja) {
    processIncomingSSNMessage(event.data.dataReceived.overlayNinja);
  }
});
```

Do not accept every `window.postMessage` event blindly. Other frames/pages can send messages too.

## Payload Shape

Normal chat/event payloads commonly include:

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

Agents should keep payload compatibility broad. Fields vary by platform and event. A custom overlay should be resilient when optional fields are missing.

Important rule from existing docs: reserve `event` for system notifications or action/event payloads. Normal chat messages should leave `event` unset or false so overlays do not mistake chat for alerts.

## WebSocket Pattern

WebSocket mode is more advanced and better for tools or integrations than simple visual overlays.

Common server:

```text
wss://io.socialstream.ninja
```

API variant used by several tool pages:

```text
wss://io.socialstream.ninja/api
```

Extension variant used by several pages:

```text
wss://io.socialstream.ninja/extension
```

For receiving normal extension messages, examples commonly join with:

```json
{ "join": "SESSION", "out": 3, "in": 4 }
```

Some tools use different channels. Do not reuse channel pairs blindly; copy from the closest built-in page.

## Sending Commands Back

Custom pages can send payloads back through the iframe:

```javascript
iframe.contentWindow.postMessage({
  sendData: { overlayNinja: commandObject },
  type: "pcs"
}, "*");
```

For targeted replies to a specific peer, some built-in tools use `type: "rpcs"` and a `UUID`.

Only send commands when the receiving page/background path is known to handle them. A chat overlay should not invent new command shapes without corresponding runtime support.

## Sample Overlay Behavior

`sampleoverlay.html` is a chat overlay example with source comments for AI/code editing.

It supports:

- `session`
- `password`
- `reverse`
- `deleteonlylast`
- `limit`, default 20
- `showtime`, default 30000 ms
- `fadezone`
- `server`
- `server2`
- `localserver`

It renders:

- avatar
- name
- source icon
- badges
- membership
- chat text
- donation
- content image

It removes oldest messages after `limit`, fades old messages after `showtime`, and supports reverse mode where new messages insert at the top.

The WebSocket fallback joins:

```json
{ "join": "SESSION", "out": 3, "in": 4 }
```

## Reverse Sample

`themes/sampleoverlay_reverse.html` is a reverse-scroll variant. It keeps newest messages pinned to the top and pushes older messages downward. Its source comments warn not to modify the scroll logic without testing.

Use this when a user wants top-down chat rather than the default bottom-up stack.

## Styling Options

Custom overlays should prefer URL-driven styling and CSS variables where practical.

Common parameters to support or copy from existing overlays:

- `css`: external CSS URL.
- `base64css`, `b64css`, `cssbase64`, `cssb64`: embedded CSS.
- `font`
- `googlefont`
- `scale`
- `limit`
- `showtime`
- `fadeout`
- `hidesource`
- `onlytype`
- `hidetype`
- `sources`
- `hidesources`
- `sourceids`
- `hidesourceids`
- `donationsonly`
- `eventsonly`
- `hidebots`

Not all built-in overlays support all of these. They are common conventions, not a guaranteed global standard.

Theme pages add their own local options such as `reverse`, `fadezone`, `bigbubbles`, `autoflip`, `denseparticles`, `fastype`, `gaming`, `retro`, `darkmode`, `style`, and `timer`. Use `theme-pages.md` or the exact theme source before promising a parameter.

## Security And Safety

Use `textContent` for untrusted user text unless the overlay intentionally supports SSN's already-normalized HTML/emote markup.

If inserting `chatmessage` with `innerHTML`, remember:

- Some source scripts preserve HTML for emotes/images when text-only mode is off.
- Custom user-generated HTML can create XSS risk if not sanitized.
- Use a sanitizer or strict rendering logic if the page is shared publicly.

Always validate:

- `event.source` for iframe messages.
- Payload shape before reading fields.
- Image URLs before blindly inserting them into style attributes.

Do not modify `background.js` for a normal custom overlay. Build against the existing message bridge and payload contract.

## Performance Rules

For active streams:

- Cap displayed messages.
- Remove old DOM nodes.
- Batch expensive layout updates.
- Avoid synchronous work in every message when chat volume can spike.
- Keep image sizes constrained.
- Use CSS transitions rather than heavy JS animations.

`sampleoverlay.html` is designed around these rules with max message count, fading, image limits, and controlled scroll transforms.

## Common Mistakes

Overlay receives nothing:

- Missing or wrong `session`.
- Wrong `password`.
- Wrong `label`; use `dock` for normal chat unless targeting another feed.
- The source tab/app is not connected to the same session.

Works in a browser but not OBS:

- OBS Browser Source cache still has an old URL.
- Browser Source dimensions are too small.
- Local files may need a server if they import relative assets or hit browser restrictions.
- Audio autoplay/monitoring settings differ in OBS.

Messages render as raw HTML or break layout:

- Use text-only mode or sanitize before `innerHTML`.
- Limit image sizes.
- Handle missing fields.

WebSocket overlay receives commands but not chat:

- Wrong server endpoint or channel pair.
- SSN setting for sending chat to API server is disabled.
- Page joined the API channel but the extension is only sending through iframe/VDO path.

## Remaining Extraction Targets

- Render and validate representative theme pages from `theme-pages.md`, including local-file OBS behavior.
- Review `samplefeatured.html` and any new sample/theme pages if present in future passes.
- Add a minimal safe overlay template that uses `textContent` by default.
