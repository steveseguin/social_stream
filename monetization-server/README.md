# SSN monetization API

Local fuzz, queue-capacity and sustained receiver checks are recorded in [September 8 validation](VALIDATION-2026-09-08.md), including commands to reproduce them.

Server endpoints for Social Stream Ninja's Monetization section. These belong on `api.socialstream.ninja`, separately from NinjaBacker. NinjaBacker donations continue to use NinjaBacker's existing API without server changes.

Run `npm ci` and `npm start`. The standalone service listens on loopback port 3079 (override with `PORT`). Route `/v1/throne/*`, `/v1/ebay/*`, `/v1/ninjabacker/*`, and `/v1/monetization/health` from the SSN API reverse proxy to it. Preserve existing API routes. Deployment wiring must be checked against the VPS configuration before installation. Nothing in this directory deploys automatically.

Throne works without application credentials. Its receiver verifies the published Ed25519 signature, timestamp and creator, removes private fields, and forwards verified gifts to SSN. One process handles webhook and SSE traffic. Disable proxy buffering for SSE, allow long response timeouts, and omit query strings from access logs: SSE reader keys and OAuth callback codes are private. Reader keys are distinct from public webhook identifiers. SSN supplies the webhook URL in its Monetization section.

To enable eBay, set `EBAY_SHOWCASE_ENABLED=1`, `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, and `EBAY_RUNAME` (the registered redirect name, not a URL). Configure the eBay application callback as `https://api.socialstream.ninja/v1/ebay/callback`. Production Browse access and `sell.fulfillment.readonly` access are required. Meet eBay's application requirements and review request quotas before rollout. The default database is `monetization.db`; set `SSN_MONETIZATION_DB` to a persistent writable path. Back up the database and keep secrets out of source control.

Only eBay connection tokens are stored, encrypted using a reader secret retained on the SSN device. The database stores its hash, not the secret. No raw orders, addresses or buyer identities are stored or broadcast. OAuth state expires in ten minutes and is single-use. Disconnect deletes the encrypted connection. eBay orders use overlapping date cursors, pagination and stable order-line deduplication; stock changes and auction endings never count as paid purchases.

For sandbox development, set `EBAY_ENVIRONMENT=sandbox` and use sandbox credentials, a sandbox RuName, and a separate database/service. Production remains the default; recognizable sandbox keys are rejected in production mode. See [sandbox setup and expansion notes](EBAY-SANDBOX.md). Application-key authentication alone does not complete seller OAuth or establish production API access.

Use HTTPS on the public API. The loopback service has body limits, rate limits and bounded SSE clients. Do not expose its internal port directly. This service does not edit listings, fulfill orders or collect payments.

Tests: `npm test`. From the SSN repository, `node tests/monetization-ssapp.e2e.cjs` and `node tests/ebay-ssapp.e2e.cjs` run the actual desktop app against local fixtures. A real eBay seller OAuth/order test and a real signed Throne gift remain required before claiming live integration validation.

## Optional NinjaBacker receiver

The service unit enables `NINJABACKER_RELAY_ENABLED=1`. `/v1/ninjabacker/*` is hosted on the SSN API, independently of NinjaBacker and the io relay. Default SSN setup remains live SSE; Reliable webhook is opt-in.

SSN generates a private receiver reader key on the device. Account setup verifies the private Tip ID with NinjaBacker's fixed public API URL; the receiver does not store that Tip ID. It encrypts the supplied dashboard signing secret with a 32-byte server key at `SSN_MONETIZATION_KEY` (default: the database path plus `.key`). The systemd StateDirectory and umask restrict both files. Back up the database AND key together; losing the key requires creators to configure signing secrets again. Do not rotate/delete it during an ordinary deployment.

The raw-body HMAC and signature timestamp are checked before acceptance. A SQLite transaction persists each delivery under a unique channel/delivery ID before returning 204. No downstream alert work delays the acknowledgment. Unacknowledged work is leased for 60 seconds and redelivered after a lost connection; SSN polls every five seconds and remembers handled IDs before acknowledging. Test tips only preview the dedicated overlay. Public fields are whitelisted; callback IDs and receipt addresses are discarded. Names/messages remain plain text. No refund/dispute feed is implied.

Retention is seven days, including deduplication tombstones. Acknowledging removes the stored payload immediately. Limits: 1,000 configured receivers, 1,000 pending events per receiver, 100,000 delivery/tombstone records overall, and five events per poll. Queue/storage failure returns non-2xx for provider retries. Switching SSN back to live delivery deletes that receiver and its queue; the host must remove the old dashboard destination. Pausing SSN retains the queue. This is at-least-once processing; external actions need their own idempotency guard against a crash between the action and the local acknowledgment.

Run `npm test` here and `node tests/ninjabacker-ssapp.e2e.cjs` from the SSN root. Set `SSN_TEST_NINJABACKER_ROOT` if the NinjaBacker checkout is not at `../vdoninja/tip-server`. The Electron test covers both live feed and reliable delivery, including signatures, offline/server-restart recovery, privacy, test isolation, duplicate suppression and switching back. It uses synthetic local accounts/payments and never charges money.


## Optional Shopify paid-order receiver

Set `SHOPIFY_RELAY_ENABLED=1` to register `/v1/shopify/*`. Route that path to this existing loopback service over HTTPS, preserving raw JSON bodies and Shopify headers. No deployment is automatic. This uses the same SQLite database and 32-byte server encryption key configuration as NinjaBacker, in separate Shopify tables. Back up the database and key together. The feature returns 503 when disabled.

Creators configure their permanent `myshopify.com` domain and manually-created webhook signing secret. The receiver validates `X-Shopify-Hmac-Sha256` as base64 HMAC-SHA256 of the original body, matches `X-Shopify-Shop-Domain`, and accepts only `orders/paid`. No Shopify Admin API access, fulfillment writes, OAuth application or customer-data storage is required. Receiver creation alone does not verify shop ownership; a correctly signed matching-store event proves delivery. Do not describe a generated URL as a verified connection.

Current positive fully-paid orders with `test: false` become anonymous `purchase` events; no donation amount fields are emitted. The total is available as `meta.commerce.orderTotal` in shop currency. Product titles and known quantities are whitelisted. Raw orders, customer details, notes, custom properties and raw order IDs are discarded. Tests are acknowledged without enqueueing actions. Signed-body `updated_at` must be within seven days and no more than five minutes in the future; missing/invalid timestamps are skipped. Orders with more than 250 lines omit quantity rather than reporting a partial count.

Deduplication uses a hash of shop and order ID, not a mutable delivery header. Seven-day queue and tombstone retention, five-event polls, 60-second leases, durable transaction-before-200, encrypted signing secrets, 1,000 receiver/1,000 pending-per-receiver/100,000 total-record caps mirror the existing receiver pattern. Webhooks accept up to 1 MiB of raw JSON. Acknowledgment immediately clears payloads. Disconnect removes the receiver and queue. This is at-least-once alert processing, with no historical reconciliation, refunds or fulfillment.

Run `node --test tests/shopify-relay.test.js` here and `node tests/shopify-ssapp.e2e.cjs` from the repository root. The latter exercises the actual application against a local signed receiver and fixture storefront data. Set `SSN_GUIDE_SCREENSHOTS=1` to capture cropped guide images; screenshot mode briefly shows the isolated app. A real Shopify development-store webhook and product import remain required before claiming live-service validation. No service keys are bundled into SSN.


## Optional public viewer pages

Set `PUBLIC_SHOP_ENABLED=1` to enable `/v1/shop` on this existing SSN API service. This requires no merchant credentials. Deploy `public-shop.js`, the updated server, and `../shared/monetization/core.js` alongside the service (preserve the relative directory layout). The same SQLite path (`SSN_MONETIZATION_DB`) stores public snapshots in a separate `public_shops` table; back it up for stable links. No deployment is performed by the source change.

Publish the standalone `shop.html`, `shared/monetization/{shop.js,shop.css,core.js}`, `translations/page-i18n.js`, translation JSON, `docs/css/styles.css` and favicon with the website. Existing extension manifest wildcard `shared/monetization/*` already exposes the browser utilities. Nothing uses remote executable code.

`POST /v1/shop` and `DELETE /v1/shop` require a private 32-byte hexadecimal bearer key, generated/persisted by the SSN device before publishing. The public ID is SHA-256 of a domain-separated key; read access cannot mutate that publisher's page. `GET /v1/shop/:id` returns only whitelisted public catalog fields and last-saved time with `Cache-Control: no-store`. There is no public directory/list endpoint. Limit: 20 products, 96 KiB requests, 1,000 pages plus the existing IP rate limit. Operator moderation/removal can delete a row by public ID; public publishing is opt-in and should remain disabled until the operator is ready to support it.

Catalogs persist offline; no checkout, inventory synchronization, sale detection or live-presence guarantee is implied. The creator retains the private device profile to update/unpublish. Failed sync retries at most once a minute; viewer polling is every 15 seconds. Public endpoints return 503 when disabled. Full local tests: `npm test`; actual-app fixtures: `node tests/product-controls-ssapp.e2e.cjs` from the repository root.

The Pages workflow now publishes the standalone viewer at the stable `/shop.html` URL from beta, with content-versioned dependencies under `public-shop-assets/`. This avoids replacing stable app utilities when the viewer is released. The ordinary beta copy remains available. Regenerate the standalone payload with `python scripts/build-public-shop.py --source . --output <staging-directory>` from the repository root. The API must still be deployed separately.
