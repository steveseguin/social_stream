# ISSUE-006: Control API token accepted via `?token=` query param

- **Status**: resolved by API 1.1.5 (2026-07-26)
- **Severity**: medium
- **Area**: ssapp repo, `main.js`
- **Found**: 2026-07-22, during ssapp LLM/MCP documentation pass

## Symptom

The control API authenticates via `X-SSAPP-Token` header **or** `?token=` query parameter (`main.js:2216`). URLs are far more likely to end up in logs, shell history, and screenshots than headers, and the auto-generated token is long-lived and stored in plaintext electron-store (`main.js:1916-1919`). A leaked `?token=` URL is a full credential for source control, settings mutation, and (in legacy mode) arbitrary JS execution (see ISSUE-005).

## Expected

Restrict query-token auth to `GET /api/v1/events` only (the SSE endpoint that needs it for `EventSource` clients); require the header elsewhere.

## Evidence

- `main.js:2216` — token accepted from query string
- `main.js:1916-1919` — token persisted in electron-store
- `main.js:1926-1930` — timing-safe comparison (good; the issue is transport, not comparison)

## Notes

Tradeoff: SSE `EventSource` cannot set headers, so query auth must remain at least for `/api/v1/events`.

## Resolution

The product `/api/v1` interface is now an explicitly enabled, loopback-only local adapter and
does not use tokens. Headless mode no longer enables it. The legacy renderer-execution test
harness retains its separate environment-provided token and does not expose query-token
authentication as a product feature.
