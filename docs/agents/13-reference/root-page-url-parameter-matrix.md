# Root Page URL Parameter Matrix

Status: quick generated-source inventory on 2026-06-24. No browser, OBS, app, or WebSocket runtime validation was performed.

## Purpose

Use this page to answer: "Which root HTML page appears to parse which URL parameters?"

This matrix is a resource map, not a behavior guarantee. It helps future agents choose the right source file to inspect before giving support advice.

For source-checked behavior and server/channel caveats, use `url-parameter-source-trace.md`. For theme, game, and WebSocket source page inventory, use `subpage-url-parameter-matrix.md`. For generated dock parameter docs, use `url-parameter-index.md`.

## Method

The pass scanned 70 root `*.html` files in `C:\Users\steve\Code\social_stream` for:

- `URLSearchParams`
- `location.search`
- literal calls like `urlParams.has("name")`, `urlParams.get("name")`, and `urlParams.getAll("name")`
- common helper calls like `hasParam("name")`, `getParam("name")`, `getBooleanParam("name")`, `readNumberParam("name")`, and `readOptionalNumberParam(["name"])`

Known limits:

- Dynamic parameter names can be missed.
- Commented-out code can be counted if it still contains literal parser calls.
- A parameter being read does not prove the feature works at runtime.
- This pass covers root HTML pages only, not `themes/**/*.html`, `games/**/*.html`, or source pages under `sources/websocket/`.
- Recheck source before treating a row as final support guidance.

## Summary Counts

| Metric | Count |
| --- | ---: |
| Root HTML files scanned | 70 |
| Root HTML files with `URLSearchParams`, `location.search`, or detected literal params | 50 |
| Root HTML files without detected URL parser usage | 20 |

## High-Count Pages

These pages have large or complex parser surfaces. Use their dedicated docs before repeating every parameter name in a support answer.

| Page | Detected Params | Primary Follow-Up |
| --- | ---: | --- |
| `dock.html` | 263 | `url-parameter-index.md`, `url-parameter-source-trace.md`, `07-overlays-and-pages/dock.md` |
| `featured.html` | 86 | `url-parameter-source-trace.md`, `07-overlays-and-pages/featured.md` |
| `bot.html` | 77 | Inspect current source; appears featured-like but needs a dedicated pass before public guidance. |

## Pages With Detected Parameters

| Page | Count | Detected Literal Parameters |
| --- | ---: | --- |
| `actions.html` | 21 | `b64css`, `base64css`, `css`, `cssb64`, `cssbase64`, `duration`, `id`, `js`, `localserver`, `obsdebug`, `obspassword`, `obspw`, `obsstatus`, `obswebsocket`, `obsws`, `password`, `s`, `server`, `server2`, `session`, `volume` |
| `aiprompt.html` | 3 | `password`, `session`, `v` |
| `automix.html` | 2 | `chat`, `vdo` |
| `baretempate.html` | 3 | `lanonly`, `password`, `session` |
| `battle.html` | 12 | `id`, `lanonly`, `lobby`, `lobbytime`, `localserver`, `nocomputers`, `password`, `s`, `server`, `server2`, `server3`, `session` |
| `chatbot.html` | 3 | `img`, `password`, `session` |
| `cohost-overlay.html` | 26 | `avatar`, `botname`, `bubble`, `hideafter`, `hidebubble`, `hideidle`, `in`, `inchan`, `label`, `localserver`, `name`, `out`, `outchan`, `pagebg`, `password`, `position`, `preview`, `room`, `scale`, `server`, `server2`, `server3`, `session`, `speak`, `status`, `tts` |
| `confetti.html` | 10 | `chroma`, `id`, `localserver`, `password`, `s`, `scale`, `server`, `server2`, `session`, `transparent` |
| `content.html` | 29 | `b64css`, `base64css`, `botlist`, `chroma`, `css`, `cssb64`, `cssbase64`, `darkmode`, `hidebots`, `hidedupes`, `hidereplies`, `id`, `js`, `lanonly`, `lightmode`, `limit`, `localserver`, `max`, `myname`, `password`, `s`, `scale`, `server`, `server2`, `server3`, `session`, `showtime`, `speed`, `transparent` |
| `createtestmessage.html` | 4 | `apiid`, `delivery`, `id`, `session` |
| `credits.html` | 27 | `dockbg`, `donationpriority`, `duration`, `endmessage`, `font`, `googlefont`, `hidecategories`, `lanonly`, `loop`, `nobg`, `noinstructions`, `nosourcetype`, `onlydonors`, `pagebackground`, `pagebg`, `password`, `persistcredits`, `server2`, `server3`, `session`, `showamounts`, `showavatar`, `showavatars`, `speed`, `style`, `textcolor`, `triggermode` |
| `emotes.html` | 35 | `b64css`, `bademotes`, `base64css`, `botlist`, `chroma`, `css`, `cssb64`, `cssbase64`, `darkmode`, `dockbg`, `floatup`, `hidebots`, `hidedupes`, `hidereplies`, `id`, `js`, `lanonly`, `lightmode`, `limit`, `localserver`, `max`, `membersonly`, `myname`, `pagebackground`, `pagebg`, `password`, `s`, `scale`, `server`, `server2`, `server3`, `session`, `showtime`, `speed`, `transparent` |
| `events.html` | 27 | `currency`, `debug`, `donationsonly`, `font`, `giftedsubsonly`, `googlefont`, `hidemeta`, `highlightvalue`, `lang`, `language`, `lightmode`, `ln`, `localserver`, `maxevents`, `minvalue`, `notime`, `scale`, `server`, `server2`, `session`, `showviewercount`, `sources`, `topbarbg`, `transparency`, `transparent`, `viewerbarbackground`, `viewerbarbg` |
| `fonts.html` | 1 | `font` |
| `games.html` | 10 | `chroma`, `darkmode`, `demo`, `lanonly`, `password`, `room`, `server`, `server2`, `server3`, `session` |
| `gif.html` | 9 | `gifcommand`, `gifid`, `label`, `lanonly`, `muted`, `password`, `session`, `showtime`, `stretch` |
| `giveaway-obs-entries.html` | 12 | `debug`, `hidekeyword`, `hidestatus`, `id`, `localserver`, `password`, `s`, `server`, `session`, `size`, `style`, `theme` |
| `giveaway.html` | 8 | `debug`, `id`, `localserver`, `obs`, `password`, `s`, `server`, `session` |
| `hype.html` | 47 | `align`, `alignright`, `b64css`, `base64css`, `chattersonly`, `chroma`, `combineall`, `combineyoutube`, `css`, `cssb64`, `cssbase64`, `darkmode`, `dockbg`, `font`, `fontsize`, `googlefont`, `hidetitle`, `id`, `in`, `inchan`, `js`, `lang`, `language`, `lightmode`, `ln`, `localserver`, `nooutline`, `opacity`, `out`, `outchan`, `pagebackground`, `pagebg`, `password`, `s`, `scale`, `server`, `server2`, `session`, `showtime`, `speed`, `style`, `topbarbg`, `transparent`, `uniqueid`, `viewerbarbackground`, `viewerbarbg`, `viewersonly` |
| `input.html` | 4 | `password`, `server`, `session`, `transparent` |
| `leaderboard.html` | 34 | `animated`, `autohide`, `avatars`, `bg`, `category`, `compact`, `demo`, `donations`, `hidedelay`, `hideempty`, `includeweekly`, `lanonly`, `layout`, `maxentries`, `notitle`, `password`, `period`, `persistdata`, `rankby`, `reset`, `rotateinterval`, `scrollspeed`, `server2`, `server3`, `session`, `showavatar`, `showsource`, `showvalue`, `theme`, `tickerscroll`, `title`, `top`, `transitionstyle`, `updateinterval` |
| `map.html` | 45 | `accent`, `accentalt`, `accentAlt`, `allowchanges`, `allowChanges`, `autofit`, `autoFit`, `autofitmarkers`, `autoFitMarkers`, `autostart`, `autoStart`, `colorintensity`, `colorIntensity`, `debug`, `hidenumbers`, `hideNumbers`, `label`, `localserver`, `mapautofit`, `mapAutoFit`, `mapcolorintensity`, `mapColorIntensity`, `maphidenumbers`, `mapHideNumbers`, `mapmotion`, `mapMotion`, `mapregion`, `mapscale`, `mapScale`, `mapstyle`, `mapStyle`, `maptype`, `mapType`, `motion`, `password`, `region`, `server`, `server2`, `server3`, `session`, `showlist`, `showList`, `showtotals`, `showTotals`, `title` |
| `meta.html` | 35 | `align`, `alignright`, `auction`, `commerce`, `compact`, `hideauctionextras`, `hidecommerceextras`, `hidedebugmeta`, `hidefields`, `hidetitle`, `hideviewerplatforms`, `hype`, `lanonly`, `layout`, `localserver`, `nobg`, `noicon`, `nolabel`, `nooutline`, `novalue`, `opacity`, `othermeta`, `pagebg`, `password`, `position`, `scale`, `server`, `server2`, `server3`, `session`, `style`, `theme`, `title`, `transparent`, `viewers` |
| `poll.html` | 17 | `debug`, `localserver`, `password`, `pollDonationWeighted`, `pollEnabled`, `pollMatchMode`, `pollOptions`, `pollQuestion`, `pollSpam`, `pollTally`, `pollTimer`, `pollType`, `server`, `server2`, `server3`, `session`, `style` |
| `reactions.html` | 19 | `align`, `burst`, `in`, `inchan`, `label`, `layout`, `limit`, `localserver`, `out`, `outchan`, `pagebg`, `password`, `room`, `scale`, `server`, `server2`, `server3`, `session`, `speed` |
| `sample_wss_source.html` | 4 | `id`, `localserver`, `s`, `session` |
| `sampleapi.html` | 4 | `channelin`, `channelout`, `localserver`, `session` |
| `sampleemote.html` | 4 | `id`, `password`, `s`, `session` |
| `samplefeatured.html` | 9 | `id`, `localserver`, `password`, `s`, `savetodisk`, `server`, `server2`, `server3`, `session` |
| `sampleoverlay.html` | 9 | `deleteonlylast`, `fadezone`, `limit`, `localserver`, `reverse`, `server`, `server2`, `session`, `showtime` |
| `scoreboard.html` | 29 | `animations`, `bgcolor`, `chatpoints`, `customtriggers`, `donationpoints`, `font`, `googlefont`, `hideavatar`, `hideplatform`, `hidepoints`, `hiderank`, `highlightchanges`, `id`, `lanonly`, `layout`, `maxusers`, `minpoints`, `password`, `preview`, `s`, `scale`, `server`, `server2`, `server3`, `session`, `textcolor`, `theme`, `title`, `transparent` |
| `septapus.html` | 8 | `b64css`, `base64css`, `css`, `cssb64`, `cssbase64`, `font`, `googlefont`, `session` |
| `spotify-overlay.html` | 26 | `accent`, `compact`, `hidealbum`, `hideart`, `hidedevice`, `hideinactive`, `hidenosong`, `hideoffline`, `hidepaused`, `hideprogress`, `hidestatus`, `in`, `inchan`, `label`, `localserver`, `out`, `outchan`, `password`, `room`, `server`, `server2`, `server3`, `session`, `style`, `theme`, `ticker` |
| `test-giveaway-webrtc.html` | 4 | `id`, `password`, `s`, `session` |
| `ticker.html` | 34 | `allowwrap`, `b64css`, `base64css`, `chroma`, `css`, `cssb64`, `cssbase64`, `display`, `font`, `fontsize`, `gap`, `googlefont`, `id`, `js`, `localserver`, `password`, `preserve`, `preservespace`, `preserveSpaces`, `rotateinterval`, `rotateorder`, `rotatepause`, `s`, `scrollcopies`, `separator`, `server`, `server2`, `session`, `speed`, `speedmode`, `style`, `transparent`, `wordwrap`, `wrap` |
| `timer.html` | 23 | `autostart`, `b64css`, `base64css`, `controls`, `countup`, `css`, `cssb64`, `cssbase64`, `current`, `customsound`, `danger`, `duration`, `label`, `localserver`, `mode`, `operator`, `password`, `scale`, `server`, `session`, `sound`, `style`, `warn` |
| `tipjar.html` | 47 | `alignright`, `barbackground`, `barcolorend`, `barcolorstart`, `baronly`, `barradius`, `bartrackcolor`, `carryover`, `celebration`, `controls`, `countgiftredemptions`, `currentamount`, `donationsource`, `donationtype`, `fillend`, `fillmode`, `fillstart`, `hidecompletions`, `hype`, `initialamount`, `jarimage`, `localserver`, `mode`, `nogifts`, `noliquid`, `noresetoncomplete`, `noresubs`, `nosubs`, `notips`, `password`, `persistent`, `resetoncomplete`, `room`, `server`, `server2`, `session`, `sound`, `startamount`, `style`, `theme`, `tipjarsource`, `tipjartype`, `tipjarunit`, `tipjarunitlabel`, `title`, `trackcolor`, `unit` |
| `waitlist.html` | 43 | `aligncenter`, `alignright`, `b64css`, `base64css`, `chroma`, `confetti`, `css`, `cssb64`, `cssbase64`, `customsound`, `darkmode`, `dockbg`, `drawmode`, `font`, `googlefont`, `hidetitle`, `id`, `includemessage`, `js`, `lang`, `language`, `lightmode`, `ln`, `localserver`, `messagesize`, `nooutline`, `opacity`, `pagebackground`, `pagebg`, `password`, `random`, `randomize`, `s`, `scale`, `server`, `server2`, `session`, `showsource`, `showtime`, `sound`, `soundvolume`, `speed`, `transparent` |
| `wordcloud.html` | 8 | `allwords`, `font`, `googlefont`, `lanonly`, `password`, `scale`, `session`, `style` |

## Pages With URL Parser Markers But No Literal Params Found

These pages included URL parser markers in the quick scan, but the literal-name extractor did not find parameter names. Inspect the source before assuming they have no URL options.

- `aioverlay.html`
- `chat-overlay.html`
- `cohost.html`
- `index.html`
- `obs-websocket-test.html`
- `recover.html`
- `shop_the_stream.html`
- `spotify.html`

## Root Pages Without Detected URL Parser Usage

These pages did not show `URLSearchParams` or `location.search` in the quick scan.

- `404.html`
- `TOS.html`
- `affiliate.html`
- `background.html`
- `beta.html`
- `chathistory.html`
- `landing.html`
- `message-ai-export.html`
- `midimonitor.html`
- `minecraft.html`
- `multi-alerts.html`
- `popup.html`
- `privacy.html`
- `replaymessages.html`
- `simple_api_client.html`
- `streamelements-importer.html`
- `streamerbot.html`
- `tts.html`
- `urleditor.html`
- `vdo.html`

## Follow-Up Work

- Generate the same kind of matrix for `themes/**/*.html`, `games/**/*.html`, and `sources/websocket/**/*.html`.
- Promote high-count pages with weak docs, especially `bot.html`, `meta.html`, `content.html`, `gif.html`, `input.html`, and `spotify-overlay.html`.
- Mark commented-out or dormant parameter branches, especially page-specific `server` handling.
- Pair this inventory with runtime validation before claiming a parameter is tested.
