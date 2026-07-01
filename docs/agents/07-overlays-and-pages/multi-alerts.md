# Multi Alerts

Status: heavy extraction pass started on 2026-06-24.

## Purpose

`multi-alerts.html` is an alert overlay for event-style SSN payloads. It is separate from normal chat overlays and focuses on follows, subscriptions, donations, cheers/bits, raids, auction wins, and hype-train events.

## Source Anchors

- `social_stream/multi-alerts.html`
- `social_stream/multi-alerts.js`
- `social_stream/popup.html`
- `social_stream/docs/event-reference.html`
- `social_stream/scripts/playwright-multi-alerts-overlay-e2e.cjs`

## Runtime Validation Status

Current status: not browser-validated from the latest run.

On 2026-06-24, `node scripts/playwright-multi-alerts-overlay-e2e.cjs` was run from `social_stream`. It failed with:

```text
frame.waitForFunction: Timeout 30000ms exceeded.
    at waitForPreviewFrame (<social_stream repo>/scripts/playwright-multi-alerts-overlay-e2e.cjs:212:15)
    at async <social_stream repo>/scripts/playwright-multi-alerts-overlay-e2e.cjs:439:24
```

The failure happened while waiting for the popup preview iframe to expose `window.__multiAlertsOverlay.getSettings`. Do not use that run as evidence that multi-alert rendering, queueing, audio, filters, or server modes are validated.

Evidence log: `17-runtime-validation-evidence-log.md`.

## Connection Model

The page can receive payloads in two ways:

- Hidden VDO.Ninja iframe bridge, using the SSN session and `label=alerts`.
- WebSocket mode when `server`, `server2`, `server3`, or `localserver` URL parameters are present.

Iframe URL pattern in source:

```text
https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=PASSWORD&push&label=alerts&view=SESSION&vd=0&ad=0&novideo&noaudio&autostart&cleanoutput&room=SESSION
```

Socket join pattern:

```json
{ "join": "SESSION", "out": 3, "in": 4 }
```

The page also accepts local preview messages through `window.postMessage` with `multiAlertsPreview`.

## Alert Categories

Current alert categories:

- `follow`
- `subscription`
- `donation`
- `bits`
- `raid`
- `auction`
- `hype`

The default user-facing labels are:

- New Follower
- New Subscriber
- New Donation
- New Cheer
- Incoming Raid
- Auction Won
- Hype Train

## Event Classification

The page normalizes many platform event names into alert categories.

Examples:

- Follow: `new_follower`, `follow`, `followed`.
- Subscription: `new_subscriber`, `subscription_gift`, `resub`, `sponsorship`, `giftpurchase`, `giftredemption`, `membermilestone`, plus older aliases such as `subscription`, `membership`, `new_member`, and `membership_upgrade`.
- Donation/gift: `donation`, `gift`, `gift_sent`, `gift_message`, `live_gift`, `tiktok_gift`, `supersticker`, `tip`, `support`, and related aliases.
- Bits: `cheer`, `bits`.
- Raid: `raid`, `host`, `hosting`, `redirect`.
- Auction: `auction_update`.
- Hype train: `hype_train`.

Count/status events such as `viewer_update`, `viewer_updates`, `follower_update`, `subscriber_update`, `stream_status`, and ad-break events are not treated as normal alert cards.

## Important Payload Fields

The alert card builder looks at many common SSN fields:

- `event`
- `eventType`
- `alertType`
- `chatname`
- `chatmessage`
- `chatimg`
- `contentimg`
- `hasDonation`
- `donation`
- `membership`
- `id`
- `type`
- `sourceName`
- `channel`
- `channelId`
- `meta`

For donations and bits, it tries to parse a cash-like value from labels and numeric fields such as:

- `donoValue`
- `donationValue`
- `meta.donoValue`
- `meta.donationValue`
- `meta.amount`

If `mindonation` or `mincash` is set, donation/bits alerts below that parsed value are skipped.

## URL Parameters

Core:

- `session`: SSN session ID.
- `password`: session password, defaulting to `false`.
- `server`: use the API WebSocket endpoint, defaulting to `wss://io.socialstream.ninja/api`.
- `server2` or `server3`: use extension WebSocket endpoint, defaulting to `wss://io.socialstream.ninja/extension`.
- `localserver`: use `ws://127.0.0.1:3000`.
- `debug`: log extra diagnostics and show status.
- `preview`: preview-only mode.
- `showstatus`: show the status chip.

Timing and queue:

- `showtime`: alert display time, minimum clamped to 1800 ms, default 8000 ms.
- `cooldown`: delay between alerts, default 900 ms.
- `queue`: enable queueing.
- `noqueue`: force no queueing.
- `maxqueue`: queue cap, clamped 1 to 100, default 20.
- `minshowtime`: lower bound when queue pressure shortens alert display, default 3000 ms.

Category styles:

- `followstyle`
- `substyle`
- `donostyle`
- `bitsstyle`
- `raidstyle`
- `auctionstyle`
- `hypestyle`

Default style is `twitch`. HTML/CSS also defines `classic`, `twitch`, and `minimal` themes.

Category disable/enable:

- `disablefollows`
- `disablesubs`
- `disabledonos`
- `disablebits`
- `disableraids`
- `auctionwins`: opt in to auction alerts.
- `hypetrain`: opt in to hype-train alerts.

Category sounds:

- `followsound`
- `subsound`
- `donosound`
- `bitssound`
- `raidsound`
- `auctionsound`
- `hypesound`

General audio:

- `beep`
- `beepvolume`
- `custombeep`

Layout/display:

- `compact`
- `hideavatar`
- `hidemedia`
- `hidesource`
- `hideamount`
- `hidesubtitle`
- `align=center`
- `alignright`
- `scale`
- `mediascale`
- `headlinescale`
- `detailscale`
- `pagebg`
- `chroma`
- `transparent` or `transparency`
- `embedded`

Source filters:

- `sources`: include only specific source types.
- `hidesources`: exclude source types.
- `sourceids` or `channels`: include matching channel/source IDs.
- `hidesourceids` or `hidechannels`: exclude matching channel/source IDs.

## Queue Behavior

Without `queue`, a new alert can replace or interrupt the current display depending on timing. With `queue`, models are stored and played sequentially. The queue is trimmed to `maxqueue`.

When the queue is deep, source shortens effective show/cooldown timing to keep alerts moving.

## Audio Unlock Behavior

Browsers can block autoplay audio. The page registers pointer, mouse, touch, key, and click listeners to unlock audio. If alert sounds do not play, the user may need to click/interact with the overlay once, especially in a normal browser tab.

In OBS Browser Source, audio routing and browser-source audio settings can also be the cause.

## Common Failures

No alerts:

- `session` is missing or wrong.
- The page is connected to `label=alerts`, but SSN is not sending alert payloads for that session.
- The event is a normal chat message and does not classify as an alert.
- Category is disabled by URL parameter.
- Auction/hype is not enabled with `auctionwins` or `hypetrain`.
- Source is excluded by `sources`, `hidesources`, `sourceids`, or `hidesourceids`.

Donation alert missing:

- `mindonation` / `mincash` may be filtering it.
- Source payload may not include `hasDonation`, `donation`, or a numeric value field.
- Gift payloads can classify as donation/gift depending on event alias.

Audio missing:

- Browser autoplay lock.
- Bad sound URL.
- OBS Browser Source audio disabled or not monitored.
- `beep`/category sound parameter not set.

Wrong style/layout:

- Category style parameters are per category. Setting `donostyle` does not affect follows.
- `compact`, scale, and media scale parameters can make cards look very different from default.

Repeated alerts:

- The page has duplicate payload protection, but source IDs or event IDs matter. If the upstream source emits the same event with changing IDs, duplicates may still appear.

## Remaining Extraction Targets

- Investigate why the Playwright multi-alerts E2E script times out while waiting for the preview iframe overlay API, then rerun it before promoting any runtime claim.
- Trace popup-generated multi-alert URLs and settings labels outside the failed runtime attempt if a source-level update is needed.
- Map each platform's current event names into the category classifier.
