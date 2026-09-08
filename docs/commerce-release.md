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

The initial requested push completed as `ba18e057` on beta. The extended audit below followed that push. Tests used isolated SSApp profiles, synthetic payments/products, local receivers and a separate portable OBS profile. No real payment, live chat send, physical printing, provider-account change or Cloudflare action was performed.

### Reproducible coverage

- `node --test tests/monetization.test.cjs tests/monetization-providers.test.cjs tests/commerce-events.test.cjs tests/commerce-guide-links.test.cjs tests/public-shop-build.test.cjs monetization-server/tests/*.test.js`: 77 passed. Covers signatures, malformed inputs, currency, privacy, deduplication, offline recovery, public catalogs, Event Flow callbacks, guide links and packaged public viewer dependencies.
- Actual SSApp suites: `monetization-ssapp.e2e.cjs` (Throne), `ebay-ssapp.e2e.cjs`, `ninjabacker-ssapp.e2e.cjs`, `commerce-ssapp.e2e.cjs`, `shopify-ssapp.e2e.cjs`, `product-controls-ssapp.e2e.cjs`, and `monetization-drafts-ssapp.e2e.cjs` under `tests/`. These exercise isolated provider fixtures, popup configuration, persistence, normal paid-sale polling, duplicate suppression, QR targets, disable/disconnect, remote controls, callbacks, draft preservation and public publishing/unpublishing.
- `node tests/commerce-overlay-audit-ssapp.e2e.cjs`: 189 checks passed; actual rendered overlays at 1920/390/320 widths and scales 0.5/1/2, five provider modes, showcase/card/alerts combinations, independently decoded QR images (including the full public catalog URL), private/test suppression, rich-text handling, malformed snapshots and post-GC memory measurements. Requires local Python OpenCV for independent QR decoding. Writes screenshots/results to its temporary profile. The final 10,000 malformed-snapshot run completed in 837 ms with 49,980 bytes additional retained JS heap after GC; this is a bounded browser test, not a production capacity guarantee.
- `node tests/monetization-locales-ssapp.e2e.cjs`: 88 provider panels and 110 translated overlay layouts passed, with preserved controls/drafts, dynamic labels and narrow light/dark layouts. Arabic, German and Chinese captures were visually reviewed. `SSN_GUIDE_SCREENSHOTS=1` captures optional visual artifacts.
- `node scripts/commerce-obs-smoke.cjs`: native OBS Browser Source and control dock, selection, scene unload/reload and reconnect.
- `node tests/all-translations.test.js` and `node tests/popup-search.test.js`: all 14 locale files and popup search pass.
- Stream Deck: 43 registry/inspector/action tests pass in the separate plugin checkout; command callbacks and selected/hidden/scheduled state match the SSN API. The extension manifest exposes packaged monetization assets, and the public viewer builder includes versioned shared dependencies and locales.
- Receiver performance and repeatable fuzz/soak commands, measurements and limitations are in [the receiver validation report](../monetization-server/VALIDATION-2026-09-08.md). The bounded soak passed 20,000 signed deliveries and 30,084 localhost HTTP operations, including restart recovery and lease/queue boundaries. No runaway retained heap was observed; this was not an overnight production soak.

These SSApp/OBS checks are opt-in, not mandatory popup or push prerequisites. They use the application's runtime; they do not start real source channels.

### Fixes and workflow polish

- Preserve unfinished fields and in-flight edits across provider actions and saves; restore button availability immediately and keep action feedback visible across polling.
- Fit long overlay cards and requested large scales inside small Browser Sources. Clamp lengthy display text, retain complete accessible text, and avoid rewriting unchanged text every 250 ms.
- Keep live audience overlays free of connection/setup diagnostics; reject private/test activity and render rich chat as plain readable text.
- Validate malformed prices, currencies, provider payloads and event names without inventing free products or sales. Bound retained alert IDs while allowing canonical long-note tip IDs.
- Keep public viewer keyboard focus through refresh, respond to system theme changes, use RTL alignment, and retain the last good catalog on malformed updates.
- Await commerce-control callbacks in Event Flow. A failed control stops dependent actions while preserving delivery of the original paid event. Success means SSN selected/hidden/scheduled state, not OBS visibility. Thermal callbacks report job submission, not printed paper.
- Add creation-time indexes for receiver retention cleanup; existing databases gain them during initialization. This server change takes effect only when the updated receiver is deployed.
- Complete popup/overlay translations and existing missing audience labels across all 14 locales. Reuse the current controls and language infrastructure; no new configuration panels.
- Document sales, auctions, manual re-gifting, receiving gifts, passive tipping and previews using existing workflows, including sounds, Event Flow and thermal labels. Manual selection does not synthesize a purchase. Avoid duplicate notification paths and preserve provider delivery IDs for external reward deduplication.

### Limits

Local fixture passes do not validate a paid eBay checkout or production seller consent/order, a real Throne gift, merchant Shopify webhook subscription/retry delivery, or live Fourthwall/Ko-fi/Buy Me a Coffee delivery. Keep the production Shopify receiver disabled until merchant validation; production eBay needs its separately configured service. Amazon has import/core coverage, not a fresh account-browser purchase test. Manual wishlist confirmation and re-gifting do not automate checkout or fulfillment.

Physical receipt output and audible playback were not exercised; dispatch, templates and callback contracts were tested. SSApp remote command routing was exercised; real Stream Deck hardware/host and an installed Chrome extension were not. Guide link checks validate local targets, not external account availability. Human review of translated wording remains useful. No deployment was performed.
