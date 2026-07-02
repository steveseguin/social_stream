# Rumble Source

Status: heavy extraction pass started on 2026-06-24.

## Purpose

Document SSN's Rumble capture paths: normal DOM capture on Rumble pages and the newer Rumble Live Stream API bridge.

## Source Anchors

- `social_stream/sources/rumble.js`
- `social_stream/sources/websocket/rumble.html`
- `social_stream/sources/websocket/rumble.js`
- `stevesbot/resources/learnings/social-stream-ninja-top-issues.md`

## Capture Modes

### Normal Rumble Page Capture

`sources/rumble.js` is a Chrome extension content script that watches Rumble chat DOM rows with a `MutationObserver`.

It extracts:

- `chatname`
- `chatmessage`
- `chatimg`
- `chatbadges`
- `nameColor`
- `hasDonation` from rant price elements
- `contentimg` for raid background images
- `event: "raid"` for raid containers
- `sourceImg` from the channel/creator image when available
- `textonly`
- `type: "rumble"`

It converts avatar/source images to data URLs where possible before relaying. This helps downstream overlays keep rendering when source images would otherwise be blocked or short-lived.

### Rumble Live Stream API Bridge

`sources/websocket/rumble.html` and `sources/websocket/rumble.js` implement a read-only bridge for Rumble's creator Live Stream API URL.

The UI tells users to paste the private URL from:

```text
rumble.com/account/livestream-api
```

The bridge can relay normalized:

- Chat messages.
- Rants/donations.
- Followers.
- Subscribers.
- Gifted subscriptions.
- Viewer counts.
- Stream online/offline state.

It is read-only. Sending messages through the Rumble API is not supported in this bridge.

## API Bridge Setup

1. Open the Rumble API dashboard.
2. Generate the Live Stream API URL for the creator/user/channel to monitor.
3. Paste that private URL into the Rumble API Alerts page.
4. Click Connect.
5. Keep the page open while it should relay into SSN.

The UI warns that the API URL is private because it already includes the stream key. If leaked, the user should reset it from the Rumble dashboard.

Supported URL parameters shown in the page:

- `apiUrl`
- `channel`
- `streamId`
- `poll`
- `replay`
- `sse`
- `followerMode`

Example:

```text
sources/websocket/rumble.html?apiUrl=...&channel=MyChannel&poll=3000
```

## API Bridge Payloads

Base payload fields:

- `chatbadges`
- `backgroundColor`
- `textColor`
- `chatimg`
- `hasDonation`
- `membership`
- `contentimg`
- `textonly`
- `type: "rumble"`
- `sourceName`
- `sourceImg`

Chat payloads include:

- `chatname`
- `chatmessage`
- `chatbadges`
- `meta.source: "live_stream_api"` for documented API polling
- `meta.source: "rumble_sse"` for SSE chat
- stream ID/title and timestamps where available
- `meta.plainText`
- `meta.rumbleEmotesRendered` when emotes were rendered into HTML

Rant/donation payloads set:

- `event: "donation"`
- `hasDonation` to the formatted amount
- `meta.rant: true`
- amount/currency details where available

Follower payloads set:

- `event: "new_follower"`
- `chatmessage` like `Started following`

Subscriber payloads set:

- `event: "new_subscriber"`
- `membership` to the subscriber label
- `subtitle` to the amount label when present

Gift payloads set:

- `event: "subscription_gift"`
- `membership` to the subscriber label
- `hasDonation` to a gifted count label
- `meta.totalGifted`, `remainingGifts`, `giftType`, and `videoId`

Viewer/stream status events are emitted as event-style messages, not normal chat messages.

## SSE And Polling Behavior

The bridge supports SSE-style chat retrieval and falls back to documented API chat polling when SSE fails. It deduplicates messages with seen event IDs and can seed recent history without relaying it unless replay is enabled.

Default poll interval in the UI is `3000` ms. Advanced UI allows a range from `1500` to `15000` ms. Lower intervals update faster but create more requests.

## Normal Page Payload Notes

DOM capture differs from API bridge capture:

- It depends on Rumble's current page markup.
- It can see visible chat DOM elements on the opened page.
- It marks raids with `event: "raid"`.
- It captures rant prices from the visible page as `hasDonation`.
- It does not require the private Live Stream API URL.

Use the API bridge when a creator can provide the API URL and wants structured, less DOM-fragile event capture.

## Common Failures

No messages from API bridge:

- The API URL is missing, wrong, expired, or reset.
- The user is not live and expects live chat/viewer data.
- The bridge page was closed.
- The user selected a stream ID that is not the active livestream.

No chat from normal page capture:

- The wrong Rumble page/chat page is open.
- Rumble changed DOM markup and selectors need review.
- Extension capture is off or settings are not loaded.
- The source tab is inactive, throttled, or not showing new chat rows.

Rants/followers/subscribers missing:

- Confirm whether the user is using the API bridge or normal DOM capture. The API bridge has structured support for these events; normal DOM capture only sees what appears in the page DOM.
- Check whether the event type exists in the current API response.

Duplicate or old messages:

- The API bridge has replay and seed behavior. Disable replay if recent history should not be forwarded on connect.
- Normal DOM capture has different dedupe behavior and can be affected by Rumble re-rendering old rows.

Security concern:

- Treat the Rumble Live Stream API URL like a secret. Do not paste it into public logs or screenshots.

## Remaining Extraction Targets

- Source-check exact popup button URL generation from `popup.js`.
- Confirm all support-mined Rumble URL-format advice against current popup/source code.
- Line-level review of stream online/offline and viewer count payloads in `sources/websocket/rumble.js`.
