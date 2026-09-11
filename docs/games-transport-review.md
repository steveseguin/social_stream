# Games transport review — 2026-09-11

Scope: all 34 HTML pages under `games/`, their shared adapters and engines, plus root `games.html` (Spam Power). Reviewed current working-tree code, including the earlier Phrase Guess channel fix. The follow-up implementation fixes the confirmed issues below.

## Implemented follow-up

- Unwrap before deduplication in both mixed games.
- Retry Spam Power?s server socket without restarting gameplay.
- Phrase Guess uses native server2 reply requests and truthful request/disconnection status; host permissions and legacy API/P2P behavior remain intact.
- Chicken Royale, Chat Wars, Dancing Parade, Pet Race, Color Wars, Emoji Tower, Treasure Hunt and Word Chain now use platform/account identity internally, keeping readable names in the UI. Chicken Royale retains old name-only saved records but starts account-specific win counters; historical records cannot safely be attributed to an account.
- Added isolated regression coverage in `tests/games-transport-regressions.test.cjs`: all 6 tests passed, including account identity, reset behavior, reply permissions, persisted counters, duplicate handling and reconnect recovery.
- Re-ran all 35 games across 19 flag/endpoint modes: 665/665 passed (`%TEMP%/ssn-overlay-flags-65kMAh/report.json`). Existing 44 game/transport tests and popup search checks passed; all 35 HTML game scripts parse at the Chrome 80 syntax baseline.
- Release version: 3.50.10. The experimental additive toggle remains unchanged.

## Original findings

### 1. Phrase Guess replies use the wrong message contract on server2

`games/phraseguess.html:477` sends `{action:'sendChat',value:...}` or `{action:'extContent',value:...}` through its chat socket. These are legacy API commands. With server2, the socket sends to channel 3, whose background receiver calls `processIncomingRequest`; that handler does not support either of these unversioned commands. Even with host server3 enabled, they are ignored. With server3 disabled, inbound requests are deliberately blocked earlier. The game's log nevertheless says the reply was sent.

Reproduced by executing the actual extracted `processIncomingRequest` and `routeStreamDeckRemoteRequest` with the packaged command router: both commands produced no chat dispatch; the native `{response:'control'}` dispatched successfully. Source inspection also confirms no `extContent` action handling in that receiver. The prior channel/gameplay test only established that guesses arrive and can win a round.

Minimal direction: retain the legacy API contract on the legacy route, use the existing native request contract for server2 replies, and keep host inbound permission checks intact. Resolve dock-only publishing through an existing supported path before changing it; do not make server2 implicitly enable server3. Report reply availability accurately. Verify both reply destinations with server3 on and off, plus the unchanged P2P/API routes.

### 2. Chicken Royale and Spam Power deduplicate before unwrapping

`games/chickenroyale.html:2016` and `games.html:508` call their duplicate check before extracting `data.content`. Thus a raw chat message and `{content: sameMessage}` both execute, despite sharing an ID. Both pages can receive multiple transports. This is a current receiver defect, separate from the accepted risk of older receivers.

Reproduced against each actual extracted input handler: one raw and one wrapped message with identical ID caused two boosts/power increments.

Minimal fix: unwrap and validate before the existing ID check in these two pages. Test raw/raw, raw/wrapped, wrapped/raw, wrapped/wrapped, and distinct IDs. Do not add persistent caches or content-based suppression of legitimate repeated chat as part of this fix. ID-less mirrored traffic remains a separate limitation.

### 3. Spam Power never reconnects its legacy server socket

`games.html:653` constructs its `&server` socket once, with no close/error reconnect handler. Its separate server2/server3 socket does retry. An API relay interruption therefore permanently loses that route until reload; an available P2P route can mask the failure.

Reproduced in the actual page with controlled Chromium WebSocket boundaries: closing its server socket produced no replacement after 5.6 seconds. Source confirms no later retry is scheduled.

Minimal fix: use the existing page reconnect pattern for this socket, with one pending retry and cleanup on unload. Preserve endpoint, room and channel choices. Test disconnect/rejoin/message reception without resetting the game or opening duplicate sockets.

### 4. Older games merge different accounts with the same display name

Chicken Royale indexes players by lowercased display name (`joinPlayer`, line 1310), ignoring the supplied platform. Chat Wars and Dancing Parade likewise use display name for membership; Pet Race uses it for racers. Color Wars, Emoji Tower, Treasure Hunt and Word Chain also aggregate player scores by display name. Consequently two distinct viewers can share a player, affect each other's team/leave actions, or share scores. This is pre-existing and transport-independent.

Minimal direction: follow the newer engines' platform plus stable account ID/username fallback for internal identity, while retaining display names for rendering. This is a separate gameplay change with more regression exposure than findings 2–3; test each affected game's joins, moves, scoring and resets before applying it broadly.

## Other limitations observed

- Several older games' `sendResponse` functions (Color Wars, Dancing Parade, Emoji Tower, Treasure Hunt, Word Chain, Chicken Royale) only notify an embedding parent and log locally. Standalone OBS pages do not publish those announcements to chat. This may be intentional; adding automatic public replies is a behavior change, not a transport repair.
- The newer audience/ambient/Quick Call adapters support batches and reject non-chat/duplicate input through their engines. Older inline games generally accept single raw/wrapped messages, have weaker field validation, and often interpret display names as HTML despite the documented plain-text name contract. These are follow-up hardening opportunities, not additional proven channel failures.
- Single-transport helper games are not inherently exposed to the same simultaneous P2P/socket duplication as the two mixed receivers above.

## Validation

- Existing local game suites: **32/32 passed** (`node --test tests/audience-games.test.cjs tests/ambient-games.test.cjs tests/quickcall.test.cjs tests/games-gallery.test.cjs`). Includes engine behavior, demos, selected browser gameplay, input validation, and gallery links.
- Previous matrix covered the 34 child game pages across 19 flag/endpoint modes. Added root Spam Power to the maintained matrix and ran its **19/19 cases successfully**. Report: `%TEMP%/ssn-overlay-flags-MyGn27/report.json`.
- Focused reproductions above found gaps not asserted by those passing tests.
- Browser checks used isolated fixtures and controlled boundaries, not live channels. No SSApp/OBS gameplay certification or exhaustive round-by-round gameplay run across all games is claimed.

The four confirmed findings are addressed above. Optional hardening and standalone parent-only announcements remain outside this repair; no public replies were added to those games.
