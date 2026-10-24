# Theme Pages

Status: heavy source pass for `themes/**/*.html` and theme README files on 2026-06-24. This is source inspection, not rendered OBS/browser validation.

## Purpose

Use this page when a user asks which theme URL to open, how prebuilt themes work, why a theme is blank in OBS, whether a theme supports `server`, how featured-message style themes differ from normal chat themes, or how to start from a theme when building a custom overlay.

Theme pages are output surfaces. They do not capture platform chat by themselves. A source tab, extension/app source window, dock/featured flow, or compatible relay must still send SSN payloads into the same session.

## Source Anchors

- `themes/readme.md`
- `themes/*.html`
- `themes/*/index.html`
- `themes/*/*.html`
- `themes/featured-styles/README.md`
- `themes/Neutron/readme.md`
- `docs/customoverlays.md`
- `sampleoverlay.html`
- `featured.html`
- `dock.html`

## Main Theme Families

| Family | Files | What They Are | Transport Pattern |
| --- | --- | --- | --- |
| Top-level chat themes | `themes/compact-*.html`, `horizontal.html`, `overlay-*.html`, `notimeoutmessages.html`, `sampleoverlay_reverse.html`, `spiritoverlay.html` | Drop-in normal chat overlays that render incoming SSN messages directly | Hidden VDO iframe by default; most also support `server`/`server2` WebSocket out 3/in 4 |
| Packaged chat themes | `deuks_overlay/*.html`, `huan-kiara/index.html`, `rainbowpuke/index.html`, `t3nk3y/index.html`, `Windows3.1/index.html` | Contributed or bundled themed chat overlays with local assets/readmes | Hidden VDO iframe by default; most support `server`/`server2` WebSocket out 3/in 4 |
| Featured-message style themes | `themes/featured-styles/*.html` | Styled alternatives to `featured.html`; they display selected/featured messages, not the whole chat feed | Hidden VDO scene iframe with `label=overlay`; no direct WebSocket handling found in this pass |
| Dock-wrapper themes | `themes/pretty.html`, `themes/Neutron/chatOnly.html`, `themes/Neutron/stream.html` | Visual packages that embed `dock.html` in an iframe and pass a preset parameter bundle | The embedded `dock.html` handles SSN traffic |
| Special theme/dashboard pages | `themes/events/index.html`, `themes/LuckyLootTube/luckyloottube.html` | Niche display pages: event/donation dashboard and a custom visual chat theme | Events page supports VDO plus WebSocket; LuckyLootTube uses VDO iframe only in inspected source |

## Shared Chat Theme Behavior

Most normal chat themes follow this pattern:

1. Read `session` from the URL.
2. Build a hidden VDO.Ninja iframe for the same room.
3. Listen for `event.data.dataReceived.overlayNinja`.
4. Render `chatname`, `chatmessage`, `chatimg`, `chatbadges`, `type`, `nameColor`, `hasDonation`, `donation`, `membership`, and `contentimg` when present.
5. Optionally connect to WebSocket mode when `server` or `server2` is present.

The common WebSocket join pair for these theme pages is:

```json
{ "join": "SESSION", "out": 3, "in": 4 }
```

Do not apply that channel pair to every SSN page. It is common in theme pages, not universal across tools.

## Common Theme Parameters

| Parameter | Theme Behavior |
| --- | --- |
| `session` | Required for hosted use unless the page prompts for a session. |
| `password` | Used by some pages; many contributed themes default it to `false` and do not expose a URL password. |
| `showtime` | Auto-hide timing in milliseconds. Defaults vary: some use 0/no timeout, many use 30000 ms. |
| `limit` | Max messages kept in DOM where implemented. Defaults vary by page. |
| `hidebots` | Hides payloads with `data.bot` in many direct-render themes, or is passed into embedded `dock.html` by wrapper themes. |
| `chroma` | Sets a solid page background for chroma keying where implemented. Usually accepts hex with or without `#`. |
| `font` | Font size in pixels where implemented. |
| `fontfamily` | Loads or applies a named font where implemented; many pages sanitize the family name before injecting CSS. |
| `server` / `server2` | Optional WebSocket mode on most direct chat themes. |
| `localserver` | Uses `ws://127.0.0.1:3000` where implemented. |

Theme-specific flags also exist. Examples include `reverse`, `deleteonlylast`, `avatar`, `noavatar`, `nobadges`, `noicon`, `time`, `light`, `ultra`, `width`, `align`, `fadezone`, `bigbubbles`, `autoflip`, `denseparticles`, `fastype`, `nosound`, `gaming`, `retro`, `darkmode`, and `size`.

## Normal Chat Theme Matrix

| Page | Main Look/Use | Notable Params | Transport Notes |
| --- | --- | --- | --- |
| `themes/compact-classic.html` | Compact single-line classic chat rows | `reverse`, `avatar`, `nobadges`, `noicon`, `time`, `hidebots`, `ultra`, `bg`, `width`, `align`, `limit`, `showtime`, `fadezone` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/compact-clean.html` | Compact two-line clean rows with accent bar | `reverse`, `noavatar`, `nobadges`, `noicon`, `time`, `hidebots`, `light`, `ultra`, `width`, `align`, `limit`, `showtime`, `fadezone` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/compact-glass.html` | Frosted compact glass rows | `reverse`, `avatar`, `nobadges`, `noicon`, `time`, `hidebots`, `light`, `ultra`, `width`, `align`, `limit`, `showtime`, `fadezone` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/horizontal.html` | Horizontal chat strip | `showtime`, `hidebadges`, `hideavatars`, `hidenames`, `hidesource`, `textonly`, `fullmessage`, `textwidth`, `hidebots`, `limit` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/notimeoutmessages.html` | Simple persistent-message overlay | `limit` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/overlay-bubbles.html` | Bubble-style chat | `showtime`, `hidebots`, `bigbubbles` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/overlay-cards.html` | 3D card/flip chat | `showtime`, `hidebots`, `autoflip` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/overlay-comic-classic.html` | Comic-style chat | `showtime`, `hidebots`, `limit` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/overlay-comic-pop.html` | Pop-comic chat | `showtime`, `hidebots`, `limit` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/overlay-danmaku.html` | Bullet-chat/danmaku overlay | `hidebots`, `noavatar`, `nonames`, `duration`, `lanes`, `region` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/overlay-neon-cyberpunk.html` | Neon/cyberpunk chat | `showtime`, `hidebots`, `intensegfx` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/overlay-particles.html` | Particle-backed chat | `showtime`, `hidebots`, `denseparticles` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/overlay-ticker-news.html` | News ticker style chat | `hidebots`, `nonames`, `noicon`, `hidesource`, `speed`, `top`, `nobar`, `nolabel`, `label` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/overlay-typewriter.html` | Terminal/typewriter chat | `showtime`, `hidebots`, `fastype`, `nosound` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/overlay-xacception.html` | Custom visual chat overlay | `showtime`, `hidebots` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/sampleoverlay_reverse.html` | Reverse-scroll sample overlay | `deleteonlylast`, `limit`, `showtime` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/spiritoverlay.html` | Spiritveil visual overlay | `limit`, `fadeout` | VDO plus optional `server`/`server2` out 3/in 4 |

Most rows also support `session`, `chroma`, `font`, `fontfamily`, `localserver`, and the relevant `server` flags.

## Packaged Theme Matrix

| Page | Main Look/Use | Notable Params | Transport Notes |
| --- | --- | --- | --- |
| `themes/deuks_overlay/overlay1.html` | Deuk packaged chat overlay variant 1 | `showtime`, `hidebots`, `chroma`, `font`, `fontfamily` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/deuks_overlay/overlay2.html` | Deuk packaged chat overlay variant 2 | `showtime`, `hidebots`, `chroma`, `font`, `fontfamily`, `size` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/huan-kiara/index.html` | Asset-backed themed chat overlay | `size` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/rainbowpuke/index.html` | Rainbow chat overlay | `hidebots`, `chroma`, `font`, `fontfamily` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/t3nk3y/index.html` | Gradient/gaming chat overlay using bundled `chroma.min.cjs` | `hidebots`, `gaming`, `chroma`, `font`, `fontfamily`, `showtime` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/Windows3.1/index.html` | Windows 3.1 retro chat overlay | `showtime`, `hidebots`, `retro`, `chroma`, `font`, `fontfamily` | VDO plus optional `server`/`server2` out 3/in 4 |
| `themes/LuckyLootTube/luckyloottube.html` | Custom glass/bokeh style chat overlay | `showtime`, `hidebots`, `chroma`, `font`, `fontfamily`, `session`, `password`, `lanonly` | Hidden VDO iframe; no direct WebSocket handling found in this pass |

## Dock-Wrapper Theme Matrix

These pages embed `dock.html` with preset parameters. Debug the embedded dock URL if chat does not appear.

| Page | Wrapper Behavior | Passed Or Supported Params |
| --- | --- | --- |
| `themes/pretty.html` | Frames `../dock.html` inside a hologram image and injects base64 CSS | Adds `transparent`, `hidemenu`, `scale=0.35`, `hideshadow`, `emoji`, `compact`, `notime`, `swipeleft`, `color`, `noavatar`; passes `showtime`, `hidebots`; supports `chroma`, `font`, `fontfamily` |
| `themes/Neutron/chatOnly.html` | Frames `../../dock.html` with Neutron chat-only layout | Adds `transparent`, `hidemenu`, `scale=0.4`, `fadein`, `smooth`, `emoji`, `color`, `twolines`; passes `showtime`, `hidebots`; supports `chroma`, `darkmode` |
| `themes/Neutron/stream.html` | Frames `../../dock.html` inside a full stream-theme layout | Same pass-through pattern as `chatOnly.html`; README recommends 1920x1080 |

## Featured-Style Themes

These pages are for selected/featured messages. They behave more like `featured.html` than a normal chat overlay.

Shared behavior found in source:

- Read `session`, `room`, or `roomid`.
- Accept `password`, with some files also accepting `pass` or `pw`.
- Use hidden VDO scene iframe with `label=overlay` and `exclude=SESSION`.
- Listen for featured-style payloads such as `contents`, direct JSON, or `overlayNinja`.
- Auto-hide with `showtime` or `timer`, usually defaulting to 30000 ms.
- Load `../../tts.js`; `tts`, `lang`, `pitch`, `rate`, and `voice` are supported by most files.
- No direct `new WebSocket` path was found in this pass.

| Page | Style Values Found |
| --- | --- |
| `themes/featured-styles/featured-modern.html` | `glass`, `neon`, `minimal`, `gaming`, `twitch` |
| `themes/featured-styles/featured-animated.html` | `bounce`, `slide`, `typewriter`, `comic`, `holo` |
| `themes/featured-styles/featured-3d.html` | `cube`, `flip`, `float`, `helix`, `iso` |
| `themes/featured-styles/featured-particles.html` | `fireflies`, `snow`, `matrix`, `bubbles`, `stars` |
| `themes/featured-styles/featured-cyberpunk.html` | `neural`, `hack`, `hologram`, `matrix`, `circuit` |
| `themes/featured-styles/featured-dynamic.html` | `elastic`, `spring`, `pendulum`, `gravity`, `magnetic` |
| `themes/featured-styles/featured-elegant.html` | `classic`, `luxury`, `minimalist`, `royal`, `vintage` |
| `themes/featured-styles/featured-gaming.html` | `arcade`, `esports`, `fps`, `retro`, `rpg` |
| `themes/featured-styles/featured-glass.html` | `frosted`, `crystal`, `prism`, `mirror`, `ice` |
| `themes/featured-styles/featured-gradient.html` | `sunset`, `ocean`, `aurora`, `rainbow`, `cosmic` |
| `themes/featured-styles/featured-neon.html` | `electric`, `toxic`, `hotpink`, `uv`, `sunset` |
| `themes/featured-styles/featured-retro.html` | `vhs`, `arcade`, `laser`, `matrix`, `neoncity` |
| `themes/featured-styles/featured-slide.html` | `left`, `right`, `top`, `bottom`, `diagonal` |

Example URL:

```text
https://socialstream.ninja/themes/featured-styles/featured-modern.html?session=SESSION_ID&style=glass&showtime=10000
```

## Special Theme Pages

| Page | Behavior | First Check |
| --- | --- | --- |
| `themes/events/index.html` | Dashboard-style page that only displays YouTube/Twitch payloads with `event` or `hasDonation`; keeps up to 100 event cards | If ordinary chat is ignored, that is expected; send an event/donation payload or use `events.html` for the current main event dashboard |
| `themes/LuckyLootTube/luckyloottube.html` | Visual chat overlay with custom background/canvas effects and direct VDO listener | If self-hosted/local OBS fails, test hosted URL first and verify `session`; this file did not expose `server` mode in source scan |

## Support Routing

| User Says | Route |
| --- | --- |
| "I want a different chat look" | Use top-level or packaged chat themes first, then custom overlay docs if none fit. |
| "I want a styled selected-message overlay" | Use `themes/featured-styles/*.html`, not normal chat themes. |
| "The theme is blank" | Confirm same `session`, source side active, and whether the page expects all chat or only featured messages/events. |
| "It works in Chrome but not OBS" | Try hosted `https://socialstream.ninja/themes/...` first; for local files in OBS v31, use `server`/`server2` when the theme supports it. |
| "Can I edit this theme?" | Yes for a fork/local custom page, but keep the message bridge, max message cap, and image sizing. Use `sampleoverlay.html` for new custom work. |
| "Can this use WebSocket instead of iframe?" | Many direct chat themes support `server`/`server2`; featured-style and dock-wrapper themes generally need their own source check. |

## OBS And Local File Notes

`themes/readme.md` warns that OBS v31 can have cross-origin iframe issues for local custom themes. Practical support path:

1. Prefer the hosted theme URL when possible.
2. If using a local file and it receives nothing, test in a normal browser.
3. If the theme supports WebSocket mode, try `&server` or `&localserver&server` with the matching SSN API/relay settings enabled.
4. If the page embeds `dock.html`, debug the embedded dock behavior rather than the wrapper artwork.
5. If a featured-style theme is blank, feature a message from dock first.

## Do Not Overclaim

- Do not say all theme pages support all dock parameters.
- Do not say all themes support `server`; LuckyLootTube and featured-style pages did not show direct WebSocket support in this pass.
- Do not treat `themes/events/index.html` as the main `events.html` page.
- Do not tell users to edit `dock.html` for theme work; start with `sampleoverlay.html`, theme files, URL params, or OBS CSS.
- Do not assume local-file OBS behavior matches hosted behavior.

## Follow-Up Extraction Needs

- Render representative theme pages in a browser and OBS-sized viewport.
- Validate local-file behavior on OBS v31 with iframe mode and WebSocket mode.
- Generate exact parameter rows for every theme file.
- Compare featured-style themes against `featured.html` for payload compatibility and TTS behavior.
- Add screenshots or visual labels after render validation.
