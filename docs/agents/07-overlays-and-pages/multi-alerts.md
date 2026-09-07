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

Current status (2026-09-07): `node scripts/playwright-multi-alerts-overlay-e2e.cjs` passed, including popup effect controls, preview, exact/ranged amounts, first-match priority, media/sound selection and mute/hide-media behavior. Media playback is instrumented in this suite; this does not verify speakers or OBS audio routing. Popup search and the isolated Electron popup suite also passed.

Additional validation (2026-09-07): all five packaged library sounds decoded successfully, and Listen played the real chime at the selected volume. An isolated portable OBS browser source received synthetic $99/$100/$101 donations through a local WebSocket relay. Only $100 loaded the animated GIF and produced audio at the OBS mixer. The saved MP4 was decoded and independently confirmed silence for $99/$101 and a chime for $100 on recording track 1. No live stream was started. This verifies OBS output routing in that test setup, not the user's speakers or an existing production scene.

Shared-library validation (2026-09-07): the expanded 17-clip library passes actual audio decoding. `scripts/alert-library-e2e.cjs` verifies keyboard node editing, sound selection, real synthetic voice playback, saved settings, replacing app-local asset references, previewing a disabled template without activating it, Flow Actions media/audio output, and the advanced template's ordered OBS-filter commands (captured, not sent to OBS). The Electron popup suite also verifies that the actual embedded background Event Flow editor loads the shared library and stylesheet. Both that suite and the Multi-Alerts overlay suite pass.

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
- Donation/gift: `donation`, `superchat`, `supersticker`, `jeweldonation`, `gift`, `gift_sent`, `gift_message`, `live_gift`, `tiktok_gift`, `tip`, `support`, and related aliases.
- Bits: `cheer`, `bits`.
- Raid: `raid`, `host`, `hosting`, `redirect`.
- Auction: `auction_update`.
- Hype train: `hype_train`.

Count/status events such as `viewer_update`, `viewer_updates`, `follower_update`, `subscriber_update`, `stream_status`, and ad-break events are not treated as normal alert cards.

`superchat` stays a donation-category alert for layout/sound settings, but the rendered card keeps `data-event-key="superchat"` and an `event-superchat` class so custom CSS or future logic can treat it separately from generic `donation`.

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

Default style is `twitch`. HTML/CSS defines `twitch`, `classic`, `minimal`, `solid`, `cute`, `cozy`, `cats`, `music`, `arcade`, `slate`, `paper`, and `micro` themes. `solid` is a flat preset: opaque card, no blur/glow/accent stripe, 7px default corner radius.

Category accent colors (optional overrides; hex like `ff2d5e` or any CSS color):

- `accent`: overrides the accent color for every category when platform colors are disabled and remains the fallback for unknown platforms.
- `followaccent`, `subaccent`, `donoaccent`, `bitsaccent`, `raidaccent`, `auctionaccent`, `hypeaccent`: per-category overrides that beat `accent`.
- `platformcolors`: opt in to platform-based colors instead of category colors. Known platforms use their standard platform color.

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

The shared sound picker (`shared/alerts/sound-library.js`) offers 17 packaged clips in both Multi-Alerts and Event Flow: eight procedural effects (applause, drumroll, whoosh, cash register, boing, record scratch, pop, camera), four synthetic English voice phrases, and the five legacy simple sounds. No upload or external sound service is required. Selecting a sound stores its relative asset URL in the existing field; Multi-Alerts also enables `beep`. **Listen / Stop** previews locally at the configured volume (35% by default), with visible playback/error status. Sound URL/upload controls remain available separately; Event Flow also keeps its app-local file workflow.

Beginner setup uses **When this happens → Show this → Play this sound → Test alert**. Amount bounds are under **Advanced: amount limits**. Both UI surfaces label their output destination: Multi-Alerts uses its own browser source; Event Flow media/audio actions use `actions.html` (Flow Actions). Avoid playing the same event sound in both overlays. The new disabled Event Flow templates provide a donation celebration/voice starter and an advanced animation/sound/delayed OBS-filter sequence. Both use packaged media and retain the existing action contracts. Node properties can be opened with Tab then Enter/Space; new controls have visible focus, labels and live text feedback.

Event animation/sound rules:

- Configure up to three effects in the popup's **Event animations & sound effects** section.
- `effect1type`: category (`donation` by default), or `follow`, `subscription`, `bits`, `raid`, `auction`, `hype`.
- `effect1media`: direct GIF/image/video asset URL. Giphy page links are not asset URLs. GIFs have no audio; video playback remains muted.
- `effect1sound`: sound asset URL, using the normal `beep` switch and `beepvolume` control.
- `effect1min` / `effect1max`: optional inclusive estimated USD bounds for donations/bits. Set both to `100` for exactly $100; leave maximum blank for $100 or more. Comparison rounds to cents. Conversion uses the existing currency helper, not live exchange rates. Unlabelled `donoValue` alone is not eligible for amount rules because provider units vary.
- Replace `effect1` with `effect2` or `effect3` for additional rules. First matching rule wins; put specific rules before broad ones. Empty media/sound fields fall back to the original media/category sound. Clearing both URLs disables a rule.
- Leave amount bounds blank for non-value categories. Invalid ranges are ignored. Normal category/source/minimum filters, queueing, and `hidemedia` still apply.
- **Test event in preview** sends a local sample at the rule's minimum (or maximum, or $100) through the normal matcher, so earlier rules still take priority. It does not send a live donation.

Example: `&beep&effect1min=100&effect1max=100&effect1media=ENCODED_GIF_URL&effect1sound=ENCODED_SOUND_URL`. URL-encode each asset URL. Popup controls do this automatically and offer the existing hosted media uploader.

Layout/display:

- `compact`
- `hideavatar`
- `hidemedia`
- `hidesource`
- `hideamount`
- `hidesubtitle`
- `hidetitle`: hide the category title badge
- `hidemessage`: hide message body text
- `hideprogress`: hide the countdown bar
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

Opt-in style overrides (added 2026-07-03; absent params keep the stock look of every preset):

- `flat`: solid card fills; removes translucent gradients, backdrop blur, glow, and drop shadows on all presets.
- `radius`: corner radius in px for cards and media boxes, clamped 0 to 48 (`radius=7`). Non-numeric values fall back to 7.
- `cardbg`: card background color; implies a solid card fill (`cardbg=18122b`). Pairs well with `flat`.
- `textcolor`: main text color; the muted text color is derived at 85% alpha when a hex value is given.
- `animation`: entrance/exit animation. One of `slidedown` (enters from the top edge, no fade), `slideup`, `pop`, or `none`. Unknown values, or `fade`, keep the default fade-and-rise.

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

- The historical June preview iframe timeout below no longer reproduces in the September validation run.
- Trace popup-generated multi-alert URLs and settings labels outside the failed runtime attempt if a source-level update is needed.
- Map each platform's current event names into the category classifier.

## Style controls

All 12 presets support `hidetitle` (category title badge), `hidemessage` (message body), and `hideprogress` (countdown bar). These switches are also available in the popup. They preserve the alert headline and display timing.

Presets: twitch, classic, minimal, solid, cute, cozy, cats, music, arcade, slate, paper, micro. Flat mode preserves collection background colors; explicit accent/category/platform colors override collection name and border colors. All presets respect reduced-motion preferences.
