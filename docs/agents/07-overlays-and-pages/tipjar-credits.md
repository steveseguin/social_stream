# Tip Jar And Credits

Status: heavy extraction pass from `tipjar.html`, `credits.html`, `parameters.md`, URL reference docs, and page-routing docs on 2026-06-24.

Use this page when a user asks about donation goals, hype goals, tip jars, supporter credits, credits roll persistence, or why donation/supporter display pages are blank.

## Source Anchors

- `tipjar.html`
- `credits.html`
- `currency.js`
- `parameters.md`
- `docs/agents/13-reference/url-parameters.md`
- `docs/agents/13-reference/surface-url-cheatsheet.md`
- `docs/agents/07-overlays-and-pages/page-capability-matrix.md`

## Tip Jar Role

`tipjar.html` is a donation/goal display overlay. It can show a jar, meter, bar, compact bar, vertical bar, minimal goal, or text-style progress display. It is normally opened as an OBS Browser Source.

Typical URL:

```text
https://socialstream.ninja/tipjar.html?session=SESSION_ID&goal=100
```

The page does not capture donations by itself. It consumes SSN payloads from a source, webhook/API path, or server relay and counts accepted donation/support events.

## Tip Jar Transport

Default bridge:

- Creates a hidden VDO.Ninja iframe.
- Uses `session` or `room`, defaulting to `tipjar` if neither is supplied.
- Uses `password` when present.
- Uses `label=tipjar`.
- Accepts `overlayNinja` payloads from the iframe only after checking `event.source`.

Optional server modes:

- `server` or `server2`: uses a WebSocket server URL, defaulting to `wss://io.socialstream.ninja` when the parameter exists without a value.
- `localserver`: uses `ws://127.0.0.1:3000`.
- Socket join payload uses `{ "join": roomID, "out": 3, "in": 4 }`.
- Socket messages can be plain payloads, `overlayNinja` payloads, or wrapped `content` payloads.

Support rule: if a user uses webhooks/API donation paths, keep session/webhook URLs private. If a user uses normal platform donations, confirm the platform/source mode emits donation data.

## Tip Jar URL Options

Core display:

| Parameter | Behavior |
| --- | --- |
| `style` | `jar`, `meter`, `bar`, `compact`, `vertical`, `minimal`, or `text`. |
| `theme` | `default`, `neon`, or `gold`. |
| `goal` | Target goal amount. Default is `250`, or `100` in hype mode. |
| `title` | Visible title; defaults to `Stream Goal` or `Hype Goal`. |
| `alignright` | Aligns the overlay to the right. |
| `baronly` | Applies a bar-only display mode. |
| `jarimage` | Custom jar image URL for `style=jar`. |

Bar/meter styling:

| Parameter | Behavior |
| --- | --- |
| `fillstart` / `barcolorstart` | Low/empty fill color. |
| `fillend` / `barcolorend` | Full fill color. |
| `fillmode` | `progress`, `gradient`, or `solid`. |
| `barheight` | Track height for bar-based styles. |
| `bartextsize` / `barfontsize` | Text size in px for the centered `bar` style amount text. |
| `barradius` | Track corner radius; `0` gives square edges. |
| `trackcolor` / `bartrackcolor` / `barbackground` | Bar track color. |
| `noliquid` | Disables the animated liquid/bar effect. |

Counting and filters:

| Parameter | Behavior |
| --- | --- |
| `tipjartype` / `tipjarunit` / `donationtype` | Counts only a unit type such as `usd`, `stars`, `bits`, `coins`, `diamonds`, `kicks`, `jewels`, `tokens`, `hearts`, or `gold`. |
| `tipjarunitlabel` | Display label for a filtered/native unit bar. |
| `tipjarsource` / `donationsource` | Comma-separated source filter. |
| `persistent` | Saves amount/history in localStorage. |
| `sound` | Plays donation sound when accepted. |
| `controls` | Shows reset/history/export/leaderboard/custom image controls. |
| `startamount` / `initialamount` / `currentamount` | Initial amount when not loading persistent saved amount. |
| `dedupewindow` | Duplicate contribution suppression window in seconds; default is 8 seconds. |

Hype mode:

| Parameter | Behavior |
| --- | --- |
| `hype` or `mode=hype` | Enables hype-goal scoring. |
| `unit` | Hype unit label, default `pts`. |
| `subpoints` | Points for subscriptions/memberships; default `2.5`. |
| `giftpoints` | Points per gift; defaults to `subpoints`. |
| `donationpoints` | Multiplier for donation value in hype mode; default `1`. |
| `notips`, `nosubs`, `nogifts`, `noresubs` | Exclude specific contribution classes. |
| `countgiftredemptions` | Count gift-recipient events where available. |
| `resetoncomplete`, `noresetoncomplete`, `carryover` | Goal completion reset/carryover behavior. |
| `hidecompletions` | Hides completion count in hype mode. |
| `completiondelay` | Delay before rollover/reset display. |
| `levelsize` / `increment` | Repeating level size for level/band goals. |
| `rollinggoal` / `cumulativegoal`, `goalstep` / `goalincrement` | Keeps the total cumulative and advances the displayed target to the next goal step, e.g. `$60 / $100` after passing a `$50` goal. |
| `celebration` | `hearts`, `confetti`, `fireworks`, or `none`. |

## Tip Jar Commands

`tipjar.html` handles command payloads before donation processing.

Reset aliases:

- `resettipjar`
- `reset_tipjar`
- `tipjar_reset`

Set amount aliases:

- `settipjaramount`
- `set_tipjar_amount`
- `tipjar_set_amount`

Command value fields for set amount:

- `value`
- `amount`
- `currentAmount`
- `tipjarAmount`

Command filters:

- If the command includes `tipjartype`, `tipjarunit`, or `donationtype`, it must match the page filter.
- If the command includes `tipjarsource`, `donationsource`, or `source`, it must match the page source filter.

Support rule: an API command can reach the server but still do nothing if the `tipjar.html` page is not open, uses a different session, or has mismatched source/unit filters.

## Tip Jar Donation Processing

Normal mode:

- Counts payloads with `donation` or `hasDonation`.
- Reads donor name from `chatname`, falling back to `Anonymous`.
- Reads source from `type`.
- Uses `currency.js` conversion helpers for cash-style values.
- Can use native unit mode when a non-USD `tipjartype` is set.
- Saves a donation history entry for accepted tips.

Hype mode:

- Normalizes contributions into `donation`, `gift`, `gift_recipient`, `sub`, or `resub`.
- Uses event names, membership values, and `meta` fields to classify gifts/subs/resubs.
- Applies duplicate suppression using explicit IDs where available, otherwise a signature of kind/source/event/name/count/raw data.
- Can count non-cash unit goals or contribution point goals.

YouTube gift guard:

- In normal USD mode, the page avoids counting YouTube gift/gift-redemption/jewel-like payloads as cash donations.
- A non-USD unit filter can intentionally count native units.

## Tip Jar Persistence And Controls

Persistence is opt-in with `persistent`.

Saved localStorage keys:

| Key Base | Use |
| --- | --- |
| `tipjar_amount` | Normal tip jar current amount. |
| `tipjar_history` | Normal tip jar donation history. |
| `tipjar_hype_amount` | Hype mode current amount/points. |
| `tipjar_hype_history` | Hype mode contribution history. |
| `tipjar_hype_completions` | Hype mode completed-goal count. |
| `tipjar_custom_image` | Custom jar image when controls/persistent custom image is used. |

Filtered pages append a suffix based on donation type and source filters. This lets a Stars-only bar and a USD bar keep separate saved totals.

Controls mode:

- Reset amount.
- Show history.
- Show leaderboard.
- Export CSV.
- Set a custom jar image for `style=jar`.

CSV export columns differ between normal and hype mode. Normal mode exports donation data; hype mode exports contribution type, points, source, event, and raw details.

## Credits Role

`credits.html` is a supporter/participant credits roll. It collects users while the page is running, then displays a scrolling credits sequence. It is normally used as an OBS Browser Source near the end of a stream.

Typical URL:

```text
https://socialstream.ninja/credits.html?session=SESSION_ID
```

The page tracks:

- `chatname`
- `type`
- message count
- donations converted through `currency.js`
- membership flag
- avatar URL when available

## Credits Transport

Default bridge:

- Creates a hidden VDO.Ninja iframe.
- Uses `password` when present.
- Uses `lanonly` when present.
- Uses `view=session`, `room=session`, and `label=dock`.
- Accepts `overlayNinja` payloads after checking `event.source`.

Optional extension socket relay:

- Enabled only with `server2` or `server3`.
- Default server is `wss://io.socialstream.ninja/extension`.
- Socket join payload uses `{ join: session, out: 3, in: 4 }`.
- If an inbound socket message includes `get`, the page replies with a callback result.

Support rule: credits needs the page open while messages arrive, unless `persistcredits` has already saved prior users for the same session.

## Credits URL Options

| Parameter | Behavior |
| --- | --- |
| `style` | Default `starwars`; also supports non-Star-Wars styles such as `elegant` and `minimal` in current source. |
| `loop` | Restarts the credits animation when it ends. |
| `persistcredits` | Saves users to localStorage by session. |
| `donationpriority` | Groups/sorts donors first, then members, then participants. |
| `onlydonors` | Ignores users without donation payloads. |
| `onlysupporters` | Ignores regular chat-only users and keeps donors plus members/subscribers. |
| `hidecategories` | Hides category headers. |
| `showavatar` / `showavatars` | Shows avatar images when available. |
| `showamounts` | Shows donation totals next to donors. |
| `nosourcetype` | Hides source type icon. |
| `endmessage` | Custom footer/end text. |
| `speed` | Scales animation speed. |
| `duration` | Sets fixed animation duration in seconds and overrides `speed`. |
| `textcolor` | Custom text color/glow. |
| `font` | Local/predefined font list. |
| `googlefont` | Loads a Google font by name. |
| `nobg` | Forces transparent/no background behavior. |
| `pagebg` / `pagebackground` / `dockbg` | Sets page/background color. |
| `triggermode` | `auto` by default; use `manual` for dock/command-triggered start workflows. |
| `noinstructions` | Hides instruction overlay. |

## Credits Commands

`credits.html` handles `creditsCommand` payloads:

| Command | Behavior |
| --- | --- |
| `start` | Starts credits in normal mode. |
| `preview` | Starts credits in preview mode. |
| `reset` | Clears collected users and persisted localStorage data. |

Manual mode support:

- In `triggermode=manual`, keep the page running and send a start command from the extension/menu/dock path.
- In `triggermode=auto`, credits start when the page becomes visible. Source comments warn auto mode may not work as expected in Electron/app contexts.

## Credits Scoring And Sorting

Default scoring:

- Each message adds 1 point.
- Donations add 100 points per converted USD value.
- Membership adds 50 points.
- Users are grouped into VIP supporters, regular supporters, and stream participants.

Donation-priority mode:

- Donors are sorted first by donation amount, then membership, then participation.
- Members without donations come next.
- Remaining participants come last.

Only-donors mode:

- Users without `hasDonation` are ignored.

## Credits Persistence

Persistence is opt-in with `persistcredits`.

Storage key:

```text
ssn-credits-users-v1:SESSION_ID
```

The stored data includes:

- name
- source type
- message count
- donation total
- membership flag
- avatar URL
- version and updated timestamp

When `persistcredits` is not set:

- Refreshing the page loses collected users.
- After the animation completes, users are cleared unless the run was a preview.

## Common Support Issues

Tip jar stays at zero:

- Confirm `tipjar.html` has the same `session` or `room` as the source/webhook.
- Confirm the platform/source actually emits `donation` or `hasDonation`.
- Check `tipjartype`, `tipjarsource`, `donationtype`, and `donationsource` filters.
- Check if the user is sending gift/sub events but the page is not in `hype` mode.
- For API commands, confirm the page is open and command filters match the page filters.

Tip jar double-counts:

- Check whether duplicate source/webhook/API paths are active.
- Keep `dedupewindow` enabled unless the workflow has a reason to disable it.
- Check whether upstream events use changing IDs.

Tip jar reset/set amount does nothing:

- Confirm the command action name is one of the supported aliases.
- Confirm the command includes a parseable amount for set operations.
- Confirm the command's source/type filters match the page URL filters.
- Confirm the page is open and connected to the same session.

Credits roll is empty:

- Keep `credits.html` open before the stream ends so it can collect users.
- Confirm the same `session` as the source/dock.
- If `onlydonors` is set, make sure donation payloads are arriving.
- If the page was refreshed without `persistcredits`, collected names were lost.

Credits do not start:

- In OBS/auto mode, make the browser source visible.
- In manual mode, send `creditsCommand: start`.
- In Electron/app contexts, prefer manual mode if auto visibility behavior is unreliable.

Old credits remain:

- If `persistcredits` is enabled, send `creditsCommand: reset` or clear localStorage for the session key.
- Confirm the page is using the expected session; storage is keyed by the first session value before a comma.

## Safe Answer Pattern

For tip jar questions:

```text
Use `tipjar.html?session=YOUR_SESSION&goal=100`. The page must be open and must receive donation payloads from a source, webhook, or API path. First check the session, source donation support, and any `tipjartype` or `tipjarsource` filters.
```

For credits questions:

```text
Use `credits.html?session=YOUR_SESSION`. Keep it open while chat arrives, or add `persistcredits` if names should survive refreshes. Start/preview/reset are controlled by `creditsCommand` messages, and auto-start depends on page/OBS visibility.
```

## Remaining Extraction Targets

- Trace exact popup/menu commands that send `creditsCommand` values.
- Trace API routes that send tip jar reset/set commands.
- Validate `currency.js` conversion behavior and source-specific donation formats.
- Add OBS screenshots/setup notes for transparent credits and tip jar styles.
- Add end-to-end tests for duplicate donation paths, persistent storage, and credits reset behavior.
