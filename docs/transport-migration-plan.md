# Overlay transport migration plan

Date: 2026-09-11. Status: implementation underway in the working tree. See the [implementation status and verification ledger](transport-migration-status.md) for completed changes and outstanding release gates. The stages below remain the acceptance criteria; they are not a claim that deployment or desktop/OBS validation is complete.

Based on the [transport audit and complete page inventory](transport-migration-audit.md). This plan refines the audit's suggested sequence: safe additive publishing and full server-only feature support are separate milestones. Private AI protocols do not have to be redesigned before ordinary chat delivery can be corrected.

## Intended outcome

Enabling chat forwarding to the server must leave connected P2P displays working. A supported server-connected display must receive its intended feed and supported controls without needing a working P2P connection. Each captured message counts once per display, each operator command applies once per intended receiver, and genuine repeated messages/commands remain valid.

The user can have a P2P Dock, a server-connected OBS overlay, and an external chat listener in the same session. Enabling one must not silence or double-trigger the others. Hosting the relay locally changes its address, not the meaning of its channels. Featured selections remain distinct from the full captured-chat feed.

Some advanced pages can legitimately retain P2P for private requests or specialized protocols. Their supported server features and remaining P2P requirements must be explicit. Keeping the bridge is not itself a defect; losing features, misrouting data, double counting, or advertising unsupported server-only operation is.

## Routing rules to preserve

| Concern | Required behavior |
| --- | --- |
| Background chat publication | Send to eligible connected P2P receivers and the enabled server2 relay. Preserve labels, filters and explicit UUID reply routing. |
| Page feed selection | Select the intended feed by page capability and URL. Do not treat API traffic, captured chat and Featured output as interchangeable. |
| Retained bridge | May carry controls/private replies while chat arrives through a socket. Either consume chat through one selected path or deduplicate every overlapping ingress before processing it. |
| Upstream commands | Choose one command route. Do not send a mutation over both transports merely because both are open. Uncertain timeouts must not cause unkeyed replay through another route. |
| Display commands | A host may publish the same command to both transport populations using the same command ID. Every intended display may apply it once. |
| Recovery | Refresh current state safely. Do not automatically repeat actions such as starting Credits, playing media, drawing a winner or changing an OBS scene. |
| Endpoint selection | Resolve the selected route first, then its explicit address, then local default/custom port, then hosted default. Do not borrow an unrelated route's endpoint silently. |
| Local mode | Keep existing host receiver switches independent. `localserver` alone must not turn on all background publishing/control permissions. Existing page-specific local auto-connect behavior must be recorded before changing it. |
| Version compatibility | Preserve old/no-version links. The existing `v=3.52.0` guard does not prove support for controls introduced later. Unknown host capabilities retain the compatibility path. |
| Private data | Keep private replies bound to the requesting client. Neither channel 7 nor a matching session ID alone replaces the current private UUID/capability boundary. |
| Delivery feedback | Distinguish sent, receiver acknowledged, and action completed. One acknowledgement establishes at least one receipt, not all displays or OBS visibility. |

`server`, `server2`, and `server3` retain their existing page-specific meanings. Generally, server2 carries captured chat, server3 carries commands back to the host, and server is the page's API/Featured route. Background `socketserver` is a separate receiver setting. Preserve current channel numbers and public request formats unless a narrowly scoped, compatible extension is needed.

## Implementation stages

### 1. Establish the baseline and repair the verification harness

**Work**

- Re-read the pending diff before implementation; retain the other agent's work and identify changes since the audit. Work on `beta`, without creating a branch or altering unrelated files.
- Repair `tests/background-overlay-compat-matrix.test.cjs` so the current-build simulation includes the actual `handleOverlayControlRequest` dependency and awaits asynchronous handlers. Keep historical fixtures unchanged. Do not bypass the failing assertion with a no-op helper.
- Turn the existing inventory into a coverage ledger. For each receiver family, record feed, upstream commands, display commands, endpoint/flag support, bridge requirement, duplicate policy, recovery behavior, host/page version assumptions and test evidence.
- Add focused regression cases for the confirmed gaps before changing their behavior: Map mirrored votes, hosted game server2 selection, giveaway explicit endpoints, and Featured template capability mismatch.
- Inspect actual helper consumers, generated wrappers and exported widgets. A regex match for `server2` is not a passing capability check.

**Completion gate:** historical/current contract preflight passes; known failures have reproducible, appropriately scoped cases; every audited audience page has a family and explicit coverage status. No production defaults change.

### 2. Correct feed selection, addressing and duplicate processing

**Work**

- Put Map's duplicate check at the shared ingress, before queuing/counting. Reuse `js/transport-dedupe.js` with the actual ingress identity. Check Poll's ID-only implementation against the same requirements; preserve repeat-voting semantics.
- Cover mirrored IDs, ID-less mirrored pairs, arrays/wrappers where accepted, delayed copies, and legitimate repeated equal messages. The bounded ID-less heuristic is a compatibility fallback, not a guarantee of exactly-once delivery after arbitrary delays.
- Extend `getChatRelayConfig` in `js/local-server-url.js` to support the direct server2 captured-chat feed on hosted and explicit compatible relays, preserving existing local behavior. Keep an explicit `server=URL` API-feed choice and its channel. Update the 33 helper-based game consumers' generated links and commerce link generation together.
- Correct `shared/giveaway/managed.js` and `giveaway-obs-entries.html` endpoint selection without merging their different protocols.
- Extend the existing legacy display adapter to hosted/custom relays for the 13 Featured themes and LuckyLootTube. Keep its existing local call contract or a compatibility wrapper. Do not rewrite each theme's transport independently.
- Make Featured popup support depend on the selected template's implemented routes. Preserve existing Featured/server2 feed distinctions and label targeting; a raw chat test is insufficient.
- Check modern chat themes, Dock wrappers, `combine.js` and exported StreamElements widgets for correct forwarding of session, password, version, flags, explicit URLs and local port. Update affected link generators with the same scoped behavior.

**Completion gate:** direct captured chat reaches the supported games/commerce displays without a Dock; Featured selection and clear reach the intended themed display; endpoint overrides are honored; mixed inputs do not duplicate effects. Test both with the current host default and with additive chat enabled. Unrelated explicit API/custom-channel choices remain unchanged.

### 3. Finish the common display-control protocol and controller replies

**Work**

- Keep the pending Actions/Poll/Credits/Hype implementation as the starting point. Review its envelope, retry lifetime, acknowledgement handling, targeting, session cleanup and allowed fields before extending it.
- Use `shared/overlay-control-transport.js` and the existing background senders for additional display-control support. Avoid a second independent control framework or a global replacement of all send functions.
- First add Map Start/Pause/Reset/configuration, Timer background state delivery, alert/bot clear and Tip Jar reset/set. Then add Ticker/Spotify state delivery and Events feature/clear. Preserve existing channels, labels and legacy handlers where they remain necessary.
- Ensure pure P2P, pure relay, and mixed displays receive the same intended command. Retries/mirrored routes reuse one ID; two deliberate button presses get different IDs. A relay acknowledgement must not prevent delivery to P2P-only displays.
- Investigate the suspected hosted callback issue with an isolated protocol test. Treat it as unconfirmed until reproduced or disproved. If confirmed, extend the existing opt-in `commandResult` negotiation to the affected OBS dock/API/Stream Deck clients; correlate replies and preserve legacy HTTP callbacks. Do not change every callback unconditionally.
- Ensure client receipt, acceptance and external action completion are not conflated. Do not automatically retry a timed-out mutation over HTTP/P2P without an applicable idempotency contract. Stream Deck's HTTP fallback needs this explicit check.
- Keep Poll configuration allowlisted and other private settings off ordinary chat/control broadcasts. Do not introduce ad-hoc fields into canonical captured events.

**Completion gate:** supported common controls work without P2P, both transport populations stay served, and replay/timeout/session tests show no duplicate mutations or false completion feedback. Hosted reply behavior has evidence and the affected client formats are compatible.

### 4. Define and verify reconnect behavior per feature

Do this alongside each stage-3 feature, not as a final generic patch.

| Feature | Recovery contract |
| --- | --- |
| Poll and Map | Distinguish current settings from a new round/reset. Use a host-issued revision/round marker for host-managed transitions where required. A retained display can reconcile a missed reset once; repeated snapshots cannot reset it repeatedly. Do not claim votes are restored after page reload unless an authoritative vote store exists. |
| Timer | Apply the host's current state/time reference. A state snapshot must not restart a running timer or replay add/subtract commands. Resolve existing page-owned versus host-owned modes explicitly. |
| Hype, Ticker, Spotify, commerce | Apply the latest versioned state and discard stale updates within the same host/session lifetime. Do not repeat animations/side effects merely because a snapshot is repeated. |
| Credits and transient Actions | Recover connection readiness; retain ongoing local playback where supported. Do not replay a roll/media/OBS action on reconnect. A missed transient action is not silently turned into a new command. |
| Giveaway | Reuse existing epoch/revision, round and operation-ID semantics. Query state after an uncertain mutation; never redraw because a reply was lost. |

**Work**

- Define state ownership and persistence before adding a new revision field. Prefer existing revisions/operation IDs. Keep new markers in feature control/state envelopes.
- Bound duplicate/pending caches, clear or scope them on session/host lifetime changes, and ignore late responses from old sockets/sessions.
- Test commands issued during disconnection, not just disconnect/reconnect with no state change. Include host restart and two successive session changes.

**Completion gate:** each feature's promised recovery behavior is deterministic and documented. Transient loss and page-local history limitations are reported honestly; there is no global exactly-once or full-history-recovery claim.

### 5. Validate and ship safe additive chat publication

This milestone depends on stages 1–2 and the relevant duplicate/recovery checks. It does **not** depend on moving private AI credentials/tools to the relay or removing every iframe. Stage 3 may ship in independently verified feature batches.

**Work**

- Run the compatibility matrix below with additive delivery enabled, including currently retained bridges and independently targeted feeds.
- Publish updated receiver pages/shared assets first through the normal authorized release process. Then change ordinary background chat delivery so enabling server2 does not suppress eligible P2P sends. Keep explicit UUID replies, labels, filters, and Stream Deck's special feed behavior correct.
- Remove the temporary additive toggle from the UI after the default change is validated. Handle imported/saved values intentionally so a stale `false` does not silently restore the obsolete suppression behavior. Document that migration.
- Update popup wording, session/server guidance, custom-overlay guidance and developer transport notes. Keep feature support distinct from socket connectivity.
- Keep SDK selection and iframe/P2P initialization independent. Do not disable P2P globally because a relay socket is open.

**Completion gate:** one P2P-only display, one relay-only display and a mixed display all receive/count one copy of intended chat while an external listener remains connected. This holds for the supported old/new host-page combinations. Any unresolved duplicate or routing regression in a supported combination blocks the default flip.

Old third-party/custom copies cannot be assumed updated. Record which tested combinations are supported. If a legacy mixed receiver cannot be made compatible by updating the maintained receiver, define a narrow compatibility treatment before changing the default; do not promise that a date/version comment solves it or silently remove the user's chosen P2P route.

### 6. Close remaining capability gaps without unnecessary protocol migration

**Work**

- Finish remaining public display flows such as Waitlist/Confetti, Word Cloud and custom GIF actions using their existing feature semantics. Add server support only with sender, receiver, generated-link and end-to-end evidence together.
- Classify AI builder, private chatbot and co-host operations separately from their public chat/stage feeds. Retain their bridge/UUID/capability path until a separately reviewed client-bound private relay design is justified. These are explicit retained dependencies, not a hidden claim of full server-only support.
- Keep `TRANSPORT_CAPABILITIES` and popup support maps aligned. Tighten each declaration only after the corresponding data and control paths pass. Use an actual new capability/version signal where new host support matters; do not reuse 3.52.0 as proof of later functionality.
- Only consider suppressing a page's bridge after proving all required flows for that link work without it. Bridge removal is an optimization and compatibility decision, not the definition of this migration's success.

**Completion gate:** every inventory entry is either verified for its advertised server operation, explicitly P2P-dependent for named features, or a non-consumer. No blank “supported” status based only on socket creation or URL parsing. Remaining private-protocol work is documented separately and does not prevent the additive milestone being complete.

## Verification matrix

Use full protocol coverage on shared helpers and representative end-to-end workflows per family, plus a generated-link and receiver check for every maintained template. Do not run an enormous blind Cartesian product or treat one representative page as proof that every template's wiring is correct.

| Dimension | Required cases |
| --- | --- |
| Host/receiver | Actual extension configuration; optional SSApp testing when useful, without separate permission; hosted pages; OBS Browser Source before claiming OBS parity. SDK and iframe host paths independently. |
| Flags | No flags; server, server2, server3 separately; supported pairs/all three; localserver alone; each supported route with localserver and a non-default port. |
| Addresses | Hosted defaults; local defaults; explicit route URLs; explicit URL plus localserver; two different explicit endpoints where multi-route links support them. No unintended cross-endpoint fallback. |
| Versions | Old supported host/new page; new host/old supported page; new/new; no `v`; old `v`; current eligibility version. Include saved URLs and exported standalone widgets. |
| Topology | P2P-only, relay-only, mixed receiver, both populations together, multiple display instances/labels, external listener, no Dock where direct captured chat is advertised. |
| Payloads | Chat, donation/membership, meta-only updates, feature/clear, settings, controls, replies, repeated equal messages, ID-less input and legacy wrapped packets where supported. |
| Failure | Relay unavailable/reconnect, P2P unavailable, lost acknowledgement, command during disconnection, host restart, session switch and late old-session responses. |
| Permissions/scope | Disabled host routes stay disabled; unrelated platforms/sessions/labels receive no new commands or private data; API-only and command-only operation behave as documented. |

Use isolated fixtures, not live source channels. Never use CamCam66Gaming. SSApp testing is optional: use it when useful, without separate permission, and do not treat it as a mandatory release gate under [AGENTS.md](../AGENTS.md). Cloudflare actions remain separately authorized; this plan requires no speculative infrastructure change. Do not weaken Electron flags, session configuration, preload behavior or browser security to make tests pass.

Keep unit/contract results, real-runtime results and prior evidence separate. Repair and reuse existing dedupe, popup, SDK, compatibility and server-control suites. Add tests for observable routing/recovery behavior rather than merely duplicating implementation branches.

## Deliverables and traceability

| Audit finding | Planned resolution |
| --- | --- |
| 1. Additive default incomplete | Stage 5, gated by feed/duplicate compatibility rather than all private protocol work. |
| 2. Map/Poll mirrored inputs | Stages 1–2; shared-ingress regression cases and compatible dedupe. |
| 3. Games/commerce local-only direct feed | Stage 2; existing shared helper + link generators. |
| 4. Legacy Featured capability mismatch | Stage 2; adapter + template-specific generated-link verification. |
| 5. Missing controls | Stage 3 common controls, stage 6 remaining specialized flows/private boundaries. |
| 6. Giveaway endpoint precedence | Stage 2; retain protocol/channel distinctions. |
| 7. Hosted callbacks suspected | Stage 3; verify first, negotiated client reply changes only if needed. |
| 8. Broken test harness | Stage 1 before the default change. |
| 9. Recovery incomplete | Stage 4 alongside each feature, with explicit state ownership. |

Deliver small reviewable changes by stage/feature, with evidence and updated capability entries. Keep shared code Chrome 80 compatible and packaged locally. Include shared dependencies in the extension manifest and standalone publishing inputs. Change source events only if necessary and update `docs/event-reference.html` for any actual contract change.

The work is complete when ordinary additive publishing is safe, advertised public server workflows work end to end, and every retained P2P dependency is named rather than mistaken for server support. Completion does not mean every page must connect to every channel, every iframe must disappear, or every transient event must survive a disconnection.

The baseline harness repair and initial Map/route-selection fixtures are complete. Publish compatible receivers before changing the background additive default; see the status ledger for remaining gates.
