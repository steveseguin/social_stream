# SSN monetization API

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
