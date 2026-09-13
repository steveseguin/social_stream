# Overlays And Pages Index

Status: framework plus heavy passes for dock, featured, multi-alerts, waitlist/polls/games, individual game pages, theme pages, tip jar/credits, AI/cohost pages, event/effect overlays, live display utilities, specialized/legacy pages, diagnostic/helper pages, custom overlays, page capability routing, and page processing inventory.

## Purpose

This section covers SSN pages users open in browsers, OBS, the extension, or the standalone app.

## Pages

- `dock.md`: heavy extraction pass started.
- `featured.md`: heavy extraction pass started.
- `multi-alerts.md`: heavy extraction pass started.
- `waitlist-polls-games.md`: heavy extraction pass started.
- `game-pages.md`: heavy extraction pass for `games.html` and current `games/*.html` pages.
- `theme-pages.md`: heavy extraction pass for `themes/**/*.html`, including chat themes, featured styles, and wrapper packages.
- `tipjar-credits.md`: heavy extraction pass started.
- `ai-cohost-pages.md`: heavy extraction pass started.
- `event-effect-overlays.md`: heavy extraction pass started.
- `live-display-utilities.md`: heavy extraction pass started.
- `specialized-legacy-pages.md`: heavy extraction pass started.
- `diagnostic-helper-pages.md`: heavy extraction pass started.
- `custom-overlays.md`: heavy extraction pass started.
- `page-capability-matrix.md`: cross-page routing for which page supports which overlay/tool/API/Event Flow/OBS behavior.
- `page-processing-matrix.md`: file-level processing depth for root overlay/tool pages, themes, games, AI/TTS pages, and Event Flow files.
- `../13-reference/surface-url-cheatsheet.md`: fast URL/page routing for dock, featured, alerts, tools, TTS/AI, API, and source pages.

## Source Anchors

- `social_stream/dock.html`
- `social_stream/featured.html`
- `social_stream/events.html`
- `social_stream/hype.html`
- `social_stream/confetti.html`
- `social_stream/wordcloud.html`
- `social_stream/leaderboard.html`
- `social_stream/games.html`
- `social_stream/games/*.html`
- `social_stream/emotes.html`
- `social_stream/reactions.html`
- `social_stream/scoreboard.html`
- `social_stream/ticker.html`
- `social_stream/map.html`
- `social_stream/chat-overlay.html`
- `social_stream/minecraft.html`
- `social_stream/septapus.html`
- `social_stream/shop_the_stream.html`
- `social_stream/simple_api_client.html`
- `social_stream/createtestmessage.html`
- `social_stream/replaymessages.html`
- `social_stream/replaymessages.js`
- `social_stream/recover.html`
- `social_stream/urleditor.html`
- `social_stream/streamelements-importer.html`
- `social_stream/streamelements-importer.js`
- `social_stream/spotify-overlay.html`
- `social_stream/test-giveaway-webrtc.html`
- `social_stream/docs/customoverlays.md`
- `social_stream/api.md`
- `social_stream/parameters.md`
- `social_stream/themes/**`

## Suggested Next Pass

- Intense pass for `dock.md` and `featured.md` by tracing exact API actions and URL parameters in code.
- Intense pass for `multi-alerts.md` by first resolving the current Playwright preview-iframe timeout, then rerunning the E2E script and adding per-platform event payload examples.
- Intense pass for `waitlist-polls-games.md` by tracing `battle.html`, current background command handlers, and popup/API command senders for waitlist, poll, timer, giveaway, and Spam Power.
- Intense pass for `game-pages.md` by rendering each game with controlled synthetic payloads, validating OBS/browser performance, and confirming page-local bot responses versus real platform send-back.
- Intense pass for `tipjar-credits.md` by tracing popup/API command senders, `currency.js`, and OBS/browser-source behavior.
- Intense pass for `ai-cohost-pages.md` by tracing dock right-click cohost commands, AI overlay settings, generated overlay handlers, and local model worker behavior.
- Intense pass for `event-effect-overlays.md` by capturing sample payloads for events, hype/viewer updates, waitlist draws, word cloud input, and leaderboard snapshots.
- Intense pass for `live-display-utilities.md` by tracing popup/API command senders and sample payloads for emotes, scoreboards, ticker text, and map voting; reactions already have a narrow controlled browser pass but still need OBS/live-platform validation.
- Intense pass for `specialized-legacy-pages.md` by validating redirect/runtime behavior, password handling, product-list API payloads, and Minecraft alert skin parity with `multi-alerts.js`.
- Intense pass for `diagnostic-helper-pages.md` by validating synthetic payloads, replay behavior, importer exports, Spotify payload senders, and giveaway test sync in a browser/OBS.
- Intense pass for `custom-overlays.md` by producing a safe minimal overlay template and compatibility table.
- Intense pass for `theme-pages.md` by rendering representative chat themes, featured-style themes, and wrapper themes in browser/OBS viewports.
- Intense pass for `page-capability-matrix.md` by generating exact per-page parameter, channel, label, storage, and bridge-mode rows from code.
- Use `page-processing-matrix.md` to pick the next page files to promote from inventory-only to quick/heavy extraction.
