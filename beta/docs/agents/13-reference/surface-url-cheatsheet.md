# Surface URL Cheat Sheet

Status: heavy routing pass from `README.md`, `api.md`, `parameters.md`, current overlay/API agent docs, and known repo pages on 2026-06-24.

Use this page when a user asks "what URL do I open?", "which page goes in OBS?", "where do I test the API?", or "which source page do I use?" This is a routing cheat sheet, not a full parameter catalog. For page dependencies and capability support, use `../07-overlays-and-pages/page-capability-matrix.md`. For exact options, use `url-parameters.md`, `url-parameter-index.md`, `url-option-examples.md`, and the page-specific docs.

## URL Basics

| Item | Rule |
| --- | --- |
| Hosted base | Most public pages use `https://socialstream.ninja/PAGE.html`. |
| Session | Add `?session=SESSION_ID` unless the page is a source setup page that has its own auth/API fields. |
| Secrets | Do not share full URLs publicly if they include session IDs, passwords, API keys, webhook URLs, OAuth tokens, or private API URLs. |
| Page parameters | Most page options are read at load time. Refresh the page after changing URL parameters. |
| App vs hosted | The standalone app can load source windows and app bridges; hosted pages are usually browser/OBS surfaces. |

Common pattern:

```text
https://socialstream.ninja/PAGE.html?session=SESSION_ID&option=value
```

## First Choice Matrix

| User Wants | Open This | Notes |
| --- | --- | --- |
| See all captured messages and control them | `dock.html?session=SESSION_ID` | Main operator dashboard. |
| Show one selected message in OBS | `featured.html?session=SESSION_ID` | Needs dock selection, auto-show, or API command. |
| Show stream event alerts | `multi-alerts.html?session=SESSION_ID` | Event support depends on platform/mode. |
| Run Event Flow media/audio/OBS actions | `actions.html?session=SESSION_ID` | Must stay open for visual/audio/action output. |
| Read chat aloud | `dock.html`, `featured.html`, `bot.html`, `chatbot.html`, `cohost.html`, or a TTS-capable overlay | The page that should produce audio must be open and unmuted. |
| Run a poll | `poll.html?session=SESSION_ID` | Page-specific state and API actions. |
| Run a waitlist/queue/giveaway list | `waitlist.html?session=SESSION_ID` | Also check dock queue behavior for featured-message queues. |
| Run a timer | `timer.html?session=SESSION_ID` | API-controllable where configured. |
| Run giveaway wheel/control | `giveaway.html?session=SESSION_ID` | Controller/entrant wheel. |
| Show giveaway OBS entries/winner view | `giveaway-obs-entries.html?session=SESSION_ID` | Companion view for giveaway output. |
| Run a chat game | `games.html?session=SESSION_ID` or `games/FILE.html?session=SESSION_ID` | Game-specific commands and storage vary; use the game docs before support promises. |
| Show tip jar/goal meter | `tipjar.html?session=SESSION_ID` | Use tip jar parameters for goal/style/source/unit. |
| Show credits/supporter roll | `credits.html?session=SESSION_ID` | Use credits parameters and persistence carefully. |
| Show event dashboard/log | `events.html?session=SESSION_ID` | Use when the user wants a feed of event cards and metadata, not animated alert popups. |
| Show viewer/chatter counts | `hype.html?session=SESSION_ID` | Needs hype/viewer-count payloads from source/app. |
| Show waitlist winner confetti | `confetti.html?session=SESSION_ID` | Tied to waitlist draw winner payloads. |
| Show a chat word cloud | `wordcloud.html?session=SESSION_ID` | Default counts one-word messages; add `allwords` for sentence tokenizing. |
| Show a leaderboard | `leaderboard.html?session=SESSION_ID` | Scores chat/events or points snapshots; persistence and reset options matter. |
| Show floating emotes | `emotes.html?session=SESSION_ID` | Needs chat messages with emoji/images/SVG emotes. |
| Show reaction/like bursts | `reactions.html?session=SESSION_ID` | Needs reaction/like event payloads. |
| Show points scoreboard | `scoreboard.html?session=SESSION_ID` | Needs points snapshots or local scoring flags. |
| Show ticker text | `ticker.html?session=SESSION_ID` | Needs payloads with `ticker`. |
| Show viewer location map | `map.html?session=SESSION_ID` | Viewers chat recognizable locations. |
| Use generated chat overlay wrapper | `chat-overlay.html?session=SESSION_ID` | Redirects to `aioverlay.html` with `overlay=chat-overlay`. |
| Show Minecraft-styled alerts | `minecraft.html?session=SESSION_ID` | Themed alert skin powered by `multi-alerts.js`. |
| Use YouTube-style CSS renderer | `septapus.html?session=SESSION_ID` | YouTube-like chat DOM, not full dock behavior. |
| Show product/gear lists | `shop_the_stream.html?sessionId=SESSION_ID` | Direct WebSocket API listener; note `sessionId`, not `session`. |
| Test API actions manually | `sampleapi.html?session=SESSION_ID` | Good for reproducing StreamDeck/HTTP command issues. |
| Generate a synthetic chat/event payload | `createtestmessage.html?session=SESSION_ID` | Diagnostic sender; choose extension API or direct WebSocket delivery. |
| Run a tiny raw WebSocket smoke client | `simple_api_client.html` | Developer diagnostic only; not the full API sandbox. |
| Replay stored local chat history | `replaymessages.html` | Helper/controller page; treat old chat history as private. |
| Recover settings from a dock URL | `recover.html` | Converts URL params into an importable `.data` settings file. |
| Edit an overlay URL without hand-editing params | `urleditor.html` | Helper catalog may lag current generated parameter config. |
| Convert a StreamElements/Streamlabs chat widget | `streamelements-importer.html` | Export a generated HTML file, then use that file in OBS. |
| Show Spotify now playing | `spotify-overlay.html?session=SESSION_ID` | Needs Spotify now-playing payloads, not ordinary chat. |
| Test giveaway page communication | `test-giveaway-webrtc.html?session=SESSION_ID` | Local BroadcastChannel/localStorage sync tester. |
| Start a custom overlay | `sampleoverlay.html?session=SESSION_ID` or local/forked custom page | Minimal/custom renderer path. |
| Use a prebuilt chat theme | `themes/compact-clean.html?session=SESSION_ID`, `themes/t3nk3y/?session=SESSION_ID`, or similar | Theme pages vary; check whether it is chat, featured, or wrapper style. |
| Use a styled featured-message theme | `themes/featured-styles/featured-modern.html?session=SESSION_ID&style=glass` | Needs a featured/selected message, not just ordinary chat. |
| Connect external app to chat | `wss://io.socialstream.ninja/join/SESSION_ID/4` | Requires remote API and chat relay toggles. |
| Send simple API action | `https://io.socialstream.ninja/SESSION_ID/ACTION` | Action depends on target page/source being open. |

## Core Chat And Overlay Pages

| Page | Typical URL | Purpose | Deeper Doc |
| --- | --- | --- | --- |
| `dock.html` | `https://socialstream.ninja/dock.html?session=SESSION_ID` | Main chat dashboard, moderation/control surface, queue/pin/feature, TTS controls, API relay path. | `07-overlays-and-pages/dock.md` |
| `featured.html` | `https://socialstream.ninja/featured.html?session=SESSION_ID` | Selected-message overlay for OBS/browser output. | `07-overlays-and-pages/featured.md` |
| `multi-alerts.html` | `https://socialstream.ninja/multi-alerts.html?session=SESSION_ID` | Alert overlay for supported stream events. | `07-overlays-and-pages/multi-alerts.md` |
| `sampleoverlay.html` | `https://socialstream.ninja/sampleoverlay.html?session=SESSION_ID` | Minimal custom overlay example. | `07-overlays-and-pages/custom-overlays.md` |
| `themes/*` pages | `https://socialstream.ninja/themes/compact-clean.html?session=SESSION_ID`, `https://socialstream.ninja/themes/t3nk3y/?session=SESSION_ID`, and similar | Alternative visual chat themes, featured-message styles, and wrapper packages. | `07-overlays-and-pages/theme-pages.md` |
| `themes/featured-styles/*` pages | `https://socialstream.ninja/themes/featured-styles/featured-modern.html?session=SESSION_ID&style=glass` | Styled selected-message overlays. | `07-overlays-and-pages/theme-pages.md` |

Support notes:

- If dock has messages but featured is blank, check featured URL/session and then click a message in dock.
- If OBS is blank but the browser works, troubleshoot OBS browser source settings.
- If multiple pages are open, use `&label=NAME` and target labels from API commands where supported.
- Theme pages are not all the same: normal chat themes render incoming chat, featured-style themes wait for selected messages, and wrapper themes embed `dock.html`.

## Event, Stats, And Aggregation Pages

| Page | Typical URL | Purpose | Deeper Doc |
| --- | --- | --- | --- |
| `events.html` | `https://socialstream.ninja/events.html?session=SESSION_ID` | Event dashboard/log with metadata, filters, donation/status display, and optional click-to-feature path. | `07-overlays-and-pages/event-effect-overlays.md` |
| `hype.html` | `https://socialstream.ninja/hype.html?session=SESSION_ID` | Viewer/chatter count overlay by source. | `07-overlays-and-pages/event-effect-overlays.md` |
| `confetti.html` | `https://socialstream.ninja/confetti.html?session=SESSION_ID` | Confetti effect for waitlist draw winners. | `07-overlays-and-pages/event-effect-overlays.md` |
| `wordcloud.html` | `https://socialstream.ninja/wordcloud.html?session=SESSION_ID` | Chat word cloud. | `07-overlays-and-pages/event-effect-overlays.md` |
| `leaderboard.html` | `https://socialstream.ninja/leaderboard.html?session=SESSION_ID` | Live leaderboard for chatters, donors, gifters, contributors, or loyalty snapshots. | `07-overlays-and-pages/event-effect-overlays.md` |
| `emotes.html` | `https://socialstream.ninja/emotes.html?session=SESSION_ID` | Floating emoji/image/SVG emote overlay from chat content. | `07-overlays-and-pages/live-display-utilities.md` |
| `reactions.html` | `https://socialstream.ninja/reactions.html?session=SESSION_ID` | Like/reaction burst overlay. | `07-overlays-and-pages/live-display-utilities.md` |
| `scoreboard.html` | `https://socialstream.ninja/scoreboard.html?session=SESSION_ID` | Points scoreboard from snapshots or local scoring flags. | `07-overlays-and-pages/live-display-utilities.md` |
| `ticker.html` | `https://socialstream.ninja/ticker.html?session=SESSION_ID` | Scrolling or rotating ticker text from explicit ticker payloads. | `07-overlays-and-pages/live-display-utilities.md` |
| `map.html` | `https://socialstream.ninja/map.html?session=SESSION_ID` | Viewer-location voting map. | `07-overlays-and-pages/live-display-utilities.md` |
| `chat-overlay.html` | `https://socialstream.ninja/chat-overlay.html?session=SESSION_ID` | Redirect helper into `aioverlay.html?overlay=chat-overlay`. | `07-overlays-and-pages/specialized-legacy-pages.md` |
| `minecraft.html` | `https://socialstream.ninja/minecraft.html?session=SESSION_ID` | Minecraft-styled alert overlay using `multi-alerts.js`. | `07-overlays-and-pages/specialized-legacy-pages.md` |
| `septapus.html` | `https://socialstream.ninja/septapus.html?session=SESSION_ID` | YouTube-structured chat renderer for YouTube-style CSS compatibility. | `07-overlays-and-pages/specialized-legacy-pages.md` |
| `shop_the_stream.html` | `https://socialstream.ninja/shop_the_stream.html?sessionId=SESSION_ID` | Product-list/gear overlay driven by API payloads or built-in chat commands. | `07-overlays-and-pages/specialized-legacy-pages.md` |

Support notes:

- Use `multi-alerts.html` for animated alert popups; use `events.html` for a dashboard/log.
- `wordcloud.html` default mode only counts single-word chat messages; use `&allwords` for full-message tokenizing.
- `leaderboard.html` can keep local persisted state when `persistdata` is used.
- `ticker.html` only displays explicit `ticker` payloads; it is not a normal chat overlay.
- `scoreboard.html` is points-oriented; `leaderboard.html` is broader contributor ranking.
- `minecraft.html` is alert styling, not a Minecraft source integration.
- `shop_the_stream.html` uses `sessionId`/`streamid`, unlike most receiving pages that use `session`.

## Operator And Automation Pages

| Page | Typical URL | Purpose | Deeper Doc |
| --- | --- | --- | --- |
| `actions.html` | `https://socialstream.ninja/actions.html?session=SESSION_ID` | Event Flow output/actions overlay for media, audio, OBS, and visual actions. | `09-api-and-integrations/event-flow-editor.md` |
| Event Flow editor | `https://socialstream.ninja/actions/` or related actions guide/editor paths | Build visual automation flows. | `09-api-and-integrations/event-flow-editor.md` |
| `sampleapi.html` | `https://socialstream.ninja/sampleapi.html?session=SESSION_ID` | Test and generate common API commands. | `09-api-and-integrations/websocket-http-api.md` |
| `streamerbot.html` | `https://socialstream.ninja/streamerbot.html?session=SESSION_ID` | Streamer.bot integration/setup surface. | `09-api-and-integrations/streamerbot.md` |
| `obs-websocket-test.html` | Local/hosted test page where available | OBS WebSocket diagnostics. | `09-api-and-integrations/obs.md` |

Support notes:

- Event Flow can fire while `actions.html` output is closed, but media/audio/OBS/browser-source actions may appear to do nothing if the actions surface is not open.
- API actions need the target page/source connected. A successful HTTP request does not prove the target acted.

## Diagnostic, Recovery, And Import Helpers

| Page | Typical URL | Purpose | Deeper Doc |
| --- | --- | --- | --- |
| `createtestmessage.html` | `https://socialstream.ninja/createtestmessage.html?session=SESSION_ID` | Build and send synthetic SSN chat/event payloads for testing overlays and API paths. | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| `simple_api_client.html` | `https://socialstream.ninja/simple_api_client.html` | Minimal WebSocket client using `out:3`, `in:4` and a simple `sendChat` payload. | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| `replaymessages.html` | `https://socialstream.ninja/replaymessages.html` | Replay locally stored chat history by time range and speed. | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| `recover.html` | `https://socialstream.ninja/recover.html` | Convert a `dock.html` URL or query string into importable settings JSON. | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| `urleditor.html` | `https://socialstream.ninja/urleditor.html` | Edit, add, save, and copy dock/overlay URL parameters. | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| `streamelements-importer.html` | `https://socialstream.ninja/streamelements-importer.html?session=SESSION_ID` | Convert a StreamElements/Streamlabs chat widget zip/folder into a standalone OBS HTML file. | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| `spotify-overlay.html` | `https://socialstream.ninja/spotify-overlay.html?session=SESSION_ID&label=spotify` | Spotify now-playing overlay. | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| `test-giveaway-webrtc.html` | `https://socialstream.ninja/test-giveaway-webrtc.html?session=SESSION_ID` | Test local giveaway page communication. | `07-overlays-and-pages/diagnostic-helper-pages.md` |

Support notes:

- These pages are mostly setup, diagnostic, or conversion helpers. Do not put them in OBS unless the page is `spotify-overlay.html` or the exported StreamElements/Streamlabs HTML file.
- `createtestmessage.html` creates synthetic payloads. It does not prove that a real platform source emits the same event.
- `recover.html`, `replaymessages.html`, and importer exports can expose session IDs, passwords, or historical chat. Redact before sharing.
- `urleditor.html` has a hardcoded parameter catalog. Check exact current support in the generated URL parameter index and page docs.

## Interactive Tool Pages

| Page | Typical URL | Purpose | Deeper Doc |
| --- | --- | --- | --- |
| `waitlist.html` | `https://socialstream.ninja/waitlist.html?session=SESSION_ID` | Waitlists, queues, draw/giveaway-style list workflows. | `07-overlays-and-pages/waitlist-polls-games.md` |
| `poll.html` | `https://socialstream.ninja/poll.html?session=SESSION_ID` | Poll display/control page. | `07-overlays-and-pages/waitlist-polls-games.md` |
| `timer.html` | `https://socialstream.ninja/timer.html?session=SESSION_ID` | Timer display/control page. | `07-overlays-and-pages/waitlist-polls-games.md` |
| `giveaway.html` | `https://socialstream.ninja/giveaway.html?session=SESSION_ID` | Giveaway controller and entrant wheel. | `07-overlays-and-pages/waitlist-polls-games.md` |
| `giveaway-obs-entries.html` | `https://socialstream.ninja/giveaway-obs-entries.html?session=SESSION_ID` | Giveaway OBS companion output. | `07-overlays-and-pages/waitlist-polls-games.md` |
| `games.html` | `https://socialstream.ninja/games.html?session=SESSION_ID` | Spam Power chat activity game. | `07-overlays-and-pages/game-pages.md` |
| `games/*` pages | `https://socialstream.ninja/games/petrace.html?session=SESSION_ID` and similar | Individual chat-driven mini games with page-specific commands. | `07-overlays-and-pages/game-pages.md` |
| `battle.html` | `https://socialstream.ninja/battle.html?session=SESSION_ID` | Older/chat-driven game surface; needs source-check before detailed support. | `13-reference/commands-and-actions.md` |

Support notes:

- Tool pages often keep their own page state in addition to SSN session traffic.
- Chat games still need a source side on the same session; `?demo` only proves the local page can animate.
- Check page-specific command actions before promising StreamDeck/API control or platform chat send-back.

## TTS And AI Pages

| Page | Typical URL | Purpose | Deeper Doc |
| --- | --- | --- | --- |
| `dock.html` with TTS options | `dock.html?session=SESSION_ID&speech=en-US` | TTS from dock/operator surface. | `09-api-and-integrations/tts.md` |
| `featured.html` with TTS options | `featured.html?session=SESSION_ID&speech=en-US` | TTS from featured/overlay surface. | `09-api-and-integrations/tts.md` |
| `bot.html` | `https://socialstream.ninja/bot.html?session=SESSION_ID` | Main bot/AI style surface where configured. | `09-api-and-integrations/ai-features.md` |
| `chatbot.html` | `https://socialstream.ninja/chatbot.html?session=SESSION_ID` | Dedicated private one-on-one chatbot page. | `09-api-and-integrations/ai-features.md` |
| `cohost.html` | `https://socialstream.ninja/cohost.html?session=SESSION_ID` | Multimodal AI cohost page. | `07-overlays-and-pages/ai-cohost-pages.md` |
| `cohost-overlay.html` | `https://socialstream.ninja/cohost-overlay.html?session=SESSION_ID&tts` | AI cohost/avatar/speech stage overlay for OBS. | `07-overlays-and-pages/ai-cohost-pages.md` |
| `aiprompt.html` | `https://socialstream.ninja/aiprompt.html?session=SESSION_ID` | AI-assisted generated-overlay builder/editor. | `07-overlays-and-pages/ai-cohost-pages.md` |
| `aioverlay.html` | `https://socialstream.ninja/aioverlay.html?session=SESSION_ID&label=aioverlay&overlay=chat-overlay` | Runtime page for saved AI-generated overlays. | `07-overlays-and-pages/ai-cohost-pages.md` |

Support notes:

- Provider keys, custom endpoints, and local model URLs should not be posted publicly.
- The page that should speak must be open, allowed to play audio, and routed into OBS/system audio as intended.

## Donation, Credits, And External Display Pages

| Page | Typical URL | Purpose | Deeper Doc |
| --- | --- | --- | --- |
| `tipjar.html` | `https://socialstream.ninja/tipjar.html?session=SESSION_ID&goal=100` | Tip jar/goal meter display. | `07-overlays-and-pages/tipjar-credits.md` |
| `credits.html` | `https://socialstream.ninja/credits.html?session=SESSION_ID` | Credits/supporter roll. | `07-overlays-and-pages/tipjar-credits.md` |
| Dock webhook display | `dock.html?session=SESSION_ID&server` | Receive webhook/API donation notifications through server path. | `09-api-and-integrations/websocket-http-api.md` |

Support notes:

- Donation webhook URLs are sensitive. Public docs note they may not verify platform signatures.
- Avoid duplicate donation paths unless the workflow intentionally deduplicates.

## API And WebSocket Endpoints

| Use | URL Shape | Requirements |
| --- | --- | --- |
| HTTP API action | `https://io.socialstream.ninja/SESSION_ID/ACTION` | Remote API control enabled; target page/source connected. |
| API action with value | `https://io.socialstream.ninja/SESSION_ID/ACTION/TARGET/VALUE` | URL-encode values. |
| WebSocket API room | `wss://io.socialstream.ninja/join/SESSION_ID` | Use correct channel routing. |
| External chat listener | `wss://io.socialstream.ninja/join/SESSION_ID/4` | Remote API control and Send chat messages to API server enabled. |
| Dock/page label target | `dock.html?session=SESSION_ID&label=control` | Use matching label in API action path where supported. |
| Local server mode | `ws://127.0.0.1:3000` or page `&localserver` where supported | Local server enabled and reachable. |

Support notes:

- API actions, viewer commands, URL parameters, and Event Flow actions are different command systems.
- `sendChat` asks SSN/source paths to send a platform chat message; platform send-back support still depends on the source/mode/auth.

## WebSocket/API Source Pages

These pages are source setup pages, not normal overlays.

Use `../08-platform-sources/websocket-source-pages.md` for grouped source-page behavior, send-back caveats, auth/token setup, and which source pages are already covered by dedicated platform docs.

| Source Page | Typical Hosted URL | Use |
| --- | --- | --- |
| YouTube | `https://socialstream.ninja/sources/websocket/youtube.html` | YouTube Data API/WebSocket-style source workflow. |
| Twitch | `https://socialstream.ninja/sources/websocket/twitch.html` | Twitch IRC/EventSub/source workflow. |
| Kick | `https://socialstream.ninja/sources/websocket/kick.html` | Kick bridge/source workflow. |
| Rumble | `https://socialstream.ninja/sources/websocket/rumble.html` | Rumble Live Stream API URL source; API URL is secret. |
| Facebook | `https://socialstream.ninja/sources/websocket/facebook.html` | Managed Page Graph/API bridge workflow. |
| IRC | `https://socialstream.ninja/sources/websocket/irc.html` | IRC/custom IRC source. |
| Joystick | `https://socialstream.ninja/sources/websocket/joystick.html` | Joystick bot/API source workflow. |
| Bilibili | `https://socialstream.ninja/sources/websocket/bilibili.html` | Bilibili source-page workflow. |
| Nostr | `https://socialstream.ninja/sources/websocket/nostr.html` | Nostr source-page workflow. |
| Streamlabs | `https://socialstream.ninja/sources/websocket/streamlabs.html` | Streamlabs socket/API token source workflow. |
| Velora | `https://socialstream.ninja/sources/websocket/velora.html` | Velora source-page workflow. |
| VPZone | `https://socialstream.ninja/sources/websocket/vpzone.html?channel=USERNAME` | VPZone API/source-page workflow. |
| StageTEN | `https://socialstream.ninja/sources/websocket/stageten.html` | StageTEN source-page workflow. |
| Social Stream chat | `https://socialstream.ninja/sources/websocket/socialstreamchat.html` | Internal/custom Social Stream chat source path; source-check before public recipes. |

Support notes:

- A WebSocket/API source page can expose different events than a DOM source.
- Auth, API tokens, scopes, and source-page status matter.
- The standalone app can route some source pages through `window.ninjafy`; app parity must be checked separately.

## Common URL Mistakes

| Mistake | Fix |
| --- | --- |
| Missing `session` | Add `?session=SESSION_ID` to receiving pages. |
| Wrong page for the job | Dock is for control, featured is for selected-message display, source pages are for capture. |
| Expecting OBS overlay to capture chat | OBS browser source displays a page; it does not replace the source side. |
| Mixing `&server` into everything | Add server parameters only for workflows that need API/server routing. |
| Using old session URLs | Copy the current session from the extension/app and refresh all pages. |
| Forgetting URL encoding | Encode spaces, JSON, endpoints, CSS, JS, and chat text in GET URLs. |
| Sharing full URLs publicly | Redact session IDs, passwords, API keys, endpoints, and webhook URLs. |
| Expecting app and Chrome parity | Check app source-window/session/injection behavior separately. |
| Using a helper page as an output overlay | Most diagnostic/helper pages are not OBS output pages. Use `spotify-overlay.html` or the exported importer file only when that is the intended output. |

## Answer Pattern

When asked which URL to use:

1. Identify the job: capture source, dock/control, featured display, alert, tool/game, TTS/AI, Event Flow, API, or custom overlay.
2. Choose the smallest page URL.
3. Add `session=SESSION_ID` if it is a receiving/control/display page.
4. Add only required parameters.
5. Mention whether the source side must also be open.
6. Warn about secrets before asking for screenshots or full URLs.

## Follow-Up Extraction Needs

- Generate a page-by-page matrix from actual root HTML files with current parameter support.
- Validate `../07-overlays-and-pages/page-capability-matrix.md` against exact root HTML handlers, labels, storage keys, and channel pairs.
- Add exact popup-generated links and UI labels.
- Add page-specific channel pairs for every API-capable tool page.
- Source-check WebSocket/API source page public URLs and required fields.
