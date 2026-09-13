# Giveaways, points, games, and Event Flow: review and implementation proposal

Reviewed: 2026-09-08. Implementation approved after review. Repository branch: `beta`.

Future direction from Steve: optional server-hosted backup/synchronization of points and settings. This service is outside the current implementation. Persist stable record/operation IDs and schema versions, keep storage behind a service boundary, and support portable backups. Do not introduce server dependencies, automatic uploads, credentials, or a second authority for balances. Future synchronization must reconcile operations and ownership rather than merge balances using maximum values.

## Recommendation

Extend the existing managed giveaway rather than introduce separate giveaway products with separate balances and controllers. Give it several audience presentations, persistent rounds/history, and one control service used by the popup, API, Stream Deck, chat, and Event Flow. Add point-funded entry only after the accounting and recovery foundation is tested. Then introduce one explicit points-pot game and add winner rewards to individual existing games as their results become host-verifiable.

The main dependency is trustworthy accounting, not more animations. A debit, a ticket, a winner, and a payout must remain consistent across failures, retries, popup closure, overlay reloads, and host restarts.

## 1. What exists and how it connects

These are source findings, not claims that every runtime path has been manually exercised.

| Area | Confirmed implementation | Consequence |
| --- | --- | --- |
| Popup links | One copy-stream-ID button; page-specific edit-link buttons; the old options links have already been removed. See [popup.html](../popup.html), [popup.js](../popup.js). | Preserve this work. Link editing must continue to import only that page's supported settings. |
| Managed giveaway | One in-memory pool in [core.js](../shared/giveaway/core.js), owned by [background.js](../background.js), with keyword/membership/repeat-winner controls and secure random selection. | A useful foundation, but no paid tickets, multiple persistent rounds, or durable payout record. |
| Audience presentations | Card, reel, and community wheel share [managed.js](../shared/giveaway/managed.js). The host selects the winner. | Add styles here; do not let each presentation select or pay its own winner. |
| Community standalone tool | [giveaway.html](../giveaway.html) already saves local entrants, winners, and settings under session/password-scoped localStorage keys. | Saved history is not entirely missing. It is missing from the authoritative managed host, and existing standalone storage is not a transactional wallet. |
| Points | [points.js](../points.js) stores earned points and points spent in IndexedDB. Available balance is their difference. Engagement awards, admin operations, Event Flow, commands, and stickers use it. | Preserve accounts, balances, fractional legacy values, and existing earning behavior. Do not create a second giveaway currency. |
| Event Flow | [EventFlowSystem.js](../actions/EventFlowSystem.js) exposes Add Points and Spend Points, with asynchronous action chains. | Separate spend/entry nodes cannot provide atomic purchases. A domain action must perform the complete purchase. |
| Chat commands | [pointsactions.js](../pointsactions.js) processes point commands through a message-store hook. | Entry feedback and earning order cannot be designed in isolation from chat persistence and processing. |
| Stickers | [rewards.js](../shared/stickers/rewards.js) spends SSN points and compensates for failed/unconfirmed delivery; [background.js](../shared/stickers/background.js) uses the shared points instance. | Reuse the wallet; preserve current refund behavior while introducing durable operation records. |
| Games | Reviewed engine families calculate local state in page instances; several use local random choices and human-readable result strings. | An overlay result is not sufficient evidence for a wallet credit. |
| Stream Deck | Host giveaway commands exist in [streamdeck-remote-control.js](../js/streamdeck-remote-control.js). Native plugin presets are absent from its [registry](../ssn-streamdeck/plugin/src/api/command-registry.ts). | API support does not establish native plugin parity. Update and verify the plugin separately. |

### Message ordering matters

For the main captured-chat path, `processIncomingMessage` applies bot actions, then Event Flow, then `sendToDestinations`. Giveaway ingestion happens inside destinations before `addMessageDB`; engagement points and points commands are attached to message-store operations. Sticker redemption starts after the database call. Other inbound paths also invoke Event Flow and need their own fixtures. See [background.js](../background.js), especially `processIncomingMessage`, `sendToDestinations`, and `processGiveawayEntry`; [points.js](../points.js), `ensurePointsSystemInitialized`; [pointsactions.js](../pointsactions.js), `initializePointsActions`.

Therefore an Event Flow purchase may see a different balance from a command processed after engagement earning. Preserve ordinary chat routing and define one purchase stage for new economy commands. Recommended first rule: eligibility and purchase use the committed balance when the economy action executes; do not promise that the entry message itself earns the point needed to enter. Document this and test each supported path. Do not move all engagement hooks as an incidental giveaway change.

## 2. Findings that determine implementation order

### Account identity is inconsistent

The points key is the case-sensitive `chatname:type`. Giveaway identity lowercases `userid || username || chatname` plus platform and stores only display name/platform/derived ID. Game identities vary again. A payout based on the displayed winner name could miss the original wallet or credit the wrong account. See `getUserKey` in [points.js](../points.js), `ingest` in [giveaway/core.js](../shared/giveaway/core.js), and the [audience engine](../games/audience-engine.js).

Introduce a resolved account reference at entry time. Keep the exact legacy wallet key and source identity/provenance; use platform-native IDs where available without assuming every source provides one. Do not silently lowercase, merge platforms, or migrate balances based on matching display names. Ambiguous identity must stop a paid operation with actionable feedback. Account linking/rename migration is a separate, explicit operation. The authoritative payload vocabulary is [event-reference.html](event-reference.html).

### Existing safeguards are useful but not enough for multi-step purchases

`PointsSystem.withUserLock` serializes operations in one instance. Writes already resolve on transaction completion and reject aborted writes. Those safeguards should be retained. However reads, cache values, and writes are separate; the lock is not shared across instances. There is no durable receipt tying a debit to an entry or tying a refund to its original debit. See `getUserPoints`, `saveUserPoints`, `spendPoints`, and `refundPoints` in [points.js](../points.js).

New economy operations need one IndexedDB transaction covering balance changes, operation receipt, and ticket/round state. Every writer touching participating accounts must use the same storage discipline: engagement, admin adjustments, imports, migrations, commands, stickers, and Event Flow. Otherwise a legacy cached write can overwrite a newer transaction. This is a shared-wallet change and must be implemented as an explicit phase with regression checks, not concealed inside a giveaway patch.

### Current command and flow failure behavior needs targeted treatment

`handleSpendCommand` in [pointsactions.js](../pointsactions.js) contains an unimplemented reward-handling TODO: `!spend amount reward-name` currently deducts points and reports the spend without fulfilling that named reward. Its wrapper also displays only successful command responses, which can conceal failure feedback on that path. Do not reuse this command for tickets. Recommended fix in the approved work: require a configured reward for redemption, retain any intentional manual spend as a clearly named opt-in behavior, and show failures through the existing supported response surface. Check custom-command users before changing semantics.

In [EventFlowSystem.js](../actions/EventFlowSystem.js), Spend Points blocks on a returned insufficient-funds result, but an exception, missing system, or invalid amount can leave downstream actions running. `blocked` propagates into flow/message handling, so it is not simply a purchase-failed output. Add transactional giveaway actions with explicit results and chain continuation rules; test synchronous and delayed chains. Address existing Spend Points failure handling as a narrowly identified compatibility fix, preserving existing flow behavior outside that decision.

### Resets, imports, and startup can change spendable balances

The current point store is profile/origin-local, not session-local. Reset clears the store. Import merge can prefer a record with less spent. Startup can reconstruct an empty store from message history, and that migration is scheduled in the background. See `resetAllPoints`, `importPoints`, `checkIfMigrationNeeded`, and `migrateFromMessageStore` in [points.js](../points.js).

With outstanding paid rounds, these operations become economy operations. Add durable migration/reset markers, coordinate migration with live writers, and prevent import/reset from silently invalidating holds or replay receipts. Never infer that an empty balance table means the user wants historical points re-created. Provide a deliberate backup/restore workflow for the complete economy. Legacy balance-only import remains supported, with clear restrictions while funds are reserved.

### Local games are not a shared result authority

The [audience page](../games/audience-page.js) creates its own engine instance. [Party games](../games/party-engine.js) include solo solves and group outcomes; [teamplay games](../games/teamplay-engine.js) include collective progress; [ambient games](../games/ambient-engine.js) have their own state model. [Chicken Royale](../games/chickenroyale.html) also processes donation-related boosts. Two overlays can disagree about timing or results. A global “pay every winner” checkbox would hide these differences.

Add reward support to an allowlist, one engine at a time, with a structured host-owned outcome. Keep ordinary local game score separate from wallet points. Do not change legacy donation boosts globally; wager-compatible variants need their own explicit rules and isolation.

## 3. Proposed accounting and persistence contract

### One wallet service, durable business operations

Extend the existing points database with versioned stores for operation receipts, rounds, entries/reservations, settlements, and pending notifications. The exact store layout should be finalized against IndexedDB upgrade and transaction fixtures before implementation. Do not place the authoritative ticket book in a second database if that prevents a single atomic commit with balances.

Preserve the current earned/spent API contract for legacy callers. Introduce explicit internal categories for awards, purchases, reservations, refunds, and transfers. Returned principal must not masquerade as newly earned points. The existing leaderboard orders by gross `points`, not available balance; preserve that default and offer a clearly labelled spendable-balance view only as an explicit addition.

Required invariants:

1. A successful purchase creates tickets and reserves/debits exactly the stated amount in one commit. Failure creates neither.
2. Available funds exclude all outstanding reservations, across simultaneous giveaways, games, and sticker purchases.
3. A retry with the same operation ID returns the committed result; the same ID with different parameters is rejected.
4. Refunds reference an original operation and cannot exceed its remaining refundable amount.
5. A round records its winner and settlement durably before an animation or success notification.
6. A payout is uniquely identified by round, award slot, recipient, and policy. Reloading or redisplaying never pays again.
7. Network delivery happens after commit. Notifications can be retried and deduplicated; no promise of exactly-once network delivery.
8. Money-like arithmetic uses bounded integers for new tickets/stakes/prizes. Existing fractional balances remain valid; no blanket rounding migration.
9. Storage failure fails paid operations closed, while ordinary chat continues.

Read the current account value inside the write transaction, not from a stale cache. Do not perform network calls or unrelated asynchronous work while holding an IndexedDB transaction. Invalidate/reconcile caches after commit. Handle blocked database upgrades and older open clients explicitly. Large refunds/payouts may use bounded, resumable batches with one durable receipt per allocation; the round stays settling/cancelling until every allocation reconciles. Do not claim that a partially processed batch has completed.

An operation ID is not an API callback ID. For captured events, derive a replay key from a source-native event/message identity plus operation/round/flow-node identity where available. Internal `message.id` is not guaranteed to be a stable native ID. Sources without reliable replay identity need a documented bounded dedupe fallback and must not be advertised as perfectly replay-safe. Delayed flow continuations retain the same operation context; a deliberate second purchase receives a new operation ID.

### Funding rules

| Operation | Recommended rule |
| --- | --- |
| Free giveaway | One entry per resolved viewer by default; optional host/flow grants are recorded. |
| Ticket giveaway | One ticket per point by default, configurable integer price and per-viewer cap. Tickets are reserved purchases while the round is open; completion consumes them, cancellation refunds them. |
| Fixed point prize | Host-configured issuance with an explicit per-round budget and winner count, frozen when opened. Disabled by default. |
| Pot game | Stakes fund the pot; payout redistributes that pot, with no hidden minting or fee. |
| Sticker reward | Ordinary point spend using the same available balance and a durable receipt, retaining current delivery/refund behavior. |
| Manual adjustment | An audited operator action with reason and operation ID; never silently edits a settled round. |

Default to SSN loyalty points only, with no purchase/cash-out mechanism added. If points can be bought or redeemed for valuable prizes in the intended wager setup, pause that part for a separate product/rules review before implementing it. This is a scope boundary, not a claim that local points are inherently exempt from all rules.

### Host ownership and storage limits

Support one authoritative economy owner per local profile, with transactional ownership/fencing for competing host instances. Session IDs select presentation/control routing and round namespaces; changing a session must not erase balances or unpaid obligations. Other browser profiles and devices have separate storage today: do not claim synchronized wallets across them. A controller talks to its selected host; it never opens a second local wallet and assumes it is the same one.

Keep durable history on the host in IndexedDB. Offer JSON backup and human-readable CSV winner exports with spreadsheet-safe text handling. Paginate participants/history; never export from the 120-entry audience preview. Keep receipts needed for refunds/recovery even if old display history is pruned. Deleting browser data still deletes local records; describe backup limits plainly.

## 4. Giveaway lifecycle and multiple draws

Use immutable giveaway and round IDs, with editable display names. Proposed lifecycle:

`draft -> open -> locked -> settling -> completed`

`open/locked -> cancelling -> cancelled`

Interrupted operations enter a recoverable locked state. Resume the recorded settlement or refund; never automatically pick a replacement winner. A host restart must not reopen paid entries silently.

Freeze price, eligibility, winner count, reward budget, and refund policy once paid entries begin. Style/title changes may remain live. A new keyword or new round is not a silent reset. Distinguish close entries, draw, draw next prize, cancel/refund, and create new round. Once an award is settled, a redraw cannot claw points back silently; record a separate operator correction or a new award slot.

Allow multiple named giveaways with explicit IDs in URLs and commands. Unqualified legacy commands address the selected default giveaway only. Reject ambiguous chat commands rather than charging a viewer into an arbitrary draw. Provide `!ticket <giveaway> <count>` and a concise entry-status command, subject to existing command collision checks. Free first ticket and per-user limits are useful optional settings; weighted subscriber bonuses are deferred until eligibility is reliable and odds are explainable across platforms.

Store ticket counts per account rather than expanding an array per ticket. Secure weighted selection must respect a bounded total and rejection sampling; the current 32-bit unweighted selector is not automatically sufficient for arbitrarily large ticket totals. State the odds and remove-winner policy consistently. A wheel rendering only a participant sample must be described as a reveal animation, not an exact picture of every ticket's odds.

Useful established patterns include active-user/keyword eligibility and winner activity information in [Nightbot](https://docs.nightbot.tv/control-panel/giveaways), and ticket caps, optional first free ticket, entry confirmations, and refunds in [StreamElements](https://docs.streamelements.com/chatbot/modules/giveaways). Adopt selectively: eligibility search, winner history, configurable closing time, controlled announcements, and refund tools have higher value than multiplying giveaway pages. Physical prize fulfillment remains a manual status with notes; winning points can settle automatically.

## 5. Games and point prizes

Do not attach payouts to arbitrary overlay messages or scrape winner text. A managed game adapter supplies a structured outcome containing game instance, round, resolved recipients, result type, and frozen reward policy. Only the host can commit it. Display pages remain read-only consumers.

| Game family | Reward approach |
| --- | --- |
| Solo solve/guess games | First migration candidate: host validates a correct answer and records the first eligible solver. |
| Team competitions | Define eligible team members at lock/participation cutoff, minimum contribution, ties, and fixed shared budget before enabling awards. |
| Cooperative progress games | Optional capped completion reward; no invented single winner. |
| Ambient/visual participation | Keep scores/cosmetics; no automatic point payout by default. |
| Legacy combat/donation-boosted games | Individual audit and managed variant required before stakes; preserve existing free-play behavior. |

First pot game proposal: **Coin Flip Pot**, explicitly a game of chance. Each viewer chooses heads or tails and can add stake before lock, up to a cap. Side changes after staking are rejected. After locking entries, the host chooses heads/tails with an unbiased cryptographic draw, persists the outcome, and then starts the audience animation. The outcome is 50/50 regardless of how many points are on either side. Winners recover their stakes and split losing stakes in proportion to their winning stake. Integer remainders use largest fractional remainder first, with an immutable entry-order tie-break. If either side has no stake, minimum participation is unmet, secure randomness is unavailable, or the host cancels before outcome commitment, refund all. After commitment, finish the recorded settlement; do not allow cancellation to reverse a known losing outcome. No house fee, negative balance, borrowing, or late bets. Test the arithmetic before adding decorative game animation.

Example: heads stakes are 2 and 1 points, tails stakes total 5. If heads wins, the 8-point pot pays 5 and 3 points respectively after deterministic rounding; total payout remains 8. Returning the winners' own 3 points is not 3 newly earned points. Other future game adapters must additionally specify tie and no-winner rules.

This is a separate later milestone, not a checkbox on every existing game. A random pot draw could reuse the raffle engine instead, but should be labelled honestly as a draw rather than implying skill. Avoid implementing both variants in the first release.

## 6. Event Flow and integration design

Add a small set of domain actions: enter giveaway, buy tickets, grant tickets, control giveaway, and query giveaway. Add game control/reward actions only once a managed adapter exists. Buy tickets atomically verifies the actor, round, price, cap, funds, and entry. Grant tickets is an operator/automation privilege and must not imply a viewer has paid.

Reuse existing node configuration, templates, validation, and branch conventions in [EventFlowEditor.js](../actions/EventFlowEditor.js). Introduce a narrowly scoped action-outcome continuation contract if existing routing cannot express failure without dropping chat. Test it in both synchronous and delayed execution; do not retrofit unrelated actions without need.

New domain events belong in documented `event`/`meta` structures. Distinguish entry accepted/rejected, round closed, winner committed, points settled, and refund completed. Do not put private balance/history into audience broadcasts. Prevent award loops with origin context, stable operation IDs, per-round budgets, and explicit rules for internally generated events. A winner-triggered flow can announce an award; it must not also repeat the built-in payout by accident.

Event Flow test/dry-run mode must use a separate simulation economy. Fake participants cannot receive real prizes. Remote event bridges and user-provided fields are not proof of a trusted actor: inspect ingress authorization and preserve provenance before enabling balance-changing commands. Existing host-disable, transport, and session settings remain intact; any broader authentication change requires a separate scoped proposal.

Use one versioned command/result contract across popup, P2P, WebSocket, and native Stream Deck. Preserve existing giveaway action names as default-round aliases. New operations return operation ID, round ID, revision, committed status, and a stable error code. Late callbacks cannot overwrite a newer selection. Retried draw buttons must not select another winner.

Native Stream Deck work includes registry entries, property inspector groups, capability gating, round selection, query-result summaries, generated profiles, translations, and command icons. Reuse the existing trophy/gift/control icon family and icon generator. Add registry/inspector parity checks; the two lists currently require coordinated updates. Verify the built plugin, not just the host command table. Relevant files: [registry](../ssn-streamdeck/plugin/src/api/command-registry.ts), [inspector](../ssn-streamdeck/plugin/ui/action-settings.html), [query results](../ssn-streamdeck/plugin/src/api/query-result.ts), [icon generator](../ssn-streamdeck/plugin/scripts/generate-command-icons.mjs), [package scripts](../ssn-streamdeck/plugin/package.json).

## 7. Popup, controller, OBS, and bloat

The popup is already approximately 1.05 MB of HTML and 557 KB of JavaScript before compression, measured from local files; this is a source-size observation, not a performance measurement. Avoid embedding complete participant tables, ledgers, and game forms in it.

Keep the Giveaway section aligned with existing sections and [popup-ui.css](../popup-ui.css): selected giveaway, concise state/count, basic entry setup, open/close/draw, preview/copy link, and an Appearance subsection. Put ticket/prize controls behind clearly named optional subsections. Use existing switches, buttons, label placement, focus styles, and theme colors. Display the committed active rules separately from an unsaved draft, so editing a field does not pretend the running round changed.

Provide a lightweight management page for multiple giveaways, participant search/removal, refunds, winner history, and backup/export. It uses the same host service and is optional; routine operation remains possible from the popup or Stream Deck. Load advanced management code when needed. Avoid a new UI framework or dependencies in every overlay. Bound broadcasts and history queries, batch entry updates, and avoid timers when idle/disabled.

The current managed page has a transparent body but opaque themed stage/wheel panels in [managed.css](../shared/giveaway/managed.css). Add explicit transparent/background choices, readable text outlines, responsive safe margins, reduced motion, and light/dark preview checks. Card, reel, and wheel should share theme variables and state, with distinct presentations rather than separate control systems. Keep community attribution and improve that renderer inside this family.

OBS sources show audience content only. No setup controls, wallet balances, private IDs, or recovery dialogs on the overlay. On reconnect, render the committed state without redrawing or paying again. Receiver connectivity is not proof that OBS is live or that a scene is visible. Long names, non-Latin names, 0/1/many entries, narrow crops, and display sample limits need deliberate designs.

Keep one copy-stream-ID control near the main connection link. Retain page-scoped edit-link behavior, including session/password handling and parameter validation. Editing an audience URL must not overwrite another page's appearance or a running round's economic rules. New giveaway ID parameters must round-trip correctly. The standalone community mode remains a labelled compatibility option; managed mode is the route for reliable remote control and points.

## 8. Guides, SEO, and maintainability

Use existing guides as the main learning surface:

- [Polls, giveaways, and waitlists](polls-giveaways-waitlists-guide.html): free draw, paid tickets, multiple rounds, cancellation, winner history, OBS setup.
- [Loyalty points](loyalty-points-guide.html): earned/available/reserved, awards versus transfers, reset/import/backup, identity and cross-device limits, stickers.
- [Event Flow recipes](event-flow-recipes.html): free entry from an event, atomic ticket purchase, winner announcement, point-prize rules, failure paths, safe testing.
- [Chat games](chat-games.html) and [gallery](games-gallery.html): which games support host control, rewards, stakes, and transparent presentation.
- [API documentation](../api.md), [commands](commands.html), and [event reference](event-reference.html): schemas, examples, capabilities, idempotency, errors, and privacy boundaries.

Popup help should be a brief explanation and a guide link, with unavoidable cost/refund terms visible next to the relevant action. Guides need screenshots from the actual tested UI, accessible headings, titles/descriptions, navigation links, and canonical public URLs without session parameters. Private control/session pages should not be indexed; `noindex` is not an access-control mechanism.

For future maintainers and AI editors, document module ownership, state transitions, invariants, identity resolution, storage versions, and extension/Electron/standalone packaging. Keep pure domain logic separate from adapters and presentations. Browser code stays classic-script/Chrome 80 compatible with packaged dependencies; no remote executable imports. Update resource manifests and deployment inclusion for new shared files, without performing any deployment as part of implementation testing.

## 9. Implementation sequence and exit criteria

| Phase | Deliverable | Required exit evidence |
| --- | --- | --- |
| 1. Contracts and wallet safety | Account resolver, operation model, atomic storage, migration/reset/import policy, targeted command/flow failure treatment. | Existing balance/earning behavior preserved; aborted transaction, stale instance, competing spend, replay, overflow, and migration fixtures pass. |
| 2. Durable free giveaways | Round IDs/state machine, saved history, one controller service, safe reset/cancel semantics, multiple rounds. | Restart/reconnect and repeated draw cannot lose state or select/pay twice; old default-round commands and links still work. |
| 3. UI and native control parity | Compact popup, optional manager, three polished presentations, transparent options, native plugin commands/icons/results, guides for free operation. | Manual extension UI flow from setup to entry to winner; API/P2P/WebSocket parity; plugin build/runtime checks; light/dark/keyboard/OBS checks clearly recorded. |
| 4. Paid tickets and fixed point prizes | Atomic purchases, caps, reservations/refunds, payout budgets, Event Flow nodes and chat entry/status. | Simultaneous giveaways plus sticker spend cannot overspend; cancellation/recovery/export are consistent; no test-mode real charges; failure feedback is visible. |
| 5. Managed game rewards | One solo game adapter and explicit outcome/reward contract, followed by individually reviewed families. | Multiple displays show one result; reload/duplicate outcomes cannot pay again; tie/no-winner rules tested. |
| 6. Points-pot game | One clearly defined wager mode with frozen rules and budget-conserving settlement. | Stakes plus payouts/refunds reconcile exactly, including rounding, disconnect, cancellation, no eligible winner, and interruption. |

Each phase must remain usable independently. Feature flags/default-off settings keep incomplete paid features unavailable. Storage upgrades are additive; disabling a feature does not delete obligations. Do not ship a database upgrade that old supported clients can silently overwrite. Cross-profile/multi-machine synchronization, purchasable points, cash-out, automated physical fulfillment, and universal game wagering are outside the first implementation.

## 10. Verification plan and evidence from this review

Executed during this review:

```text
node --test tests/points-import-validation.test.cjs tests/points-query-failures.test.cjs tests/points-storage-streamerbot-regressions.test.cjs tests/giveaway.test.cjs tests/sticker-rewards.test.cjs
42 tests passed; 0 failed.
```

These checks cover important existing behavior, including fractional points, storage completion/failures, imports, giveaway selection, sticker deduplication, and delivery/refund handling. They do not prove the proposed transaction journal, new paid flows, every real browser failure, native Stream Deck hardware, or OBS operation.

Implementation acceptance must include:

- Real IndexedDB integration fixtures for cross-instance updates, database upgrades, aborts, quota failures, and restart at each purchase/settlement boundary. Pure mocks alone are insufficient.
- One viewer with 10 available points trying concurrent purchases across two rounds and a sticker: successful total spending never exceeds 10; failed operations create no tickets.
- Duplicate source events, delayed flow retries, repeated UI clicks, timeout-after-commit, lost callbacks, and stale state queries. Verify the same committed operation is reported, not repeated.
- Import/reset while funds are reserved, account rename/ambiguous identity, same name on different platforms, fractional legacy balances, huge/invalid counts, and no secure random source.
- Actual extension UI: create a test round, configure it, send a test message through the normal test ingress, participate, query status, close, draw, cancel/refund, restart, and review history. Isolate test balances and participants.
- Visual checks for every presentation/theme/background mode, light/dark popup, keyboard access/focus, reduced motion, long text, empty states, disconnected host, capped lists, and readable errors. Do not rely solely on screenshots or DOM assertions; press the controls.
- API and native plugin: identical inputs/results over supported transports, proper channels/callback correlation, disconnected/disabled host, unknown round, repeated keypress, capability fallback, icons at key size, translations, and generated profile checks.
- Run `node tests/popup-search.test.js` for popup changes. Do not launch SSApp or its Electron test suites without Steve's explicit SSApp testing request. When authorized, test that runtime with its actual settings in an isolated profile; do not substitute another browser and call it equivalent.
- Real OBS and Stream Deck hardware checks are separate from automated browser/plugin fixtures. Record what was actually exercised and what remains unverified. Never use unrelated live channels, including `CamCam66Gaming`.

No UI/manual OBS/Stream Deck hardware verification was performed in this planning review. Existing tests passing does not remove the identified design gaps. Before implementing a game reward adapter, complete that game's full outcome/identity audit; the reviewed game families are examples, not certification of every game page.

## Proposed defaults for approval of the implementation direction

Free keyword giveaways remain the simplest default. Point prizes, paid tickets, and stakes are opt-in. One ticket costs one SSN point unless configured otherwise; set a per-viewer cap. Closed/cancelled paid rounds have explicit, recorded outcomes; cancellation refunds unsettled purchases. Fixed prizes use a capped host award budget. Game rewards are enabled only for reviewed managed games. Preserve legacy accounts and ordinary earning behavior, keep longer instructions in guides, and complete accounting/recovery before adding wagering.
