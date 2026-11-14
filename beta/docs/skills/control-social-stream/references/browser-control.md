# Browser controls

Enable **File > Local AI / Automation**, restart SSApp, and connect using **Copy MCP Setup**.
The same controls are available through `POST /api/v1/command` on the loopback API.
Use SSApp 0.4.38 or newer, with API 1.4.1 and MCP adapter 1.3.1. Earlier 0.4.37
development builds may expose some browser commands; check their advertised capabilities.

## Choose a surface

Call `ssapp_list_browser_targets` (`listBrowserTargets`) and choose a `targetId`.
Targets identify browser contents in this running app, including the main UI, source
windows, sign-in windows, popups and embedded views. Each entry includes its owning
`windowId`, available source ID, title, visibility, loading state and parent window ID.
List again after opening or closing a window. Virtual sources without browser contents
use the existing source lifecycle and event tools.

All actions affect the selected target. Native browser input works in hidden windows
without moving the desktop pointer or showing the window. Showing or focusing a window
is an explicit operation and is unavailable in headless mode.

## Observe and act

In SSApp 0.4.40 / API 1.6.0, screenshot payloads also contain `page.redactedUrl`
and `page.title` for the captured page. Private human takeover pauses browser
tools until explicit handback; use `ssapp_get_human_control_status` while waiting.
See [human-control.md](human-control.md) for sign-in handoff.

| MCP tool | HTTP command | Use |
| --- | --- | --- |
| `ssapp_browser_screenshot` | `captureBrowserScreenshot` | Viewport image, screenshot ID and coordinate mapping |
| `ssapp_browser_inspect` | `inspectBrowserTarget` | Visible text, frames and element references |
| `ssapp_browser_interact` | `interactBrowserTarget` | Click, focus, scroll, fill or press a basic key using an element reference |
| `ssapp_browser_input` | `browserInput` | Native mouse, keyboard and touch sequences |
| `ssapp_browser_navigate` | `navigateBrowserTarget` | Navigate, back, forward, reload, stop |
| `ssapp_browser_window` | `setBrowserTargetWindow` | Show, hide, focus, minimize, maximize, restore, resize, close |
| `ssapp_browser_choose_files` | `chooseBrowserFiles` | Set a browser upload input to authorized local files |
| `ssapp_browser_frame_stream` | `getBrowserFrameStream` | Get a live-view endpoint |
| `ssapp_list_app_menu_items` | `listAppMenuItems` | Application menu and a target's context menu |
| `ssapp_invoke_app_menu_item` | `invokeAppMenuItem` | Invoke a listed menu item |

Mutation calls require `confirm: true`. This records authorization for the user's task;
do not ask for fresh permission for each action within that task.

Screenshots return MCP image content and structured metadata. If the model chooses a point
on the image, pass `screenshotId` with the image's pixel coordinates. SSApp maps those
coordinates to the page viewport, including resized screenshots and browser zoom.
Without `screenshotId`, coordinates are CSS pixels relative to the top-left of the target
viewport. They are never desktop coordinates. Screenshot IDs expire after two minutes
and are invalidated by navigation or viewport/scale changes. Re-observe if the page moves.

Example HTTP command, using values returned by discovery and screenshot capture:

```json
{
  "action": "browserInput",
  "value": {
    "targetId": "wc:7",
    "screenshotId": "SCREENSHOT_ID",
    "actions": [
      { "action": "click", "x": 180, "y": 120 },
      { "action": "keypress", "key": "ControlOrMeta+a" },
      { "action": "type", "text": "Search text" },
      { "action": "keypress", "key": "Enter" }
    ],
    "confirm": true
  }
}
```

Input batches accept up to 64 actions:

- `click`, `doubleClick`, `move`, `mouseDown`, `mouseUp`: `x`, `y`, optional `button` and `modifiers`.
- `scroll`: `x`, `y`, `deltaX` and/or `deltaY`. Positive deltas scroll right/down.
- `drag`: `path` containing at least two `{x,y}` points, optional button/modifiers and `durationMs`.
- `type`: Unicode `text` inserted at the focused caret. Click the intended field first.
- `keypress`: a DOM key name or chord, such as `Enter`, `Control+a`, `Shift+ArrowLeft`, or `ControlOrMeta+End`.
- `keyDown`, `keyUp`: one key; keep held-key gestures inside one batch.
- `touchStart`, `touchMove`: `points` containing `{id,x,y}` entries. IDs must be unique.
- `touchEnd`, `touchCancel`: no points. A `touchStart`/move/end sequence can use multiple contacts.
- `wait`: `durationMs`, up to 2000 per action. Total explicit delays are limited to 10 seconds per batch.

Modifiers are `Alt`, `Control`, `Meta`, `Shift`, or `ControlOrMeta`. `durationMs` sets drag
duration; on other actions it waits after the action. Held keys, buttons and touches are
released when the batch ends, including failure. Input results report completed actions.
An interrupted or timed-out action may have taken effect: inspect before retrying.

Clicks target the rendered surface, including iframes and canvas. Semantic inspection
provides per-frame text and element refs; do not treat frame-local element positions as
top-level screenshot coordinates. Element-ref fill continues to exclude password/file
fields. Native input can operate sign-in fields; use existing sessions and hand control
to the user when authentication needs their participation.

## Navigation, menus and files

`navigateBrowserTarget` accepts `goto` with an HTTP(S) URL, or `back`, `forward`, `reload`,
and `stop`. Existing navigation handling remains in effect. An accepted response means
the request was issued; inspect again to verify the final page. `resize` uses window
content dimensions in Electron device-independent pixels, which can differ from CSS
viewport dimensions when zoom is changed.

Application menus use the `menuPath` and exact `label` from `listAppMenuItems`.
After a browser-input right click opens a native context menu, list with `targetId` and
use the returned context `menuId`, path and label. The automation context menu is exposed
through these tools; ordinary user context menus retain their normal behavior.
Context menu references expire after one minute. Native JavaScript and app dialogs use
`getPendingAppDialogs`, `waitForAppDialog` and `respondToAppDialog`. These commands remain
available when a prompt blocks a page.

For an HTML upload control, call `chooseBrowserFiles` with `targetId`, CSS `x`/`y`, and
`paths` containing the authorized absolute local file paths. If coordinates come from
a screenshot, multiply them by its `inputScale.x` and `inputScale.y` first. Point to the
HTML file input or its associated label. Multiple paths require a multi-file input.
For an app's open/save dialog use `respondToAppDialog`.

## Live view

`getBrowserFrameStream` returns a relative endpoint such as
`/api/v1/browser/frames/wc%3A7?fps=2&maxWidth=1280`. Open it on the same loopback API origin.
It returns multipart JPEG frames and runs only while connected. Disconnect to stop.
There is no audio or desktop capture. A client can request 1–5 frames per second,
with at most two simultaneous streams. Slow clients apply backpressure and are disconnected
if they do not drain. Use a fresh screenshot, with its coordinate mapping, for input.
