# URL Parameter Source Trace

Status: source-check pass on 2026-06-24. No browser, OBS, standalone app, or live WebSocket runtime validation was performed.

## Purpose

Use this page when a user asks why a URL option works on one SSN page but not another, or when a support answer needs to distinguish generated `dock.html` URL parameters from page-specific parser behavior.

This is not a public promise that every listed option is runtime-tested. It is a source-trace layer over the current HTML page parsers.

## Main Rule

SSN URL parameters are not global.

`url-parameter-index.md` is generated from `shared/config/urlParameters.js` and mostly describes the streaming overlay surface for `dock.html`. Many root pages create their own `URLSearchParams` instance and read only the parameters that page knows about.

If a parameter is in the generated index, that proves the name exists in the generated dock parameter docs. It does not prove `featured.html`, `timer.html`, `poll.html`, `tipjar.html`, a theme page, or a helper page supports it.

For quick page inventory, use `root-page-url-parameter-matrix.md` for root pages and `subpage-url-parameter-matrix.md` for theme, game, and WebSocket source pages.

## Source Anchors

Source files checked during this pass:

- `shared/config/urlParameters.js`
- `dock.html`
- `featured.html`
- `waitlist.html`
- `poll.html`
- `timer.html`
- `sampleoverlay.html`
- `sampleapi.html`
- `actions.html`
- `tipjar.html`
- `credits.html`
- `events.html`
- `hype.html`
- `wordcloud.html`
- `leaderboard.html`
- `emotes.html`
- `reactions.html`
- `scoreboard.html`
- `ticker.html`
- `map.html`
- existing page docs under `docs/agents/07-overlays-and-pages/`

Use current source before giving final-grade advice about a rare page, theme, or newly changed URL option.

## Source-Checked Rules

- Most URL parameters are read at page load. Users usually need to refresh the page or OBS browser source after changing them.
- `session`, `s`, and `id` are common aliases, but not every page accepts all three. Some pages use `room` instead or in addition.
- `password` is common and private. Do not share full URLs containing it.
- `server`, `server2`, `server3`, and `localserver` are page-specific. They do not always select the same endpoint or channel pair.
- `label` is overloaded. On API-targeted display pages it may be used as a target filter; on `timer.html` it is also the visible timer label.
- `style`, `theme`, `scale`, `speed`, `duration`, `sound`, and `title` are page-specific. Do not copy meanings across pages without checking that page.
- Boolean parsing differs. Some pages treat parameter presence as true; other pages parse values like `true`, `false`, `1`, `0`, `yes`, `no`, `on`, or `off`.
- Custom CSS support appears on many pages, but the exact aliases and behavior differ.
- Custom JS support is not universal and is a security boundary. Some pages allow `js`; `dock.html` restricts script injection to trusted hosting contexts such as OBS/Electron/file/GitHub-hosted contexts.

## Connection Parameter Matrix

This matrix covers the current source-checked parser branches, not every runtime path.

| Page | Session Params | Direct Server Params | Source-Checked Channel/Endpoint Behavior | Support Notes |
| --- | --- | --- | --- | --- |
| `dock.html` | `session`, `s`, `id` | `server`, `server2`, `server3`, `localserver` | `server` uses the API socket path and joins `out:2, in:1` in the normal branch; the featured-mode branch uses `out:2, in:2`. `server2` and `server3` use the extension socket path and join `out:3, in:4`. | Main generated URL parameter target. This page has many more options than most utility pages. |
| `featured.html` | `session`, `s`, `id` | `server`, `server2`, `server3`, `localserver` | `server` calls `setupSocket()` and joins `out:3, in:2`; `server2` calls `setupSocket(1)` and joins `out:3`; `server3` calls `setupSocket(2)` and joins `out:3, in:1`. | Similar to dock in concept, but parser and channel behavior are separate. |
| `waitlist.html` | `session`, `s`, `id` | direct `server`/`server2` code is commented out | Source contains an extension-socket setup for `out:5, in:6`, but the direct `server` and `server2` URL branch is commented with "not yet supporting this." | Do not promise `&server` works here until runtime/source is rechecked. |
| `poll.html` | `session`, `s`, `id` through `getSessionId()` | `server`, `server2`, `server3`, `localserver` | `server` uses API-style routing with `out:2, in:1`. `server2` and `server3` use the extension socket path with `out:3, in:4`. | Poll settings are parsed independently from dock settings. |
| `timer.html` | `session`, `s`, `id` | `server`, `localserver` | Direct WebSocket branch only starts when `server` is present and joins `out:2, in:1`. | Timer also has an iframe bridge labeled `timer`; `label` affects timer display state. |
| `giveaway.html` | `session`, `s`, `id` | `server`, `localserver` | Direct socket starts only when `server` or `localserver` is present and joins `out:5, in:6`. | `obs=true` switches the page into OBS widget mode. |
| `sampleoverlay.html` | `session` | `server`, `server2`, `localserver` | `server` or `server2` opens a socket and joins `out:3, in:4`. | Simple overlay sample; useful for custom overlay support. |
| `sampleapi.html` | `session` | `localserver`; channel params | Uses `channelout` and `channelin` controls; default examples show API server channel testing. | This is a testing/helper page, not a normal display overlay. |
| `actions.html` | `session`, `s`, `id` | `server`, `server2`, `localserver` | Defaults to the extension socket path and joins `out:5, in:6`. | Used by Event Flow/action output; supports `volume`, `duration`, OBS WebSocket params, CSS, JS, and TTS configuration. |
| `tipjar.html` | `session`, `room` | `server`, `server2`, `localserver` | Socket setup is gated by `server` or `server2`. Source computes default server differently depending on whether a server param exists. | `style`, `theme`, `goal`, points, filters, and bar options are tip-jar specific. |
| `credits.html` | `session` | `server2`, `server3` relay blocks in page family docs; iframe bridge by default | Main source path uses an iframe bridge to the dock-labeled room. Existing docs cover command handling through dock. | Credits is mostly a collector/renderer, not a normal chat overlay. |
| `events.html` | `session` | `server`, `server2`, `localserver` | Direct socket branch joins `out:3, in:4`. | Event dashboard options are event filters and display controls, not dock message style options. |
| `hype.html` | `session`, `s`, `id` | `server`, `server2`, `localserver`, custom `out`/`outchan`, `in`/`inchan` | Default channel pair is `out:3, in:4`; URL params can override the pair. | `fontsize` sets CSS scale; `scale` later scales the whole body. |
| `wordcloud.html` | source page parser only | no socket branch in checked parser | Uses `style`, `scale`, `allwords`, `font`, and `googlefont`; it is fed through other message paths. | Do not assume dock transport params apply. |
| `leaderboard.html` | `session` | optional `server2`/`server3` relay | Optional extension relay joins `out:3, in:4`. | Many leaderboard options are local scoring/display options. |
| `emotes.html` | `session`, `s`, `id` | `server`, `server2`, `server3`, `localserver` | Main branch joins `out:3, in:4`; source also contains a later extension relay block for `server2`/`server3`. | Needs a deeper pass before giving advanced server examples. |
| `reactions.html` | `session`, `room` | `server`, `server2`, `server3`, `localserver` | `server` maps to API-style default URL; `server2`/`server3` map to extension-style default URL. Channels default to `out:3, in:4` and can be overridden by `out`/`outchan` and `in`/`inchan`. | Supports burst, limit, alignment, layout, scale, speed, and page background options. |
| `scoreboard.html` | `session`, `s`, `id` | `server`, `server2`, `server3` | Direct socket branch joins `out:3, in:4`. | Can consume points snapshots or locally score chat/donations depending on URL options. |
| `ticker.html` | `session`, `s`, `id` | `server`, `server2`, `localserver` | Direct socket branch joins `out:7, in:8`. | `display=rotate` and scroll options are ticker-specific. |
| `map.html` | `session` | `server`, `server2`, `server3`, `localserver` | `server` uses API-style `out:2, in:1`; `server2`/`server3` use extension-style `out:3, in:4`. | Map has its own normalized, case-insensitive parameter handling. |

## Page-Specific Option Families

### `dock.html`

Use `dock.html` for the largest set of generated URL parameters.

Source-checked families include:

- connection: `session`, `s`, `id`, `password`, `server`, `server2`, `server3`, `localserver`, `label`
- message layout: `compact`, `overlaymode`, `chatonly`, `hidemenu`, `showmenu`, `scale`, `padding`, `alignright`, `alignbottom`, `horizontal`, `rtl`
- style: `darkmode`, `lightmode`, `transparent`, `chroma`, `font`, `googlefont`, colors, bubble styling, outline/glow/shadow options
- filtering: source/user filters, bot/host filters, donation/member/event filters, private/public filtering, emoji-only filtering
- queue and display state: `queueonly`, `pinnedonly`, `autoshow*`, `selfqueue`, save/reload/cache options
- third-party posting: SPX and H2R related URL params
- custom code: `css`, base64 CSS aliases, `js`, and base64 JS aliases with trust-context restrictions

Support caveat: when the user opens a theme or utility page, do not assume the dock option exists there.

### `featured.html`

Source-checked families include:

- connection: `session`, `s`, `id`, `password`, `server`, `server2`, `server3`, `localserver`, `lanonly`
- display: `limit`, `scale`, `offset`, `showtime`, `rounded`, `transition`, `fade`, `swipe`, `stack`, `alignright`, `aligntop`, `center`
- filtering: `onlyfrom`, `fromonly`, `hidefrom`, `exclude`, `filterevents`, `filterfeaturedusers`, Twitch-only/hide-Twitch shortcuts, donation/member stripping
- identity/media: `firstnamesonly`, `hidenames`, `hidebadges`, `showsource`, `noavatar`, `noavatarifmissing`, YouTube channel-name mode
- custom style: `css`, base64 CSS aliases, `font`, `googlefont`, `transparent`, `chroma`
- audio/TTS: `custombeep`, `beepvolume`, `beep`, `beepdono`, and `TTS.configure(urlParams)`

Support caveat: `featured.html` is not just "dock with a different skin"; its socket routing and parser are separate.

### `waitlist.html`

Source-checked families include:

- display: `pagebg`, `pagebackground`, `dockbg`, `showtime`, `randomize`, `random`, `includemessage`, `messagesize`, `showsource`
- connection and identity: `session`, `s`, `id`, `password`, `drawmode`
- custom style: `css`, base64 CSS aliases, `scale`, `alignright`, `aligncenter`, `hidetitle`, `font`, `googlefont`, `opacity`, `language`, `lang`, `ln`
- visual modes: `chroma`, `darkmode`, `lightmode`, `transparent`, `nooutline`
- feedback: `confetti`, `customsound`, `soundvolume`, `sound`

Support caveat: direct `server`/`server2` URL support was commented out in source during this pass.

### `poll.html`

Source-checked URL initialization includes:

- `pollType`
- `pollQuestion`
- `pollOptions`
- `pollMatchMode`
- `pollTimer`
- `pollEnabled`
- `style`
- `pollSpam`
- `pollTally`
- `pollDonationWeighted`
- `debug`
- `server`, `server2`, `server3`, `localserver`

Support caveat: `poll.html` has its own normalizers for booleans, numbers, option lists, and match modes.

### `timer.html`

Source-checked URL initialization includes:

- connection and control: `session`, `s`, `id`, `password`, `operator`, `controls`, `server`, `localserver`
- timer state: `mode`, `countup`, `duration`, `current`, `autostart`
- display: `label`, `style`, `scale`, `css`, base64 CSS aliases
- thresholds: `warn`, `danger`
- sound: `customsound`, `sound`, URL-loaded sound state

Support caveat: timer API commands and timer URL options are related but not identical. The timer page can receive actions such as `settimer`, `starttimer`, `pausetimer`, `timeradd`, `timersubtract`, and `resettimer`.

### `actions.html`

Source-checked URL initialization includes:

- connection: `session`, `s`, `id`, `password`, `server`, `server2`, `localserver`
- media/action behavior: `volume`, `duration`
- OBS: `obsstatus`, `obsdebug`, `obsws`, `obswebsocket`, `obspw`, `obspassword`
- custom style/code: `css`, base64 CSS aliases, `js`
- TTS: page calls `TTS.configure(urlParams)` when available

Support caveat: `actions.html` is an action output page for Event Flow style behavior. It is not a normal chat display.

### `tipjar.html`

Source-checked URL initialization includes:

- display mode: `style`, `theme`, `hype`, `mode=hype`, `celebration`, `title`, `controls`, `jarimage`, `alignright`
- goal and units: `goal`, `unit`, `subpoints`, `giftpoints`, `donationpoints`, `tipjartype`, `tipjarunit`, `donationtype`, `tipjarsource`, `donationsource`, `tipjarunitlabel`
- counting behavior: `notips`, `nosubs`, `nogifts`, `noresubs`, `countgiftredemptions`
- completion behavior: `persistent`, `resetoncomplete`, `noresetoncomplete`, `carryover`, `hidecompletions`, `completiondelay`, `dedupewindow`
- bar styling: `fillstart`, `fillend`, `barcolorstart`, `barcolorend`, `fillmode`, `noliquid`, `barheight`, `barradius`, `baronly`, `levelsize`, `increment`, `startamount`, `initialamount`, `currentamount`, `trackcolor`, `bartrackcolor`, `barbackground`
- connection: `session`, `room`, `password`, `server`, `server2`, `localserver`

Support caveat: tip jar parameters control goal math and donation aggregation. They should not be described as dock display filters.

### `credits.html`

Source-checked families include:

- collection and sorting: `donationpriority`, `persistcredits`, `onlydonors`, `hidecategories`
- display: `style`, `nobg`, `pagebg`, `pagebackground`, `dockbg`, `speed`, `duration`, `textcolor`, `font`, `googlefont`
- content: `endmessage`, `showamounts`, `showavatar`, `showavatars`, `hidecategories`
- routing/control: `session`, `password`, `lanonly`, `triggermode`, `loop`

Support caveat: credits collect state from incoming messages and commands. They are not a generic text ticker.

### Event And Effect Pages

Source-checked page families:

- `events.html`: `session`, `debug`, `ln`, `lang`, `language`, `sources`, `donationsonly`, `minvalue`, `giftedsubsonly`, `currency`, `highlightvalue`, `lightmode`, `transparent`, `hidemeta`, `notime`, `maxevents`, `font`, `googlefont`, `showviewercount`, `viewerbarbg`, `viewerbarbackground`, `topbarbg`, `scale`, `localserver`, `server`, `server2`
- `hype.html`: `ln`, `lang`, `language`, `viewerbarbg`, `pagebg`, `showtime`, `session`, `s`, `id`, `password`, `uniqueid`, `font`, `googlefont`, `css`, base64 CSS aliases, `fontsize`, `align`, `alignright`, `hidetitle`, `opacity`, `localserver`, `out`, `outchan`, `in`, `inchan`, `server`, `server2`, `chroma`, `speed`, `darkmode`, `lightmode`, `transparent`, `nooutline`, `viewersonly`, `chattersonly`, `style`, `combineyoutube`, `combineall`, `scale`, `js`
- `wordcloud.html`: `style`, `scale`, `allwords`, `font`, `googlefont`
- `leaderboard.html`: `password`, `lanonly`, `layout`, `theme`, `category`, `period`, `compact`, `showvalue`, `rotateinterval`, `tickerscroll`, `scrollspeed`, `includeweekly`, `maxentries`, `top`, `reset`, `showavatar`, `avatars`, `donations`, `showsource`, `hideempty`, `autohide`, `hidedelay`, `rankby`, `animated`, `updateinterval`, `persistdata`, `bg`, `title`, `notitle`, `transitionstyle`, optional `server2`/`server3`

Support caveat: these pages usually need event-style payloads, not just normal chat text.

### Live Display Utility Pages

Source-checked page families:

- `emotes.html`: `showtime`, `floatup`, `hidedupes`, `limit`, `max`, `membersonly`, `hidereplies`, `session`, `s`, `id`, `password`, `lanonly`, `css`, base64 CSS aliases, `bademotes`, `myname`, `botlist`, `hidebots`, `scale`, `server`, `server2`, `server3`, `localserver`, `chroma`, `speed`, `darkmode`, `lightmode`, `transparent`, `pagebg`, `pagebackground`, `dockbg`, `js`
- `reactions.html`: `session`, `room`, `password`, `label`, `out`, `outchan`, `in`, `inchan`, `scale`, `speed`, `burst`, `limit`, `pagebg`, `align`, `layout`, `server`, `server2`, `server3`, `localserver`
- `scoreboard.html`: `session`, `s`, `id`, `password`, `layout`, `theme`, `maxusers`, `minpoints`, `chatpoints`, `donationpoints`, `customtriggers`, `hidepoints`, `hiderank`, `hideavatar`, `hideplatform`, `animations`, `highlightchanges`, `title`, `font`, `googlefont`, `bgcolor`, `textcolor`, `scale`, `server`, `server2`, `server3`, `lanonly`, `preview`, `transparent`
- `ticker.html`: `session`, `s`, `id`, `password`, `font`, `fontsize`, `googlefont`, `style`, `css`, base64 CSS aliases, `server`, `server2`, `localserver`, `chroma`, `speed`, `speedmode`, `display`, `rotateinterval`, `rotatepause`, `rotateorder`, `separator`, `gap`, `transparent`, `scrollcopies`, `js`
- `map.html`: case-insensitive/normalized parameters for map type, region filters, visual settings, iframe bridge, `session`, `password`, `label`, `server`, `server2`, `server3`, and `localserver`

Support caveat: these pages consume narrow payload shapes. A blank page may mean no matching payload has arrived, not that the session is broken.

## Boolean And Value Parsing Differences

| Pattern | Examples | Support Meaning |
| --- | --- | --- |
| Presence-only flags | Many dock, featured, waitlist, tip jar, and credits options | `&darkmode` may be enough; `&darkmode=false` may still count as present on some pages. |
| Explicit boolean parser | `poll.html`, `ticker.html`, `map.html` | Values like `false`, `0`, or `no` may be honored when that page has a parser. |
| Numeric parser with fallback | `scale`, `showtime`, `duration`, `goal`, `rotateinterval` | Invalid numbers usually fall back to defaults, but the default differs by page. |
| List parser | `pollOptions`, `sources`, `filterevents`, `hidefrom`, `tipjarsource` | Separators and normalization differ by page. |
| Overloaded string | `style`, `theme`, `label`, `sound`, `title` | Same name can control unrelated behavior on different pages. |

When answering support questions, say "this page parses X" instead of "SSN supports X globally."

## High-Risk Claims To Avoid

- Do not say every `url-parameter-index.md` entry works on every overlay.
- Do not say `&server`, `&server2`, and `&server3` mean the same thing everywhere.
- Do not say `&label=` always means API target label. It can be page display state.
- Do not say `&style=` has a universal value list.
- Do not tell users to add `&server` to `waitlist.html` without checking current source; the direct server branch was commented out during this pass.
- Do not promise custom JS works from any URL or host.
- Do not treat generated URL docs as a substitute for page code when the user is on `timer.html`, `poll.html`, `tipjar.html`, `credits.html`, event pages, utility pages, themes, or games.

## Troubleshooting Flow

When a URL option "does not work":

1. Identify the exact page: `dock.html`, `featured.html`, theme page, tool page, API helper, or standalone app window.
2. Check whether the page parser reads that parameter.
3. Check whether the option is read only on load; refresh the page or OBS browser source.
4. Check the session, password, and source side before styling or display options.
5. Check the page-specific meaning of `server`, `server2`, `server3`, `localserver`, and `label`.
6. Check whether the page needs a narrow payload type. For example, poll, timer, tip jar, credits, map, reactions, and ticker pages may ignore normal chat if the payload does not match.
7. Check boolean syntax. If the page uses presence-only flags, remove `=false` style values.
8. Check URL encoding for CSS, JS, spaces, lists, JSON strings, and custom endpoint URLs.
9. If the claim affects public docs or a support template, inspect current source again and mark whether it is source-checked, browser-validated, OBS-validated, or app-e2e-validated.

## Follow-Up Validation Needed

- Generate a page-by-page parameter matrix from all root HTML files and theme/game pages.
- Add line references or function anchors for the high-use pages once the parser docs are stable.
- Runtime-test `server`, `server2`, `server3`, `localserver`, and `label` combinations with controlled WebSocket payloads.
- Browser/OBS-test custom CSS, base64 CSS, and custom JS behavior per page.
- Validate waitlist direct server behavior after any future source change.
- Validate page-specific boolean parsing against actual browser URLs.
