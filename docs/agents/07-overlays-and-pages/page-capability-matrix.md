# Page Capability Matrix

Status: heavy routing pass from current overlay/page docs, root HTML page inventory, `README.md`, `api.md`, `parameters.md`, Event Flow docs, and generated reference pages on 2026-06-24.

Use this page when a user asks "which SSN page supports this?", "what has to stay open?", "does this go in OBS?", "does it need the dock?", or "why does this page do nothing?" This is a routing and dependency matrix. For exact parameters or commands, use the page-specific docs and the reference indexes.

## Source Anchors

- `dock.html`
- `featured.html`
- `multi-alerts.html`
- `actions.html`
- `waitlist.html`
- `poll.html`
- `timer.html`
- `giveaway.html`
- `giveaway-obs-entries.html`
- `tipjar.html`
- `credits.html`
- `events.html`
- `hype.html`
- `confetti.html`
- `wordcloud.html`
- `leaderboard.html`
- `emotes.html`
- `reactions.html`
- `scoreboard.html`
- `ticker.html`
- `map.html`
- `chat-overlay.html`
- `minecraft.html`
- `septapus.html`
- `shop_the_stream.html`
- `sampleoverlay.html`
- `sampleapi.html`
- `simple_api_client.html`
- `createtestmessage.html`
- `replaymessages.html`
- `recover.html`
- `urleditor.html`
- `streamelements-importer.html`
- `streamelements-importer.js`
- `spotify-overlay.html`
- `test-giveaway-webrtc.html`
- `bot.html`
- `chatbot.html`
- `cohost.html`
- `cohost-overlay.html`
- `streamerbot.html`
- `games.html`
- `battle.html`
- `themes/**/*.html`
- `games/*.html`
- `api.md`
- `parameters.md`
- `docs/commands.html`
- `docs/ai-cohost-guide.html`
- `docs/event-reference.html`
- `docs/agents/13-reference/surface-url-cheatsheet.md`

## First Rule

SSN pages are usually one of five things:

| Page Type | What It Does | Common Mistake |
| --- | --- | --- |
| Source page/source tab | Captures chat/events from a platform. | Expecting an OBS overlay page to capture chat by itself. |
| Dock/control page | Shows all messages and lets the operator act on them. | Treating `dock.html` as only a visual overlay. |
| Output overlay | Shows selected messages, alerts, media, credits, goals, or game output. | Forgetting that the source side and session must still match. |
| Tool/controller page | Runs a page-specific stateful tool such as poll, timer, waitlist, or giveaway. | Sending API commands while the target page is not open or on the wrong session. |
| Integration/test page | Helps configure or test API/integration behavior. | Using a sample/setup page as the production output surface. |

If a page should display or play something, it normally has to be open in a browser tab, app webview, or OBS Browser Source. A successful API request does not prove the target page was present or acted on the command.

## Page Capability Matrix

| Page | Primary Job | OBS Output | Needs Source Messages | Needs Dock | API/Event Flow Role | Keeps Own State | First Failure Check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `dock.html` | Operator dashboard, full chat feed, moderation/control, queue/pin/feature, TTS, chat send-back where supported | Sometimes, but usually as OBS custom dock/control UI rather than public stream overlay | Yes | No | Receives and sends many API actions; can publish featured/selected messages to overlays and integrations | Some page/session/UI state; exact persistence needs page-specific check | Same session as source, source tab/app active, extension/app enabled, API toggles if API-driven |
| `featured.html` | Selected-message overlay | Yes | Indirectly, through dock/auto-show/API/source selection | Usually yes for manual selection | Accepts content/clear/show commands; can TTS from featured messages | Mostly display state | Same session as dock/source; click a dock message or send known `content` API payload |
| `multi-alerts.html` | Follows, subs, donations, bits, raids, auction, hype-style alert cards | Yes | Yes, but only event/rich payloads that classify as alerts | No | Can receive via iframe bridge or WebSocket/server path; preview via postMessage | Queue/display state; latest Playwright validation attempt failed waiting for preview iframe overlay API | Confirm the platform/mode emits that event, category is not disabled, session/label is correct |
| `actions.html` | Event Flow output/action surface for media, audio, text, OBS/browser-source actions | Yes when effects should appear on stream | Depends on flow trigger | No | Required output surface for many Event Flow media/audio/OBS/browser-source side effects | Runtime action/layer state | Open `actions.html?session=...`; verify flow active and trigger matches; for OBS use obs-websocket v5 if needed |
| `waitlist.html` | Waitlist, queue, draw/giveaway-style list display | Yes, if the waitlist should be visible | Yes for viewer join messages and list updates | No, unless using dock workflow to manage messages separately | API actions include waitlist update/remove/highlight/reset/download style controls | Yes, page/tool state and payload-driven list state | Same session/password, waitlist mode enabled or page receiving waitlist payloads, correct join command |
| `poll.html` | Poll display/control page | Yes | Yes for votes | No | API actions include reset/close/load/settings/create poll flows | Yes, poll settings and vote state | `pollEnabled`, poll type/options, duplicate-vote behavior, same session |
| `timer.html` | Timer display/control page | Yes | Not necessarily; can be controlled directly | No | API actions include start/pause/toggle/reset/add/subtract/set/get state | Yes, timer state | Target page open with same session; correct action/value format |
| `giveaway.html` | Giveaway controller, entrant wheel, winner selection | Usually browser/control; can be shown if desired | Yes for entrants | No | Uses session traffic and local companion communication | Yes, localStorage keys such as wheel state, keyword, winners, settings | Same session, keyword/settings, clear old localStorage if stale entrants return |
| `giveaway-obs-entries.html` | Giveaway OBS companion view | Yes | Indirectly through giveaway controller/transport | No | Companion output, not the main controller | Display copy of giveaway state | Both giveaway pages use same session/password and are connected |
| `tipjar.html` | Tip jar/goal meter display | Yes | Donation/tip payloads or webhook/API donation path | No | Can display donation events from source/API/webhook paths | Yes when persistent options are used | Donation source actually sends payloads, goal/unit/source filters, duplicate webhook paths |
| `credits.html` | Credits/supporter roll | Yes | Donation/member/supporter-like payloads | No | Display output; parameter-driven behavior | Yes when `persistcredits` is used | Same session; persistence setting; source event families supported by platform |
| `events.html` | Event log/dashboard with rich metadata and optional click-to-feature path | Optional | Yes, event or donation/status payloads | No | Can receive via iframe bridge or WebSocket/server path; selected cards can send featured payloads | Display list state | Same session; source emits event fields; `sources`, `donationsonly`, `minvalue`, or `giftedsubsonly` filters are not hiding the event |
| `hype.html` | Viewer/chatter count overlay by source | Yes | Yes, hype/viewer-count payloads | No | Receives `hype` and `viewer_updates` style payloads by iframe or WebSocket/server path | Runtime count/source state | Same session; app/source emits viewer counts; `viewersonly`, `chattersonly`, `combineyoutube`, or `combineall` behavior is understood |
| `confetti.html` | Waitlist draw winner confetti effect | Yes | Indirectly through waitlist draw payloads | No | Receives waitlist payloads by iframe or WebSocket/server path | Effect-only runtime state | Waitlist draw is active and payload includes `drawmode` plus winner state |
| `wordcloud.html` | Chat word cloud | Yes | Yes, ordinary chat payloads with `chatmessage` | No | Receives iframe bridge payloads | In-memory word counts | Same session; test with a one-word message or add `allwords` for sentence tokenizing |
| `leaderboard.html` | Live leaderboard for chatters, donors, gifters, contributors, or loyalty snapshots | Yes | Yes, chat/event payloads or `points_leaderboard` snapshots | No | Receives iframe bridge payloads; optional `server2/server3` relay path | Yes when `persistdata` is used | Payload has `chatname` and `type`, or a valid points snapshot; check ranking mode and persistence |
| `emotes.html` | Floating emoji, image emote, and SVG emote overlay | Yes | Yes, chat payloads with visual emote content | No | Receives iframe bridge payloads; optional WebSocket/server paths | Display/runtime animation state | Same session; `chatmessage` contains emoji/images/SVGs; filters such as `membersonly`, `hidebots`, or `hidedupes` are expected |
| `reactions.html` | Like/reaction burst overlay | Yes | Yes, reaction/like event payloads | No | Receives iframe bridge payloads; optional API/extension/local WebSocket paths | Runtime burst/dedupe state; controlled local browser validation exists for popup URL parsing, synthetic bridge/payload rendering, server-mode joins, and TikTok-like target routing only | Event name is `reaction`, `liked`, or `like`; ordinary chat is ignored |
| `scoreboard.html` | Points scoreboard | Yes | Yes, points snapshots or locally scored chat/events | No | Receives iframe bridge payloads; optional WebSocket/server path; supports preview postMessage | In-memory score state; controlled local browser validation exists for preview/local scoring only | Send `points_leaderboard` or enable `chatpoints`, `donationpoints`, or `customtriggers` |
| `ticker.html` | Scrolling or rotating ticker text | Yes | No ordinary chat dependency; needs ticker payloads | No | Receives iframe bridge payloads; optional WebSocket/server path on `out:7`, `in:8` | Current ticker items only | Payload includes top-level `ticker` string or array |
| `map.html` | Viewer-location voting map | Yes | Yes, chat text with recognizable locations | No | Receives iframe bridge payloads; optional API socket `out:2`, `in:1` and extension socket `out:3`, `in:4` | In-memory voter/tally state | Map data assets load; chat text resolves to a country/state/city; collection is not paused/disabled |
| `chat-overlay.html` | Redirect helper for generated overlay runtime | Yes, after redirect | Yes if the target generated overlay needs messages | No | Adds `overlay=chat-overlay` and redirects to `aioverlay.html` | Depends on generated overlay package | Debug `aioverlay.html` saved overlay loading, not this wrapper |
| `minecraft.html` | Minecraft-styled stream alert skin | Yes | Yes, event/rich alert payloads | No | Uses `multi-alerts.js` behavior with Minecraft CSS/markup | Alert queue/display state from `multi-alerts.js` | Treat as multi-alerts behavior; it is not a Minecraft source integration |
| `septapus.html` | YouTube-structured custom chat renderer | Yes | Yes, chat/donation/member payloads | No | Receives iframe bridge payloads using YouTube-style DOM structure | Display list and donation ticker state | Use when YouTube-style CSS compatibility is desired; most dock URL options are not compatible |
| `shop_the_stream.html` | Product-list display surface | Yes | Optional chat commands or API product-list actions | No | Direct SSN WebSocket API listener, defaults to `in:1`, `out:1` | Current product-list display state | URL uses `sessionId` or `streamid`, not `session`; sample lists contain placeholder affiliate data |
| `sampleoverlay.html` | Minimal custom chat overlay example | Yes | Yes | No | Can use iframe bridge or WebSocket fallback depending on URL | Display list only | Same session/password, correct bridge/server mode, custom code validates `postMessage` source |
| `themes/**/*.html` | Prebuilt chat themes, featured-message styles, dock-wrapper themes, and package themes | Yes | Depends: chat themes need ordinary chat; featured styles need selected/featured payloads; wrapper themes depend on embedded dock | No | Mostly display-only; bridge mode and parameters vary by theme family | Usually display/runtime only; wrapper themes inherit dock behavior | Confirm whether it is a chat theme, featured-style theme, or dock-wrapper theme, then check same session and supported bridge mode |
| `sampleapi.html` | API sandbox/test page | No, except as a testing tab | No, but target page/source must exist for actions to matter | No | Generates/tests API commands | No production output state | Use it to reproduce a command, then check the real target page is open and API toggles are enabled |
| `simple_api_client.html` | Minimal WebSocket/API smoke client | No | No, but target source/page must exist for actions to matter | No | Joins `out:3`, `in:4` and sends a simple `sendChat` payload | No | Use only as a low-level connection test; it does not prove platform send-back support |
| `createtestmessage.html` | Synthetic chat/event payload sender | No | No, but target page/source must exist for actions to display | No | Sends test payloads by extension API POST/GET fallback or direct WebSocket channel 1/4 | Stores last session in `localStorage` | Remote API toggle for extension mode; target page open; selected delivery channel matches target |
| `replaymessages.html` | Stored chat-history replay controller | No | Uses stored local message history, not live source messages | No | Sends replay control actions to extension background and replays through P2P path | Replay session timers; reads local IndexedDB history | SSN enabled, stored messages exist in selected time range, target overlays are open; Electron path is limited |
| `recover.html` | Dock URL to settings `.data` recovery helper | No | No | No | No live API role; generates import JSON from URL params | Generated JSON only | Pasted URL contains a session/stream ID; recovered params still need current setting/page validation |
| `urleditor.html` | Dock/overlay URL parameter editor | No | No | No | No live API role; copies edited URL | Saves named URLs in `localStorage` key `savedUrls` | Hardcoded parameter catalog may be stale; verify target page supports the parameter |
| `streamelements-importer.html` | StreamElements/Streamlabs widget import/export helper | The exported HTML file is OBS output; importer page is setup UI | Exported overlay needs SSN traffic | No | Exported file receives iframe bridge traffic or optional WebSocket mode | Saves importer session in `localStorage` key `ssnSeImporterSession` | Export the generated HTML, test with `?demo`, then add `?session=` or embedded session for live use |
| `spotify-overlay.html` | Spotify now-playing display overlay | Yes | Needs Spotify payloads, not ordinary chat | No | Receives hidden iframe bridge traffic; optional WebSocket channels default `out:8`, `in:9` | Runtime now-playing state | Confirm Spotify payload sender, matching session/label, and remove hide flags while debugging |
| `test-giveaway-webrtc.html` | Giveaway local communication diagnostic | No | No live source dependency for test buttons | No | Sends local giveaway sync messages by BroadcastChannel or localStorage fallback | Message count/log only | All giveaway pages must share session/password and browser context; use main giveaway page for real entrant capture |
| `streamerbot.html` | Streamer.bot integration/setup surface | No normal stream output | Depends on integration | No | Helps configure Streamer.bot WebSocket/API route | Setup/session state varies | Confirm Streamer.bot endpoint/password/action ID and SSN API/session settings |
| `bot.html` | AI/bot response surface where configured | Maybe, if used as a visible/voice surface | Yes for live chat behavior | No | AI/TTS/chatbot workflows depend on provider/settings | Conversation/runtime state varies | Provider key/endpoint, trigger rules, page open, same session |
| `chatbot.html` | Dedicated one-on-one/private chatbot page | Maybe, depending on use | Not normal public chat capture unless configured | No | AI chat surface | Conversation/runtime state varies | Correct page purpose, provider/settings, source/session if live chat is involved |
| `cohost.html` | Multimodal AI cohost control/monitor surface | Usually control, not final OBS avatar | Yes for live chat monitoring | Often controlled from dock for selected messages | AI cohost control path; can mirror stage payloads | Runtime cohost state | Same session, Live Chat mode, provider/model setup |
| `cohost-overlay.html` | AI cohost playout/avatar/speech overlay | Yes | Indirectly through cohost/dock/control messages | Usually dock or cohost control side | Receives `aiOverlay`/`cohostOverlay` commands | Display/playout state | Same session and overlay label, TTS/audio permission, page open in OBS/browser |
| `aiprompt.html` | AI-assisted generated-overlay builder/editor | No | Optional; required for AI generation and extension sync | No | Sends private `chatbot`, `saveAiPromptOverlays`, and `getAiPromptOverlays` bridge actions | localStorage builder state plus extension sync | Private Chat Bot enabled, provider configured, same session when using AI |
| `aioverlay.html` | Runtime display for saved/generated AI overlays | Yes | Yes for live overlay data | No | Loads saved AI prompt overlay packages and forwards SSN payloads to generated iframe | Generated overlay package/local state | Saved overlay exists, `overlay=` name matches, same browser/profile/session |
| `battle.html` | Older chat-driven game surface | Maybe | Yes, through its specific transport | No | Older WebRTC/extension communication path per `api.md` | Game state | Source-check current behavior before promising API/WebSocket support |
| `games.html` | Spam Power chat-activity game | Yes when game output should be visible | Yes, ordinary chat activity | No | Game-specific page behavior; optional server/extension relay paths | Yes, localStorage game history | Same session, chat volume is arriving, and stale localStorage is not confusing the current score/history |
| `games/*.html` | Chat-driven mini games | Yes when game output should be visible | Yes, usually ordinary chat payloads | No | Mostly game-specific page behavior; exact commands vary by game | Yes for Chicken Royale and Phrase Guess, otherwise usually in-memory | Same session, game page receives `label=dock` style chat payloads, and viewer input matches that exact game |

## Capability By Feature

| Feature User Asks For | First Page To Check | Required Running Pieces | Notes |
| --- | --- | --- | --- |
| See all messages | `dock.html` | Source tab/app/page plus same session | Dock is the main proof that capture is working. |
| Show only one selected message | `featured.html` plus `dock.html` | Source, dock, featured overlay, same session | Manual selection comes from dock click; auto-show/API can also feed it. |
| Show alert popups for follows/subs/donos/raids | `multi-alerts.html` | Event-capable source mode plus same session | Normal chat does not become an alert unless payload fields classify as an event. |
| Play Event Flow media/audio/text | `actions.html` | Active flow, matching trigger, actions page open | Add as OBS Browser Source when the effect should appear on stream. |
| Control OBS from Event Flow | `actions.html` | Flow active; OBS WebSocket v5 or OBS Browser Source capability | Prefer obs-websocket v5 on port `4455` for scene/source/filter/mute actions. |
| Read chat with TTS | `dock.html`, `featured.html`, or AI/TTS-capable page | Page that should speak must be open and unmuted | Browser autoplay, provider keys, and OBS audio capture are common blockers. |
| Let viewers join a queue/waitlist | `waitlist.html` | Source messages, waitlist settings/command, same session | Do not confuse dock featured-message queue with waitlist tool behavior. |
| Run a poll | `poll.html` | Source messages, poll enabled/settings, same session | Vote matching depends on poll type and match mode. |
| Run a countdown/timer | `timer.html` | Timer page open; API/source control if used | Timer can be controlled without ordinary chat if API actions are used. |
| Run a giveaway wheel | `giveaway.html` | Source messages, keyword/settings, same session | OBS companion view is separate from the controller. |
| Show giveaway output in OBS | `giveaway-obs-entries.html` | Giveaway controller plus companion view | Both pages must share session/password. |
| Show tips/goals | `tipjar.html` | Donation payload/webhook/API path, same session | Filters by source/unit/goal can make valid donations look ignored. |
| Show credits/supporters | `credits.html` | Supported event payloads, same session | Persistence can survive refreshes if enabled. |
| Show a running event log/dashboard | `events.html` | Event-capable source mode, same session | Ordinary chat is not enough unless the payload maps to a displayable event/status path. |
| Show viewer/chatter counts | `hype.html` | Source/app emits hype or viewer-update payloads, same session | It is a stats overlay, not a generic alert page. |
| Show confetti for waitlist winners | `confetti.html` | Waitlist draw payloads, same session | Only draw winner state triggers the effect. |
| Show a chat word cloud | `wordcloud.html` | Source messages with `chatmessage`, same session | Default mode counts one-word messages; use `allwords` for sentences. |
| Show top chatters/donors/gifters | `leaderboard.html` | Source messages/events or points snapshot, same session | Persistence and reset settings can affect what users see after refresh. |
| Show floating emotes | `emotes.html` | Source messages with emoji, images, or SVG emotes | Plain text messages will not visibly trigger the page. |
| Show reaction/like bursts | `reactions.html` | Reaction/like event payloads, same session | Event support is platform/mode-specific. |
| Show points scoreboard | `scoreboard.html` | Points snapshot or local scoring flags | It is not the same as donor/gifter leaderboard behavior. |
| Show ticker text | `ticker.html` | Payload with top-level `ticker` string or array | Normal chat does not populate it automatically. |
| Show viewer location map | `map.html` | Chat messages with place names, same session | Test with simple country names before debugging city/state edge cases. |
| Use generated chat overlay runtime | `chat-overlay.html` or `aioverlay.html` | Saved/generated overlay package and same session | `chat-overlay.html` redirects to `aioverlay.html` with `overlay=chat-overlay`. |
| Use Minecraft alert styling | `minecraft.html` | Event-capable source mode plus same session | It is a themed alert overlay, not Minecraft chat capture. |
| Use YouTube-style CSS chat structure | `septapus.html` | Source messages and same session | Good for YouTube-style CSS experiments, not full dock feature parity. |
| Show a product list/gear overlay | `shop_the_stream.html` | Direct API/product-list payloads or built-in chat commands | Uses `sessionId`/`streamid` and direct WebSocket channel settings. |
| Build custom visual chat overlay | `sampleoverlay.html` or copied theme page | Source messages plus iframe/WebSocket bridge | Use `sampleoverlay.html` as the safest starting pattern; use `theme-pages.md` to choose an existing theme family. |
| Test API action URL | `sampleapi.html` | API toggles and actual target page/source | Sample API is a diagnostic surface, not proof the target page exists. |
| Smoke-test raw WebSocket API connection | `simple_api_client.html` | Session ID, WebSocket access, target source/page for real action effects | This is a tiny diagnostic client, not the full API test page. |
| Generate a fake chat/event payload | `createtestmessage.html` | Session ID, remote API toggle or matching direct WebSocket channel, target page open | Synthetic events do not prove real platform event support. |
| Replay stored chat history | `replaymessages.html` | Stored local message DB, SSN enabled, target pages open | Treat history as private and use a test session when experimenting. |
| Recover settings from a dock URL | `recover.html` | A URL with `session`/stream ID and any desired URL params | It only converts URL params; it cannot recover settings absent from the URL. |
| Edit overlay URL parameters visually | `urleditor.html` | Full URL and target page knowledge | Its parameter catalog is hardcoded; verify against current generated indexes. |
| Convert a StreamElements/Streamlabs chat widget | `streamelements-importer.html` | Widget zip/folder/files and SSN session for live export | Use the downloaded generated HTML in OBS, not the importer page. |
| Show Spotify now playing | `spotify-overlay.html` | Spotify payload sender plus matching session/label | It ignores ordinary chat payloads. |
| Test giveaway page sync | `test-giveaway-webrtc.html` | Giveaway pages in the same browser context and same session/password | It tests local sync messages, not live entrant capture. |
| Integrate Streamer.bot | `streamerbot.html` plus API/WebSocket docs | Streamer.bot running, endpoint/password/action ID/session | Verify whether the workflow sends into SSN, receives from SSN, or both. |
| AI cohost avatar/speech | `cohost.html` plus `cohost-overlay.html` | Provider/model settings, session, overlay label, page open | `cohost.html` is the control/monitor side; `cohost-overlay.html` is OBS playout. |
| AI-generated custom overlay | `aiprompt.html` plus `aioverlay.html` | Private Chat Bot/provider for generation; saved overlay package for runtime | `aiprompt.html` builds/saves; `aioverlay.html` displays the saved overlay in OBS. |
| One-on-one chatbot | `chatbot.html` | Provider/model settings | Do not present it as a normal overlay unless the workflow really uses it that way. |
| Chat mini games | `games.html`, `games/*.html`, or `battle.html` | Source messages, same session, game-specific commands/settings | Use `game-pages.md` for current mini-game commands and storage; source-check before promising API/send-back behavior. |

## State And Dependency Matrix

| Page/Family | Source Side Needed | Dock Needed | API Toggle Needed | Event Flow Needed | OBS Browser Source Needed | Local/Browser State |
| --- | --- | --- | --- | --- | --- | --- |
| Dock | Yes | No | Only for API-server control/relay | No | Only if used as OBS dock/control | Some UI/session state |
| Featured | Yes indirectly | Usually yes | Only for API-fed selected messages | No | Yes for stream output | Display/timing state |
| Multi-alerts | Yes, event-capable | No | Only in server/WebSocket workflows | No | Yes for stream output | Queue/display state; 2026-06-24 controlled browser validation attempt failed before render assertions |
| Actions/Event Flow output | Depends on trigger | No | Depends on flow action/source | Yes | Yes for visual/audio/OBS output | Layer/runtime state |
| Waitlist | Yes for viewer-driven joins | No | Only for remote control | No | Optional, if visible | Tool/list state |
| Poll | Yes for votes | No | Only for remote control | No | Optional, if visible | Poll/vote state |
| Timer | No for direct timer control | No | Only for remote control | No | Optional, if visible | Timer state |
| Giveaway | Yes for entrants | No | Usually no, except integration paths | No | Controller optional; companion yes | localStorage-heavy |
| Tip jar | Donation/event source or webhook | No | For webhook/API donation path | No | Yes for stream output | Optional persistence |
| Credits | Event/source data | No | Depends on feed path | No | Yes for stream output | Optional persistence |
| Events dashboard | Event/status/donation source data | No | Only in server/WebSocket workflows | No | Optional | Display list state |
| Hype/viewer counts | Hype or viewer-update payloads | No | Only in server/WebSocket workflows | No | Yes | Runtime count/source state |
| Confetti | Waitlist draw payloads | No | Only in server/WebSocket workflows | No | Yes | Effect-only runtime state |
| Word cloud | Chat payloads | No | No server path observed in this pass | No | Yes | In-memory word counts |
| Leaderboard | Chat/event payloads or points snapshots | No | Optional `server2/server3` relay path | No | Yes | Optional localStorage persistence |
| Emotes | Chat payloads with visual emote content | No | Optional server paths | No | Yes | Runtime animation state |
| Reactions | Reaction/like event payloads | No | Optional server paths | No | Yes | Runtime burst/dedupe state; 2026-06-24 controlled browser validation covered popup URL parsing, synthetic bridge/payload rendering, server-mode joins, and TikTok-like target routing only |
| Scoreboard | Points snapshots or URL-enabled local scoring | No | Optional server paths | No | Yes | In-memory score state; 2026-06-24 controlled browser validation covered preview/local scoring only |
| Ticker | Ticker payloads | No | Optional server path on `out:7`, `in:8` | No | Yes | Current ticker items only |
| Map | Chat payloads with location text or map control payloads | No | Optional API/extension server paths | No | Yes | In-memory voter/tally state |
| Custom overlay/themes | Yes | No | Only if WebSocket/API mode chosen | No | Yes for stream output | Page-specific; theme family decides whether it is chat, featured, wrapper, or event-oriented |
| Sample API | Target-dependent | Target-dependent | Yes for remote API testing | No | No | No production output |
| Diagnostic/test helpers | Target-dependent | Usually no | Depends on helper mode | No | Usually no | Some localStorage or local IndexedDB history |
| StreamElements importer export | Yes for exported file | No | Optional WebSocket mode only | No | Yes for generated OBS file | Embedded export config and local importer session |
| Spotify overlay | Spotify payload path | No | Optional WebSocket mode | No | Yes | Runtime track/progress state |
| AI/cohost pages | Yes for live chat behavior | Sometimes for selected-message playout | Depends on control path | Optional | Co-host overlay yes | Runtime/conversation state |
| Streamer.bot setup | Depends on direction | No | Usually yes | Optional | No | Setup/runtime state |
| Games | Yes | No | Source-check before promising | No | Optional, if visible | Game/localStorage state; see `game-pages.md` for current storage exceptions |

## Page Families Not To Confuse

| Looks Similar | Difference |
| --- | --- |
| Dock queue vs waitlist | Dock queue is for selected/featured messages. `waitlist.html` is a viewer queue/list/draw tool. |
| Featured overlay vs multi-alerts | Featured shows selected chat/content. Multi-alerts shows classified rich event alerts. |
| Multi-alerts vs events dashboard | Multi-alerts shows animated alert popups. `events.html` is an event log/dashboard with metadata and filters. |
| Waitlist vs confetti | `waitlist.html` manages the list/draw. `confetti.html` is only the visual celebration effect for draw winners. |
| Hype vs leaderboard | `hype.html` shows current viewer/chatter counts. `leaderboard.html` accumulates user rankings over time or from snapshots. |
| Word cloud vs normal chat overlay | `wordcloud.html` aggregates words from chat. It is not meant to render each message. |
| Emotes vs reactions | `emotes.html` extracts visible emotes from chat content. `reactions.html` displays reaction/like events. |
| Scoreboard vs leaderboard | `scoreboard.html` is points-snapshot/local scoring oriented. `leaderboard.html` is broader chat/event contributor ranking. |
| Ticker vs normal chat overlay | `ticker.html` renders explicit `ticker` payloads. It does not automatically display every chat message. |
| Map vs poll | `map.html` resolves location text and tallies viewer places. It is not the general poll page. |
| `chat-overlay.html` vs `aioverlay.html` | `chat-overlay.html` is a redirect helper. `aioverlay.html` is the generated overlay runtime. |
| `minecraft.html` vs Minecraft source support | `minecraft.html` is an alert skin. It does not capture Minecraft chat. |
| `septapus.html` vs `dock.html` | `septapus.html` renders YouTube-like chat DOM for styling; it is not the operator dock. |
| `shop_the_stream.html` vs a storefront | `shop_the_stream.html` displays product lists from payloads; it is not a managed commerce backend. |
| `actions.html` vs Event Flow editor | The editor builds flows. `actions.html` is the runtime output/control surface for effects and OBS actions. |
| `sampleapi.html` vs API server | `sampleapi.html` helps build/test commands. The API server endpoint is `https://io.socialstream.ninja/SESSION/ACTION`. |
| `sampleapi.html` vs `simple_api_client.html` | `sampleapi.html` is the broader API sandbox. `simple_api_client.html` is a minimal WebSocket smoke client. |
| `createtestmessage.html` vs real platform events | `createtestmessage.html` sends synthetic SSN payloads. Real follows/subs/gifts/rewards still depend on source/platform mode. |
| `recover.html` vs settings backup | `recover.html` rebuilds settings from URL params only. It is not a full backup unless the needed settings were in the URL. |
| `urleditor.html` vs current parameter source of truth | `urleditor.html` has a hardcoded helper catalog. Generated config/source docs remain the stronger reference for exact support. |
| `streamelements-importer.html` vs OBS overlay | The importer creates the exported HTML file. The exported file, not the importer page, goes into OBS. |
| `spotify-overlay.html` vs chat overlay | `spotify-overlay.html` expects Spotify now-playing payloads, not ordinary chat messages. |
| `test-giveaway-webrtc.html` vs giveaway controller | The test page sends local sync test messages. `giveaway.html` is the controller for real entrant capture. |
| `sampleoverlay.html` vs platform source pages | Sample overlay receives normalized SSN payloads. Source pages capture platform data. |
| Normal chat themes vs featured-style themes | Normal chat themes render ordinary incoming chat. `themes/featured-styles/*` pages wait for featured/selected-message payloads, so they can be blank while normal chat is flowing. |
| Theme wrappers vs direct-render themes | `pretty.html` and Neutron pages embed `dock.html`; many other theme files render SSN payloads directly. Debug the embedded dock for wrapper themes. |
| `cohost.html` vs `cohost-overlay.html` | `cohost.html` monitors/controls AI cohost behavior. `cohost-overlay.html` is the visible/audio playout surface. |
| `tipjar.html` vs donation capture | Tip jar displays donation/goal data. It does not replace the donation source/webhook/platform capture path. |
| `credits.html` vs persistent account history | Credits roll displays collected session/supporter data. It should not be treated as an account-level CRM without source-checking storage behavior. |

## First Support Checks

Blank page or no output:

- Confirm the URL has the current `session`.
- Confirm the source side is running and sending messages/events.
- Confirm the page is the right page for the job.
- For OBS, test the same URL in a normal browser and refresh the OBS Browser Source.
- For transparent overlays, create a real message/event before judging the page blank.

API command says success but nothing changes:

- Confirm remote API control is enabled where needed.
- Confirm the target page is open.
- Confirm the target page uses the same session and label.
- Confirm the action belongs to that page family.
- Reproduce with `sampleapi.html` only after checking the target exists.

Event Flow action does nothing:

- Confirm the flow is saved and active.
- Confirm the test/live payload matches the trigger.
- Open `actions.html?session=...` for media/audio/text/OBS/browser-source actions.
- For OBS control, check obs-websocket v5, port, password, and `obs-websocket-test.html`.

Tool page ignores chat:

- Confirm it consumes ordinary chat or the required event family.
- Confirm chat commands/keywords are enabled and correctly spelled.
- Confirm duplicate-vote/duplicate-entry settings are not filtering the user.
- Clear page localStorage or use reset controls when stale state is suspected.

Alerts/events/tip jar/credits ignore events:

- Confirm the platform/mode actually emits the event family.
- Check event filters such as source, unit, minimum donation, or disabled categories.
- Avoid enabling duplicate webhook/source paths unless the workflow intentionally deduplicates.

## Answer Pattern

When answering a page capability question:

1. Name the page and exact URL shape.
2. State whether it is a source, control page, output overlay, tool page, or setup/test page.
3. State what else must be open.
4. State whether it belongs in OBS.
5. State the first setting/session/event check.
6. Point to the deeper page doc for parameters or commands.

Example:

```text
For a poll, use `poll.html?session=YOUR_SESSION`. It is a stateful tool page, not the dock. Keep the source side open so votes arrive, and put the poll page in OBS only if you want viewers to see it. First check `pollEnabled`, poll type/options, and that the page uses the same session.
```

## Do Not Overclaim

- Do not say every page supports every URL parameter.
- Do not say every platform can produce follows, subs, rewards, gifts, tips, or send-back chat.
- Do not say API commands work when only the HTTP endpoint was reachable; the target page may be missing.
- Do not say Event Flow visual/audio actions work without `actions.html` open.
- Do not say Chrome extension and standalone app behavior are identical without checking the source-window/app parity docs.
- Do not promise `battle.html`, `games.html`, or individual `games/*.html` API/send-back behavior without source-checking that exact page and source/platform path.
- Do not ask users to paste full session/API/webhook URLs publicly.

## Follow-Up Extraction Needs

- Generate an exact root-page inventory with page type, supported query parameters, bridge mode, WebSocket channel pair, and storage keys.
- Trace `processInput`/message handlers for `dock.html`, `featured.html`, `waitlist.html`, `poll.html`, `timer.html`, `giveaway.html`, `tipjar.html`, `credits.html`, and `actions.html`.
- Validate per-game requirements and reset/storage behavior from `game-pages.md` with controlled browser and OBS runs.
- Create a page-label/channel routing table for targeted API commands.
- Validate AI/cohost overlay command routing against `docs/ai-cohost-guide.html`, `cohost.html`, and `cohost-overlay.html`.
- Validate event/effect overlay payload samples, URL parameters, and OBS rendering for `events.html`, `hype.html`, `confetti.html`, `wordcloud.html`, and `leaderboard.html`.
- Validate live display utility payload samples, command senders, URL parameters, and OBS rendering for `emotes.html`, `reactions.html`, `scoreboard.html`, `ticker.html`, and `map.html`.
- Reactions now has narrow controlled browser validation for popup URL parsing, synthetic bridge/payload rendering, fake server-mode joins, and controlled TikTok-like target routing. It still needs OBS, hosted, real extension bridge, real relay, live platform, app, and long-running validation.
- Scoreboard now has narrow controlled browser validation for preview/local scoring. It still needs OBS, hosted, app, live source, WebSocket/server-mode, label/session/password, and long-running persistence validation.
- Multi-alerts has a failed controlled browser validation attempt that timed out waiting for the preview iframe overlay API. Resolve that before marking multi-alert render, queue, filter, audio, or server-mode behavior as browser-validated.
- Validate specialized/legacy page behavior for `chat-overlay.html`, `minecraft.html`, `septapus.html`, and `shop_the_stream.html`.
- Validate diagnostic/helper behavior for `createtestmessage.html`, `simple_api_client.html`, `replaymessages.html`, `recover.html`, `urleditor.html`, `streamelements-importer.html`, `spotify-overlay.html`, and `test-giveaway-webrtc.html`.
- Validate theme behavior for `themes/**/*.html`, including chat themes, featured styles, dock-wrapper themes, and OBS local-file/WebSocket behavior.
