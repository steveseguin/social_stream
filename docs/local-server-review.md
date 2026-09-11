# Local Server review — 2026-09-10

This review covers the SSApp checkout based on 0.4.28 and the Social Stream beta source checkout. These source corrections require a subsequent packaged app release for the wrapper changes. The tests run the real SSApp Electron runtime with isolated profiles, real source-window capture, the real local relay, and locally served copies of the primary source files. Test-only network restrictions prevent contact with live channels and production services.

## Confirmed failures and corrections

| Area | Failure | Correction |
| --- | --- | --- |
| Event Flow storage | A Local Server toggle reran mirror selection. A remote outage could switch from HTTPS to the packaged file origin and show a different IndexedDB database. | Update only the selected frame's local relay parameters. Preserve its origin, path, session-related settings and language; keep the existing dependency monitor and Retry loading workflow. |
| Port changes | The frame builder could restore an old port from the cached SSApp environment. | Update the cached port on relay start and port-change notifications. |
| Game links | Selecting a preset removed `localserver` and `localserverport`. | Preserve both when regenerating the selected game URL. |
| Mini-games | Many pages hardcoded the public relay. Most new games only consumed the Dock/API route, while captured chat was sent on the extension route. | Use the existing local URL helper and allow explicitly local `server2` links to consume captured chat directly. Hosted game routing is unchanged. |
| Explicit game relay addresses | A game URL containing both an explicit `server=ws://...` address and local `server2` settings could ignore the explicit address and connect to the default local port instead. | Retain the explicit API relay address and channel. Local captured-chat routing still applies when no explicit API relay is supplied. |
| Overlays | Several secondary `server2`/`server3` connections ignored local mode. | Select the local endpoint on each applicable route, retaining explicit endpoint overrides. |
| Legacy display templates | Thirteen featured styles and LuckyLootTube had no local relay consumer, despite being offered as overlay presets. | Add a local-only adapter using their existing rendering functions and channel conventions. Their hosted WebRTC behavior is unchanged. |
| Local callbacks | Replies intended for page clients were discarded if the relay had no matching internal pending request. | Consume only relay-owned callbacks; send ordinary replies through the existing room/channel filters. |
| Event Flow visual actions | A captured message triggered the flow, but its action used only WebRTC even when the actions page was connected locally. | Send the `actions` target on channel 6 through an existing local background socket. This requires explicit local mode; hosted actions and other targets keep their existing paths. |
| Individual receiver switches | With only the API receiver enabled, the generated Flow Actions URL had local settings but no server flag, so the page never opened a relay connection. | Explicit local mode opens the action channel independently of chat-forwarding switches. If no local background socket is available, retain the existing connected-peer delivery path. |
| Copied Local Media URL | The embedded Event Flow Editor copied an OBS URL without the active session, leaving the actions page unable to receive the user's flow. | Read the background's active session when the popup session input/response is absent; standalone editor URLs can also supply their session. |
| API tools | API examples, the simple API client, test-message tool, OBS control dock, and shopping page could connect to the public endpoint from local URLs. | Honor the local endpoint. The test-message tool sends API ingestion through local WebSocket; the API sample disables its unsupported HTTP send buttons. |
| Generated tool links | Monetization links and the OBS dock's full API link lost connection parameters. | Preserve local mode, port, and the relevant route/explicit endpoint. |
| Exported StreamElements widgets | The standalone export referred to the importer's absent local URL helper and did not retain local settings. | Embed the selected local endpoint in the generated file and resolve optional port overrides without external helper dependencies. |
| Public webhooks | A local relay connection could appear as a ready public webhook receiver. | The provider setup explains that the public webhook URL needs the hosted receiver. No new public connection is opened automatically. |

## Scope and compatibility

The review inventoried root, game, and theme HTML pages, plus their shared connectors, generated URLs, background routing, Electron relay, frame loading, and local-service boundaries. Platform capture scripts and provider-specific WebSockets are not chat-relay endpoints and are not redirected.

Endpoint-only corrections take effect when `localserver` is present. New game extension-feed behavior additionally requires `server2`. Legacy template adapters require an explicit local mode and a supported server flag. Existing remote defaults and game/P2P routing are preserved when local mode is absent. Explicit relay URL overrides retain their existing precedence on corrected paths.

No app-wide Electron flags, security defaults, sessions, request hooks, or source navigation rules were changed. The disposable fallback bundle was not edited. Existing unrelated legacy-session recovery changes in the SSApp checkout were preserved.

## Remaining transport requirements

| Feature | Dependency / practical limitation |
| --- | --- |
| Website assets and saved flows | Local Server is a WebSocket relay, not a website host. A fully offline startup can select the packaged interface, which retains its separate origin/storage. This work prevents a relay toggle from causing that switch; it does not merge independent databases. |
| Waitlist | Its dedicated `sendWaitlistConfig` exchange remains WebRTC-only. Generated links intentionally do not advertise server support. |
| Word Cloud and Custom GIF Commands | Dedicated legacy bridge routes remain required. |
| Private chatbot, AI Prompt editing, co-host control | These use upstream WebRTC requests independently of the local incoming chat feed. AI-generated overlay URLs preserve local parameters. |
| Older sample pages | `baretempate.html`, `sampleemote.html`, and `septapus.html` remain legacy WebRTC examples. They are not converted into relay clients by this work. |
| Public webhook URLs | The public HTTP API cannot deliver directly to a loopback relay. Use the hosted receiver for these URLs. Provider-specific reliable receivers remain separate and were not contacted. |
| OBS browser sources and LAN clients | Already-copied URLs do not update themselves. Recopy after changing mode/port. Loopback addresses refer to the machine running the page; a different device needs an explicitly configured LAN endpoint. |
| Other local services | Local AI/control API, media serving, local models/TTS, voice control, and OBS's own WebSocket service use separate ports and protocols. Relay port changes must not repoint them. |

## Validation

The automated in-app tests are in `ssapp/tests/electron/local-server-pages-e2e.cjs`. `SSAPP_LOCAL_LIFECYCLE=1` enables menu toggles, failure/retry, flow persistence, stopped/running port changes, actual captured-chat flow actions and an application restart without a CLI port override. `SSAPP_LOCAL_PAGE_SWEEP=1` inventories relay-capable pages and verifies their real connections and subscribed channels. `SSAPP_LOCAL_GAME_WORKFLOWS=1` adds game participation, a complete two-player Memory Parade match, and control workflows; `SSAPP_LOCAL_CONTROL_WORKFLOWS=1` runs those control workflows without repeating the extended game list.

`SSAPP_LOCAL_ROUTING_WORKFLOWS=1` tests generated Flow Actions links with receiver switches enabled individually, visible text/image/clear actions triggered by actual source capture, and three server stop/start cycles while the same game, featured-template and action windows stay open. It checks preserved game participants, one action per trigger, no page reloads and local relay joins. OBS control sockets are tracked separately from chat-relay joins. Add `SSAPP_LOCAL_MEDIA_WORKFLOWS=1` to load the primary checkout through the app's supported local-folder mode and exercise the embedded editor's file picker, Copy Local Flow Actions URL button, HTTP media serving and captured-chat image playback/clear. Only the native file-picker result and clipboard destination are supplied by the test; the app's IPC, registration, copied URL, relay, flow engine and rendering remain real. Playback runs in SSApp Electron, not an OBS installation.

`SSAPP_LOCAL_RELAY_OVERRIDE=1` checks actual game participation through explicit API/captured-chat relay addresses with a deliberately incorrect default local port. `SSAPP_LOCAL_DOCK_WORKFLOWS=1` enables the separate Dock publishing switch and exercises generated Dock/featured-template URLs, real source capture, manual selection and clearing twice. Chat forwarding alone intentionally supplies the featured template's automatic feed; manual selection uses the Dock publishing route. `SSAPP_LOCAL_PORT_CONFLICT=1` occupies a real loopback port, selects it using the File menu while running and stopped, checks flow storage and stability past 15 seconds, then frees the port and verifies captured-chat actions after a manual retry. Test source windows now receive explicit normal-sized bounds through the existing creation IPC.

Supporting checks include popup link generation/search regressions, local-port configuration checks, JavaScript parsing, and whitespace review. These are supplemental to the real Electron runs.

The local fixtures exercise connection failures deterministically; they do not establish why the reporter's machine could not download the remote files. The reporter's OBS runtime, firewall, network, production services, and packaged release still require a release/user check. Transport receipt across the inventory is distinguished from complete UI workflows below.

### Completed in-app checks

- 111 relay-capable pages connected to the chosen loopback port and received a packet on their actual subscribed channel. This includes 34 mini-game pages. Two additional pages were classified as a legacy bridge/custom external input rather than relay clients.
- All 14 legacy display templates rendered delivered messages. Modern Featured and LuckyLootTube also rendered actual captured chat through server2. A hosted-mode legacy template retained its existing iframe connection.
- Fourteen games accepted actual source-captured commands with no Dock open and independently accepted direct API-feed commands: chickenroyale, memoryparade, tugofwar, signallock, crowdquest, minorityclub, crewkitchen, beaconrelay, meteorshield, oddoneout, sumsquad, rockpapershowdown, numberhunt, quickcall.
- Two viewers completed all four timed Memory Parade sequences with perfect scores, using `!mem` and the existing `!remember` command. Joining the next match also passed. The test reads the displayed sequence and sends real source-captured chat; it does not advance or inspect the game engine's internal state.
- Two repeated off/on cycles, Retry loading after a failed script, port changes while stopped and running, saved-flow persistence, and chat after a port change passed. No delayed navigation occurred across the old 15-second threshold.
- After a complete app restart, the selected port persisted without a CLI override. Active captured-chat flows displayed exactly one action per message before changes, after port changes, and after restart; inactive flows stayed off.
- Local API timer replies, page-owned callback delivery, room/channel isolation, real OBS control-dock start/pause confirmations, timer display state, action text, monetization rendering, disabled HTTP buttons, and a downloaded standalone widget receiving captured chat passed.
- The pending combined-overlay page preserved local mode and port in nested Dock/actions URLs. Preview, generated-link opening, QR creation, captured chat, visible action delivery and chat after reload passed inside SSApp.
- All 16 background recovery cases passed, including MIME/content mismatches, loader outages, invalid JavaScript, empty/JSON responses, redirects, a slow primary mirror, a stalled response body, failed dependencies, execution failures and slow downloads. Saved flows remained intact; the active flow executed once and inactive flows did not execute.

### Evidence and reproduction

- `%TEMP%/ssapp-local-pages-pe7HlQ/report.json`: final occupied-port run passed both running/stopped cases and additionally verified that the background document's time origin stayed unchanged beyond 15 seconds, detecting same-URL reloads as well as navigation changes.
- `%TEMP%/ssapp-local-pages-8WzlRu/report.json`: explicit API and captured-chat relay overrides both accepted actual game joins; generated Dock/featured links selected and cleared two captured messages with the publishing switch enabled. Both running/stopped occupied-port cases preserved flows and resumed captured-chat actions after freeing the port and retrying.
- `%TEMP%/ssapp-local-pages-eqQw6W/report.json`: pre-fix explicit API game address was ignored in a local `server2` link; Memory Parade could not receive a join through the selected relay.
- `%TEMP%/ssapp-local-pages-DVUhmN/report.json`: final HTTPS-source run passed each receiver individually (`server2`, `socketserver`, `server3`), embedded-editor session/media-service checks, and all three existing-page reconnect cycles.
- `%TEMP%/ssapp-local-pages-GxiSWm/report.json`: embedded Local Media selection/copy and actual captured-chat file display/clear passed after the missing-session fix; API-only and forwarding-only routes passed. Existing game/template/action pages recovered through three relay restarts without reloading, losing participants or duplicating displayed actions, using the local-folder runtime.
- `%TEMP%/ssapp-local-pages-uD6nwN/report.json`: API-only and forwarding-only delivery, plus three existing-page relay reconnect cycles, passed using HTTPS source fixtures in the normal app frame configuration.
- `%TEMP%/ssapp-local-pages-i1xuS9/report.json`: pre-fix Copy button reproduction; the generated Local Media URL omitted the session.
- `%TEMP%/ssapp-local-pages-T0G6Rx/report.json`: pre-fix API-only Flow Actions delivery failure; forwarding-only delivery worked.
- `%TEMP%/ssapp-local-pages-HeLXmC/report.json`: final complete 111-page relay sweep, all 14 legacy-template renders, actual generated-link control/export workflows, and flow action/persistence/restart checks passed with no page-sweep failures.
- `%TEMP%/ssapp-local-pages-SGWBCU/report.json`: combined-overlay local transport/rendering and generated-link/QR/reload checks passed, along with the control and export workflows.
- `%TEMP%/ssapp-local-pages-2EBasU/report.json`: repeated combined-overlay checks after the editable-link persistence correction; edits survive reload, local chat/actions still render, and control/export workflows pass.
- `%TEMP%/ssapp-local-pages-4tcbHU/report.json`: all 14 game participation workflows and a full Memory Parade match passed. This stronger run then reproduced the previously missed captured-chat Event Flow action failure, corrected by local channel-6 routing.
- `%TEMP%/ssapp-script-recovery-DQP4xy/report.json`: all 16 background-loader failure/recovery cases passed on the re-review.
- `%TEMP%/ssapp-session-migration-e2e-Dszl4x/report.json`: all 18 pending legacy-session upgrade/recovery cases passed with isolated relay fixtures, including published old app runtimes and current-app restarts.
- `%TEMP%/ssapp-local-pages-tLKFuW/report.json`: passing original 99-page inventory and relay lifecycle checks.
- `%TEMP%/ssapp-local-pages-aaMdJL/report.json`: lifecycle recheck after the final frame change and expanded sweep. This run exposed test assumptions: a 3.2-second join deadline and case-sensitive assertions against uppercase template text. The join deadline is now 10 seconds and the text check is case-insensitive.
- `%TEMP%/ssapp-local-pages-IPD0qs/report.json`: all 14 legacy templates pass local delivery and visible rendering.
- `%TEMP%/ssapp-local-pages-RjT42M/report.json`: Modern Featured and LuckyLootTube render actual source-captured chat as well as direct relay input.
- `%TEMP%/ssapp-local-pages-j2V4ZU/report.json`: complete passing run of all 14 game workflows, callback boundaries, control/rendering workflows, and standalone widget export.
- `%TEMP%/ssapp-local-pages-YgrvbO/report.json`: final generated-link check. The actual popup links open the local OBS control dock and importer; selecting LuckyLootTube generates a working local captured-chat link. Control and export workflows pass through those links.
- `%TEMP%/ssapp-local-pages-Fh5Zbw/report.json`: Pet Race reconnect/delivery check with the corrected join deadline.
- `%TEMP%/ssapp-script-recovery-VH1cbS/report.json`: five background-loader failure/recovery cases.
- `%TEMP%/ssapp-local-pages-OSBeuY/report.json`: pre-fix reproduction of a relay toggle selecting the file origin during an outage.

### Relay page inventory

This table records transport checks, not a claim that every command, animation, provider, or OBS integration on each page was exercised. Complete rendering/control workflows are identified separately.

| Page | Result |
| --- | --- |
| `actions.html` | Local channel received |
| `aioverlay.html` | Local channel received |
| `battle.html` | Local channel received |
| `bot.html` | Local channel received |
| `cohost-overlay.html` | Local channel received |
| `cohost.html` | Local channel received |
| `confetti.html` | Local channel received |
| `content.html` | Local channel received |
| `createtestmessage.html` | Local channel received |
| `credits.html` | Local channel received |
| `dock.html` | Local channel received |
| `emotes.html` | Local channel received |
| `events.html` | Local channel received |
| `featured.html` | Local channel received |
| `games.html` | Local channel received |
| `games/beaconrelay.html` | Local channel received |
| `games/chaosmode.html` | Local channel received |
| `games/chatgarden.html` | Local channel received |
| `games/chatwars.html` | Local channel received |
| `games/chickenroyale.html` | Local channel received |
| `games/colorsymphony.html` | Local channel received |
| `games/colorwars.html` | Local channel received |
| `games/cometrally.html` | Local channel received |
| `games/crewkitchen.html` | Local channel received |
| `games/crowdquest.html` | Local channel received |
| `games/dancingparade.html` | Local channel received |
| `games/emojirain.html` | Local channel received |
| `games/emojitower.html` | Local channel received |
| `games/fireflycatch.html` | Local channel received |
| `games/mazeraid.html` | Local channel received |
| `games/memorylane.html` | Local channel received |
| `games/memoryparade.html` | Local channel received |
| `games/meteorshield.html` | Local channel received |
| `games/minorityclub.html` | Local channel received |
| `games/numberhunt.html` | Local channel received |
| `games/oddoneout.html` | Local channel received |
| `games/petrace.html` | Local channel received |
| `games/phraseguess.html` | Local channel received |
| `games/pixelbattle.html` | Local channel received |
| `games/quickcall.html` | Local channel received |
| `games/rhythmpulse.html` | Local channel received |
| `games/rockpapershowdown.html` | Local channel received |
| `games/signallock.html` | Local channel received |
| `games/sumsquad.html` | Local channel received |
| `games/treasurehunt.html` | Local channel received |
| `games/tugofwar.html` | Local channel received |
| `games/wordchain.html` | Local channel received |
| `games/wordshuffle.html` | Local channel received |
| `games/wordstorm.html` | Local channel received |
| `giveaway-obs-entries.html` | Local channel received |
| `giveaway.html` | Local channel received |
| `hype.html` | Local channel received |
| `input.html` | User-specified external source WebSocket |
| `leaderboard.html` | Local channel received |
| `map.html` | Local channel received |
| `meta.html` | Local channel received |
| `minecraft.html` | Local channel received |
| `monetization.html` | Local channel received |
| `multi-alerts.html` | Local channel received |
| `obs-control-dock.html` | Local channel received |
| `poll.html` | Local channel received |
| `reactions.html` | Local channel received |
| `sample_wss_source.html` | Local channel received |
| `sampleapi.html` | Local channel received |
| `samplefeatured.html` | Local channel received |
| `sampleoverlay.html` | Local channel received |
| `scoreboard.html` | Local channel received |
| `shop_the_stream.html` | Local channel received |
| `simple_api_client.html` | Local channel received |
| `spotify-overlay.html` | Local channel received |
| `themes/compact-classic.html` | Local channel received |
| `themes/compact-clean.html` | Local channel received |
| `themes/compact-glass.html` | Local channel received |
| `themes/deuks_overlay/overlay1.html` | Local channel received |
| `themes/deuks_overlay/overlay2.html` | Local channel received |
| `themes/events/index.html` | Local channel received |
| `themes/featured-styles/featured-3d.html` | Local channel received; message rendered |
| `themes/featured-styles/featured-animated.html` | Local channel received; message rendered |
| `themes/featured-styles/featured-cyberpunk.html` | Local channel received; message rendered |
| `themes/featured-styles/featured-dynamic.html` | Local channel received; message rendered |
| `themes/featured-styles/featured-elegant.html` | Local channel received; message rendered |
| `themes/featured-styles/featured-gaming.html` | Local channel received; message rendered |
| `themes/featured-styles/featured-glass.html` | Local channel received; message rendered |
| `themes/featured-styles/featured-gradient.html` | Local channel received; message rendered |
| `themes/featured-styles/featured-modern.html` | Direct and captured chat rendered |
| `themes/featured-styles/featured-neon.html` | Local channel received; message rendered |
| `themes/featured-styles/featured-particles.html` | Local channel received; message rendered |
| `themes/featured-styles/featured-retro.html` | Local channel received; message rendered |
| `themes/featured-styles/featured-slide.html` | Local channel received; message rendered |
| `themes/horizontal.html` | Local channel received |
| `themes/huan-kiara/index.html` | Local channel received |
| `themes/LuckyLootTube/luckyloottube.html` | Direct and captured chat rendered |
| `themes/notimeoutmessages.html` | Local channel received |
| `themes/overlay-bubbles.html` | Local channel received |
| `themes/overlay-cards.html` | Local channel received |
| `themes/overlay-comic-classic.html` | Local channel received |
| `themes/overlay-comic-pop.html` | Local channel received |
| `themes/overlay-credits.html` | Local channel received |
| `themes/overlay-danmaku.html` | Local channel received |
| `themes/overlay-neon-cyberpunk.html` | Local channel received |
| `themes/overlay-particles.html` | Local channel received |
| `themes/overlay-ticker-news.html` | Local channel received |
| `themes/overlay-typewriter.html` | Local channel received |
| `themes/overlay-xacception.html` | Local channel received |
| `themes/rainbowpuke/index.html` | Local channel received |
| `themes/sampleoverlay_reverse.html` | Local channel received |
| `themes/spiritoverlay.html` | Local channel received |
| `themes/t3nk3y/index.html` | Local channel received |
| `themes/Windows3.1/index.html` | Local channel received |
| `ticker.html` | Local channel received |
| `timer.html` | Local channel received |
| `tipjar.html` | Local channel received |
| `waitlist.html` | Legacy WebRTC waitlist protocol (not advertised as relay-capable) |
