# eBay production setup — September 13, 2026

Production application setup is enabled on eBay and the SSN API. Real seller consent and order access still need validation.

## Completed

- Created SSN's first production keyset in the existing developer account. Stored credentials outside Git in `%USERPROFILE%\.ssn-secrets\ebay-production.env`, restricted to the current Windows account.
- Implemented and deployed the account-deletion receiver at `https://api.socialstream.ninja/v1/ebay/account-deletion`. eBay accepted its challenge and its signed **Send Test Notification** succeeded. The first signed test exposed eBay's single-line PEM public-key format; the handler now normalizes that format and the regression fixture covers it.
- Registered the existing developer primary-contact email for endpoint outage alerts. No account-deletion exemption was requested.
- Enabled the production keyset, confirmed application OAuth HTTP 200, and read one existing public listing through production Browse search (HTTP 200). No listing or purchase was created.
- Configured an OAuth-enabled production RuName, SSN display title, `https://socialstream.ninja/privacy.html`, and accepted/declined callbacks at `https://api.socialstream.ninja/v1/ebay/callback`.
- Restricted the redirect's selected scopes to `sell.fulfillment.readonly` and `commerce.identity.readonly`; both are assigned to this production keyset. The runtime authorization URL uses those same two scopes. Identity access permits matching seller connections to deletion notifications; extra profile/contact fields are discarded.
- Installed root-owned mode-600 `/etc/ssn-monetization.env` on the existing API VPS. eBay uses its own `/var/lib/ssn-monetization/ebay-production.db`; existing providers' databases and encryption keys were retained. The sandbox deployment was unchanged. No Apache or Cloudflare changes were needed.
- Public `/v1/ebay/status` now returns HTTP 200 with `environment=production`. A new isolated test reader correctly returns `connected=false`; `/connect` returns HTTP 200 and opens the real eBay seller sign-in page.

## Validation and deployment evidence

The local server suite passed before deployment. All 29 server tests passed on the staged VPS combination (27 backend tests plus two browser-normalizer tests whose test-only assets were staged separately). The final PEM normalization passed the targeted two-test suite locally and on the VPS, followed by eBay's actual signed notification test.

Tests cover challenge validation, setup without a RuName, rejected unsigned/forged requests, fixed eBay key lookup, one-hour key caching, removing every connection belonging to the matching seller while retaining another seller, duplicate deliveries, and cancellation of a sales response that was in flight during deletion. Existing sandbox, privacy, pagination, refresh and other-provider tests passed. The eBay parser and deletion routes are encapsulated in the eBay plugin.

Code backups are under `/root/ssn-backups/ebay-production-20260913`. The staged candidate is `/tmp/ssn-ebay-production-20260913/candidate`. Only `server.js`, `ebay-showcase.js`, and new `ebay-deletion.js` were installed into `/opt/ssn-monetization`. Existing dependencies were retained. Both systemd services remained active; public monetization health and sandbox status passed after restart.

## Remaining seller validation

An isolated production test reader and authorization URL are stored privately in `%USERPROFILE%\.ssn-secrets\ebay-production-connect.json`. Its reader is separate from an SSN client profile. Chrome was left at the real seller login, with **Stay signed in** unchecked. The OAuth state expires after ten minutes; initiate a fresh `/connect` for the same private reader if it expires. Do not copy its reader, state or authorization code into logs, Git or chat.

After Steve signs in and grants consent, verify the callback, connected status, Identity lookup, token refresh, a public listing read through SSN, and read-only Fulfillment access. No real seller login, renewable seller authorization, real order response or paid-order/overlay advancement has been confirmed by this setup. The earlier SSApp API-to-overlay test used fixtures. Production configuration alone does not replace those checks.

The API showcase still requests the US Browse marketplace. Regional eBay Live browser-capture support is separate and does not establish regional API parity.
