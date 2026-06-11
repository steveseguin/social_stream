# Issues Review

## Fixed in this pass

- `poll.html`: confirmed. Numeric votes now require a digits-only token before parsing, so `1abc` no longer counts as `1`; multiple-choice text matching now records exact matches first and only accepts flexible punctuation/compact matches when they resolve to a single option; hashtag-anywhere matching now accepts non-ASCII/non-`[A-Za-z0-9_]` hashtag bodies instead of silently dropping them.

- `background.js:12896`, the listed overlay/game/theme bridge handlers, `chatbot.html`, `dock.html`, `giveaway.html`, `giveaway-obs-entries.html`, and `hype.html`: confirmed. These message handlers now guard `event.data`/`e.data` and `dataReceived` before reading `overlayNinja`, preventing unrelated or malformed `postMessage()` payloads from throwing.

- `battle.html:243`, `battle.html:477`, `battle.html:543`: confirmed. `lobbytime` now falls back when malformed, and socket joins use the already-derived `roomID` instead of re-reading `urlParams.get("session").split(...)`.

- `content.html:227`: confirmed. `?limit=` now reads `urlParams.get("limit")` instead of accidentally parsing `urlParams.has("limit")`.

- `aiprompt.html:1029-1030`, `aiprompt.html:1159`, `aiprompt.html:1321-1322`, `aiprompt.html:1395`: confirmed. The embedded templates now parse numeric params into temporary values and fall back when malformed instead of letting `NaN` into limits/timers.

- `gif.html:106`, `gif.html:327-339`: confirmed. `?showtime=0` is now preserved, malformed `showtime` falls back to `3000`, and the `HEAD` probe now uses `AbortController` with the existing `mediaProbeTimeout`.

- `bot.html:1439`, `featured.html:1580`: confirmed. `?rounded=0` now stays `0`; malformed values fall back to `10`.

- `tts.js:617-632`, `tts.js:737-739`, `tts.js:764-766`, `tts.js:798`, `tts.js:814-815`, `tts.js:851`: confirmed. TTS numeric URL params now use explicit parse helpers, so valid zero values survive and malformed values use defaults.

- `tts.js:1724`, `tts.js:1957`, `tts.js:2081`, `tts.js:2147`, `tts.js:2260`, `tts.js:2488`, `tts.js:2613`: confirmed. Blob audio URLs now route through `TTS.setAudioSource()` and `TTS.finishedAudio()` revokes the active object URL.

- `leaderboard.html:878`, `leaderboard.html:1225`: confirmed. `rotateinterval` and `hidedelay` now fall back when malformed instead of passing `NaN` into timer math.

- `games/chaosmode.html:597`: confirmed. The activity feed now builds the username/message row with text nodes instead of injecting raw `innerHTML`.

## Needs deliberate follow-up

- `bot.html:2321`, `featured.html:2960`, `featured.html:2970`, `featured.html:2984`, `featured.html:2989`, `featured.html:3023`, `featured.html:3150`, `emotes.html:598`, `games/emojirain.html:396`, `games/rhythmpulse.html:924`, `sampleemote.html:80`, `waitlist.html:810`, `waitlist.html:814`, `waitlist.html:949`, and the named theme overlay `innerHTML` sinks: partly confirmed, but not safe to blanket-escape in this pass. These render paths intentionally carry SSN HTML for emotes, badges, source icons, and content images. Best fix: add a shared renderer/sanitizer that allows the known-safe SSN tags/attributes (`img`, `svg` where expected, badge/source markup) and blocks event attributes, scriptable URLs, and unexpected containers, then replace local `innerHTML` writes with that helper.

- `dock.html:3781-3804`, `dock.html:3789`, `dock.html:4858-4862`, `dock.html:4930`: confirmed as a consistency concern, but not fixed here because `roomID.split(",")[0]` suggests comma-bearing URL values may have existing behavior. Best fix: normalize the join room separately from the display/config value, using `validateRoomId()` on only the socket join id.

- First-party `replaceAll()` remains in non-overlay files such as `ai.js`, `background.js`, `popup.js`, `libs/objects.js`, and source scripts. Under the clarified support rule, this is not worth fixing unless the file runs in an overlay/OBS browser surface.

## Stale or not validated

- `gif.html:672-676`: the direct fetched-SVG `innerHTML` issue is stale in the current tree. `displaySVG()` now creates an `img`, assigns `img.src = url`, and appends the element; it does not inject fetched SVG markup.

- The broad overlay `innerHTML` issue remains security-relevant, but individual exploitability varies by source because `background.js` applies `filterXSS()` to captured `chatname`/`chatmessage`. I did not mark every listed render sink as fixed because direct websocket/overlay payloads can bypass some capture assumptions, and a naive local escape would break expected emote rendering.
