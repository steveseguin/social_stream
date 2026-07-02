# Game Pages

Status: heavy source pass for `games.html` and current `games/*.html` pages on 2026-06-24. This is source inspection, not rendered OBS/browser validation.

## Purpose

Use this page when a user asks how SSN chat games work, which game URL to open, what viewers should type, why a game ignores chat, or how to reset game state.

These pages are output/control surfaces. They do not capture platform chat by themselves. A source page, extension tab, standalone app source window, or compatible relay must still send normalized SSN chat payloads into the same session.

## Source Anchors

- `games.html`
- `games/chaosmode.html`
- `games/chatgarden.html`
- `games/chatwars.html`
- `games/chickenroyale.html`
- `games/colorsymphony.html`
- `games/colorwars.html`
- `games/dancingparade.html`
- `games/emojirain.html`
- `games/emojitower.html`
- `games/memorylane.html`
- `games/petrace.html`
- `games/phraseguess.html`
- `games/pixelbattle.html`
- `games/rhythmpulse.html`
- `games/treasurehunt.html`
- `games/wordchain.html`
- `games/wordstorm.html`

## Shared Runtime Pattern

| Area | Source-Backed Behavior |
| --- | --- |
| URL shape | Usually `https://socialstream.ninja/games/FILE.html?session=SESSION_ID`. Root Spam Power uses `https://socialstream.ninja/games.html?session=SESSION_ID`. |
| Source dependency | Games expect normalized SSN payloads with `chatname` and `chatmessage`, usually through a hidden VDO iframe using `label=dock`. |
| Message parsing | Most pages unwrap `data.content`, sanitize or strip HTML from `chatname`/`chatmessage`, and ignore payloads missing a name or message. |
| Common params | Most support `session`, `password`, `server`, and `demo`. Many also support `room`, `chroma`, and `darkmode`, but not all do. |
| Direct WebSocket | Most `games/*.html` pages with `server` join `{ join: session, out: 2, in: 1 }`. Phrase Guess is the main exception and joins `{ join: session, in: 2, out: 1 }`. |
| Extension relay | Root `games.html` and `chickenroyale.html` support `server2`/`server3` extension relay on `{ join: session, out: 3, in: 4 }`. |
| Demo mode | `demo` injects fake messages or actions for local visual testing. It does not prove that a real platform source emits matching payloads. |
| State | Most games keep state in memory and reset on reload. Persistent exceptions are Spam Power, Chicken Royale, and Phrase Guess. |
| Bot responses | Several games post a bot-style response to the parent page with `postMessage`. Treat that as page-local output unless the exact embedding or send-back path has been verified. |

## Game Matrix

| Page | Viewer Input | What It Does | State/Storage | First Failure Check |
| --- | --- | --- | --- | --- |
| `games.html` | Ordinary chat volume; no exact command required | Spam Power meter driven by chat rate, message volume, multipliers, goals, win streaks, and demo events | Local history for peak activity, wins, best streak, average win rate, recent goals | Same session, source sends ordinary chat, no stale localStorage if historical stats look wrong |
| `games/chaosmode.html` | Any chat, plus `!explode`, `!glitch`, `!shake`, `!portal` | Flying text, emoji effects, chaos waves, and command-triggered visual events | In-memory only | Message must include `chatmessage`; commands are substring checks, but blank/no-name payloads are ignored |
| `games/chatgarden.html` | Plant words such as flower, tree, rose, grass, plant, or built-in plant names | Grows labeled plants and visual garden effects from chat words | In-memory garden/contributor state | Message must contain a recognized plant word |
| `games/chatwars.html` | `!red`, `!blue`, `!green`, or `!yellow`, then normal chat from joined players | Team battle where joined chatters add team power and help capture territory | In-memory battle/team state | Battle must be active and the user must join a team first |
| `games/chickenroyale.html` | `!join`, `!play`, `!chicken`; `!start` can shorten lobby; chat during battle boosts a living chicken | 3D last-bird-standing battle royale with lobby countdown, auto-join option, donations as mega boost, and persistent dinner count | `localStorage` key `chickenRoyaleDinners` | Check lobby state, `maxplayers`, `jointime`, `autojoin`, and whether the battle already started |
| `games/colorsymphony.html` | Color words such as red, blue, green, yellow, purple, orange, pink, white, black, cyan | Creates musical/color notes, harmonies, and visual rhythm effects from color mentions | In-memory composer/note state | Message must contain a recognized color word |
| `games/colorwars.html` | `!red`, `!blue`, `!yellow`, or `!green` | Paints random map cells for a team, updates scores/leaderboard, and can collect power-ups | In-memory team/map state | Command must start with `!` and match an existing team exactly |
| `games/dancingparade.html` | `!join`, `!dance`, `!leave` | Adds dancers to a parade, triggers dance moves, and removes dancers | In-memory dancer state | User must join before `!dance` is useful |
| `games/emojirain.html` | Chat messages containing emoji | Drops emoji rain, tracks emoji rate, recent emoji, and combo streaks | In-memory emoji state | Plain text messages are ignored; send an actual emoji/image-style payload |
| `games/emojitower.html` | `!drop` | Drops emoji blocks into a tower-style stacking game | In-memory tower state | Command must be exactly `!drop` after sanitizing |
| `games/memorylane.html` | Memory-like messages, keywords, emoji, or messages longer than 20 characters | Builds photo/memory cards and tracks mood, nostalgia, contributors, and recent memories | In-memory memories, capped history | Very short plain messages without keywords/emojis may be ignored |
| `games/petrace.html` | `!join [dog|cat|rabbit|turtle|hamster]` | Adds racers, auto-starts with enough players, and runs a pet race | In-memory race state | Race max is 5 racers; duplicate joins and joins during an active race are rejected |
| `games/phraseguess.html` | Free-text guesses while game is active | Host/controller reveals a masked phrase over time; guesses are matched by similarity threshold | `localStorage` keys `ssnPhraseGameSettings` and `ssnPhrases` | Game must be started; guesses from the configured bot name are ignored; threshold defaults matter |
| `games/pixelbattle.html` | `paint color x y`, `color x y`, or `x y color` | Paints pixels on a shared canvas/grid with valid internal colors | In-memory pixel grid | Command must include a valid color and valid coordinates in one of the supported orders |
| `games/rhythmpulse.html` | Beat/music words such as kick, drum, bass, snare, clap, snap, hihat, cymbal, crash, beat, rhythm, music, sound, plus musical emoji | Creates beat circles, rhythm waves, note particles, drum-pad sounds, sync tracking, BPM, and genre stats | In-memory rhythm/musician state | Browser audio may need a user gesture or unmuted source; message must contain beat keywords or musical emoji |
| `games/treasurehunt.html` | `!dig B5` style coordinate commands | Lets viewers dig grid coordinates and find hidden treasures | In-memory grid/round state | Command must start with `!dig ` and use a valid coordinate |
| `games/wordchain.html` | Plain alphabetic words at least 3 letters long | Chains words by last letter, scores by word length, awards combos, and runs timed rounds | In-memory word/score state | Word must start with the current last letter and not already be used |
| `games/wordstorm.html` | Normal chat with meaningful words | Creates/upgrades word bubbles, counts words, builds combos, and keeps max visible word count under control | In-memory word counts | Common words, numeric-only text, very short words, and very long words are filtered |

## Parameter And Transport Matrix

| Page/Group | Params Found In Source | Transport Notes | Storage Notes |
| --- | --- | --- | --- |
| `games.html` | `session`, `room`, `password`, `lanonly`, `chroma`, `darkmode`, `demo`, `server`, `server2`, `server3` | Hidden VDO iframe with `label=dock`; `server` uses out 2/in 1; `server2`/`server3` use extension out 3/in 4 | Stores Spam Power history/statistics |
| Most visual mini-games | `session`, `room`, `password`, `server`, `demo`, often `chroma`, `darkmode` | Hidden VDO iframe with `label=dock`; optional `server` WebSocket usually out 2/in 1 | Usually in-memory only |
| Simple command mini-games | `session`, `password`, `server`, `demo` | Hidden VDO iframe with `label=dock`; optional `server` WebSocket out 2/in 1 | Usually in-memory only |
| `games/chickenroyale.html` | `session`, `room`, `password`, `lanonly`, `jointime`, `maxplayers`, `autojoin`, `chroma`, `darkmode`, `demo`, `server`, `server2`, `server3` | Hidden VDO iframe with `label=dock`; direct `server` out 2/in 1; extension relay `server2`/`server3` out 3/in 4 | Stores career wins in `chickenRoyaleDinners` |
| `games/phraseguess.html` | `session`, `password`, `server`, `demo` | Uses iframe push/peer flow for dock-label traffic; optional WebSocket joins `in:2`, `out:1` | Stores settings in `ssnPhraseGameSettings` and phrases in `ssnPhrases` |

## Command And Input Index

| Input | Games |
| --- | --- |
| Chat activity/volume | `games.html` |
| Chaos commands | `chaosmode.html`: `!explode`, `!glitch`, `!shake`, `!portal` |
| Plant words | `chatgarden.html` |
| Team join colors | `chatwars.html`, `colorwars.html`: `!red`, `!blue`, `!green`, `!yellow`; `colorwars.html` also supports `!yellow` |
| Color words | `colorsymphony.html` |
| Dancer commands | `dancingparade.html`: `!join`, `!dance`, `!leave` |
| Emoji messages | `emojirain.html`; `emojitower.html` uses `!drop` |
| Memory-style text | `memorylane.html` |
| Pet race join | `petrace.html`: `!join` with optional pet type |
| Phrase guesses | `phraseguess.html`: free text while active |
| Pixel painting | `pixelbattle.html`: `paint color x y`, `color x y`, or `x y color` |
| Beat/music words | `rhythmpulse.html` |
| Treasure dig | `treasurehunt.html`: `!dig COORDINATE` |
| Word chaining | `wordchain.html`: plain alphabetic word |
| Word storm | `wordstorm.html`: meaningful words in normal chat |
| Chicken Royale | `chickenroyale.html`: `!join`, `!play`, `!chicken`, `!start`, and ordinary chat boosts during battle |

## Phrase Guess Notes

Phrase Guess is more controller-like than the other mini-games.

- The page has host controls for Start/Stop, Skip Phrase, Reset, phrase list, and settings.
- It requires `session` unless `demo` is used.
- Defaults found in source include reveal interval 20 seconds, match threshold 70, initial mask 80, mask reduction 10, bot name `Phrase Bot`, and send mode `dock`.
- It ignores guesses while inactive and skips messages from the configured bot name.
- Exact phrase match or similarity above threshold wins. Similarity above 50 can trigger a warm hint response.
- WebSocket send mode can send `sendChat` for chat mode, or `extContent` for dock-style bot messages. Actual platform chat send-back still depends on the source/platform path.

## Chicken Royale Notes

Chicken Royale is the largest game page in this group.

- It is a Three.js 3D battle royale using `games/chickenroyale.html?session=...`.
- `jointime` is clamped from 10 to 600 seconds; default is 45 seconds.
- `maxplayers` is clamped from 2 to 200; default is 100.
- `autojoin` lets any chatter enter during lobby.
- `!start` shortens the lobby when there are at least 2 players. Non-mod users must already be in the lobby.
- During battle, ordinary chat from a living player boosts that player's chicken. Donation payloads with `hasDonation` grant a larger boost.
- Career wins are stored in localStorage as `chickenRoyaleDinners`.

## Troubleshooting

| Symptom | First Checks |
| --- | --- |
| Game page is blank or does not react | Confirm the source side is running, the URL has the same `session`, and the page is receiving ordinary chat payloads with `chatname` and `chatmessage`. |
| Demo works but real chat does not | Demo injects local fake data. Check the source tab/app source window, session ID, and hidden iframe or WebSocket bridge. |
| Commands are ignored | Verify exact command spelling and whether the command must be the whole message, at the start of the message, or merely present in the text. |
| Only some games ignore chat | Check that specific game's expected input. Many games ignore plain text unless it contains a command, color, plant word, emoji, coordinate, or valid word. |
| WebSocket mode does not work | Most games use `server` out 2/in 1, but Phrase Guess uses `in:2`, `out:1`; Chicken Royale and root Spam Power also support extension relay `server2`/`server3` out 3/in 4. |
| Bot response does not appear in platform chat | Most game responses are page-local `postMessage` responses. Do not promise real platform chat send-back unless the exact page, send mode, source, and platform support have been checked. |
| Old stats or winners keep returning | Clear the relevant localStorage key: Spam Power history in `games.html`, `chickenRoyaleDinners`, or Phrase Guess keys `ssnPhraseGameSettings` and `ssnPhrases`. |
| Rhythm Pulse has no sound | Browser audio can be muted, blocked by autoplay policy, or not captured by OBS. Click the page/audio control and verify OBS browser-source audio settings. |
| Chicken Royale is full or will not join | Check `maxplayers`, whether the battle already started, duplicate names, and whether `autojoin` is intended. |

## Answer Pattern

When answering a game question:

1. Name the exact game page and URL shape.
2. State that a source side must be active on the same session.
3. Give the viewer input or command.
4. Mention whether it stores persistent state.
5. Suggest `?demo` only as a local visual test.

Example:

```text
For Pet Race, open `https://socialstream.ninja/games/petrace.html?session=YOUR_SESSION`. Keep your source chat on the same session. Viewers join with `!join`, or `!join dog`, `!join cat`, `!join rabbit`, `!join turtle`, or `!join hamster`. If it ignores joins, check whether the race already started, whether the racer already joined, or whether the 5-racer limit is full.
```

## Follow-Up Extraction Needs

- Validate each game in a browser with controlled synthetic payloads and screenshots.
- Validate OBS rendering and performance for high-motion pages, especially Chicken Royale, Emoji Rain, Rhythm Pulse, and Pixel Battle.
- Trace and test page-local bot responses versus actual platform chat send-back.
- Generate exact URL parameter rows from source for every game page.
- Validate mobile/browser sizing and text overflow for command-heavy game UIs.
