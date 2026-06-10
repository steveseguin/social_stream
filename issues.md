# Issues Found

## High

- `poll.html:739-741`: `compactChoiceText()` removes all non-alphanumeric characters, so option text like `goof!` and `goof` normalize to the same value and can both count the same vote path.

- `poll.html:845-846`: `parseInt(vote, 10)` accepts values with trailing characters (for example `1abc`), so non-numeric tokens can be interpreted as valid numeric votes in multiple/yes-no polls.

- `baretempate.html:76-77`, `bot.html:1853-1857`, `battle.html:444-445`, `confetti.html:230-231`, `content.html:443-444`, `credits.html:993-994`, `emotes.html:503-504`, `games.html:563-564`, `featured.html:2355-2357`, `gif.html:566-568`, `games/wordstorm.html:667-668`, `themes/featured-styles/featured-gaming.html:723-727`, `themes/featured-styles/featured-particles.html:669-670`, `themes/featured-styles/featured-neon.html:711-712`, `themes/overlay-bubbles.html:768-769`, `themes/overlay-cards.html:790-791`, `themes/compact-glass.html:626-627`, `dock.html:8215-8218`: multiple overlay/game/theme message handlers use `"overlayNinja" in e.data.dataReceived` or equivalent checks without null/shape guards, so unexpected `message` events can throw and stop processing overlay payloads.

- `battle.html:477`, `battle.html:543`: `urlParams.get('session').split(",")[0]` is evaluated without checking if `session` exists, so omitting `?session=` throws before socket open and prevents the page from connecting.

## Medium

- `poll.html:720-727`: hashtag matching in `getVoteCandidates()` only accepts ASCII token characters (`[A-Za-z0-9_][A-Za-z0-9_-]*`), so valid unicode/extended hashtags are ignored in hashtag-anywhere mode.

- `content.html:227`: `parseInt(urlParams.has("limit"))` is used instead of `parseInt(urlParams.get("limit"))`, so `?limit=` is never read and `maxShow` cannot be overridden with the `limit` URL param.

- `aiprompt.html:1029-1030`, `aiprompt.html:1159`, `aiprompt.html:1321-1322`, `aiprompt.html:1395`: URL query params (`limit`, `showtime`, `duration`, `target`, `start`, `minutes`) are parsed with `parseInt(...)`/`Math.max(...)` and no `NaN` fallback, so malformed values (for example `?limit=bad`) become `NaN` and the feed cap guard (`feed.children.length > limit`) never triggers truncation.

- `background.js:484-487` and `background.js:15757`, `background.js:15834`: `String.prototype.replaceAll()` is used for GIF parsing and stream ID generation; this is not available in Chrome-80-era environments despite this project's compatibility note.

- `gif.html:327-329`, `gif.html:339`: `detectMediaType()` does an unbounded `HEAD` request before any timeout and proceeds even when `fetch` stalls or returns unexpected content, so media queues can wait unnecessarily and degrade overlay responsiveness.

- `tts.js:617-632`, `tts.js:737-739`, `tts.js:764-766`, `tts.js:798`, `tts.js:814-815`: numeric URL params are parsed with `parseFloat/parseInt(... ) || default`, which makes valid zero values impossible and can leave fields as `NaN` when malformed input is passed.

- `dock.html:3781-3804`, `dock.html:3789`, `dock.html:4858-4862`, `dock.html:4930`: room IDs are taken from URL params and only normalized in a narrow file:// branch (`prompt` path), so socket joins can use malformed/trimless values from normal URL-sourced sessions without the same validation.
