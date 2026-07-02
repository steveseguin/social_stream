# Subpage URL Parameter Matrix

Status: quick generated-source inventory on 2026-06-24. No browser, OBS, app, or WebSocket runtime validation was performed.

## Purpose

Use this page to answer: "Which theme, game, or WebSocket source page appears to parse this URL parameter?"

This page extends `root-page-url-parameter-matrix.md` into subdirectories. It is an inventory aid, not runtime proof.

## Method

The pass scanned:

- `themes/**/*.html`
- `games/**/*.html`
- `sources/websocket/**/*.html`

The scan used literal URL parser patterns such as `URLSearchParams`, `urlParams.get("name")`, `urlParams.has("name")`, and common helper calls.

Known limits:

- Dynamic parameter names can be missed.
- A detected parameter can still be dormant, commented out, or context-specific.
- A page can use URL parameters without being a normal user-facing overlay.
- Runtime support still needs browser/OBS/app validation.

## Summary Counts

| Area | HTML Files Scanned | Pages With URL Parser Markers |
| --- | ---: | ---: |
| `themes/**/*.html` | 41 | 41 |
| `games/**/*.html` | 17 | 17 |
| `sources/websocket/**/*.html` | 14 | 3 |

## Theme Pages

| Page | Count | Detected Literal Parameters |
| --- | ---: | --- |
| `themes/LuckyLootTube/luckyloottube.html` | 8 | `chroma`, `font`, `fontfamily`, `hidebots`, `lanonly`, `password`, `session`, `showtime` |
| `themes/Neutron/chatOnly.html` | 5 | `chroma`, `darkmode`, `hidebots`, `session`, `showtime` |
| `themes/Neutron/stream.html` | 5 | `chroma`, `darkmode`, `hidebots`, `session`, `showtime` |
| `themes/Windows3.1/index.html` | 10 | `chroma`, `font`, `fontfamily`, `hidebots`, `localserver`, `retro`, `server`, `server2`, `session`, `showtime` |
| `themes/compact-classic.html` | 22 | `align`, `avatar`, `bg`, `chroma`, `deleteonlylast`, `fadezone`, `font`, `fontfamily`, `hidebots`, `limit`, `localserver`, `nobadges`, `noicon`, `password`, `reverse`, `server`, `server2`, `session`, `showtime`, `time`, `ultra`, `width` |
| `themes/compact-clean.html` | 22 | `align`, `chroma`, `deleteonlylast`, `fadezone`, `font`, `fontfamily`, `hidebots`, `light`, `limit`, `localserver`, `noavatar`, `nobadges`, `noicon`, `password`, `reverse`, `server`, `server2`, `session`, `showtime`, `time`, `ultra`, `width` |
| `themes/compact-glass.html` | 22 | `align`, `avatar`, `chroma`, `deleteonlylast`, `fadezone`, `font`, `fontfamily`, `hidebots`, `light`, `limit`, `localserver`, `nobadges`, `noicon`, `password`, `reverse`, `server`, `server2`, `session`, `showtime`, `time`, `ultra`, `width` |
| `themes/deuks_overlay/overlay1.html` | 9 | `chroma`, `font`, `fontfamily`, `hidebots`, `localserver`, `server`, `server2`, `session`, `showtime` |
| `themes/deuks_overlay/overlay2.html` | 10 | `chroma`, `font`, `fontfamily`, `hidebots`, `localserver`, `server`, `server2`, `session`, `showtime`, `size` |
| `themes/events/index.html` | 4 | `localserver`, `server`, `server2`, `session` |
| `themes/featured-styles/featured-3d.html` | 8 | `password`, `pitch`, `rate`, `room`, `session`, `showtime`, `style`, `tts` |
| `themes/featured-styles/featured-animated.html` | 10 | `password`, `pitch`, `rate`, `room`, `roomid`, `session`, `showtime`, `style`, `tts`, `voice` |
| `themes/featured-styles/featured-cyberpunk.html` | 14 | `lang`, `pass`, `password`, `pitch`, `pw`, `rate`, `room`, `roomid`, `session`, `showtime`, `style`, `timer`, `tts`, `voice` |
| `themes/featured-styles/featured-dynamic.html` | 14 | `lang`, `pass`, `password`, `pitch`, `pw`, `rate`, `room`, `roomid`, `session`, `showtime`, `style`, `timer`, `tts`, `voice` |
| `themes/featured-styles/featured-elegant.html` | 14 | `lang`, `pass`, `password`, `pitch`, `pw`, `rate`, `room`, `roomid`, `session`, `showtime`, `style`, `timer`, `tts`, `voice` |
| `themes/featured-styles/featured-gaming.html` | 14 | `lang`, `pass`, `password`, `pitch`, `pw`, `rate`, `room`, `roomid`, `session`, `showtime`, `style`, `timer`, `tts`, `voice` |
| `themes/featured-styles/featured-glass.html` | 14 | `lang`, `pass`, `password`, `pitch`, `pw`, `rate`, `room`, `roomid`, `session`, `showtime`, `style`, `timer`, `tts`, `voice` |
| `themes/featured-styles/featured-gradient.html` | 14 | `lang`, `pass`, `password`, `pitch`, `pw`, `rate`, `room`, `roomid`, `session`, `showtime`, `style`, `timer`, `tts`, `voice` |
| `themes/featured-styles/featured-modern.html` | 15 | `autoshow`, `lang`, `pass`, `password`, `pitch`, `pw`, `rate`, `room`, `roomid`, `session`, `showtime`, `style`, `timer`, `tts`, `voice` |
| `themes/featured-styles/featured-neon.html` | 14 | `lang`, `pass`, `password`, `pitch`, `pw`, `rate`, `room`, `roomid`, `session`, `showtime`, `style`, `timer`, `tts`, `voice` |
| `themes/featured-styles/featured-particles.html` | 8 | `password`, `pitch`, `rate`, `room`, `session`, `showtime`, `style`, `tts` |
| `themes/featured-styles/featured-retro.html` | 14 | `lang`, `pass`, `password`, `pitch`, `pw`, `rate`, `room`, `roomid`, `session`, `showtime`, `style`, `timer`, `tts`, `voice` |
| `themes/featured-styles/featured-slide.html` | 14 | `lang`, `pass`, `password`, `pitch`, `pw`, `rate`, `room`, `roomid`, `session`, `showtime`, `style`, `timer`, `tts`, `voice` |
| `themes/horizontal.html` | 20 | `chroma`, `font`, `fontfamily`, `fullmessage`, `hideavatars`, `hidebadges`, `hidebots`, `hidenames`, `hidesource`, `limit`, `localserver`, `noavatars`, `nobadges`, `nonames`, `server`, `server2`, `session`, `showtime`, `textonly`, `textwidth` |
| `themes/huan-kiara/index.html` | 5 | `localserver`, `server`, `server2`, `session`, `size` |
| `themes/notimeoutmessages.html` | 5 | `limit`, `localserver`, `server`, `server2`, `session` |
| `themes/overlay-bubbles.html` | 10 | `bigbubbles`, `chroma`, `font`, `fontfamily`, `hidebots`, `localserver`, `server`, `server2`, `session`, `showtime` |
| `themes/overlay-cards.html` | 10 | `autoflip`, `chroma`, `font`, `fontfamily`, `hidebots`, `localserver`, `server`, `server2`, `session`, `showtime` |
| `themes/overlay-comic-classic.html` | 10 | `chroma`, `font`, `fontfamily`, `hidebots`, `limit`, `localserver`, `server`, `server2`, `session`, `showtime` |
| `themes/overlay-comic-pop.html` | 10 | `chroma`, `font`, `fontfamily`, `hidebots`, `limit`, `localserver`, `server`, `server2`, `session`, `showtime` |
| `themes/overlay-danmaku.html` | 16 | `chroma`, `duration`, `font`, `fontfamily`, `hidebots`, `hidenames`, `lanes`, `localserver`, `noavatar`, `noavatars`, `nonames`, `password`, `region`, `server`, `server2`, `session` |
| `themes/overlay-neon-cyberpunk.html` | 10 | `chroma`, `font`, `fontfamily`, `hidebots`, `intensegfx`, `localserver`, `server`, `server2`, `session`, `showtime` |
| `themes/overlay-particles.html` | 10 | `chroma`, `denseparticles`, `font`, `fontfamily`, `hidebots`, `localserver`, `server`, `server2`, `session`, `showtime` |
| `themes/overlay-ticker-news.html` | 18 | `chroma`, `font`, `fontfamily`, `hidebots`, `hidenames`, `hidesource`, `label`, `localserver`, `nobar`, `noicon`, `nolabel`, `nonames`, `password`, `server`, `server2`, `session`, `speed`, `top` |
| `themes/overlay-typewriter.html` | 11 | `chroma`, `fastype`, `font`, `fontfamily`, `hidebots`, `localserver`, `nosound`, `server`, `server2`, `session`, `showtime` |
| `themes/overlay-xacception.html` | 9 | `chroma`, `font`, `fontfamily`, `hidebots`, `localserver`, `server`, `server2`, `session`, `showtime` |
| `themes/pretty.html` | 6 | `chroma`, `font`, `fontfamily`, `hidebots`, `session`, `showtime` |
| `themes/rainbowpuke/index.html` | 8 | `chroma`, `font`, `fontfamily`, `hidebots`, `localserver`, `server`, `server2`, `session` |
| `themes/sampleoverlay_reverse.html` | 7 | `deleteonlylast`, `limit`, `localserver`, `server`, `server2`, `session`, `showtime` |
| `themes/spiritoverlay.html` | 6 | `fadeout`, `limit`, `localserver`, `server`, `server2`, `session` |
| `themes/t3nk3y/index.html` | 10 | `chroma`, `font`, `fontfamily`, `gaming`, `hidebots`, `localserver`, `server`, `server2`, `session`, `showtime` |

## Game Pages

| Page | Count | Detected Literal Parameters |
| --- | ---: | --- |
| `games/chaosmode.html` | 7 | `chroma`, `darkmode`, `demo`, `password`, `room`, `server`, `session` |
| `games/chatgarden.html` | 7 | `chroma`, `darkmode`, `demo`, `password`, `room`, `server`, `session` |
| `games/chatwars.html` | 7 | `chroma`, `darkmode`, `demo`, `password`, `room`, `server`, `session` |
| `games/chickenroyale.html` | 13 | `autojoin`, `chroma`, `darkmode`, `demo`, `jointime`, `lanonly`, `maxplayers`, `password`, `room`, `server`, `server2`, `server3`, `session` |
| `games/colorsymphony.html` | 7 | `chroma`, `darkmode`, `demo`, `password`, `room`, `server`, `session` |
| `games/colorwars.html` | 4 | `demo`, `password`, `server`, `session` |
| `games/dancingparade.html` | 4 | `demo`, `password`, `server`, `session` |
| `games/emojirain.html` | 7 | `chroma`, `darkmode`, `demo`, `password`, `room`, `server`, `session` |
| `games/emojitower.html` | 4 | `demo`, `password`, `server`, `session` |
| `games/memorylane.html` | 7 | `chroma`, `darkmode`, `demo`, `password`, `room`, `server`, `session` |
| `games/petrace.html` | 4 | `demo`, `password`, `server`, `session` |
| `games/phraseguess.html` | 4 | `demo`, `password`, `server`, `session` |
| `games/pixelbattle.html` | 7 | `chroma`, `darkmode`, `demo`, `password`, `room`, `server`, `session` |
| `games/rhythmpulse.html` | 7 | `chroma`, `darkmode`, `demo`, `password`, `room`, `server`, `session` |
| `games/treasurehunt.html` | 4 | `demo`, `password`, `server`, `session` |
| `games/wordchain.html` | 4 | `demo`, `password`, `server`, `session` |
| `games/wordstorm.html` | 7 | `chroma`, `darkmode`, `demo`, `password`, `room`, `server`, `session` |

## WebSocket Source Pages

| Page | Count | Detected Literal Parameters |
| --- | ---: | --- |
| `sources/websocket/bilibili.html` | 0 | URL parser marker detected, but no literal parameter names found by this quick scan. |
| `sources/websocket/nostr.html` | 6 | `naddr`, `nevent`, `npub`, `pubkey`, `relay`, `relays` |
| `sources/websocket/youtube.html` | 9 | `c`, `channel`, `code`, `slowerpoll`, `state`, `username`, `v`, `video_id`, `videoId` |

## WebSocket Source Pages Without Detected URL Parser Markers

These were scanned but did not show `URLSearchParams` or `location.search` in the quick inventory.

- `sources/websocket/facebook.html`
- `sources/websocket/index.html`
- `sources/websocket/joystick.html`
- `sources/websocket/kick.html`
- `sources/websocket/rumble.html`
- `sources/websocket/socialstreamchat.html`
- `sources/websocket/stageten.html`
- `sources/websocket/streamlabs.html`
- `sources/websocket/twitch.html`
- `sources/websocket/velora.html`
- `sources/websocket/vpzone.html`

## Common Patterns

- Most theme pages use a small chat-overlay parser with `session`, `server`, `server2`, `localserver`, `showtime`, `chroma`, `font`, `fontfamily`, and `hidebots`.
- Featured-style theme pages use a separate featured-message parser with `room`, `roomid`, `session`, `password`, `showtime`, `style`, `tts`, `voice`, `pitch`, `rate`, and sometimes `lang`, `pass`, `pw`, or `timer`.
- Most game pages use `session`, `room`, `password`, `server`, `demo`, `chroma`, and `darkmode`; `chickenroyale.html` has additional lobby/player parameters.
- WebSocket source pages are not consistent. Some use URL parameters heavily; others depend on page UI, OAuth state, or source-specific scripts.

## Follow-Up Work

- Inspect `themes/featured-styles/*.html` as a family before giving TTS or password alias guidance.
- Runtime-test `server` and `server2` in theme pages before publishing exact channel behavior.
- Validate game-page `server` behavior and command handling with controlled chat payloads.
- Inspect WebSocket source pages manually; many do not expose literal URL params but can still use local UI, OAuth, or injected source state.
