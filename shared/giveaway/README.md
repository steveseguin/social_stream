# Managed giveaway/economy ownership

`service.js` is host-only. It uses the existing `PointsSystem` database and its
`userPoints` and `economyRecords` stores. `managed.js` is a read-only audience
renderer. `popup.js` and `control.js` are adapters to background commands, not
independent wallets. `core.js` preserves the older in-memory free-draw core.

## Invariants

- Read current balances and update balance, round and receipt in one readwrite
  transaction. Await only IndexedDB requests inside it; never await a network call.
- `pointsSpent` includes `pointsReserved`. Available balance remains
  `points - pointsSpent`; never subtract the reservation again.
- Price/prize rules freeze once entries exist. Point prizes are issuance; pot
  settlements redistribute stakes. Returning stake is not newly earned points.
- `userKey` retains the legacy exact `chatname:type` identity. Entries retain that
  key alongside the source identity. Do not merge accounts by display name.
- Every economic retry uses the original operation ID. The journal checks its
  parameters. Callback IDs alone do not guarantee business idempotency.
- Store the result before displaying it. Never trust a winner reported by an
  overlay. The managed Number Hunt secret stays on the host.
- A restart closes open rounds for review. Cancellation returns reservations;
  reset cannot discard them. Completed outcomes cannot be cancelled.
- `summary:` records are derived routing/list summaries, not settlement inputs.
  Audience snapshots contain at most 120 entries and 20 winners. Never settle
  or export the full participant book from those samples.

## Records and recovery

The points DB is version 2. New business records use version 1, with stable IDs:
`giveaway:` current rounds, `archive:` prior rounds, `operation:` dedupe receipts,
`summary:` lightweight lists, `redemption:` sticker payment receipts, and
`migration` to prevent unintended reconstruction after a reset/recovery.

Complete backups include both stores in one read transaction. Recovery accepts
only a fresh target and validates reservation totals before writing. It does not
merge journals or rewind a populated host. Balance-only imports remain separate.

Optional server backup/sync is a future concern. No transport or credentials belong
in this module. A future adapter must handle authority and operation reconciliation;
merging balances with `max()` is not safe. Settings synchronization is separate from
settling pending purchases. This implementation provides local snapshot recovery,
not cross-device synchronization or a complete replication protocol.

## Limits and tests

Current rounds support 10,000 participants and 1,000,000 total tickets. Entries are
counts, not one object per ticket. One transaction commits each draw, including pot
allocation. Large rounds should be benchmarked before raising these limits; do not
split settlement into unjournaled batches. History/receipts currently have no
automatic deletion policy.

Run `node tests/giveaway-economy.test.cjs` for real IndexedDB concurrency, failures,
recovery and payouts. `giveaway-popup.test.cjs` clicks the isolated extension UI and
manager. `giveaway-overlay.test.cjs` checks audience modes and transport handling.
`eventflow-giveaway.test.cjs` checks failure isolation and simulation. Run the popup
search and existing points/sticker regression tests too. Do not launch SSApp unless
Steve expressly requests that runtime's tests. Native plugin tests live in the
separate `ssn-streamdeck` repository.

`node tests/giveaway-recovery.test.cjs` forcibly terminates only its own Windows
Chromium process tree to check committed purchase/payout recovery and an
interrupted draw transaction. The popup suite also imports its downloaded backup
through the manager in a fresh extension profile, restores the original session
through the popup, and refunds recovered tickets.

Optional integration checks (never part of an automatic app-launch suite):

- Set `SSN_GIVEAWAY_PLUGIN_BUNDLE` to the built `.sdPlugin` directory, then run
  `node tests/giveaway-popup.test.cjs`. It copies the plugin to a temporary directory
  and drives protocol key events against the real isolated extension. It does not
  modify device profiles or press physical keys.
- With OBS already running, idle, and its existing unauthenticated loopback
  WebSocket on port 4455 available, set `SSN_OBS_GIVEAWAY_TEST=1` and run
  `node tests/giveaway-obs.test.cjs`. It uses a temporary scene, returns to the
  original scene, and removes its own sources. It never changes OBS security,
  starts a stream/recording, or launches SSApp. Screenshots go to the OS temp folder.
