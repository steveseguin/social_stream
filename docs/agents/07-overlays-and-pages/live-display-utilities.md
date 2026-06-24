# Live Display Utilities

Status: heavy extraction pass from `emotes.html`, `reactions.html`, `scoreboard.html`, `ticker.html`, and `map.html` on 2026-06-24.

Use this page when a user asks about floating emotes, reaction bursts, points scoreboards, ticker text, or viewer-location maps. These are receiving/display pages. They do not capture platform chat by themselves.

## Source Anchors

- `emotes.html`
- `reactions.html`
- `scoreboard.html`
- `ticker.html`
- `map.html`
- `sources/images/*.png`
- `thirdparty/iso-3166.json`
- `thirdparty/world-110m.json`
- `thirdparty/map/*.json`

## Fast Routing

| User Wants | Page | Typical URL | Payload Needed | First Check |
| --- | --- | --- | --- | --- |
| Floating emoji, emote images, and SVGs from chat | `emotes.html` | `https://socialstream.ninja/emotes.html?session=SESSION_ID` | `chatmessage` containing emoji, images, or SVGs | Send a message that actually contains rendered emotes/emoji. |
| Like/reaction bursts | `reactions.html` | `https://socialstream.ninja/reactions.html?session=SESSION_ID` | Event `reaction`, `liked`, or `like` | Confirm the platform/source emits reaction/like event payloads. |
| Points scoreboard | `scoreboard.html` | `https://socialstream.ninja/scoreboard.html?session=SESSION_ID` | `points_leaderboard` snapshot or local scoring payloads | Enable points snapshot path or local scoring URL flags. |
| Scrolling or rotating ticker text | `ticker.html` | `https://socialstream.ninja/ticker.html?session=SESSION_ID` | Payload with `ticker` | Send a `ticker` value as a string or array. |
| Viewer location voting map | `map.html` | `https://socialstream.ninja/map.html?session=SESSION_ID` | Chat messages containing recognizable country/state/city text | Confirm map collection is enabled and the chat text resolves to a place. |

## Shared Support Rule

If one of these pages is blank, check payload shape before debugging OBS:

- `emotes.html` needs `chatmessage` with visual emote content.
- `reactions.html` ignores ordinary chat and only accepts `reaction`, `liked`, or `like` events.
- `scoreboard.html` needs a points snapshot or URL-enabled local scoring.
- `ticker.html` needs a `ticker` field.
- `map.html` needs chat text that resolves to a country, state, or city.

## `emotes.html`

`emotes.html` extracts emoji, image emotes, and SVG emotes from incoming chat messages and animates them across the page.

Important behavior:

- Accepts `session`, `s`, or `id`.
- Reads `password` and `lanonly`.
- Normal iframe bridge uses `label=dock`.
- Optional WebSocket modes use `server`, `server2`, `server3`, or `localserver`; observed channel pair is `out:3`, `in:4`.
- Ignores internal dock/control payloads such as `mid`, `pin`, `unpin`, `queueInit`, `queue`, and `deleteMessage`.
- Unwraps `data.content` before processing.
- Requires `chatmessage`.
- Extracts Unicode emoji from text, image tags, and SVG tags from the rendered chat HTML.
- `hidedupes` suppresses duplicate emote/image/SVG content.
- `membersonly` requires `membership` or `hasMembership`.
- `hidebots` can hide payloads with `bot === true`; `myname` or `botlist` can extend the bot list.
- `hidereplies` drops messages that contain words starting with `@`.
- `bademotes` filters configured emoji from display.
- `floatup` changes animation behavior and defaults timeout behavior toward shorter floating bursts.

URL parameters observed:

- Session/security: `session`, `s`, `id`, `password`, `lanonly`.
- Server path: `server`, `server2`, `server3`, `localserver`.
- Limits/timing: `showtime`, `floatup`, `limit`, `max`, `speed`.
- Filters: `hidedupes`, `membersonly`, `hidereplies`, `bademotes`, `myname`, `botlist`, `hidebots`.
- Visuals: `scale`, `chroma`, `darkmode`, `lightmode`, `transparent`, `pagebg`, `pagebackground`, `dockbg`.
- Custom code/style: `css`, `base64css`, `b64css`, `cssbase64`, `cssb64`, `js`.

Support checks:

- If it is blank, send a chat message with a normal emoji first.
- If platform emotes do not show, inspect whether the source payload includes image/SVG HTML in `chatmessage`.
- If too many emotes appear, use `limit`/`max` and `hidedupes`.
- If a bot keeps triggering emotes, use `hidebots` and the `myname`/`botlist` parameter.

## `reactions.html`

`reactions.html` is an event reaction overlay. It is not a general emote/chat overlay.

Runtime evidence:

- `browser-validated` on 2026-06-24 for controlled local Playwright behavior only. `node scripts/playwright-reactions-overlay-e2e.cjs` passed with `Reactions overlay test passed with 12 blocked external request(s).`
- Validated: popup-generated reactions URL parameters, URL parsing for `align`, `layout`, `scale`, `speed`, `burst`, `limit`, `pagebg`, and `triple`, synthetic VDO bridge `liked` payload handling, direct `reaction`/`liked` payload rendering, inline image scaling, fake WebSocket endpoint/channel joins for server modes, and controlled TikTok anonymous-like target routing.
- Not validated by that pass: OBS, hosted page behavior, real installed extension runtime, real VDO bridge delivery, real WebSocket relay delivery, live TikTok behavior, standalone app behavior, or long-running persistence.
- Evidence log: `17-runtime-validation-evidence-log.md`.

Important behavior:

- Accepts `session` or `room`.
- Reads `password`.
- Default bridge label is `reactions`, but `label` can override it.
- Uses configurable WebSocket channels with `out`/`outchan` and `in`/`inchan`, defaulting to `out:3`, `in:4`.
- `server` uses the API-style endpoint default; `server2` and `server3` use the extension-style endpoint default.
- Also supports `localserver`.
- Accepts payloads wrapped in `dataReceived.overlayNinja` or `overlayNinja`.
- Only processes normalized event names `reaction`, `liked`, and `like`.
- Suppresses duplicate signatures for about 2.5 seconds.
- `liked` and `like` events spawn a like burst.
- `reaction` events spawn individual reaction media/fallback reactions.

URL parameters observed:

- Session/security: `session`, `room`, `password`, `label`.
- Server/channel: `server`, `server2`, `server3`, `localserver`, `out`, `outchan`, `in`, `inchan`.
- Visuals/behavior: `scale`, `speed`, `burst`, `limit`, `pagebg`, `align`, `layout`, `triple`.

Support checks:

- If it is blank, confirm the source emits reaction-like event payloads; ordinary chat messages are ignored.
- If duplicates appear, capture the raw payload and compare event/type/name/message/id fields because those form the dedupe signature.
- If the page shows a setup note, the URL is missing `session` or `room`.

## `scoreboard.html`

`scoreboard.html` is a points display page. It is related to `leaderboard.html`, but its primary source is points snapshots and optional local scoring flags.

Runtime evidence:

- `browser-validated` on 2026-06-24 for controlled local Playwright behavior only. `node scripts/playwright-scoreboard-e2e.cjs` passed with `PASS scoreboard e2e`.
- Validated: preview-mode synthetic `points_leaderboard` rendering, `maxusers`, `minpoints`, `layout=ticker`, `theme=neon`, title text, subtitle summary, local `chatpoints`, `donationpoints`, `customtriggers`, compact layout, and `hidepoints`.
- Not validated by that pass: OBS, hosted page, extension/app bridge, live source payloads, WebSocket/server modes, session/password/label routing, or long-running persistence.
- Evidence log: `17-runtime-validation-evidence-log.md`.

Important behavior:

- Accepts `session`, `s`, or `id`.
- Reads `password`.
- Normal iframe bridge uses `label=dock`.
- Optional WebSocket path uses `server`, `server2`, or `server3` and joins `out:3`, `in:4`.
- `preview` allows direct `postMessage` payload testing without enforcing iframe source.
- Handles `event === "points_leaderboard"` or `type === "points_leaderboard"` when the payload contains `leaderboard`.
- Also accepts any payload with `leaderboard` and `reason`.
- Local scoring is opt-in:
  - `chatpoints` adds 1 point for messages with `chatmessage`.
  - `donationpoints` adds donation-derived points for `hasDonation`.
  - `customtriggers` adds numeric `score`, `meta.score`, or `meta.points`.
- Does not store state in localStorage in this pass; local scores are in memory.

URL parameters observed:

- Session/security: `session`, `s`, `id`, `password`, `lanonly`.
- Server/path: `server`, `server2`, `server3`, `preview`.
- Layout/theme: `layout`, `theme`, `title`, `font`, `googlefont`, `bgcolor`, `textcolor`, `scale`, `transparent`.
- Data/ranking: `maxusers`, `minpoints`, `chatpoints`, `donationpoints`, `customtriggers`.
- Visibility/animation: `hidepoints`, `hiderank`, `hideavatar`, `hideplatform`, `animations`, `highlightchanges`.

Support checks:

- If it says it is waiting for points, confirm a `points_leaderboard` snapshot is being sent or add a local scoring flag.
- If ordinary chat does not change it, `chatpoints` must be present.
- If donation scoring does not change it, `donationpoints` must be present and `hasDonation` must parse as a positive amount.
- If custom scores do not count, verify the payload contains numeric `score`, `meta.score`, or `meta.points`.

## `ticker.html`

`ticker.html` displays text items from a `ticker` payload as a scrolling or rotating ticker.

Important behavior:

- Accepts `session`, `s`, or `id`.
- Reads `password`.
- Normal iframe bridge uses `label=ticker`.
- Optional WebSocket path uses `server` or `server2` and joins `out:7`, `in:8`.
- `processInput` returns unless `ticker` exists in the payload.
- `ticker` can be an array or a string. Strings are split by line breaks.
- Empty entries become spacer items.
- `display=rotate` switches from scrolling to one-item-at-a-time rotation.
- Scroll mode repeats entries with `scrollcopies`; rotate mode can use sequential or random order.

URL parameters observed:

- Session/security: `session`, `s`, `id`, `password`.
- Server/path: `server`, `server2`, `localserver`.
- Style: `font`, `fontsize`, `googlefont`, `style`, `css`, `base64css`, `b64css`, `cssbase64`, `cssb64`, `chroma`, `transparent`, `js`.
- Motion/display: `speed`, `speedmode`, `display`, `rotateinterval`, `rotatepause`, `rotateorder`, `separator`, `gap`, `scrollcopies`.
- Text wrapping: `preserveSpaces`, `preservespace`, `preserve`, `wrap`, `wordwrap`, `allowwrap`.

Support checks:

- If it is blank, send a payload with a top-level `ticker` field.
- If a normal chat message is expected to appear automatically, clarify that this page is not a generic chat ticker.
- If text is too fast or too slow, use `speed`; for smoother timing, test `speedmode=time`.
- If multiple ticker items are needed, send `ticker` as an array or newline-separated string.

## `map.html`

`map.html` is an interactive viewer-location voting map. It tries to resolve chat messages to countries, states, or cities and tallies unique voters.

Important behavior:

- Uses case-insensitive parameter lookup for many map settings.
- If `session` is missing, it does not join the bridge; it listens only for direct page messages.
- Reads `password`.
- Default bridge label is `map`, overrideable with `label`.
- Main API socket path uses `server` or `localserver`, joining `out:2`, `in:1`.
- Extension socket path uses `server2` or `server3`, joining `out:3`, `in:4`.
- Loads local map datasets from `thirdparty/iso-3166.json`, `thirdparty/world-110m.json`, and `thirdparty/map/*`.
- Queues chat messages until map data is ready.
- Processes commands in `cmd`: `resetmap`, `resetpoll`, `reset`, `startmap`, `start`, `resume`, `unpause`, `unpausemap`, `pausemap`, `pause`, `stop`, `stopmap`, `enable`, `enablemap`, `disable`, `disablemap`.
- Processes `settings` payload updates and individual `setting`/`value` updates.
- For chat messages, resolves `chatmessage` as a country/state/city and registers a vote under a voter key built from name, source, and user id.
- `allowchanges` controls whether existing voters can change location.
- `multi`, `mapspam`, or `mapSpam` allow multiple votes.
- `maptype` supports `country`, `state`, or `city`.
- `region`/`mapregion` can restrict the visible/accepted map area.

URL parameters observed:

- Session/security: `session`, `password`, `label`.
- Server/path: `server`, `server2`, `server3`, `localserver`.
- Display/settings: `title`, `showlist`, `showList`, `showtotals`, `showTotals`, `allowchanges`, `allowChanges`, `accent`, `accentalt`, `accentAlt`, `maptype`, `mapType`, `mapstyle`, `mapStyle`, `region`, `mapregion`, `motion`, `mapmotion`, `mapMotion`, `mapscale`, `mapScale`.
- Voting: `multi`, `mapspam`, `mapSpam`.
- Behavior: `autostart`, `autoStart`, `autofit`, `autoFit`, `autofitmarkers`, `autoFitMarkers`, `mapautofit`, `mapAutoFit`, `hidenumbers`, `hideNumbers`, `maphidenumbers`, `mapHideNumbers`, `colorintensity`, `colorIntensity`, `mapcolorintensity`, `mapColorIntensity`, `debug`.

Support checks:

- If it is blank, confirm the page can load the `thirdparty` JSON assets and that the session is present.
- If chat does not register, test a simple country name such as `Canada` or `Japan`.
- If users cannot change their answer, check `allowchanges`.
- If repeated messages inflate counts, check `multi`, `mapspam`, or `mapSpam`.
- If state/city mode misses a location, switch to `maptype=country` to confirm base voting works.

## Page Choice Notes

- Use `emotes.html` for visual emotes from chat content.
- Use `reactions.html` for like/reaction event bursts.
- Use `scoreboard.html` for points-system snapshots or opt-in local score counters.
- Use `leaderboard.html` when the user wants donor/gifter/contributor rankings rather than points snapshots.
- Use `ticker.html` only when another page/API path sends `ticker` payloads.
- Use `map.html` when viewers should vote with location text.

## Common Failures

| Symptom | Likely Cause | First Fix |
| --- | --- | --- |
| Emotes page is blank | Chat payload has plain text only | Send a real emoji or platform emote and inspect `chatmessage`. |
| Reaction page is blank | Source does not emit reaction/like events | Confirm event payload name is `reaction`, `liked`, or `like`. |
| Scoreboard says waiting for points | No points snapshot and no local scoring flags | Send `points_leaderboard` or add `chatpoints`, `donationpoints`, or `customtriggers`. |
| Ticker does nothing | Payload lacks `ticker` | Send top-level `ticker` as string or array. |
| Map ignores chat | Message does not resolve to a known place, or map is paused/disabled | Test a simple country and check map commands/settings. |

## Follow-Up Extraction Needs

- Trace popup/API command senders for ticker, map, points scoreboard, reactions, and emotes.
- Capture sample payloads for emotes, ticker, and map; reactions already have a narrow controlled synthetic payload pass, but still need live/platform and OBS examples.
- Extend controlled browser validation beyond the current scoreboard and reactions passes to emotes, ticker, and map.
- Validate OBS rendering with controlled payloads for all live display utilities, including scoreboard.
- Compare `scoreboard.html` and `leaderboard.html` user-facing setup labels.
- Validate map region/city/state datasets and edge cases with real examples.
