# Waitlist Polls And Games

Status: heavy extraction pass started on 2026-06-24.

## Purpose

This page documents SSN's interactive browser/OBS tools: waitlists, polls, timers, giveaways, and chat-driven games. These tools consume SSN session traffic but often maintain their own state and command surfaces.

## Source Anchors

- `social_stream/waitlist.html`
- `social_stream/poll.html`
- `social_stream/timer.html`
- `social_stream/giveaway.html`
- `social_stream/giveaway-obs-entries.html`
- `social_stream/games.html`
- `social_stream/games/**`
- `social_stream/api.md`

## Shared Setup Pattern

Most pages require:

- `session`: SSN session ID.
- `password`: optional session password, defaulting to `false`.
- A hidden VDO.Ninja iframe bridge.

Many tools also support WebSocket/API mode with:

- `server`
- `server2`
- `server3`
- `localserver`

Do not assume every tool uses the same channels. Each page defines its own join channel pair and label.

## Waitlist

Page:

```text
waitlist.html
```

Connection:

- Reads `session`, `s`, or `id`.
- If opened as a local file without a session, it prompts for one.
- Hidden iframe uses `label=waitlist`.
- Optional WebSocket path joins with `out: 5`, `in: 6`.

Important URL parameters:

- `password`
- `drawmode`
- `includemessage`
- `messagesize`
- `randomize` or `random`
- `showsource`
- `hidetitle`
- `css`
- `base64css`, `b64css`, `cssbase64`, or `cssb64`
- `font`
- `scale`
- `alignright`
- `aligncenter`
- `showtime`
- `sound`
- `pagebg`, `pagebackground`, or `dockbg`

Incoming payload keys it handles:

- `waitlistmessage`: updates the title.
- `remove`: updates title/remove display state.
- `drawmode`: switches draw display behavior.
- `winlist`: winner list.
- `drawPoolSize`: current number of entries in the draw pool.
- `waitlist`: full waitlist array or `false`.

Waitlist entries can include:

- `chatname`
- `chatmessage`
- `waitlistJoinMessage`
- `waitlistTrigger`
- `type`
- `waitStatus`
- `randomStatus`

Common API actions documented in `api.md`:

- `removefromwaitlist`
- `highlightwaitlist`
- `resetwaitlist`
- `stopentries`
- `downloadwaitlist`
- `selectwinner`
- `drawmode`
- `waitlistmessage`

Support notes:

- If the waitlist page is blank, confirm the URL has the right session and the waitlist is actually receiving `waitlist` or draw payloads.
- `drawmode` changes display semantics. It can show only pool counts or winners rather than a normal queue.
- `showsource` depends on platform icon files under `sources/images`.

## Poll

Page:

```text
poll.html
```

Connection:

- Hidden iframe uses `label=poll`.
- `server` mode joins `out: 2`, `in: 1`.
- `server2` / `server3` extension mode joins `out: 3`, `in: 4`.

Core URL parameters:

- `session`
- `password`
- `pollType`: `freeform`, `multiple`, or `yesno`.
- `pollQuestion`
- `pollOptions`: comma-separated options.
- `pollMatchMode`: current code supports exact behavior and `hashtag-anywhere`.
- `pollTimer`
- `pollEnabled`
- `style`
- `pollSpam`
- `pollTally`
- `pollDonationWeighted`
- `debug`

Poll behavior:

- `yesno` sets options to `Yes` and `No`.
- `multiple` accepts numeric votes and text votes matching configured options.
- `freeform` accepts hashtags and numeric selection when options exist.
- `hashtag-anywhere` lets `#word` appear anywhere in the message.
- Votes are keyed by user ID when available, otherwise by name plus source.
- If `pollSpam` is off, duplicate voters are ignored.
- If `pollDonationWeighted` is on, donation amount can increase vote weight.
- UI updates are throttled to reduce DOM churn.

Commands accepted by the page:

- `startpoll`
- `resetpoll`
- `closepoll`

`api.md` also documents higher-level poll actions handled elsewhere:

- `loadpoll`
- `getpollpresets`
- `setpollsettings`
- `createpoll`

Support notes:

- If votes do not count, confirm `pollEnabled` is true and the poll is not closed.
- For multiple choice polls, users can vote by number or matching option text.
- For freeform polls, users generally vote with hashtags.
- Duplicate prevention can make testing look broken when the same name/user votes repeatedly.

## Timer

Page:

```text
timer.html
```

Connection:

- Hidden iframe uses `label=timer`.
- Optional `server` mode joins `out: 2`, `in: 1`.
- It can register with the extension by sending `registerTimer` once it sees the `SocialStream` peer.

Core URL parameters:

- `session`
- `password`
- `operator` or `controls`: show local controls and register as operator.
- `mode`: `countdown` or `countup`.
- `countup`: shorthand for count-up mode.
- `duration`
- `current`
- `label`
- `style`: `stage`, `compact`, or `ring`.
- `autostart`
- `warn`
- `danger`
- `sound`
- `customsound`
- `css`
- `base64css`, `b64css`, `cssbase64`, or `cssb64`
- `scale`
- `server`
- `localserver`

Commands accepted:

- `starttimer`
- `pausetimer`
- `toggletimer`
- `resettimer`
- `timeradd`
- `timersubtract`
- `settimer`
- `gettimerstate`

`settimer` accepts values such as:

- `seconds`
- `duration`
- `current`
- `currentSeconds`
- `label`
- `mode`
- `style`
- `warn`
- `warnSeconds`
- `danger`
- `dangerSeconds`
- `sound`
- `customsound`
- `soundUrl`
- `autostart`
- `running`

`gettimerstate` responds on the WebSocket with a callback result containing current timer state.

Support notes:

- Timer sound can require a user gesture before browsers allow playback.
- `operator`/`controls` affects whether the control panel is shown and whether the page registers itself as an operator.
- If remote commands fail, check whether the page is connected by iframe, API WebSocket, or only local controls.

## Giveaway

Pages:

```text
giveaway.html
giveaway-obs-entries.html
```

`giveaway.html` is the controller and entrant wheel. `giveaway-obs-entries.html` is the OBS companion view for wheel/winner display.

Connection:

- Reads `session`, `s`, or `id`.
- Hidden iframe uses `label=dock` because it consumes ordinary chat messages as entries.
- WebSocket mode joins `out: 5`, `in: 6`.
- Local communication uses `BroadcastChannel` when available, with localStorage fallback.

State:

- Entrants are stored in memory and persisted to `localStorage` as `giveawayWheelState`.
- Keyword is persisted as `giveaway_keyword`.
- Winners are persisted as `giveaway_winners`.
- Settings are persisted as `giveaway_settings`.

Entry behavior:

- Default keyword is `ENTER`.
- When exact match is disabled, any chat message containing the keyword can enter.
- When exact match is enabled, the keyword must match as a bounded word pattern.
- Entrant IDs are based on name plus platform, so the same user/platform only enters once.
- UI and broadcast updates are batched for high-rate chat.

Actions/broadcast messages:

- `giveaway_update`
- `entrants_update`
- `entrant_remove`
- `keyword_update`
- `spin_update`
- `winner_update`
- `style_update`
- `giveaway_state_request`

Support notes:

- If the OBS entries view does not update, confirm both pages use the same session and password.
- If entrants are not added, confirm the keyword and exact-match setting.
- If old entrants reappear, clear saved localStorage state or use the page controls to clear/reset.
- If high-volume chat lags, the page intentionally batches UI/broadcast saves.

## Games

Main page:

```text
games.html
```

Game files also exist under:

```text
games/
```

The inspected `games.html` implements a chat activity game called Spam Power.

Connection:

- Reads `session` or `room`, defaulting to `test`.
- Reads `password`.
- `lanonly` is passed into the iframe URL when present.
- Hidden iframe uses `label=dock`.
- `server` mode joins `out: 2`, `in: 1`.
- `server2` / `server3` extension mode joins `out: 3`, `in: 4`.

Display parameters:

- `chroma`
- `darkmode`
- `demo`

Behavior:

- Counts incoming SSN messages that include both `chatmessage` and `chatname`.
- Tracks messages per second.
- Applies multipliers at 5+ and 10+ messages per second.
- Maintains historical stats in localStorage: peak activity, wins, best streak, average win rate, and recent goals.
- `demo` injects sample chat messages for testing the game without a live source.

Support notes:

- If the game does not react, confirm it is receiving ordinary chat payloads on `label=dock`.
- If it seems too hard/easy, localStorage history influences dynamic goals.
- `demo` is useful to distinguish connection issues from rendering/game logic.

## Common Troubleshooting Across Tools

Tool page is blank:

- Check `session`.
- Check `password`.
- Confirm the relevant SSN feature is sending payloads for that tool.
- Open browser dev tools for JavaScript errors.

Remote/API control does not work:

- Confirm the relevant API toggles are enabled in SSN settings.
- Confirm the page is connected to the expected WebSocket server and channel pair.
- Use the exact action names; these pages generally lower-case commands.

OBS view does not update:

- Confirm OBS Browser Source URL has the same session/password.
- Confirm browser-source cache is not showing an old URL.
- For giveaway, confirm controller and OBS entries page are connected through the same local/session transport.

Audio does not play:

- Browser autoplay policy may require a click or keypress.
- Check OBS Browser Source audio settings.
- Confirm custom sound URL is reachable.

## Remaining Extraction Targets

- Extract each `games/*.html` file into a per-game matrix.
- Source-check `battle.html` and any score/battle pages not present in this pass.
- Trace popup-generated URLs for waitlist, poll, timer, and giveaway.
- Cross-check `api.md` command descriptions against current background command handlers.
