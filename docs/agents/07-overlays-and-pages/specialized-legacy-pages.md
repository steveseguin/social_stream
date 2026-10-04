# Specialized And Legacy Pages

Status: heavy extraction pass from `chat-overlay.html`, `minecraft.html`, `septapus.html`, and `shop_the_stream.html` on 2026-06-24.

Use this page when a user asks about a root HTML page that looks like a standalone feature but is actually a wrapper, skin, legacy custom renderer, or experimental integration surface.

## Source Anchors

- `chat-overlay.html`
- `minecraft.html`
- `septapus.html`
- `shop_the_stream.html`
- `aioverlay.html`
- `multi-alerts.js`

## Fast Routing

| User Asks About | What It Is | Use This First |
| --- | --- | --- |
| `chat-overlay.html` | Redirect wrapper into `aioverlay.html` with `overlay=chat-overlay` | `ai-cohost-pages.md` and AI/generated overlay docs. |
| `minecraft.html` | Minecraft-styled alert overlay skin powered by `multi-alerts.js` | `multi-alerts.md`. |
| `septapus.html` | YouTube-structured custom chat renderer for applying YouTube-style CSS | This doc plus custom overlay notes. |
| `shop_the_stream.html` | Experimental product-list overlay controlled by API actions or chat commands | This doc plus API/WebSocket docs. |

## `chat-overlay.html`

`chat-overlay.html` is not a separate chat overlay implementation in the current source. It is a tiny redirect page:

- Reads the current query string and hash.
- Adds `overlay=chat-overlay` if no `overlay` parameter is already present.
- Redirects to `aioverlay.html` with the updated query and original hash.

Support implications:

- If a user asks how `chat-overlay.html` works, route them to `aioverlay.html`/AI-generated overlay runtime behavior.
- Debug saved/generated overlay package loading, not this wrapper page.
- Keep any existing `session`, `label`, `server`, or `overlay` parameters in mind; the wrapper preserves query values and hash.

Typical URL:

```text
https://socialstream.ninja/chat-overlay.html?session=SESSION_ID
```

This becomes an `aioverlay.html` URL with `overlay=chat-overlay` unless another overlay name was provided.

## `minecraft.html`

`minecraft.html` is a Minecraft-styled alert page. The page contains CSS, markup, audio element, and script includes, then delegates alert behavior to:

- `tts.js`
- `./libs/colours.js`
- `./multi-alerts.js`

Support implications:

- Treat it as a themed alert overlay, not a Minecraft platform/source integration.
- Its event handling, alert classification, queue behavior, URL session handling, TTS, and server bridge behavior come from `multi-alerts.js`.
- Use `multi-alerts.md` for behavioral support questions.
- Use this page when the user wants Minecraft visual styling for stream alerts.

Typical URL:

```text
https://socialstream.ninja/minecraft.html?session=SESSION_ID
```

First checks:

- Confirm the source/platform emits an event that `multi-alerts.js` classifies as an alert.
- Confirm the page is open on the same session.
- If alert behavior differs from `multi-alerts.html`, compare CSS/theme effects before assuming event logic changed.

## `septapus.html`

`septapus.html` is a YouTube-structured chat overlay renderer. It builds DOM nodes using YouTube-like custom element names such as text message, paid message, paid ticker, and membership renderers so YouTube-style CSS can be applied.

Important behavior:

- Without `session`, it shows a setup form and custom CSS input.
- The setup form writes `session`, optional `password`, and optional `base64css` into the URL.
- With `session`, it joins the SSN room through an invisible VDO.Ninja iframe.
- Normal iframe mode uses `label=dock`.
- It prepends chat messages into a YouTube-style chat list and keeps only about 20 visible messages.
- Donation payloads create YouTube-style paid message elements and, for parsed amounts of at least 5, paid ticker elements.
- Membership payloads create a legacy paid-message style sponsor entry.
- Regular chat creates a text-message renderer with badge/author-type handling.
- Supports `font`, `googlefont`, `css`, and base64 CSS aliases.

URL parameters observed:

- `session`
- `password` via setup form, but see caveat below
- `font`
- `googlefont`
- `css`
- `base64css`, `b64css`, `cssbase64`, `cssb64`

Source-observed caveat:

- The setup UI can add `password` to the URL, but the runtime branch initializes `password` to `"false"` and this pass did not find URL parsing for `password`. Do not promise password-protected room support for `septapus.html` unless current source is rechecked.

Support checks:

- If the user wants normal SSN dock behavior, use `dock.html` instead.
- If they want YouTube-style CSS compatibility, `septapus.html` may be the intended page.
- If custom CSS does not work, test with a short CSS sample first; long CSS in the URL can be trimmed by the setup page.
- If messages appear but YouTube-specific styling looks off, explain that SSN normalizes multi-platform payloads and cannot perfectly recreate every YouTube DOM detail.

## `shop_the_stream.html`

`shop_the_stream.html` is a product-list overlay prototype/utility. It connects directly to the SSN WebSocket API and can display product lists from API messages or built-in example chat commands.

Important behavior:

- It does not use the standard VDO.Ninja iframe bridge in this pass.
- It reads `sessionId` or `streamid`, not `session`.
- It connects to:

```text
wss://io.socialstream.ninja/join/SESSION/IN_CHANNEL/OUT_CHANNEL
```

- Defaults are `inChannel=1` and `outChannel=1`.
- If `password` is present, it sends a password JSON message after the socket opens.
- It handles API messages:
  - `action: "displayProductList"` with `value` containing a product list.
  - `action: "hideProductList"`.
- It also reacts to chat commands:
  - `!gear` or `!setup` shows an example streaming setup list.
  - `!games` shows an example favorite games list.
  - `!cleargear` or `!hidegear` hides the list.
- Product items can include `name`, `url`, `imageUrl`, and `description`.
- QR codes are generated through `https://api.qrserver.com/v1/create-qr-code/`.
- The page includes an Amazon Associate disclosure.
- Amazon/eBay/Whatnot source capture is separate from this display page; use `../08-platform-sources/live-commerce-sources.md` when the question is about live-commerce source data rather than product-list display.

URL parameters observed:

- `sessionId`
- `streamid`
- `password`
- `inChannel` or `in`
- `outChannel` or `out`
- `autoHide`
- `hideDelay` or `delay`
- `debug`
- `listId`

Support checks:

- If it does not connect, check that the URL uses `sessionId` or `streamid`, not just `session`.
- If product lists do not show, verify the WebSocket channel pair and action payload.
- If chat commands show placeholder products, that is expected; the built-in lists use example affiliate URLs and placeholder images.
- Treat product URLs, affiliate links, and commerce claims as user-owned content, not SSN-managed storefront data.
- If a user expects eBay/Whatnot auction/product metadata to automatically appear here, validate the source payload and API action path first.

## Page Choice Notes

- Use `aioverlay.html` for generated AI/custom overlay runtime; `chat-overlay.html` is only a redirect helper.
- Use `minecraft.html` for Minecraft alert styling; use `multi-alerts.html` for the standard alert look.
- Use `septapus.html` when a user specifically wants YouTube-style DOM/CSS compatibility.
- Use `shop_the_stream.html` only for product-list/commerce display experiments or custom API workflows.

## Do Not Overclaim

- Do not call `minecraft.html` a Minecraft chat/source integration.
- Do not call `chat-overlay.html` an independent overlay engine.
- Do not say `septapus.html` supports every `dock.html` URL option.
- Do not say `shop_the_stream.html` is a complete commerce platform; it is a display surface that listens for product-list data.

## Follow-Up Extraction Needs

- Trace current popup/API senders for `shop_the_stream.html` product-list actions, if any.
- Verify whether `septapus.html` should parse `password` in runtime mode.
- Validate `minecraft.html` behavior against `multi-alerts.js` with controlled event payloads.
- Validate generated `chat-overlay.html` redirect URLs with saved AI overlay packages.
