# Server Transport Migration Roadmap

## Current state

- [x] Cross-transport dedupe is deployed on beta.
- [x] The socket-only gate is present but requires links with `v=3.52.0` or newer.
- [ ] The guarded pages are deployed to production.
- [ ] Production go-live time is recorded below.
- [ ] Version `3.52.0` is released.

Production go-live (Day 0): `NOT STARTED`

The 30-day countdown starts only when the guarded pages go live on production. Do not bump the extension to `3.52.0` before the Day 30 readiness review passes.

## Phase 1: Production rollout - Day 0

- [ ] Deploy the guarded page changes to production.
- [ ] Record the exact production date and time above.
- [ ] Confirm fresh production copies of representative pages contain the transport gate and dedupe guard.
- [ ] Run `node scripts/transport-dedupe-regression.test.cjs` against the production commit.
- [ ] Keep the extension version below `3.52.0`.
- [ ] Keep additive delivery experimental; do not enable it by default.

## Phase 2: Cache and production soak - Days 1-30

- [ ] Leave the `3.52.0` gate inactive for the full 30 days.
- [ ] Monitor reports of duplicate or missing messages.
- [ ] Test additive delivery with existing `v=3.50.5` links; they should remain dual-listen and render once.
- [ ] Test links without `server2`; they should remain bridge-only.
- [ ] Test representative chat overlays, emotes, events, hype, games, and the dock.
- [ ] Do not treat an old saved OBS URL as updated merely because its cached page has refreshed.

## Phase 3: Readiness review - Day 30

All items must pass before releasing `3.52.0`:

- [ ] Thirty full days have passed since the recorded production go-live time.
- [ ] Production is serving the guarded page code.
- [ ] The dedupe regression test passes.
- [ ] Fresh and old saved links both render messages once during additive delivery.
- [ ] No unresolved duplicate-message or dropped-message regression remains.
- [ ] The socket-outage tradeoff is accepted: a socket-only overlay cannot receive the P2P fallback while its bridge is disconnected.

## Phase 4: Release `3.52.0`

- [ ] Bump the extension manifest to `3.52.0`.
- [ ] Release the updated extension.
- [ ] Confirm newly generated links contain `v=3.52.0` or newer.
- [ ] Confirm eligible read-only overlays using `server2` stop opening the legacy bridge.
- [ ] Confirm old saved links remain dual-listen and are protected by dedupe.
- [ ] Monitor the release before changing the additive-delivery default.

## Phase 5: Make additive delivery the default

Do this no earlier than September 1, 2026, and only after the `3.52.0` release has completed its monitoring period.

- [ ] Change additive delivery from opt-in to the default; the existing date comment does not perform this change automatically.
- [ ] Update or remove the experimental setting text in the popup.
- [ ] Retest fresh `3.52.0+` links, old saved links, bridge-only links, and socket outages.
- [ ] Keep the dedupe guards in place.

## Separate later project: retire the legacy bridge

This is not required for the `3.52.0` or additive-delivery rollout.

- [ ] Keep the dock dual-connected until its commands and private/targeted replies work fully through the server.
- [ ] Audit every surface marked `legacyBridgeRequired: true`.
- [ ] Migrate special tools such as hype, credits, events, poll, map, reactions, and tipjar individually.
- [ ] Change transport capability flags one page at a time after focused testing.
- [ ] Decide whether and how old saved URLs will ever be moved away from dual-listen mode.
