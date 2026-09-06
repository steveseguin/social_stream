# ISSUE-017: YouTube DOM mode emits undocumented `membershiprenewal` event

- **Status**: open
- **Severity**: medium
- **Area**: social_stream `sources/youtube.js`
- **Found**: 2026-07-22, during YouTube source documentation pass

## Symptom

`checkType` emits `membershiprenewal` (`sources/youtube.js:1866-1868`) and `processMessage` passes it straight to `data.event` (`:1640-1642`) whenever the membership card has chat text — renewal-with-message cards never hit the `resub`/`sponsorship` remap (`:1372-1437`). `membershiprenewal` is not in the documented event vocabulary (`docs/event-reference.html`), so downstream filters/routing keyed on documented events miss these rows.

## Expected

Renewal-with-message cards map to `resub` (or `membershiprenewal` is added to `docs/event-reference.html` as an intentional event).

## Evidence

- `sources/youtube.js:1866-1868` — tag→event mapping
- `sources/youtube.js:1640-1642` — event passthrough
- `sources/youtube.js:1372-1437` — resub/sponsorship remap that gets skipped

## Notes
