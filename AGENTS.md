# Social Stream Ninja – Agent Notes

This repository supports three distinct delivery targets:

- `sources/` and `sources/websocket/` scripts are shared between the Chrome extension **and** the Electron desktop app.  They must remain compatible with both environments.  New code should follow the existing pattern of feature-detecting `chrome.runtime` and falling back to relative imports or Electron IPC helpers.
- `lite/` (and `doc/`) are standalone web apps.  They are deployed independently of the extension/Electron bundles and therefore cannot rely on manifest entries.  The production site serves them from `https://socialstream.ninja/lite/`.  Any shared module they import (for example `../../shared/utils/...`) must be published alongside them at `https://socialstream.ninja/shared/`.
- The new `shared/` directory contains cross-surface utilities (`shared/utils/scriptLoader.js`, provider cores, etc.).  When deploying the Lite site or the extension/Electron builds, make sure this directory is bundled alongside the consumers (the Lite site needs `shared/**` to be served next to `lite/`, while the extension manifest exposes the same files via `web_accessible_resources`).

Key architectural notes:

- Content scripts such as `sources/websocket/twitch.js` and `sources/websocket/kick.js` remain classic scripts.  They load shared helpers with dynamic `import()` guarded by `chrome.runtime.getURL(…)` and a relative fallback so Electron (which lacks `chrome.*`) continues to work.
- Prefer old-school browser scripts for pages/overlays and keep browser-facing code Chrome 80 friendly. Avoid `<script type="module">`, top-level `import`/`export`, and newer syntax or APIs unless there is already a compatibility path or Steve explicitly asks to raise the baseline.
- Provider cores (`providers/twitch/chatClient.js`, `providers/kick/core.js`, `providers/youtube/liveChat.js`) must stay environment agnostic: no direct DOM or Chrome APIs, all logging should be optional, and transports (RTC vs extension messaging) sit in their respective adapters.
- When adding new shared utilities, place them under `shared/` and update both the manifest (for extension access) and any standalone deployment scripts to include the folder.

If you need more context on how Electron wiring differs from the extension bootstrap, inspect the existing calls around `chrome.runtime.sendMessage` in `sources/websocket/*` and the IPC hooks in the Electron app before making changes.

- Event payload vocabulary and field expectations are documented in `docs/event-reference.html`. Update that page whenever a source adds, renames, or re-shapes an event so downstream surfaces stay in sync.

## Communication
- VERY IMPORTANT: Be terse.
- VERY IMPORTANT: Do not add extra details unless Steve explicitly asks for them.
- VERY IMPORTANT: State the answer or fix in one sentence first.
- VERY IMPORTANT: Do not explain reasoning unless Steve asks.
- Answer the exact question directly first.
- Be terse.
- Answer only what was asked unless extra context is needed to prevent a mistake.
- Call out oversights or red-flag concerns when they matter.

## Message Contracts

- Every outbound event follows the canonical structure referenced in `docs/event-reference.html`. Required fields (`platform`, `type`, `chatname`, `chatmessage`, etc.) must stay intact.
- Additional, non-standard details belong inside the top-level `meta` object. Populate `meta` with plain JSON values (no functions/classes) so downstream consumers can safely parse them.
- Avoid emitting ad-hoc top-level keys—coordinate changes through the event reference doc before shipping.

## Custom Overlay Notes

- Payload source of truth: [docs/event-reference.html](./docs/event-reference.html). Check it before changing payloads or building new overlays.
- Helpful companion guide for custom pages and styling: [docs/customoverlays.md](./docs/customoverlays.md).
- Most overlay pages need `?session=YOUR_SESSION_ID` in the URL or they will sit idle. Examples: `dock.html?session=YOUR_ID`, `featured.html?session=YOUR_ID`, `multi-alerts.html?session=YOUR_ID`.
- Common optional URL params worth preserving when building overlays: `&password=...`, `&label=...`, `&server`, `&css=...`, `&b64css=...`, `&scale=...`, `&limit=...`, `&onlytype=...`, `&hidetype=...`.
- Most custom overlays either connect by websocket or by a hidden VDO.Ninja iframe bridge and read incoming data from `event.data?.dataReceived?.overlayNinja`.
- Treat overlay traffic as mixed payloads: plain chat messages, alert-like chat messages, and meta-only event updates can all come through the same feed.
- Alert overlays often key off existing fields like `event`, `membership`, `subtitle`, `hasDonation`, `contentimg`, and `meta`. Do not invent one-off top-level keys when the documented fields already fit.
- For style work, prefer URL-driven CSS (`&css=`, `&b64css=`), CSS variables, and class toggles over changing payload shapes.
- Keep custom overlay/browser code old-school and Chrome 80 friendly: no `<script type="module">`, no top-level `import` / `export`, and avoid newer browser APIs unless there is a fallback.

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
  "type": "youtube",
  "nameColor": "",
  "chatbadges": "",
  "backgroundColor": "",
  "textColor": ""
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
  "private": true,
  "chatbadges": [
    "https://socialstream.ninja/icons/bot.png",
    "https://socialstream.ninja/icons/announcement.png"
  ]
}
```

```json
{
  "chatname": "Ava",
  "chatmessage": "",
  "chatimg": "https://socialstream.ninja/media/user1.jpg",
  "contentimg": "https://socialstream.ninja/media/logo.png",
  "type": "youtube"
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

## Surface Parity Notes

- YouTube capture now targets three modes: scraping (DOM), Data API polling, and Data API streaming. Treat the streaming initiative as additive—do **not** regress the existing polling or scraping paths.
- All `sources/websocket/**/*.html|js` assets load inside both the Chrome extension and the Electron app. Any new page (e.g., a streaming client) must accept configuration via URL parameters (`?channel=...`, `?videoId=...`) just like the legacy polling pages.
- Lite plugins (`lite/plugins/**`) are standalone web-only integrations. They never ship inside the extension or Electron bundle, but they should still share core logic via `shared/` when practical.

## Communication

- VERY IMPORTANT: Be terse in responses to Steve.
- Do not add extra detail beyond the direct answer unless needed to prevent a mistake.
- VERY IMPORTANT: State the answer or fix in one sentence first.
- VERY IMPORTANT: Do not explain reasoning unless Steve asks.
- When replying to Steve, prefer plain, everyday language over jargon.
- Keep explanations direct and practical; explain technical terms briefly when they matter.

## Git Push Contract

- VERY IMPORTANT: When Steve says `push`, treat it as an instruction to push to `beta`.
- VERY IMPORTANT: Do it serially in this exact order only: `git add -A`, `git commit` (use `--allow-empty` if needed), `git pull --rebase origin beta`, `git push origin beta`.
- VERY IMPORTANT: Do not parallelize any git commands in that flow.
- VERY IMPORTANT: Do not add extra git inspection commands unless Steve explicitly asks for them.
