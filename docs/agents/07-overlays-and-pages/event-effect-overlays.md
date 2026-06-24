# Event And Effect Overlays

Status: heavy extraction pass from `events.html`, `hype.html`, `confetti.html`, `wordcloud.html`, and `leaderboard.html` on 2026-06-24.

Use this page when a user asks about the event dashboard, hype/viewer counter, confetti effect, word cloud, or leaderboard pages. These pages are not platform sources. They are receiving/output pages that need matching SSN session traffic from source pages, the dock, the standalone app, or an API/server route.

## Source Anchors

- `events.html`
- `hype.html`
- `confetti.html`
- `wordcloud.html`
- `leaderboard.html`
- `currency.js`
- `sources/images/*.png`

## Fast Routing

| User Wants | Page | Typical URL | OBS Role | First Check |
| --- | --- | --- | --- | --- |
| Running feed of follows, gifts, donations, status events, and rich event metadata | `events.html` | `https://socialstream.ninja/events.html?session=SESSION_ID` | Optional dashboard/output | Source emits event fields, same session, filters are not hiding the event. |
| Viewer/chatter count by source | `hype.html` | `https://socialstream.ninja/hype.html?session=SESSION_ID` | Yes | Payload contains `hype` or `viewer_updates`; source/app sends viewer counts. |
| Confetti when waitlist draw winners are selected | `confetti.html` | `https://socialstream.ninja/confetti.html?session=SESSION_ID` | Yes | Waitlist draw payload includes `drawmode` and winners. |
| Word cloud from chat | `wordcloud.html` | `https://socialstream.ninja/wordcloud.html?session=SESSION_ID` | Yes | Incoming payload has `chatmessage`; default mode only counts single-word messages. |
| Top chatters, donors, gifters, contributors, or loyalty points | `leaderboard.html` | `https://socialstream.ninja/leaderboard.html?session=SESSION_ID` | Yes | Incoming payload has `chatname` and `type`, or a `points_leaderboard` snapshot. |

## Shared Transport Pattern

These pages generally use an invisible VDO.Ninja iframe to join the SSN room and receive `dataReceived.overlayNinja` payloads.

Common bridge details:

- `events.html` creates an iframe with `label=dock` in its normal mode.
- `hype.html` creates an iframe with `label=hype`.
- `confetti.html` creates an iframe with `label=waitlist`.
- `wordcloud.html` creates an iframe with `label=wordcloud`.
- `leaderboard.html` creates an iframe with `label=dock`.
- `hype.html`, `events.html`, and `confetti.html` can also connect to a WebSocket server when `server` or `server2` is present, joining the room with `out:3` and `in:4` by default.
- `leaderboard.html` has an optional extension relay path with `server2` or `server3`, also joining `out:3` and `in:4`.
- `wordcloud.html` did not show a WebSocket fallback in this pass; it uses the iframe bridge.

Do not assume these pages capture platform chat by themselves. If the dock is also blank, troubleshoot source capture and session first.

## `events.html`

`events.html` is a dashboard-style event feed. It shows normalized SSN event payloads with source icons, event labels, donation display, optional USD conversion, metadata panels, and optional viewer top-bar counts.

Important behavior:

- Requires `session` for normal hosted usage.
- Receives `overlayNinja` payloads from the iframe bridge.
- If `server` or `server2` is present, it also opens a WebSocket and joins `out:3`, `in:4`.
- Ignores payloads where `type` is `obs`.
- Shows entries when the payload has `event`, `hasDonation`, or another display-forcing status path.
- Can filter by platform/source via `sources`.
- Can filter to donations via `donationsonly`.
- Can filter donation minimums via `minvalue`.
- Can filter likely gift-sub events via `giftedsubsonly`.
- Can convert and show USD values with `currency`.
- Can add value-based styling with `highlightvalue`.
- Can show/hide event metadata panels with `hidemeta`.
- Can show/hide timestamps with `notime`.
- Keeps only the latest `maxevents` entries, defaulting to 200.
- Clicking a message selects it and tries to send a featured payload to peers labeled `overlay`; clicking the active message again sends a clear payload.

URL parameters observed:

- Session and debug: `session`, `debug`.
- Translation: `ln`, `lang`, `language`.
- Event filters: `sources`, `donationsonly`, `minvalue`, `giftedsubsonly`.
- Value display: `currency`, `highlightvalue`.
- Visuals: `lightmode`, `transparent`, `transparency`, `hidemeta`, `notime`, `maxevents`, `font`, `googlefont`, `scale`.
- Viewer top bar: `showviewercount`, `viewerbarbg`, `viewerbarbackground`, `topbarbg`.
- Server path: `server`, `server2`, `localserver`.

Source-observed caveat:

- `events.html` initializes `password` to `"false"` and uses it in the iframe URL, but this pass did not find URL parsing for `password`. Do not tell users `&password=` is supported on `events.html` unless current source is rechecked.

Support checks:

- If it is blank, first send a known event/donation payload rather than an ordinary chat message.
- If donations are missing, check `donationsonly`, `minvalue`, source filters, and whether the platform payload uses `hasDonation`.
- If a clicked event does not feature elsewhere, check whether a compatible featured/overlay peer is open and connected, or whether the WebSocket fallback is configured.
- If source icons are broken, check the `type` field against `sources/images/TYPE.png`.

## `hype.html`

`hype.html` displays per-source viewer and chatter counts. It is closer to a stats overlay than a generic event alert page.

Important behavior:

- Accepts `session`, `s`, or `id`.
- Hosted use without a session redirects users to the old live-chat-overlay README.
- Reads `password` and passes it to the iframe.
- The normal iframe uses `label=hype`.
- Optional WebSocket mode joins `out:3`, `in:4`, or custom `out`/`in` values.
- `processInput` returns unless the payload contains a `hype` object.
- `hype.clear.action === "refreshSources"` clears local source state and hides the output.
- `uniqueid` filters hype payloads when the payload has `hype.uniqueId`.
- Regular hype payloads are expected to include `hype.viewers`, `hype.chatters`, and/or `hype.combined`.
- It also handles payloads where `event` is `viewer_updates` and viewer counts are in `meta`.
- It can combine YouTube and YouTube Shorts, or combine all sources globally.
- It can show viewers only, chatters only, or both.

URL parameters observed:

- Session/security: `session`, `s`, `id`, `password`, `uniqueid`.
- Server/channel: `server`, `server2`, `localserver`, `out`, `outchan`, `in`, `inchan`.
- Display timing/scale: `showtime`, `fontsize`, `scale`, `speed`.
- Fonts/style: `font`, `googlefont`, `css`, `base64css`, `b64css`, `cssbase64`, `cssb64`, `js`, `style`.
- Alignment/title: `align`, `alignright`, `hidetitle`.
- Background/theme: `opacity`, `chroma`, `darkmode`, `lightmode`, `transparent`, `pagebg`, `pagebackground`, `dockbg`, `nooutline`.
- Count modes: `viewersonly`, `chattersonly`, `combineyoutube`, `combineall`.
- Top bar background: `viewerbarbg`, `viewerbarbackground`, `topbarbg`.

Support checks:

- If it stays hidden, confirm the source/app is sending `hype` payloads or `viewer_updates`, not just chat messages.
- If only one source appears, check whether counts are actually present for the other source and whether `combineyoutube` or `combineall` is changing the labels.
- If custom CSS/JS is used, treat it as untrusted and ask for a clean URL reproduction before debugging core behavior.

## `confetti.html`

`confetti.html` is a narrow visual effect page tied to waitlist draw payloads.

Important behavior:

- Accepts `session`, `s`, or `id`.
- Reads `password` and passes it to the iframe.
- The iframe uses `label=waitlist`.
- Optional WebSocket mode joins `out:3`, `in:4`.
- `processInput` watches for `drawmode` and `waitlist`.
- It counts waitlist entries where `randomStatus === 1`, ignoring entries where `waitStatus == 1`.
- It creates 150 falling confetti elements only when `drawmode` is true and at least one winner is present.

URL parameters observed:

- Session/security: `session`, `s`, `id`, `password`.
- Server path: `server`, `server2`, `localserver`.
- Visuals: `scale`, `chroma`, `transparent`.

Support checks:

- If it is blank, confirm the waitlist draw is actually running and that the payload includes winner state.
- Ordinary chat messages, donations, and generic API pings will not trigger confetti.
- If it works in a browser but not OBS, refresh the OBS Browser Source and confirm transparency is not hiding the effect.

## `wordcloud.html`

`wordcloud.html` builds a D3 force-simulation word cloud from incoming chat messages.

Important behavior:

- Uses `session` directly in the iframe URL; this pass did not find fallback prompting for missing session.
- Reads `password` and `lanonly`.
- The iframe uses `label=wordcloud`.
- Processes `data.content` wrappers before looking for `chatmessage`.
- Lowercases and trims incoming chat messages.
- Default mode only counts messages that are a single word matching `^\w+$` and not emoji.
- With `allwords`, it strips URLs and counts all word tokens in the message.
- Maintains an in-memory word count map and renders the top 100 words.
- If the payload contains `state`, it clears the cloud.
- No localStorage persistence was observed in this pass.
- No WebSocket fallback was observed in this pass.

URL parameters observed:

- Session/security: `session`, `password`, `lanonly`.
- Visuals: `style`, `scale`, `font`, `googlefont`.
- Parsing mode: `allwords`.

Support checks:

- If it is blank, try a simple one-word chat message first, such as `test`.
- If users type full sentences, add `allwords` or explain that default mode only counts single-word messages.
- If it resets unexpectedly, check for payloads containing a `state` field.
- If `server2/server3` is expected, source-check first; this pass only found iframe transport.

## `leaderboard.html`

`leaderboard.html` builds a live leaderboard from chat and event payloads. It can rank by combined score, gifts, donations, engagement/messages, or loyalty point snapshots.

Important behavior:

- Uses `session` directly in the iframe URL.
- Reads `password` and `lanonly`.
- The iframe label is `dock`.
- Optional `server2` or `server3` starts an extension relay WebSocket and joins `out:3`, `in:4`.
- Processes `data.content` wrappers.
- Handles `event === "points_leaderboard"` snapshots when `leaderboard` is an array.
- For normal live events, requires `chatname` and `type`.
- Removes bot users when payloads include `bot === true`.
- Tracks message count, donation amount, gifts, gift values, bits/coins, membership status, mod/VIP/verified state, and event count.
- Donation amount comes from `hasDonation`, `donation`, `donoValue`, and `currency.js` conversion where available.
- Gift quantity can come from `giftCount`, `giftcount`, `total`, `count`, `quantity`, `giftQuantity`, or `gifts`.
- `persistdata` stores state in localStorage using `leaderboard_${session}_${rankingType}`.
- Persisted data older than seven days is discarded.
- `reset` is an interval in hours; when reached, it clears users and removes persisted data for that storage key.

URL parameters observed:

- Session/security: `session`, `password`, `lanonly`.
- Transport: `server2`, `server3`.
- Layout/theme: `layout`, `theme`, `compact`, `bg`, `title`, `notitle`.
- Ranking: `category`, `period`, `rankby`, `donations`, `showvalue`.
- Rotation/ticker: `rotateinterval`, `includeweekly`, `transitionstyle`, `tickerscroll`, `scrollspeed`.
- Limits: `maxentries`, `top`.
- Display: `showavatar`, `avatars`, `showsource`, `hideempty`, `autohide`, `hidedelay`, `animated`, `updateinterval`.
- Persistence/reset: `persistdata`, `reset`.
- Test/demo: `demo`.

Ranking/event notes:

- Contribution events include raids, hosts, follows, joins, likes, cheers, channel points, rewards, gifts, subs, memberships, and legacy alias names.
- Gift events include gift purchase/redemption/subscription-gift style payloads and legacy gift aliases.
- Membership events include sponsorship/member milestone/new subscriber/resub style payloads and legacy membership aliases.
- `rankby=loyalty` depends on `points_leaderboard` snapshots rather than ordinary chat scoring.

Support checks:

- If it stays empty, confirm incoming payloads include both `chatname` and `type`.
- If donations do not rank, confirm `hasDonation`/`donation` is a positive marker and that `currency.js` can parse the platform/source value.
- If gifts look too low or too high, inspect the quantity field and whether `showvalue` is expected.
- If old names keep returning, remove `persistdata`, clear localStorage for the page, or change/reset the session/ranking key.
- If it only works with `server2/server3`, check the extension relay/server setup and same session.

## Page Choice Notes

Do not confuse these pages with `multi-alerts.html`:

- Use `multi-alerts.html` for animated alert popups.
- Use `events.html` for an event log/dashboard that can show rich metadata and selectable event cards.
- Use `hype.html` for viewer/chatter count presentation.
- Use `leaderboard.html` for accumulated user ranking over time.
- Use `wordcloud.html` for chat-word aggregation.
- Use `confetti.html` only for waitlist draw winner celebration.

## Common Failures

| Symptom | Likely Cause | First Fix |
| --- | --- | --- |
| Page loads but nothing appears | No matching session traffic or wrong payload type | Open dock/source with the same session and send a known compatible event. |
| Ordinary chat does not trigger the page | The page expects event, hype, waitlist, or ranking payloads | Match the page to the payload family. |
| Works in browser but not OBS | OBS browser source cache, transparency, audio/visibility, or stale URL | Refresh OBS source, paste the same URL in a normal browser, then compare. |
| Counts or rankings look stale | Local state or persistence is still active | Use reset controls/parameters or clear localStorage for that page. |
| API/WebSocket success but page does not change | Target page is not open, wrong session/channel, or wrong page family | Confirm page URL, session, channel pair, and payload shape. |

## Safe Answer Pattern

For support replies, answer in this order:

1. Name the exact page and URL shape.
2. Say what payload family it expects.
3. Say what must be open and on the same session.
4. Mention the key filter or state setting that can hide output.
5. Avoid asking for full URLs with sessions/passwords in public channels.

Example:

```text
For a word cloud, use `wordcloud.html?session=YOUR_SESSION`. It only builds from incoming `chatmessage` payloads. By default it counts single-word messages, so try a one-word test first or add `&allwords` for full-message token counting. Keep the source side open on the same session.
```

## Follow-Up Extraction Needs

- Trace popup/menu builders that generate these URLs.
- Add line-level mappings for every URL parameter.
- Capture sample payloads for `hype`, `viewer_updates`, waitlist draw winners, `points_leaderboard`, and donation/gift leaderboard events.
- Check if `events.html` should support `password` but currently does not parse it.
- Validate each page in OBS/browser with controlled payloads before calling behavior tested.
