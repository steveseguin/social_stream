# eBay sandbox setup

See the [seller/streamer implementation plan](EBAY-SELLER-PLAN.md) for the next milestones and comprehensive feature scope. Steve completed developer verification and eBay created the sandbox RuName on September 7, 2026. It is now stored in the private environment file. The separate sandbox service and callback route were deployed and verified over public HTTPS on September 7, 2026.

The sandbox keyset authenticated successfully on September 7, 2026. It is stored outside Git at `%USERPROFILE%\.ssn-secrets\ebay-sandbox.env`, with file access restricted to Steve's Windows account. Never copy its contents into the client, repository, screenshots or logs. The Dev ID is retained there but REST OAuth uses only the Client ID and Client Secret.

## Finish seller connection

1. In the eBay developer account, open **Sandbox > User Tokens** for this keyset. Configure an OAuth redirect entry and copy its **RuName**, not its URL, into the private file as `EBAY_RUNAME=...`.
2. The accepted redirect URL must reach this service's `/v1/ebay-sandbox/callback` over HTTPS. Use a dedicated sandbox deployment, with a separate database. Do not switch the public production service to sandbox. Hosting and the client API route must point at that same sandbox service before a real seller login can finish.
3. Create sandbox seller and buyer users. Grant the seller connection `https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly`. The app also needs Browse access with `https://api.ebay.com/oauth/api_scope`. Scope strings keep `api.ebay.com` even in sandbox.
4. Add `EBAY_SHOWCASE_ENABLED=1` and an absolute, sandbox-only `SSN_MONETIZATION_DB` path to the private file. Set `PORT` if another local service uses 3079.
5. From `monetization-server`, run the commands below (Node 22). A local server alone does not make the hosted client or callback use it; the Electron fixture test maps the API to its local server for isolated testing.

```powershell
node --env-file="$env:USERPROFILE/.ssn-secrets/ebay-sandbox.env" check-ebay-sandbox.js
node --env-file="$env:USERPROFILE/.ssn-secrets/ebay-sandbox.env" server.js
```

## Existing product queue

Add up to 20 existing listing URLs in one currency, select **Cheapest remaining product**, and enable the showcase. The first confirmed paid purchase removes that entry, showing the next cheapest available item. It advances after one purchase, including multi-quantity listings; it does not wait for all inventory to sell. Fixed-price, single-quantity listings make the simplest first test. Auctions use changing bid prices, so they cannot promise a strictly increasing price ladder. Ended or unavailable items are skipped without inventing a purchase.

Only orders belonging to the connected seller can confirm a purchase. Third-party listings can be displayed, but their purchases cannot automatically advance this seller's queue. Buyers open the displayed link/QR and buy on eBay. Buying from within SSN and creating new listings are not implemented.

Sandbox endpoints, OAuth, listing URLs and stored seller connections are separated from production. Sandbox labels appear in the connection status, overlay and purchase message. Sandbox purchase events still run configured purchase actions; use an isolated SSN test session. Production keys/access and a production seller consent flow remain separate requirements.

## Expansion path

| Feature | Existing support / next work |
| --- | --- |
| Cheapest-first stream sale | Already implemented; verify with a sandbox seller, two fixed-price listings and a paid test order. |
| Product selection | Hosts currently paste listing links. Add Browse search with a picker and explicit distinction between seller sales and third-party recommendations. |
| Viewer product selection | Add a public, read-only product gallery sharing the overlay's safe item fields; checkout stays on eBay. |
| Selling from SSN | Add a separate seller listing workflow with inventory-write consent, location, category/aspects, stock and business policies; preview before publishing. |
| Inventory Mapping | The linked API generates listing previews from product inputs. Start a preview task, query its status/results, let the seller review, then create/publish through a listing API. It does not report sales or perform checkout. |
| Embedded checkout / affiliate revenue | Review eBay Buy API and Partner Network eligibility first. Sandbox credentials alone do not establish production approval. |

## Validation

`npm test` covers endpoint selection, environment separation, encrypted tokens, sales pagination and privacy. From the repository root, `node tests/monetization.test.cjs` covers queue selection and environment mismatch. `node tests/ebay-ssapp.e2e.cjs` uses the actual SSApp runtime and synthetic sandbox responses, including QR links, cheapest-first advancement and purchase alerts. Set `SSN_TEST_EBAY_ENVIRONMENT=production` to exercise production fixture URLs. Seller consent was completed on September 7, 2026, using the developer portal with public-data, inventory, account, fulfillment-readonly and inventory-mapping scopes. Direct sandbox Inventory, Account and Fulfillment API requests succeeded. The seller token is stored outside Git in the private secrets directory and expires at 17:00 UTC on September 7; this is a temporary test token, not the deployed SSN connection. Account privileges report sellerRegistrationCompleted=false, but cross-checks on September 7 show Trading GetUser Status=Confirmed, FeedbackScore=500, SellerInfo.GoodStanding=true and CheckoutEnabled=true; Account payments-program reports OPTED_IN and onboarding reports ONBOARDED for EBAY_US/EBAY_PAYMENTS. There is no outstanding payments onboarding step returned. Treat the registration flag as inconsistent sandbox data, not proof that another registration form is required. VerifyAddFixedPriceItem subsequently returned Ack=Success with no errors or warnings on September 7 for the synthetic USD 5 notebook in tests/ebay-sandbox-notebook.xml. This validates the seller and listing definition without publishing a listing. The legacy ValidateTestUserRegistration call was decommissioned January 30, 2025; do not follow older knowledge-base advice to use it. No paid order has been validated yet. The sandbox listing UI failed while creating a draft, and Seller Hub returned an error.

References: [OAuth setup](https://developer.ebay.com/support/knowledge-base/5075), [listing creation](https://developer.ebay.com/develop/guides/sell/listing-creation), [Inventory Mapping](https://developer.ebay.com/develop/api/sell/inventory_mapping), [Buy API requirements](https://developer.ebay.com/api-docs/buy/buy-requirements.html).

## September 7 implementation update

The Sandbox/Production selector is implemented in the monetization popup. Switching disables the showcase, preserves separate private credentials/product lists/sale state, and restores them after restart. Sandbox service endpoints now use `/v1/ebay-sandbox/*`; production retains `/v1/ebay/*`. The changes are local and not deployed.

Three single-quantity listings were published successfully with no warnings and verified through Browse API (HTTP 200):

| USD price | Sandbox item ID |
| --- | --- |
| 5 | 110590594057 |
| 10 | 110590594059 |
| 20 | 110590594060 |

The buyer committed to purchase the USD 5 item (transaction 10000012446210). Checkout failed twice while saving the synthetic shipping address. Payment is not confirmed; do not mark this item as a paid purchase or claim a complete SSN end-to-end pass.

Deployment package: `deploy/ssn-ebay-sandbox.service` runs a separate loopback service on port 3080 with its own state directory. Install sandbox credentials only in `/etc/ssn-ebay-sandbox.env` with restricted permissions; do not override the separate database, port or environment in that file. On the confirmed existing Apache API host, proxy only this prefix inside its existing HTTPS virtual host:

```apache
ProxyPass /v1/ebay-sandbox/ http://127.0.0.1:3080/v1/ebay-sandbox/
ProxyPassReverse /v1/ebay-sandbox/ http://127.0.0.1:3080/v1/ebay-sandbox/
```

Confirm port 3080 is free, validate Apache configuration, and verify the callback before enabling the service publicly. The existing API host was confirmed on September 7. Its connection details are stored privately in `%USERPROFILE%\.ssn-secrets\ssn-api-server.json`. No deployment or Cloudflare changes have been performed.

Local validation after the selector/route changes: monetization unit tests 16/16, server tests 9/9, popup search checks, Electron popup checks, and the actual SSApp eBay fixture flow all passed. The SSApp screenshot was inspected. These fixture checks verify automatic advancement and alerts, but do not replace the still-blocked paid sandbox checkout test.

## Deployment completed September 7

The confirmed existing API VPS now runs the sandbox code independently at `/opt/ssn-ebay-sandbox`, under `ssn-ebay-sandbox.service`, listening only on 127.0.0.1:3080. Its credentials are root-owned mode 600 in `/etc/ssn-ebay-sandbox.env`, and its database is under its separate systemd state directory. Temporary credential-transfer copies were removed.

All nine server tests passed on the VPS. Apache configuration validation passed before reload. Public HTTPS `/v1/ebay-sandbox/status` returns environment=sandbox and connected=false for a fresh reader; `/v1/ebay-sandbox/callback` returns the expected 400 for missing OAuth state. Existing monetization health remains OK, and both services are active. No Cloudflare changes were made. The local frontend changes are not pushed; seller OAuth must next be completed through the running SSN client before the full end-to-end test.

The connection address, username and private-key file reference are saved outside Git in `%USERPROFILE%\.ssn-secrets\ssn-api-server.json` with restricted Windows permissions.
