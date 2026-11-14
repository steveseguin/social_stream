# Transport migration implementation status

2026-09-11. Working-tree changes; not deployed. The [audit](transport-migration-audit.md) preserves the original findings and its 155-page inventory. The [plan](transport-migration-plan.md) defines the final outcome and release gates.

## Current outcome

Hosted/custom server2 feeds now work through the existing game/commerce helper. Legacy Featured templates can use hosted/custom relays. Map and Poll share source-aware chat deduplication. Background display controls now use the existing relay control envelope across more receivers, while retaining P2P compatibility. Hosted controller replies have an opt-in format that survives the hosted relay.

The global additive default is **not changed**. Receiver publication and supported old/mixed-receiver verification still precede that change. Private AI requests remain bound to the existing P2P client/UUID protocol. SSApp was subsequently tested in isolated profiles. No Cloudflare access, deployment, OBS test, commit, or push was performed for this implementation.

## Coverage ledger

The inventory groups below cover the original audit's receiver families. A shared-helper test is not a live test of every individual template. Existing version/bridge declarations remain conservative: `v=3.52.0` does not certify the new control channel. Old hosts and custom copies may still require P2P.

| Family | Implemented path and recovery | Evidence / limitation |
| --- | --- | --- |
| Dock, standard chat, modern themes, wrappers | Existing feed selection retained; no global default flip | Compatibility matrix: 9 background builds, 44 overlays, 103 version/page cases. It tests maintained receivers against historical traffic, not all historical receiver copies. |
| 33 helper-based games and commerce display | Hosted/local/explicit server2 uses input 4, output 3; explicit server API selection retains input 1. Generated links preserve server2. | Endpoint/channel regression fixtures; existing link tests. Individual game mechanics and commerce purchase flows were not retested. |
| 13 legacy Featured templates / LuckyLootTube | Existing adapter now accepts hosted and explicit relays as well as localserver. Featured server uses input 2; server2 uses input 4. Label filtering retained. | Adapter selection/clear/label tests. Matrix still classifies LuckyLootTube as legacy P2P and does not certify its new socket path. |
| Poll / Map | Shared source-aware vote dedupe; control channel 7; allowlisted configuration; host epoch/revision/reset markers reconcile missed resets. | Actual extension Poll capture/settings/close and Map configuration with VDO blocked; mirrored-ID and ID-less Map tests; state/revision tests. Page reload does not restore vote history. |
| Actions / Credits | Existing channel 6 Actions and channel 7 Credits control IDs retained; same ID on mirrored delivery/retry. Credits keeps legacy dock-labelled peers served. | Actual extension Credits collection/start; existing source/contract checks. Transient commands are not replayed on reconnect. Old mixed Actions copies still need explicit regression coverage before the additive default flip. |
| Hype | Existing channel 7 current-state query retained | Actual extension hosted snapshot test. Hype retains its existing state semantics; no full historical recovery is promised. |
| Timer | Host state on channel 7; snapshot only after host initialization. Revisions suppress repeated/stale snapshots. Direct page API commands retained. | Actual extension host-state test and negotiated API query; state tests. Local page edits remain until the host issues a changed state; host restart is a new state epoch. |
| Ticker / Spotify | Channel 7 host state; latest saved state can be queried. Revision checks avoid replaying unchanged snapshots after delivery-ID expiry. | Actual extension Ticker delivery/reload; state tests and Spotify queue regression suite. Existing custom channels and label-specific P2P routes retained. |
| Tip Jar / alerts / Minecraft / Bot | Reset/set or clear commands use channel 7 with shared delivery IDs | Actual extension Tip Jar, multi-alerts and Bot receipt/duplicate-rejection tests. Minecraft uses the same alert handler but was not separately opened. These tests verify receipt, not every visual effect. Previews do not subscribe to Tip Jar controls. |
| Reactions | Targeted reaction events can use channel 7; existing reaction dedupe remains after envelope filtering | Actual extension receipt and duplicate rejection; dedicated animation assertions remain outside this test. |
| Events dashboard | Feature and clear publish to Featured output 2 and connected P2P viewers | Routing fixture verifies both populations and excludes unrelated P2P labels. Preserves the existing ID-less selection semantics. |
| Waitlist / Confetti | Existing list/winner/clear payloads sent through the common target sender, including SDK and relay populations | Actual extension Waitlist delivery; list/draw/custom-message/clear contracts. No automatic winner or confetti replay; a newly opened page awaits the next update. |
| Word Cloud / GIF | Channel 7 targeted words/reset and media actions; delivery IDs suppress mirrors. Custom GIF filters retained; non-default custom labels retain P2P. | Word Cloud counting/reset contracts and actual extension Word Cloud/GIF image rendering with P2P blocked. No word history or missed media replay. |
| Managed giveaway / legacy entries | Explicit endpoint wins over local default; managed server2 uses extension channel 4; legacy entries keeps its separate channels | Actual extension native manager test and endpoint review. Existing giveaway round/operation recovery is retained. |
| AI builder/runtime, private chatbot, co-host | Public chat feed and private host protocol remain distinct | Baseline source audit. Private credentials, tools and saved-overlay requests are not broadcast on channel 7. |
| Other standalone/provider/operator/non-consumer entries | No provider capture, Electron security/session behavior or unrelated UI workflows changed | Baseline inventory classification remains applicable. OBS/SSApp parity is not inferred from browser tests. |

## Controller reply compatibility

An isolated hosted relay probe delivered `commandResult` and did not deliver `callback`. Requests with `get` may opt in using `replyFormat: "commandResult"`; the host replies with `{type:"commandResult", action, get, result}`. Legacy callers retain `{callback:{get,result}}`, including existing HTTP/P2P formats. Existing giveaway replies using `result.request` remain accepted.

OBS control dock, sample API queries and the nested `ssn-streamdeck` WebSocket client negotiate this format. The Stream Deck change is in its separate, parent-ignored checkout and must be released there too. Its HTTP fallback chooses a route before a command is sent; a timed-out WebSocket mutation is not automatically resent through HTTP.

Control acknowledgement means the receiver callback received the packet, not external action completion or OBS visibility. It does not mean every viewer acknowledged. Channel 7 separates public display controls from ordinary chat; it is not an authorization boundary for private data.

## Verification recorded this turn

- Compatibility matrix: 103/103; historical contracts: 9 builds and 6 payload types.
- Actual unpacked extension, isolated YouTube fixture and hosted relay with VDO blocked: Poll, Credits, Hype, Timer, Ticker/reload, Waitlist, Map configuration, native Giveaway Manager, Word Cloud/GIF rendering, negotiated controller reply. Spotify, Tip Jar, Alerts, Bot, Reactions and Confetti also receive controls and reject a repeated delivery ID. Report: `%TEMP%/ssn-extension-controls-ul9m57/report.json`.
- Migration regression suite: 12 tests covering routing, mirrored inputs, targeting, settings privacy, round recovery, repeated/stale state, Events and Waitlist/Word Cloud semantics, local/explicit endpoints, client-bound reconnect requests, unrelated API acknowledgements and all eight host route-switch combinations.
- Popup search, generated overlay links, Stream Deck router, SDK transport (12), Spotify queue tests pass.
- Nested Stream Deck TypeScript check and WebSocket/P2P client tests: 36 pass, including negotiated hosted reply format.
- Classic script/inline-script parsing and final diff whitespace check performed. No live source channels used.

### Subsequent SSApp verification

The real SSApp runtime loads the current Social Stream checkout through the existing test asset adapter. Tests use separate temporary profiles, fixture source windows and random session IDs. Production profiles, live source channels and app-wide compatibility settings were not changed.

- Hosted relay suite: **14 cases passed**, including captured Event Flow actions, Poll controls, Credits, Hype, Timer/Ticker reload recovery, Map settings, negotiated controller replies, Giveaway Manager, independent route switches, explicit endpoint selection, reconnect and two session changes. Report: `%TEMP%/ssapp-server-controls-Q8PNrR/report.json`.
- Mixed local relay/WebRTC suite: **passed**. A P2P-only Actions display receives commands while the relay is enabled; mirrored Poll voting counts one captured message once and accepts a second deliberate vote. Report: `%TEMP%/ssapp-server-controls-wDUWvM/report.json`.
- Local relay suite: ordinary socket reconnect, additional state controls, negotiated replies and Giveaway Manager pass. The actual Local Server stop/start menu sequence reproducibly fails Poll retention. Report: `%TEMP%/ssapp-server-controls-qFClr1/report.json`.

Two desktop findings:

1. With Map open, its empty API acknowledgement could resolve Giveaway Manager's pending request before the structured host answer arrived. Fixed the manager to accept only structured host results. The local suite now passes Giveaway Manager with Map/Timer/Ticker open; a regression test also rejects empty and boolean acknowledgements while retaining structured success/error responses. This change does not alter other pages' callback behavior.
2. Local relay stop/start reloads the background iframe while leaving the Poll display open. Diagnostics show the same poll configuration, a new host time origin/epoch, and host `closed` changing from true to false. The display retains its time origin but loses its two votes and reopens. This remains unfixed. Preserve the host-managed round state across this relay-driven reload; do not change app-wide flags or suppress legitimate poll resets to hide it.

## Remaining gates and next steps

### Expanded maintained-receiver coverage

At Steve's request, older mixed receiver copies are accepted as a risk; they are not a prerequisite for experimental use.

- **1,292 cases passed across 68 maintained pages**: all 34 games, 13 legacy Featured themes, LuckyLootTube, commerce display, 16 common control receivers, and Dock/Featured/sampleoverlay. Each has all 16 on/off combinations of `server`, `server2`, `server3` and `localserver`, plus three explicit-endpoint cases (including conflicting defaults and separate API/chat endpoints).
- These run the actual page scripts in Chromium with controlled WebSocket/iframe boundaries. They check endpoint/channel/session selection, disabled routes and startup errors. Featured templates also render and clear selections; control receivers acknowledge packets, filter wrong targets and accept a repeated ID once. Game route coverage is not a full gameplay test of every game. Reports: `%TEMP%/ssn-overlay-flags-8PpIew/report.json` (910), `ssn-overlay-flags-S75Veb/report.json` (325), `ssn-overlay-flags-HRUPyQ/report.json` (57).
- Found and fixed **Phrase Guess hosted server2 selecting the extension address but retaining legacy channel 2**. Its direct captured-chat route now joins channel 4 on hosted as well as local relays. Existing legacy API-mode channels and explicit/local choices are preserved. An additional 14-case Phrase Guess run starts and wins a round on each enabled route, with negative route checks where disabled: `%TEMP%/ssn-overlay-flags-FcyOHo/report.json`.
- **Actual SSApp, experimental additive toggle enabled:** two separate fixture chat messages each reach a P2P-only display, a relay-only display and a mixed maintained display exactly once. Real WebRTC signaling, isolated app profile/session and local relay; no live source channels. Report: `%TEMP%/ssapp-server-controls-Xp8GLs/report.json`.
- The harness accounts for existing page-specific contracts rather than making every flag mean the same thing: server3-only Dock must not consume captured chat; Featured uses its own channel priority and clears via its exit animation. Tests use canonical alphanumeric session IDs; arbitrary session-ID normalization differences are outside this matrix.

### Outstanding work

1. Finish dedicated runtime cases for every newly connected effect, mirrored controls, missed updates, and local/custom endpoint combinations. Preserve the existing localserver-alone behavior of legacy pages; localserver is not blanket host authorization.
2. The local relay stop/start loss of Poll round state is an accepted, deferred limitation at Steve's direction. SSApp testing remains optional and may be run when useful without separate permission; it is not a blanket mandatory release gate. OBS Browser Source behavior remains unverified.
3. Publish updated receiver HTML and shared assets together, then verify deployed assets. The extension manifest exposes the common helper; standalone deployments must serve it too.
4. Keep additive chat delivery behind the existing experimental toggle, as Steve requested. Older mixed Actions/custom receiver compatibility is an accepted risk for now; do not claim universal compatibility. Changing the default or retiring the toggle is deferred.
5. Keep private AI migration separate. Do not remove bridges or claim server-only private feature support based on a URL flag or socket connection.
