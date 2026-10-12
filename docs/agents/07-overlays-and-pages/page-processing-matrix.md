# Page Processing Matrix

Status: quick inventory plus extraction-depth ledger for overlay, tool, game, theme, AI/TTS, and integration pages on 2026-06-24.

Use this page to answer: "Has this page file been processed already?", "Which pages are only inventoried?", and "What should the next extraction pass inspect?" Use `page-capability-matrix.md` for user-facing capability routing.

## Inventory Counts

Current file scan found:

| Area | Count | Notes |
| --- | --- | --- |
| Root `*.html` files | 70 | Includes app pages, overlays, tools, docs/marketing/legal shells, extension pages, and setup/test pages. |
| `themes/**/*.html` pages | 41 | Visual chat overlays, featured-message style overlays, wrapper themes, and package themes. |
| `games/*.html` pages | 17 | Chat-driven game pages. |
| `actions/` core docs/code files | 8 | Event Flow editor/runtime docs and implementation files listed below. |

This matrix focuses on pages users may open as overlays, tools, controllers, outputs, setup/test pages, or AI/TTS surfaces. Public docs pages, legal pages, and extension runtime shells are tracked in `11-support-kb/public-docs-coverage.md`, `03-extension-architecture.md`, and `02-resource-manifest.md`.

## Depth Labels

| Label | Meaning |
| --- | --- |
| `inventory-only` | Listed here, but not behavior-extracted. Inspect source before answering detailed questions. |
| `quick` | Basic routing or purpose notes exist. Details still need source checks. |
| `heavy` | Usable source-backed agent docs exist. Line-level behavior still needs validation. |
| `intense-needed` | High-risk or support-heavy page where exact handlers, storage, channels, and tests should be traced. |

## Core Overlay And Tool Pages

| File | Current Depth | Current Output Docs | Known Role | Next Extraction Need |
| --- | --- | --- | --- | --- |
| `dock.html` | heavy | `dock.md`, `page-capability-matrix.md`, API/reference docs | Main operator dashboard, all-message view, queue/pin/feature/control surface | Trace every `processInput`/API action, local/session storage behavior, label targeting, and OBS custom-dock behavior. |
| `featured.html` | heavy | `featured.md`, `page-capability-matrix.md` | Selected-message overlay | Trace exact parameter support, timeout/queue behavior, TTS path, and theme compatibility. |
| `samplefeatured.html` | quick | `featured.md` | Featured overlay sample/test page | Source-check before using in recipes. |
| `multi-alerts.html` | heavy | `multi-alerts.md`, `page-capability-matrix.md` | Stream event alert overlay | Validate classifier aliases, queue timing, preview path, and per-platform event payloads. |
| `actions.html` | heavy | `event-flow-editor.md`, `page-capability-matrix.md` | Event Flow media/audio/text/OBS output surface | Trace action payload format, layers, OBS WebSocket settings, and browser-source action requirements. |
| `waitlist.html` | heavy | `waitlist-polls-games.md`, `page-capability-matrix.md` | Waitlist, queue, draw/list display | Trace API handlers, join commands, draw mode, storage, and popup-generated URLs. |
| `poll.html` | heavy | `waitlist-polls-games.md`, `page-capability-matrix.md` | Poll display/control | Trace vote parsing, duplicate handling, presets, API settings, and storage. |
| `timer.html` | heavy | `waitlist-polls-games.md`, `page-capability-matrix.md` | Timer display/control | Trace state machine, API callbacks, warning/overtime behavior, and style options. |
| `giveaway.html` | heavy | `waitlist-polls-games.md`, `page-capability-matrix.md` | Giveaway controller and wheel | Trace entrant storage, keyword behavior, winner selection, BroadcastChannel/localStorage sync. |
| `giveaway-obs-entries.html` | heavy | `waitlist-polls-games.md`, `page-capability-matrix.md` | Giveaway OBS companion output | Trace controller-to-output sync, winner display, session/password handling. |
| `games.html` | heavy | `waitlist-polls-games.md`, `game-pages.md`, `page-capability-matrix.md` | Spam Power chat activity game | Validate scoring, localStorage history, server/extension relay paths, and OBS behavior. |
| `tipjar.html` | heavy | `tipjar-credits.md`, `url-parameters.md`, `surface-url-cheatsheet.md`, `page-capability-matrix.md` | Tip jar/goal display | Trace popup/API command senders, `currency.js`, OBS setup, and duplicate webhook/source tests. |
| `credits.html` | heavy | `tipjar-credits.md`, `url-parameters.md`, `surface-url-cheatsheet.md`, `page-capability-matrix.md` | Credits/supporter roll | Trace popup/menu `creditsCommand` senders, OBS visibility behavior, and reset workflows. |
| `sampleoverlay.html` | heavy | `custom-overlays.md`, `page-capability-matrix.md` | Minimal custom chat overlay example | Turn into a safe minimal template and validate WebSocket/iframe fallback behavior. |
| `chat-overlay.html` | heavy | `specialized-legacy-pages.md`, `ai-cohost-pages.md` | Redirect wrapper into `aioverlay.html` with `overlay=chat-overlay` | Validate generated overlay package availability and redirect URL behavior. |
| `events.html` | heavy | `event-effect-overlays.md`, `page-capability-matrix.md` | Event dashboard/log with metadata, filters, viewer top bar, and click-to-feature path | Capture sample payloads and validate filters, featured handoff, and `password` behavior. |
| `hype.html` | heavy | `event-effect-overlays.md`, `page-capability-matrix.md` | Viewer/chatter count overlay by source | Validate source/app payload generation, `viewer_updates`, custom channels, and CSS/JS injection behavior. |
| `confetti.html` | heavy | `event-effect-overlays.md`, `page-capability-matrix.md` | Waitlist draw winner confetti effect | Validate waitlist draw payloads and OBS rendering behavior. |
| `emotes.html` | heavy | `live-display-utilities.md`, `page-capability-matrix.md` | Floating emoji/image/SVG emote overlay from chat content | Validate source payload HTML/emote shape, bot/member filters, and OBS behavior. |
| `leaderboard.html` | heavy | `event-effect-overlays.md`, `page-capability-matrix.md` | Live leaderboard for chatters, donors, gifters, contributors, and loyalty snapshots | Validate exact scoring, reset/persistence, `points_leaderboard` snapshots, and server relay behavior. |
| `map.html` | heavy | `live-display-utilities.md`, `action-command-index.md`, `page-capability-matrix.md` | Viewer-location voting map | Validate command senders, settings payloads, region/state/city matching, and data asset loading. |
| `minecraft.html` | heavy | `specialized-legacy-pages.md`, `multi-alerts.md` | Minecraft-styled alert skin using `multi-alerts.js` | Validate alert parity against `multi-alerts.js` and controlled event payloads. |
| `reactions.html` | heavy | `live-display-utilities.md`, `page-capability-matrix.md` | Like/reaction burst overlay | Validate source event support and burst/dedupe behavior. |
| `scoreboard.html` | heavy | `live-display-utilities.md`, `page-capability-matrix.md` | Points scoreboard display | Validate points snapshot path, local scoring flags, and popup/API senders. |
| `septapus.html` | heavy | `specialized-legacy-pages.md` | YouTube-structured custom chat renderer for CSS compatibility | Validate password behavior, CSS injection paths, and message DOM compatibility. |
| `shop_the_stream.html` | heavy | `specialized-legacy-pages.md` | Product-list/commerce overlay prototype using direct WebSocket API | Validate product-list action sender path, channel routing, and support/commercial boundaries. |
| `ticker.html` | heavy | `live-display-utilities.md`, `page-capability-matrix.md` | Ticker text display | Validate command/API sender path and `out:7`/`in:8` server routing. |
| `wordcloud.html` | heavy | `event-effect-overlays.md`, `page-capability-matrix.md` | D3 chat word cloud | Validate single-word versus `allwords` parsing, reset payloads, and bridge-only transport. |

## API, Integration, Test, And Diagnostic Pages

| File | Current Depth | Current Output Docs | Known Role | Next Extraction Need |
| --- | --- | --- | --- | --- |
| `sampleapi.html` | heavy | `websocket-http-api.md`, `surface-url-cheatsheet.md`, `page-capability-matrix.md` | API sandbox/test page | Trace exact generated commands and any stale presets against `api.md` and page source. |
| `simple_api_client.html` | heavy | `diagnostic-helper-pages.md` | Minimal SSN WebSocket/API smoke client | Validate remote API toggles and send-back assumptions before public recipes. |
| `sample_wss_source.html` | quick | `generic-and-custom-sources.md`, `adding-a-source.md` | Sample WebSocket/source sender | Source-check current message shape and setup steps. |
| `streamerbot.html` | heavy | `streamerbot.md`, `page-capability-matrix.md` | Streamer.bot setup/integration page | Trace exact WebSocket request/response path and action ID behavior. |
| `obs-websocket-test.html` | quick | `obs.md`, `event-flow-editor.md` | OBS WebSocket diagnostic page | Validate current v5 test flow, auth behavior, and error messages. |
| `midimonitor.html` | quick | `action-command-index.md`, `features-and-capabilities.md` | MIDI diagnostic/control page by filename | Source-check device permissions and output path. |
| `spotify.html` | quick | `event-flow-editor.md`, `features-and-capabilities.md` | Spotify setup/control page by filename | Source-check OAuth/settings/action support. |
| `spotify-overlay.html` | heavy | `diagnostic-helper-pages.md` | Spotify now-playing output overlay | Trace the Spotify source/control side that emits payloads and validate OBS rendering. |
| `streamelements-importer.html` | heavy | `diagnostic-helper-pages.md` | StreamElements/Streamlabs widget import/export helper | Validate exports with real widget zips/folders and OBS browser source behavior. |
| `urleditor.html` | heavy | `diagnostic-helper-pages.md` | URL parameter editor/helper with local saved presets | Reconcile hardcoded parameter catalog with generated URL parameter index. |
| `createtestmessage.html` | heavy | `diagnostic-helper-pages.md` | Synthetic SSN payload/test-message sender | Validate presets against event/alert pages and current event schema. |
| `test-giveaway-webrtc.html` | heavy | `diagnostic-helper-pages.md` | Giveaway local communication diagnostic | Validate against current giveaway pages in same browser context. |
| `recover.html` | heavy | `diagnostic-helper-pages.md` | Dock URL to importable settings recovery helper | Validate recovered `.data` imports against current extension/app import flow. |
| `replaymessages.html` | heavy | `diagnostic-helper-pages.md` | Chat history replay controller backed by stored message DB | Fix or confirm background replay progress/cleanup caveat before stable user-facing recipes. |

## AI, TTS, Bot, And Cohost Pages

| File | Current Depth | Current Output Docs | Known Role | Next Extraction Need |
| --- | --- | --- | --- | --- |
| `bot.html` | heavy | `ai-features.md`, `page-capability-matrix.md` | Bot/AI surface where configured | Trace provider settings, trigger rules, storage, and chat send path. |
| `chatbot.html` | heavy | `ai-features.md`, `page-capability-matrix.md` | One-on-one/private chatbot page | Trace session use, provider setup, and privacy/storage behavior. |
| `cohost.html` | heavy | `ai-features.md`, `ai-cohost-pages.md`, `page-capability-matrix.md`, public cohost guide | AI cohost control/monitor page | Trace dock integration, provider/model paths, and tool requests line-by-line. |
| `cohost-overlay.html` | heavy | `ai-cohost-pages.md`, `page-capability-matrix.md`, public cohost guide | AI cohost playout overlay | Trace dock right-click command senders, OBS audio behavior, and label detection. |
| `aioverlay.html` | heavy | `ai-cohost-pages.md`, `02-resource-manifest.md` | Runtime page for saved/generated AI overlays | Validate generated overlay handlers, extension sync, and server/bridge modes. |
| `aiprompt.html` | heavy | `ai-cohost-pages.md`, `02-resource-manifest.md` | AI prompt overlay builder/editor | Validate AI provider bridge, patch rules, screenshots, export/import, and save/sync workflows. |
| `message-ai-export.html` | quick | `ai-cohost-pages.md`, `02-resource-manifest.md` | AI/message export page by filename; not yet a primary live overlay route | Source-check privacy, file output, and current workflow before recipes. |
| `tts.html` | heavy | `tts.md`, `features-and-capabilities.md` | TTS setup/test or output page by filename | Trace provider support, browser audio, OBS capture, and free/cloud boundaries. |

## Game Pages

Individual `games/*.html` files now have a source-backed heavy pass in `game-pages.md`. Use it for commands, URL shape, storage, transport, and first-failure checks. Still source-check before promising exact browser rendering, OBS performance, or real platform chat send-back.

| File | Current Depth | Current Output Docs | Next Extraction Need |
| --- | --- | --- | --- |
| `games/chaosmode.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate rendering and command effects with synthetic payloads. |
| `games/chatgarden.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate plant keyword coverage and OBS visual behavior. |
| `games/chatwars.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate battle start/team flow and territory updates. |
| `games/chickenroyale.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate Three.js rendering, lobby timing, relay paths, and stored dinners. |
| `games/colorsymphony.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate color keyword coverage and audio/visual effects. |
| `games/colorwars.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate team command parsing, bot responses, and score updates. |
| `games/dancingparade.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate dancer join/dance/leave flow and bot responses. |
| `games/emojirain.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate emoji extraction against real platform payload shapes. |
| `games/emojitower.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate `!drop` flow and bot responses. |
| `games/memorylane.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate keyword/emoji/long-message photo creation. |
| `games/petrace.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate race capacity, auto-start, and bot responses. |
| `games/phraseguess.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate controller UI, storage, reveal timing, similarity scoring, and send modes. |
| `games/pixelbattle.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate paint command parsing and coordinate bounds. |
| `games/rhythmpulse.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate browser audio permission, beat keyword coverage, and OBS audio capture. |
| `games/treasurehunt.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate coordinate parsing, round reset, and bot responses. |
| `games/wordchain.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate word-chain rules, duplicate handling, and timed rounds. |
| `games/wordstorm.html` | heavy | `game-pages.md`, `waitlist-polls-games.md` grouped notes | Validate word filtering, combo behavior, and max visible words. |

## Theme Pages

Theme pages now have a source-backed heavy pass in `theme-pages.md`. Use it for theme-family routing, URL shapes, parameter groups, bridge mode, featured-vs-chat differences, wrapper behavior, and OBS/local-file caveats. Still render-check before making final visual/layout claims.

| File | Current Depth | Current Output Docs | Next Extraction Need |
| --- | --- | --- | --- |
| `themes/compact-classic.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate rendered compact row behavior and parameter combinations. |
| `themes/compact-clean.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate rendered compact row behavior and parameter combinations. |
| `themes/compact-glass.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate rendered compact glass behavior and parameter combinations. |
| `themes/deuks_overlay/overlay1.html` | heavy | `theme-pages.md`, package README | Validate package assets and OBS local/hosted behavior. |
| `themes/deuks_overlay/overlay2.html` | heavy | `theme-pages.md`, package README | Validate package assets and OBS local/hosted behavior. |
| `themes/events/index.html` | heavy | `theme-pages.md` | Validate event/donation filtering against current payloads. |
| `themes/featured-styles/featured-3d.html` | heavy | `theme-pages.md`, `featured.md` | Validate featured payload compatibility and 3D rendering. |
| `themes/featured-styles/featured-animated.html` | heavy | `theme-pages.md`, `featured.md` | Validate featured payload compatibility and animation behavior. |
| `themes/featured-styles/featured-cyberpunk.html` | heavy | `theme-pages.md`, `featured.md` | Validate featured payload compatibility and TTS behavior. |
| `themes/featured-styles/featured-dynamic.html` | heavy | `theme-pages.md`, `featured.md` | Validate featured payload compatibility and animation behavior. |
| `themes/featured-styles/featured-elegant.html` | heavy | `theme-pages.md`, `featured.md` | Validate featured payload compatibility and visual styles. |
| `themes/featured-styles/featured-gaming.html` | heavy | `theme-pages.md`, `featured.md` | Validate featured payload compatibility and visual styles. |
| `themes/featured-styles/featured-glass.html` | heavy | `theme-pages.md`, `featured.md` | Validate featured payload compatibility and visual styles. |
| `themes/featured-styles/featured-gradient.html` | heavy | `theme-pages.md`, `featured.md` | Validate featured payload compatibility and visual styles. |
| `themes/featured-styles/featured-modern.html` | heavy | `theme-pages.md`, `featured.md` | Validate featured payload compatibility, `autoshow`, and TTS behavior. |
| `themes/featured-styles/featured-neon.html` | heavy | `theme-pages.md`, `featured.md` | Validate featured payload compatibility and visual styles. |
| `themes/featured-styles/featured-particles.html` | heavy | `theme-pages.md`, `featured.md` | Validate featured payload compatibility and particle performance. |
| `themes/featured-styles/featured-retro.html` | heavy | `theme-pages.md`, `featured.md` | Validate featured payload compatibility and visual styles. |
| `themes/featured-styles/featured-slide.html` | heavy | `theme-pages.md`, `featured.md` | Validate featured payload compatibility and slide directions. |
| `themes/horizontal.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate horizontal layout, filtering flags, and message overflow. |
| `themes/huan-kiara/index.html` | heavy | `theme-pages.md`, package README | Validate asset loading and `size` behavior. |
| `themes/LuckyLootTube/luckyloottube.html` | heavy | `theme-pages.md` | Validate VDO-only behavior, canvas/background rendering, and OBS performance. |
| `themes/Neutron/chatOnly.html` | heavy | `theme-pages.md`, package README | Validate wrapper iframe and recommended 430x650 layout. |
| `themes/Neutron/stream.html` | heavy | `theme-pages.md`, package README | Validate wrapper iframe and recommended 1920x1080 layout. |
| `themes/notimeoutmessages.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate persistent message behavior and limits. |
| `themes/overlay-bubbles.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate bubble sizing and high-volume behavior. |
| `themes/overlay-cards.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate card flip behavior and `autoflip`. |
| `themes/overlay-comic-classic.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate comic style rendering and limits. |
| `themes/overlay-comic-pop.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate comic style rendering and limits. |
| `themes/overlay-danmaku.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate lane/region/duration behavior. |
| `themes/overlay-neon-cyberpunk.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate high-intensity effects and OBS performance. |
| `themes/overlay-particles.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate particle density and OBS performance. |
| `themes/overlay-ticker-news.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate ticker speed/top/bar/name/source flags. |
| `themes/overlay-typewriter.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate typewriter speed and sound toggle. |
| `themes/overlay-xacception.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate visual behavior and core parameters. |
| `themes/pretty.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate dock-wrapper iframe, hologram asset, and injected CSS. |
| `themes/rainbowpuke/index.html` | heavy | `theme-pages.md`, package README | Validate visual behavior and local/hosted assets. |
| `themes/sampleoverlay_reverse.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate reverse scroll behavior and supported options. |
| `themes/spiritoverlay.html` | heavy | `theme-pages.md`, `custom-overlays.md` | Validate fadeout behavior and limits. |
| `themes/t3nk3y/index.html` | heavy | `theme-pages.md`, package README | Validate bundled chroma dependency and `gaming` mode. |
| `themes/Windows3.1/index.html` | heavy | `theme-pages.md`, package README | Validate retro mode and visual layout. |

## Event Flow Files

| File | Current Depth | Current Output Docs | Next Extraction Need |
| --- | --- | --- | --- |
| `actions/index.html` | heavy | `event-flow-editor.md` | Validate editor entry point, asset loading, and UI labels. |
| `actions/event-flow-guide.html` | heavy | `event-flow-editor.md` | Reconcile guide claims with current code/tests. |
| `actions/state-nodes-guide.html` | heavy | `event-flow-editor.md` | Reconcile state-node guide claims with current code/tests. |
| `actions/STATE_NODES_EXPLANATION.md` | heavy | `event-flow-editor.md` | Mark stale sections where code/tests differ. |
| `actions/EventFlowEditor.js` | heavy | `event-flow-editor.md` | Intense trace of node definitions, UI fields, templates, and exports/imports. |
| `actions/EventFlowSystem.js` | heavy | `event-flow-editor.md` | Intense trace of trigger/action execution and side effects. |
| `actions/interface.js` | inventory-only | `02-resource-manifest.md` | Source-check runtime role and page bridge behavior. |
| `actions/loader.js` | inventory-only | `02-resource-manifest.md` | Source-check asset loading and runtime context. |

## Root HTML Pages Tracked Elsewhere

These root pages are not primary overlay/tool extraction targets in this matrix:

- Extension/runtime shells: `background.html`, `popup.html`, `content.html`.
- Public/marketing/legal/documentation pages: `404.html`, `affiliate.html`, `beta.html`, `index.html`, `landing.html`, `privacy.html`, `TOS.html`.
- Miscellaneous app/document pages that need separate routing before overlay classification: `automix.html`, `baretempate.html`, `chathistory.html`, `fonts.html`, `gif.html`, `input.html`, `meta.html`, `vdo.html`.

If a user asks about any of these, inspect the file directly and add a row here or route it to the appropriate section.

## Next Pass Priority

1. Generate exact parameter/channel/storage rows for `dock.html`, `featured.html`, `multi-alerts.html`, `actions.html`, `waitlist.html`, `poll.html`, `timer.html`, `giveaway*.html`, `tipjar.html`, `credits.html`, AI/cohost pages, and event/effect overlays.
2. Validate `event-effect-overlays.md` with controlled payloads for `events.html`, `hype.html`, `confetti.html`, `wordcloud.html`, and `leaderboard.html`.
3. Validate `live-display-utilities.md` with controlled payloads for `emotes.html`, `reactions.html`, `scoreboard.html`, `ticker.html`, and `map.html`.
4. Validate `specialized-legacy-pages.md` with redirect checks, controlled alert payloads, YouTube-style CSS checks, and shop/product-list API payloads.
5. Validate `diagnostic-helper-pages.md` with synthetic test payloads, settings recovery imports, message replay, importer export files, Spotify payload senders, and giveaway local sync.
6. Validate `ai-cohost-pages.md` against dock right-click command senders, AI overlay settings, and local model worker behavior.
7. Validate `tipjar-credits.md` against popup/API command senders, `currency.js`, and OBS behavior.
8. Validate `game-pages.md` with synthetic payloads, browser screenshots, OBS checks, and exact generated parameter rows.
9. Validate `theme-pages.md` with browser/OBS screenshots, local-file OBS v31 checks, and exact per-theme parameter rows.
