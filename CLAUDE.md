# Claude Code Instructions

## Commit Messages

- Never include "Co-Authored-By: Claude" or similar attribution in commit messages
- Do not add comments, documentation, or any other indicators that AI/Claude assisted with the code
- Commit messages should be written as if authored solely by the developer

## SSN Overlay Notes

- Payload source of truth: [docs/event-reference.html](./docs/event-reference.html).
- Helpful custom overlay guide: [docs/customoverlays.md](./docs/customoverlays.md).
- Most overlay pages need `?session=YOUR_SESSION_ID` in the URL or they will not connect. Examples: `dock.html?session=YOUR_ID`, `featured.html?session=YOUR_ID`, `multi-alerts.html?session=YOUR_ID`.
- Common optional URL params: `&password=...`, `&label=...`, `&server`, `&css=...`, `&b64css=...`, `&scale=...`, `&limit=...`, `&onlytype=...`, `&hidetype=...`.
- Custom overlays usually read data from websocket traffic or from a hidden VDO.Ninja iframe bridge via `event.data?.dataReceived?.overlayNinja`.
- Expect mixed payloads on the same feed: standard chat messages, alert-style chat messages, and meta-only event updates.
- Reuse documented fields like `event`, `membership`, `subtitle`, `hasDonation`, `contentimg`, and `meta` instead of inventing one-off top-level keys.
- For styling work, prefer `&css=` / `&b64css=`, CSS variables, and class toggles over changing payload formats.
- Keep browser-facing overlay code old-school and Chrome 80 friendly: no `<script type="module">`, no top-level `import` / `export`, and avoid newer browser APIs unless there is a fallback.

Minimal iframe bridge listener pattern:

```js
window.addEventListener("message", (event) => {
  const payload = event.data?.dataReceived?.overlayNinja;
  if (payload !== undefined) {
    handlePayload(payload);
  }
});
```

Sample payloads based on the fake test data in [background.js](./background.js):

```json
{
  "chatname": "Jess",
  "chatmessage": "Looking good! This is a test message.",
  "chatimg": "https://socialstream.ninja/media/user1.jpg",
  "type": "youtube"
}
```

```json
{
  "chatname": "Sir Drinks-a-lot",
  "chatmessage": "COFFEE!",
  "chatimg": "https://socialstream.ninja/media/user5.jpg",
  "type": "discord",
  "membership": "Coffee Addiction",
  "subtitle": "32 Years",
  "private": true
}
```

```json
{
  "event": "viewer_updates",
  "meta": {
    "youtube": 815,
    "twitch": 221,
    "kick": 94
  }
}
```

```json
{
  "type": "whatnot",
  "event": "auction_update",
  "meta": {
    "status": "winning",
    "statusText": "redatv2004 is Winning!",
    "bidder": "redatv2004",
    "title": "500 Spot Silver Slab Mega Set - #191",
    "category": "Coins, U.S. currency",
    "price": 88,
    "priceText": "$88",
    "bids": 7,
    "bidsText": "7 Bids",
    "timer": "00:19",
    "shipping": "Shipping + Taxes are extra"
  }
}
```
