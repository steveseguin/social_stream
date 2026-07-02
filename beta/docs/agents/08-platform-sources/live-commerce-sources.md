# Live Commerce Sources

Status: heavy grouped pass started on 2026-06-24. This page documents shopping, auction, and live-commerce source scripts that were previously mostly inventory-only.

Use this page when a user asks about Amazon Live, eBay Live, or Whatnot.

## Source Anchors

- `sources/amazon.js`
- `sources/ebay.js`
- `sources/whatnot.js`
- `sources/inject/whatnot-ws.js`
- `manifest.json`
- `docs/js/sites.js`
- Related display page: `../07-overlays-and-pages/specialized-legacy-pages.md` for `shop_the_stream.html`

## Core Rule

These are live shopping capture sources. They can look like normal chat sources, but eBay and Whatnot also emit commerce, auction, viewer, reaction, or event metadata.

Support answers should start with:

- Confirm the user is on the exact live-commerce URL pattern.
- Confirm the live/chat panel is loaded and visible.
- Reload the source page after extension install or reload.
- Ask whether the user expects plain chat, viewer counts, auctions/products, reactions, donations/tips, raids, loyalty, or giveaway/product updates.
- Treat seller/store IDs, event URLs, buyer names, and product listings as potentially private or commercially sensitive in public support.
- Do not promise send-back. The inspected scripts implement `getSource` and `focusChat`, but no source-level `SEND_MESSAGE` handler was found.

`focusChat` only focuses the chat input where possible. It is not the same as sending a message.

## Source Matrix

| Source | Public Setup | Manifest Matches | Captures | Rich/Event Notes |
| --- | --- | --- | --- | --- |
| Amazon Live | Standard Amazon Live card | `https://www.amazon.com/live*`, `https://www.amazon.com/b/?node=*&broadcast=*` | Rendered Amazon chat rows under `[data-testid='MessageArea']`, sender, avatar, text | Payload `type` and `getSource` are `amazon`; mostly plain chat; includes hidden/visibility keepalive patches. |
| eBay Live | Standard eBay Live card | eBay Live event URLs for multiple country domains plus `ir.ebaystatic.com/.../shoplive/*` | Rendered chat, avatar, viewer counts, reactions, auction cards, live event cards, commerce/navigation snapshots, seller follower stats | Payload `type` and `getSource` are `ebay`; emits `viewer_update`, `reaction`, `auction_update`, `commerce_update`, and `follower_update` events where source data is available. |
| Whatnot | Standard Whatnot card | `https://www.whatnot.com/live/*`, `https://whatnot.com/live/*`, `https://www.whatnot.com/dashboard/live/*` | Rendered chat, avatars, badges, viewer counts, auction/product/giveaway snapshots | Payload `type` and `getSource` are `whatnot`; paired `whatnot-ws.js` intercepts Whatnot WebSocket frames for chat, tips, raids, loyalty, viewer, product, giveaway, and livestream updates. |

## Capture Behavior

### Amazon Live

`sources/amazon.js` watches `[data-testid='MessageArea']` and processes added nodes. It extracts:

- sender from `[data-testid='MessageSenderName']`
- outgoing sender fallback from `.nav-shortened-name`
- avatar from incoming/outgoing message clusters
- message text from `[data-testid='TextMessage']`

It emits normal chat payloads with `type: "amazon"`. It also includes a WebRTC keepalive and visibility patches to reduce hidden-tab throttling.

Support boundaries:

- Treat Amazon Live as chat capture unless current source validation proves richer event support.
- The manifest row uses `document_start`; if the source loads but no chat appears, check whether the page layout still exposes `MessageArea`.
- The public site entry is for Amazon Live; do not confuse it with Amazon Chime, which is covered in `communication-and-sensitive-sources.md`.

### eBay Live

`sources/ebay.js` is much richer than a plain chat parser. It watches chat containers and also polls/observes page sections for live-commerce state.

Plain chat:

- sender from `.user-name`, `*_username_`, or `chatAuthor-` selectors
- avatar from `img.aspect-square[src]`
- message text from `.message-content`, `chatText-`, or fallback node text
- payload `type: "ebay"`

Event/meta payloads:

| Event | Meaning |
| --- | --- |
| `viewer_update` | Viewer count from DOM when viewer count or hype settings apply. |
| `reaction` | Heart/reaction animation detected in the page. Sent to the `reactions` target. |
| `auction_update` | Snapshot of active player-card/event-card auction state: title, status, timer, bidder/winner, price, shipping, bids, viewer count, seller, tags, and related fields when available. |
| `commerce_update` | Snapshot of navigation, player cards, live events, live previews, upcoming events, or related commerce state when available. |
| `follower_update` | Seller follower count from seller stats lookup when a seller slug can be found. |

Important support boundaries:

- `auction_update` and `commerce_update` are snapshot-style metadata events. They are not normal chat messages.
- Seller follower stats depend on the current seller slug and an external stats lookup path in the implementation. Treat it as best effort and do not promise it as a guaranteed eBay platform API feature.
- The eBay manifest row has many country-specific eBay Live URL patterns. Ask for the exact country/domain URL before diagnosing injection.
- The source uses `all_frames`, so iframe/frame context matters.

### Whatnot

`sources/whatnot.js` combines rendered DOM capture with a WebSocket interception path.

DOM capture handles:

- rendered chat nodes under Whatnot live pages
- avatars, badges, usernames, message text, profile links, highlighted rows
- viewer counts when viewer count or hype settings apply
- auction snapshots from the live player footer
- commerce snapshots for products, surprise sets, and upcoming giveaways

The paired `sources/inject/whatnot-ws.js` runs at `document_start` on Whatnot live/dashboard pages and wraps `window.WebSocket` for `wss://www.whatnot.com/` sockets. It posts received frames back to the content script as `whatnot-ws-interceptor` messages. `sources/whatnot.js` then parses selected WebSocket events.

Inspected WebSocket event handling includes:

| WebSocket Event | SSN Output |
| --- | --- |
| `new_msg` | Chat payload with username, avatar, membership/loyalty tier, moderator/admin flags, and meta. |
| `tip_sent` | Donation-style chat payload with `event: "donation"`, `hasDonation`, optional `donoValue`, and meta. |
| `raid_selected`, `has_been_raided`, `raid_started` | Raid payload with `event: "raid"` and raid count metadata where available. |
| `user_loyalty_tier_level_up` | Member-style payload with `event: "member"` and loyalty tier. |
| `livestream_view_count_updated` | Viewer count update. |
| `livestream_update`, `giveaway_entry_count_updated`, `product_created`, `product_updated`, `product_deleted`, `giveaway_started`, `giveaway_won`, `payment_failed`, `user_joined`, `phx_reply` | Refreshes or parses snapshots for products, giveaways, livestream state, and latest activity events where supported. |

Whatnot support boundaries:

- WebSocket activity suppresses duplicate DOM chat/viewer processing for a short window, so DOM and WebSocket paths are intentionally coordinated.
- The source has richer event handling than Amazon and most DOM-only commerce sources.
- Do not promise full Whatnot moderation or send-back. The inspected source has `focusChat`, not a source-level send handler.
- In the standalone app, `whatnot.js` can also register `window.ninjafy.onWebSocketMessage`; app parity still needs live Electron validation.

## Send-Back Boundary

For the live-commerce scripts inspected in this pass:

- Amazon, eBay, and Whatnot implement `getSource`.
- Amazon, eBay, and Whatnot implement or attempt `focusChat`.
- No source-level `SEND_MESSAGE` handler was found in these scripts.

Support wording should be: "SSN can capture chat and, for eBay/Whatnot, selected commerce or event metadata. Sending replies back is not documented by these source scripts."

## Relationship To `shop_the_stream.html`

`shop_the_stream.html` is a display/control page for product-list payloads and direct SSN WebSocket/API messages. It is not the same thing as the Amazon/eBay/Whatnot source scripts.

Use this routing:

- User asks whether Amazon/eBay/Whatnot chat or event data is captured: start here.
- User asks how to display or control a product list overlay: use `../07-overlays-and-pages/specialized-legacy-pages.md`.
- User sends product-list API actions manually: use `../13-reference/action-command-index.md` and API docs.

## Common Support Patterns

### "Amazon Live/eBay Live/Whatnot is listed, but nothing appears."

Use this order:

1. Confirm the exact URL against the matrix above.
2. Confirm the live page is loaded and chat is visible.
3. Reload the live page after extension install/reload.
4. Check whether the user expects chat or metadata events.
5. For eBay, check the country-specific URL and frame context.
6. For Whatnot, check whether the page has a live chat DOM and whether the WebSocket interceptor is loaded.

### "Why do I get auction/product events but no normal chat?"

This can happen when a page exposes commerce state while chat is not visible, not live, not loaded, or blocked by a DOM layout change. Check the chat panel separately from product/auction cards.

### "Why do I get normal chat but no auction/product events?"

Amazon Live is mostly plain chat in the inspected source. For eBay and Whatnot, product/auction metadata depends on the current page layout exposing the expected player cards, footer, product sections, or WebSocket frames.

### "Can this power shopping/product overlays?"

Partly. eBay and Whatnot can emit commerce/auction metadata events, and `shop_the_stream.html` can display product-list payloads. Do not assume every platform-specific product field maps automatically to the shop overlay; validate the payload path and target action.

## Extraction Gaps

Needed future passes:

- Live browser validation for Amazon Live, eBay Live country URLs, and Whatnot live/dashboard URLs.
- Controlled payload samples for eBay `auction_update`, `commerce_update`, `follower_update`, and Whatnot WebSocket event families.
- Confirm whether eBay seller stats lookup is still intended and how failures surface in support.
- Verify `whatnot-ws.js` behavior in Chrome extension and standalone app source-window contexts.
- Check whether any background/dock/debugger path can type/send after `focusChat`.
