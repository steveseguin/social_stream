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
