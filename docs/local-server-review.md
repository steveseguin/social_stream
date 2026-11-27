# Server transport review — 2026-09-10

## Server-mode follow-up (unreleased)

The earlier review below tested local relay operation. It did **not** establish hosted server-mode parity. Compatibility comments described the old implementation, not a requirement to preserve broken controls. The historical “left unchanged” and “hosted unchanged” statements below are superseded for the features in this follow-up.

- Confirmed the Flow Actions regression in real SSApp with live WebRTC: a local relay socket was open, a WebRTC-only Actions display was connected, and a captured-chat action did not reach that display. The corrected sender delivers through enabled relay routes **and** connected WebRTC peers. Current pages suppress duplicate command IDs across those paths. An open socket alone no longer counts as a relay receipt.
- Poll receives its own settings and Start/End/Reset controls; initial/reconnect reads do not reset existing votes. Credits receives Start/Preview/Test/Reset and the background-collected snapshot without replaying a roll when it reconnects. Hype receives initial snapshots and updates. These paths use hosted `io.socialstream.ninja`, local, or explicit compatible relay addresses.
- A separate live mixed-mode test found that Poll's repeat-voting setting counted the same captured message twice, once per transport. Poll now suppresses matching message IDs across its transports while allowing subsequent messages from the same viewer. This is separate from command-ID suppression and does not change other overlays' chat handling.
- Giveaway Manager retains server mode in generated links. The hosted relay consumes ordinary `callback` packets instead of forwarding them to page clients (confirmed with an isolated live relay probe). The manager therefore opts into the existing `commandResult` format, correlated by `result.request`; native and WebRTC controls and other API clients retain their formats.
- Session changes recreate enabled hosted as well as local connections. Old socket callbacks are guarded against acting on the new session. Password-only changes retain their existing behavior.
- Generated Flow Actions links include the independent action route with API-only or command-only receivers, in hosted and local modes. No receiver is enabled automatically.

### Protocol and scope

Only Actions, Poll controls, Credits controls and Hype snapshots use the new `ssnControl` delivery metadata (`id`, `target`, optional `reply` and snapshot `client`). This is an overlay-control envelope, not a captured chat/event field. Actions retains channel 6; the other three use a separate channel 7 subscription so their settings and commands do not reach ordinary chat consumers. Existing chat channels and custom chat-channel parameters are unchanged. The selected explicit relay endpoint takes precedence over a local default.

`ssnControlRequest` permits read-only Poll/Hype snapshots through an enabled API receiver or chat-forwarding route. `ssnControlAck` confirms receipt by the intended feature, not OBS visibility or successful completion of an external action. The host uses only enabled sockets; command-only `server3` permits the existing independent Actions route, not unrestricted snapshot publication. Poll settings are allowlisted; other settings and credentials are not included. Retries keep the same ID. Receivers retain IDs for 60 seconds (bounded to 4096), longer than the sender's retry window. Updated pages keep the legacy bridge for older-host compatibility.

No Electron flags, security defaults, preload scripts, platform capture code, Cloudflare settings, tags, releases or deployed services were changed. Both host and overlay page sources need this update; an SSApp version number alone does not identify remotely loaded page revisions.

### Follow-up validation

`ssapp/tests/electron/server-controls-e2e.cjs` runs actual source capture, popup controls, overlay windows and host sockets in isolated SSApp profiles. Default mode blocks external DNS and uses the real local relay. `SSAPP_TEST_HOSTED=1` uses the actual hosted relay. `SSAPP_TEST_LIVE_WEBRTC=1` permits live VDO.Ninja assets/signaling for WebRTC-only and mixed-display checks. The normal Electron session, preload and compatibility settings remain in effect. No live source channel is used.

Completed expanded local and hosted runs: `%TEMP%/ssapp-server-controls-9jMpld/report.json` and `%TEMP%/ssapp-server-controls-pzpqD5/report.json`. Poll settings/votes/End/Reset, Credits Start/Preview/Test/Reset, disabled receivers and recovery, Hype snapshot/reload, Giveaway Manager entries/close/draw/reset, individual Flow Actions receiver switches, explicit Poll relay addresses, host reconnect, and two session changes passed.

`%TEMP%/ssapp-server-controls-REtdJu/report.json` records the pre-fix WebRTC-only Actions failure. `%TEMP%/ssapp-server-controls-9LYSfP/report.json` is the completed live WebRTC/mixed run: the WebRTC-only Actions page and a second page connected through both WebRTC and the local relay each rendered exactly one action per captured message. The remaining controls, custom relay address and session/reconnect checks also passed in that run.

`SSAPP_TEST_RELAY_RESTART=1` exercises the actual Stop/Enable Local Server menu commands. `%TEMP%/ssapp-server-controls-juSC6N/report.json` passed: the existing Poll retained its votes and closed state, Credits did not rebuild/restart its roll, and fresh Actions and Poll controls worked after all page sockets reconnected. The earlier broad local suite also passed again with session/giveaway flags; evidence is `%TEMP%/ssapp-local-pages-BTKW0i/report.json`.

`SSAPP_TEST_LIVE_WEBRTC=1 SSAPP_TEST_POLL_REPEAT=1` checks real repeat voting with both transports connected. `%TEMP%/ssapp-server-controls-2v4qR9/report.json` records the pre-fix duplicate (two votes from one captured message). `%TEMP%/ssapp-server-controls-MPDnFk/report.json` passed after correction: the first captured message counted once and a second message from the same viewer increased the count to two. The full hosted suite passed again after this Poll change: `%TEMP%/ssapp-server-controls-XHfnVC/report.json`.

`tests/server-controls-extension-e2e.cjs` loaded the actual unpacked extension in headed Chromium, used its real manifest-injected YouTube capture script with a local chat fixture, and delivered through the actual hosted relay with WebRTC unavailable. `%TEMP%/ssn-extension-controls-1hYKp9/report.json` records passing Poll settings/votes/End, background Credits collection/Start, Hype display snapshots, and the unchanged native extension Giveaway Manager entry workflow. This establishes the listed extension workflows, not every extension overlay or OBS behavior.

### Remaining control audit

Code review still finds bridge-only routes for Map Start/Pause/Reset, targeted Reactions, Ticker updates (`sendTickerP2P`), Spotify updates (`sendSpotifyOverlay`), Tip Jar reset/set, legacy waitlist/draw updates used by Confetti, and Events feature/clear clicks. Their chat receipt does not prove control parity. Waitlist, Word Cloud, Custom GIF commands, private chatbot and co-host upstream requests remain separate follow-up work. The recent mini-game direct `server2` feed and legacy-template adapters also remain local-only additions; ordinary hosted chat/API paths are not evidence that those additions work hosted. None of those paths was silently converted by this change.

OBS Browser Source, LAN clients and packaged-release checks remain unverified in this follow-up. The other overlay-control routes listed above were reviewed in code, not newly exercised end-to-end.

## Historical local review

This review covers the SSApp checkout based on 0.4.28 and the Social Stream beta source checkout. These source corrections require a subsequent packaged app release for the wrapper changes. The tests run the real SSApp Electron runtime with isolated profiles, real source-window capture, the real local relay, and locally served copies of the primary source files. Test-only network restrictions prevent contact with live channels and production services.

## Confirmed failures and corrections

| Area | Failure | Correction |
| --- | --- | --- |
| Event Flow storage | A Local Server toggle reran mirror selection. A remote outage could switch from HTTPS to the packaged file origin and show a different IndexedDB database. | Update only the selected frame's local relay parameters. Preserve its origin, path, session-related settings and language; keep the existing dependency monitor and Retry loading workflow. |
| Port changes | The frame builder could restore an old port from the cached SSApp environment. | Update the cached port on relay start and port-change notifications. |
| Session changes | Changing the session in the popup updated generated links while existing local background sockets stayed joined to the previous session. | Reconnect the enabled local routes when the session ID changes. Hosted routes and password-only changes retain existing behavior. |
| Giveaway Manager | Opening the manager dropped the local connection settings and waited for WebRTC. | Preserve the local settings and use the existing API command/callback protocol. Reconnect without reloading and retry initial state reads if the host is still starting; never replay mutations. Native extension controls and hosted WebRTC are unchanged. |
| Managed giveaway relay overrides | Audience displays ignored explicit local relay addresses. | Preserve explicit API and captured-chat relay endpoints and their corresponding channels. |
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
| Poll settings and controls | Real local votes work when configured through URL parameters. With WebRTC unavailable, the generated page stays on “Loading poll ...”, and the popup's End Poll button does not stop voting. The page explicitly retains its bridge for settings/control commands. Left unchanged pending a decision to extend local-only support. |
| Credits controls | Background collection works while the display is closed. With only the local relay available, Start Credits does not deliver that snapshot and Test credits reports “No credits source connected.” Its compatibility guard explicitly retains the bridge for start/preview/reset. Left unchanged. |
| Hype Meter snapshots | The local API returns the captured chatter count, but the generated Hype display receives no pushed snapshot without WebRTC. The page explicitly declares its snapshot transport bridge-only. Left unchanged. |
| Private chatbot, AI Prompt editing, co-host control | These use upstream WebRTC requests independently of the local incoming chat feed. AI-generated overlay URLs preserve local parameters. |
| Older sample pages | `baretempate.html`, `sampleemote.html`, and `septapus.html` remain legacy WebRTC examples. They are not converted into relay clients by this work. |
| Public webhook URLs | The public HTTP API cannot deliver directly to a loopback relay. Use the hosted receiver for these URLs. Provider-specific reliable receivers remain separate and were not contacted. |
| Local Giveaway Manager | Requires the popup's existing remote API control switch. It does not turn on that receiver automatically. Full economy backup/recovery still uses the host's native controls; the local manager does not expose those operations over WebSocket. |
| OBS browser sources and LAN clients | Already-copied URLs do not update themselves. Recopy after changing mode/port. Loopback addresses refer to the machine running the page; a different device needs an explicitly configured LAN endpoint. |
| Other local services | Local AI/control API, media serving, local models/TTS, voice control, and OBS's own WebSocket service use separate ports and protocols. Relay port changes must not repoint them. |

The latest review makes no application behavior changes. The three gaps above were reproduced in the real Electron runtime with external networking unavailable. Changing those transport contracts would require an intentional compatibility decision, rather than assuming every page's relay connection provides all of its controls. Map, Reactions, Spotify, Ticker, Tip Jar, Confetti and Events also declare bridge-dependent control/update paths in their compatibility metadata; these declarations were reviewed but their complete workflows were not tested in this round. The existing Local Server join, room/channel filtering, stop/start, port configuration and LAN-toggle code was also reviewed without changes; LAN behavior was not newly tested.

## Validation

The automated in-app tests are in `ssapp/tests/electron/local-server-pages-e2e.cjs`. `SSAPP_LOCAL_LIFECYCLE=1` enables menu toggles, failure/retry, flow persistence, stopped/running port changes, actual captured-chat flow actions and an application restart without a CLI port override. `SSAPP_LOCAL_PAGE_SWEEP=1` inventories relay-capable pages and verifies their real connections and subscribed channels. `SSAPP_LOCAL_GAME_WORKFLOWS=1` adds game participation, a complete two-player Memory Parade match, and control workflows; `SSAPP_LOCAL_CONTROL_WORKFLOWS=1` runs those control workflows without repeating the extended game list.

`SSAPP_LOCAL_ROUTING_WORKFLOWS=1` tests generated Flow Actions links with receiver switches enabled individually, visible text/image/clear actions triggered by actual source capture, and three server stop/start cycles while the same game, featured-template and action windows stay open. It checks preserved game participants, one action per trigger, no page reloads and local relay joins. OBS control sockets are tracked separately from chat-relay joins. Add `SSAPP_LOCAL_MEDIA_WORKFLOWS=1` to load the primary checkout through the app's supported local-folder mode and exercise the embedded editor's file picker, Copy Local Flow Actions URL button, HTTP media serving and captured-chat image playback/clear. Only the native file-picker result and clipboard destination are supplied by the test; the app's IPC, registration, copied URL, relay, flow engine and rendering remain real. Playback runs in SSApp Electron, not an OBS installation.

`SSAPP_LOCAL_RELAY_OVERRIDE=1` checks actual game participation through explicit API/captured-chat relay addresses with a deliberately incorrect default local port. `SSAPP_LOCAL_DOCK_WORKFLOWS=1` enables the separate Dock publishing switch and exercises generated Dock/featured-template URLs, real source capture, manual selection and clearing twice. Chat forwarding alone intentionally supplies the featured template's automatic feed; manual selection uses the Dock publishing route. `SSAPP_LOCAL_PORT_CONFLICT=1` occupies a real loopback port, selects it using the File menu while running and stopped, checks flow storage and stability past 15 seconds, then frees the port and verifies captured-chat actions after a manual retry. Test source windows now receive explicit normal-sized bounds through the existing creation IPC.

Supporting checks include popup link generation/search regressions, local-port configuration checks, JavaScript parsing, and whitespace review. These are supplemental to the real Electron runs.

`SSAPP_LOCAL_SESSION_CHANGE=1` changes the session through the actual popup twice and verifies new-room game joins, captured-chat actions, API replies and absence of chat in the previous room. `SSAPP_LOCAL_GIVEAWAY_WORKFLOWS=1` exercises generated audience/manager links, captured entries, snapshots after reload, drawing/resetting, history, participant removal, explicit endpoint overrides, server restarts and the API receiver switch.

`SSAPP_LOCAL_TRANSPORT_REVIEW=1` verifies actual leaderboard counts, opted-in persistence, popup reset and fresh counting after reset. It then records the Credits/Poll/Hype workflows above, using real source capture, popup controls and the local API. It reports their outcomes instead of asserting that the current bridge limitations must remain forever; a successful diagnostic exit does not mean those unsupported controls worked.

The local fixtures exercise connection failures deterministically; they do not establish why the reporter's machine could not download the remote files. The reporter's OBS runtime, firewall, network, production services, and packaged release still require a release/user check. Transport receipt across the inventory is distinguished from complete UI workflows below.

### Completed in-app checks

- A local message-ranked leaderboard counted three captured messages, restored that count after reload, cleared both displayed and persisted entries through the popup Reset button, and started at one for the next captured message.
- Credits background collection, URL-configured poll voting and the Hype API snapshot worked. Popup Credits/Poll control delivery and Hype display updates failed with the bridge unavailable, as detailed above; these are recorded limitations, not passing control tests.
- Two popup session changes passed with game joins, captured-chat visual actions and API replies in the newly selected session; no matching captured chat reached the previous session.
- Managed giveaways accepted two real captured entries, restored the count after a display reload, drew a winner, restored that winner on a second API display and reset both displays. The popup-opened local manager loaded history, opened/closed entries and removed a participant. Explicit API and captured-chat addresses worked with a deliberately incorrect default port. Two relay restarts preserved the manager document and restored working controls; disabling/re-enabling the API receiver produced useful guidance and recovered after Refresh.
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

- `%TEMP%/ssapp-local-pages-9snQbU/report.json`: completed transport review. Leaderboard count/reload/reset passed. Credits collected the named viewer but could not start/test locally. Poll counted two votes, remained open after popup End Poll and accepted a third vote. Hype's API snapshot contained one YouTube chatter while the generated display had zero displayed sources. The report includes each page's declared transport capabilities.
- `%TEMP%/ssapp-local-pages-DjlERn/report.json`: final combined session/giveaway run passed all the workflows above, including two manager reconnects without document reload and disabled-API recovery.
- `%TEMP%/ssapp-local-pages-W7Oobm/report.json`: isolated session-change fix passed both directions. `%TEMP%/ssapp-local-pages-Ssa6Gf/report.json` records the pre-fix captured chat remaining in the old session.
- `%TEMP%/ssapp-local-pages-HojsJA/report.json`: pre-fix manager URL lost local parameters and remained on “Connecting to the host.” `%TEMP%/ssapp-local-pages-D1a6Lh/report.json` records the managed display ignoring an explicit relay address. `%TEMP%/ssapp-local-pages-Dg5QBY/report.json` records the initial manager reconnect request failing while the host was still starting; the final run adds safe state-read retries.
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
