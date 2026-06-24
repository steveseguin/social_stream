# Featured Overlay

Status: heavy extraction pass started from `featured.html`, `api.md`, `parameters.md`, README, and featured-style theme docs.

## Source Anchors

- `featured.html`
- `samplefeatured.html`
- `api.md`
- `parameters.md`
- `README.md`
- `tts.js`
- `themes/featured-styles/README.md`
- `themes/featured-styles/*.html`

## Role

`featured.html` is the main selected-message overlay. It shows the message chosen from `dock.html`, auto-show rules, or API commands. It is usually loaded as an OBS Browser Source and may look blank or transparent until a message is featured.

Typical URL:

```text
https://socialstream.ninja/featured.html?session=SESSION_ID
```

Support note: a blank page is normal when no message is currently featured, especially with transparent styling.

## Basic Workflow

1. Start the extension/app/source.
2. Open `dock.html?session=SESSION_ID`.
3. Open `featured.html?session=SESSION_ID` in OBS or a browser.
4. Click a message in the dock or enable auto-show.
5. Use the clear button or `showtime` to remove the featured message.

If clicking a dock message does nothing, verify session ID match before debugging CSS.

## Connection And Server Parameters

`api.md` documents several server connection modes:

| Parameter | Use |
| --- | --- |
| `server` | Connects featured page to the API server path. |
| `server2` | Alternate server routing mode. |
| `server3` | Alternate server routing mode for extension/server routing. |
| `password` | Session password when configured. |
| `lanonly` | Restricts peer routing to LAN-only behavior where supported. |
| `label` | Names the featured instance for targeted commands. |

For normal users, a plain `session` URL is the first thing to test. Add server/label parameters only when the workflow requires them.

## Display Timing And Animation

Common parameters:

| Parameter | Meaning |
| --- | --- |
| `showtime` | Auto-hides the message after the given number of milliseconds. |
| `fadein` / `fadeout` | Enables fade effects. |
| `swipeleft`, `swiperight`, `swipeup` | Slide-in direction variants. |
| `animatein`, `animateout` | Uses named animation styles. |
| `typewriter` | Types message text letter by letter. |
| `queuetime` | Queues featured messages and displays them sequentially. |
| `center` | README mentions centered featured messages for the featured overlay. |

Example:

```text
featured.html?session=SESSION_ID&showtime=20000&fadein
```

## Filtering

Documented featured filters include:

- `onlyshowdonos`
- `hideDonations`
- `hideevents`
- `filterevents`
- `hideTwitch`
- `onlyTwitch`
- `onlyFrom`
- `hideFrom`
- `filterfeaturedusers`

Use these when one featured overlay should show only donations, one platform, approved users, or selected event types.

## Message Payload

Minimum payload:

```json
{
  "chatname": "Username",
  "chatmessage": "Message content",
  "type": "external"
}
```

Common display fields:

- `chatimg`
- `chatbadges`
- `contentimg`
- `hasDonation`
- `membership`
- `title`
- `subtitle`
- `sourceImg`
- `sourceName`
- `nameColor`
- `textColor`
- `backgroundColor`
- `event`
- `meta`

Use `docs/agents/05-message-flow-and-event-contracts.md` and `api.md` for the full contract.

## API Actions

`api.md` documents these featured actions:

| Action | Purpose |
| --- | --- |
| `content` | Display a new featured content object. |
| `clear` | Clear the current featured message. |
| `toggleTTS` | Toggle TTS. |
| `tts` | Set or toggle TTS state. |

Example WebSocket payload:

```json
{
  "action": "content",
  "value": {
    "chatname": "ExampleUser",
    "chatmessage": "Hello, featured chat!",
    "type": "twitch"
  }
}
```

Example HTTP clear:

```text
https://io.socialstream.ninja/SESSION_ID/clearOverlay
```

## TTS

`featured.html` loads `tts.js`. TTS can be enabled with:

```text
featured.html?session=SESSION_ID&speech=en-US
```

Common TTS parameters:

- `speech` / `tts`
- `volume`
- `rate`
- `pitch`
- `voice`
- provider keys/settings from `parameters.md`

OBS note: provider/browser TTS can usually be captured with OBS Browser Source audio. Free system Web Speech TTS may play through the OS output and require virtual cable/application/desktop audio capture.

## Styling

Fast styling options:

- URL parameters from `parameters.md`.
- OBS Browser Source custom CSS field.
- `css` or `cssb64` URL parameters.
- Fork/local copy for code-level changes.
- `themes/featured-styles/*.html` for prebuilt modern/animated/3D/particle styles.

Theme docs list examples:

```text
featured-modern.html?session=SESSION_ID&style=glass
featured-animated.html?session=SESSION_ID&style=bounce
featured-3d.html?session=SESSION_ID&style=cube
featured-particles.html?session=SESSION_ID&style=matrix
```

Featured-style theme parameters include:

- `session` / `room`
- `style`
- `password`
- `showtime`
- `server`
- `exit`
- `tts`
- `voice`
- `pitch`
- `rate`

## OBS Setup

Common setup:

1. Add an OBS Browser Source.
2. Paste the `featured.html?session=...` URL.
3. Use a size such as `1280x600`, `1920x600`, or full canvas for themed overlays.
4. Enable browser-source audio control when using browser/provider TTS.
5. Refresh the source after URL or CSS changes.

For full-canvas themed overlays, `1920x1080` is commonly suggested by the theme docs.

## Common Support Issues

| Symptom | Likely Cause | First Checks |
| --- | --- | --- |
| Blank overlay | No featured message yet | Click a dock message or send API `content`. |
| White browser page | Viewing a transparent/empty overlay outside OBS | Test after featuring a message; check CSS/background. |
| Dock has messages but overlay does not | Wrong session or stale OBS source | Match session ID; refresh OBS Browser Source. |
| Message appears then vanishes | `showtime` or clear action | Remove/raise `showtime`; check automation/API. |
| All overlays respond | Missing `label` targeting | Add `&label=` and target API commands. |
| TTS silent | Browser audio gate or provider issue | Click page in browser, check OBS audio control, test provider. |
| Local custom CSS/page fails on macOS/Linux OBS | Local-file behavior limitation | Use hosted page or OBS Browser Source CSS. |
| Wrong style/font | CSS precedence | Add `!important`, check loaded CSS URL/base64 value. |

## Follow-Up Extraction Needs

- Full parameter matrix specific to `featured.html`.
- Line-level trace of queue/timeouts and TTS lifecycle.
- Current compatibility matrix for every `themes/featured-styles` overlay.
- Rendered examples/screenshots for blank/transparent troubleshooting.
