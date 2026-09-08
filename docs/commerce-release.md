# Commerce release checks

Product promotion, public viewer links, and payment alerts are separate features. Show/Next/Hide/Resume select products in SSN; OBS controls whether a scene or Browser Source is visible. Hiding promotional cards does not stop activity alerts.

## Website releases

The Pages workflow must run `scripts/build-public-shop.py` after copying the main and beta sites. It publishes `/shop.html` and its own content-versioned dependencies under `/public-shop-assets/`. Keep this step when promoting the deployment workflow to stable; an older stable-only workflow can otherwise remove the public viewer. This checklist does not change the stable branch.

Before a stable release:

1. Confirm the release workflow includes the public-shop builder and ships `translations/*.json`, `translations/page-i18n.js`, and the shared monetization assets it selects.
2. Build into a temporary output directory with `python scripts/build-public-shop.py --source . --output <temporary-directory>`.
3. Check that `/shop.html` and each referenced asset return 200 after deployment. Open a published viewer link, change the selected product, and confirm the viewer updates. Use an isolated catalog and unpublish it afterward.
4. Keep the existing `/v1/shop` receiver, database, and encryption key intact. Frontend releases do not require reinstalling the API service.

## Stream Deck

The separate `ssn-streamdeck` repository publishes downloadable GitHub releases through its existing workflow. Version 0.2.3 adds saved-product selection, Show/Next/Hide/Resume and localized state feedback. The workflow tests Windows, macOS and Linux, checks all eight plugin languages, validates the bundle, and packages the Windows/macOS native runtimes. Marketplace listing copy lives in that repository; a GitHub release is not an Elgato Marketplace approval.

## Shopify without a merchant account

Run `node --test monetization-server/tests/shopify-relay.test.js` and `node tests/shopify-ssapp.e2e.cjs`. They use isolated signed fixtures and the actual SSApp runtime. Coverage includes HTTP signature verification, Unicode, currency precision, privacy, duplicate suppression, test-order isolation, offline recovery, product import, and disconnect.

These tests passed on September 7, 2026. They do not confirm a merchant's webhook subscription, checkout, or actual Shopify retry delivery. Keep the production Shopify receiver disabled until a merchant can complete that check. Manual product links and promotional overlays remain usable. See the [Shopify guide](shopify-setup.html).

## Translation checks

The commerce labels cover the eleven supported non-English SSN locales. Actual SSApp checks exercise the translated OBS control dock and public viewer at narrow widths, including Arabic direction, and verify the existing controls and QR behavior. Run `node tests/product-controls-ssapp.e2e.cjs` and `node tests/all-translations.test.js` after changing those surfaces. Human language review remains welcome.

## September 8, 2026 validation and polish audit

Tests used the beta checkout, isolated SSApp profiles, synthetic payments/products and local receivers. Native OBS used a separate portable profile. No real payment was made, no provider account was modified, and no Cloudflare action was performed.

| Check | Result |
| --- | --- |
| `node --test tests/monetization.test.cjs tests/commerce-events.test.cjs monetization-server/tests/*.test.js` | 43 passed. Includes wishlist import/manual advancement/undo, provider signatures, privacy, currency, deduplication, offline recovery, public catalog and Event Flow routing. |
| `node tests/ebay-ssapp.e2e.cjs` | Passed twice: sandbox fixtures and production-URL fixtures (`SSN_TEST_EBAY_ENVIRONMENT=production`). Covers connection UI, callback, queue modes, auction price/countdown, normal 60-second paid-sale polling, advancement, alerts, QR, mobile, disconnect. Neither run calls real eBay APIs. |
| `node tests/monetization-ssapp.e2e.cjs` | Throne passed: signed delivery through the actual app, gift/contribution ranks, duplicate rejection, QR, reset and disable. |
| `node tests/ninjabacker-ssapp.e2e.cjs` | Passed real local NinjaBacker sender to SSApp: synthetic Stripe delivery, anonymity, JPY, test isolation, reliable delivery, restart recovery and switching back to live feed. |
| `node tests/commerce-ssapp.e2e.cjs` | Passed Fourthwall fixture import, Fourthwall/Ko-fi/Buy Me a Coffee setup links, product persistence, QR, source filtering, independent alerts and preview. |
| `node tests/shopify-ssapp.e2e.cjs` | Passed signed local orders, privacy, test isolation, restart recovery, product import, persistence and disconnect. |
| `node tests/product-controls-ssapp.e2e.cjs` | Passed popup controls, Event Flow, remote API, OBS control page, public viewer publishing/unpublishing, QR and translated narrow layouts. Screenshot regeneration mode was not enabled. |
| `node scripts/commerce-obs-smoke.cjs` | Passed actual OBS dock/Browser Source, Show/Next/Hide/Resume, scene unload/reload and reconnect. Fresh dock/overlay screenshots reviewed. |
| `node tests/popup-search.test.js` | Passed. |
| `node tests/all-translations.test.js` | Failed on missing `innerHTML.nc-audience-guide` in `en-uk.json`; unrelated to commerce. The suite stops at this first failure. |

Test maintenance completed: the eBay test now opens the overlay-options subsection before using its controls; NinjaBacker popup screenshots use native Electron capture because Playwright capture stalled on the hidden main window; OBS cleanup stops the isolated process before waiting for its HTTP connections to close. These changes do not alter application behavior.

### Polish implemented after the audit

- Unrelated provider actions now merge refreshed saved state with local edits. Unsaved product rows, unfinished product fields and edits made while Save is pending remain intact. Explicit eBay disconnect/environment actions still disable that source; Shopify disconnect clears its own setup.
- Actions restore their prior availability and then apply the refreshed state. Copy/remove/disconnect buttons no longer become temporarily enabled without a link or connection; unpublishing also leaves Remove disabled.
- The existing Save setup button shows the existing translated Unsaved label while saved settings differ. Its status line is beside Save, and provider feedback uses existing nearby status areas. Action feedback survives the next polling refresh. No new settings or panels were added.
- The originally reported missing audience guide label was filled using each locale's existing setup-guide wording. The broad translation suite still stops on pre-existing audience strings (now `en-uk.json: innerHTML.nc-audience-step-connect`); other locales also have existing missing keys. This is not a commerce regression.

`node tests/monetization-drafts-ssapp.e2e.cjs` passes in the actual SSApp runtime with an isolated profile and external networking blocked. It checks immediate button states, draft preservation, partial product fields, delayed save replies, dirty-label clearing and action-error visibility across polling. Optional `SSN_GUIDE_SCREENSHOTS=1` captures light/dark setup images to the test's temporary profile and briefly shows its isolated window. Fresh light/dark screenshots were inspected for readable feedback and button labels.

After the implementation, all 27 monetization/event-routing checks and popup-search checks passed. The actual SSApp commerce, Shopify, product-controls and eBay suites passed again. No deployment or push was performed.

Remaining limits: these passes do not validate a paid eBay sandbox checkout or production seller consent/order, a real Throne gift, a merchant's Shopify webhook subscription/retries, or live Fourthwall/Ko-fi/Buy Me a Coffee delivery. The Amazon wishlist received core/import coverage, not a fresh Amazon-account browser test. The real Stream Deck host and Chrome extension were not exercised in this run; SSApp's remote command routing was.
