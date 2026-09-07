# Monetization integration review

Reviewed September 7, 2026. This is a prioritization proposal, not a list of newly implemented integrations. Ranking reflects creator relevance, existing SSN coverage, and integration effort; it is not a market-share ranking. Provider-reported creator counts are not active-user counts.

## Recommended order

| Priority | Source | Why it fits | Existing SSN coverage and next step |
| --- | --- | --- | --- |
| 1 | Fourthwall | The closest fit for creator merchandise, product gifting, memberships, and support in one platform. Fourthwall reports over 150,000 creators. | Already has a webhook handler in `background.js`. Expand and classify individual event types; it currently puts order totals in `hasDonation`. Preserve existing user behavior through an explicit migration rather than silently removing that field. |
| 2 | Ko-fi | Broad creator appeal: tips, memberships, commissions, and small shops. Ko-fi reports over one million creators. | Already has a webhook handler, but it accepts only public `Donation` events. Add membership and commerce handling. Respect private-payment settings; do not start publishing previously excluded private messages. |
| 3 | Buy Me a Coffee | Particularly relevant to this request: its current webhook catalog includes wishlist payments, shop purchases, commissions, recurring support, and memberships. | Existing handler recognizes donation creation and membership start. Expand coverage and distinguish actual amounts from membership labels; the current membership path places a tier name in `hasDonation`. |
| 4 | Shopify | A useful new source for creators with established independent merchandise stores. | No dedicated paid-order integration found. Start with verified paid orders and `purchase` alerts. Keep order totals separate from creator donations and strip private customer data. More setup effort than expanding the existing creator platforms. |
| 5 | Tiltify | Adds charity-stream donations and campaign progress, a distinct use case from creator income. | No dedicated integration found. Its official support links a v5 API for custom overlays. Validate the current authorization and delivery options before choosing transport. Charity totals need an explicit distinction from creator earnings. |
| 6 | Patreon | Useful for creators whose recurring supporters are outside the streaming platform. | `sources/patreon.js` captures page chat, not a paid membership lifecycle. Add an authorized API/webhook integration. Membership changes are not automatically new payments; verify charge state and avoid counting repeated updates. |

Evidence and integration references:

- Fourthwall: [creator examples and reported adoption](https://fourthwall.com/creator-examples/all-examples), [commerce and stream integrations](https://fourthwall.com/features), [order payload](https://docs.fourthwall.com/api-reference/order-events/order-placed), [gifting guide](https://docs.fourthwall.com/webhooks/gifting-guide). Gifting documentation is marked beta; do not assume it has the same lifecycle as a normal order.
- Ko-fi: [platform scope and reported adoption](https://help.ko-fi.com/hc/en-us/articles/115004000994-What-is-Ko-fi), [webhook capabilities](https://help.ko-fi.com/hc/en-us/articles/360004162298-Does-Ko-fi-have-an-API-or-webhook). Its webhook API reports payments, not membership cancellation.
- Buy Me a Coffee: [current webhook catalog, signatures, retries, and test flags](https://help.buymeacoffee.com/en/articles/15743173-how-to-setup-and-use-buy-me-a-coffee-webhooks). This July 2026 guide documents `wishlist_payment.created`, `extra_purchase.created`, and commission events as well as support and membership events. Inspect their full schemas before assigning SSN semantics; funding is not necessarily completion.
- Shopify: [webhook topics](https://shopify.dev/docs/api/admin-rest/latest/resources/webhook), [paid-order semantics](https://help.shopify.com/en/manual/shopify-flow/reference/triggers/order-paid). Use current supported app APIs during implementation; the REST reference here confirms event semantics, not a recommendation to build a new REST app.
- Tiltify: [official custom-overlay API guidance](https://info.tiltify.com/support/solutions/articles/43000008129-create-your-own-overlay), [existing stream-tool integrations](https://info.tiltify.com/support/solutions/folders/43000050938).
- Patreon: [developer platform](https://www.patreon.com/portal), [API and webhook reference](https://docs.patreon.com/).

Streamlabs and StreamElements already have source integrations. Treat improvements there as reliability and coverage work, not new monetization platforms. StreamElements documents a [completed-tip topic](https://docs.streamelements.com/websockets/topics/channel-tips). Avoid subscribing to both a platform's native integration and an aggregator without a deliberate duplicate policy.

## Shared design requirements

Keep `hasDonation` and `donoValue` for confirmed paid support. Preserve the agreed `gift`, `giftcontribution`, `giftfunded`, and `purchase` meanings in the [event reference](event-reference.html#commerce-events). New product-sale integrations should not silently become donation totals. Existing providers that already use `hasDonation` for commerce require a compatibility decision before migration.

Use provider delivery IDs for retries, distinguish test events, and retain public item details in existing display fields plus `meta.commerce`. Do not expose buyer emails, addresses, checkout secrets, or private order links. Reuse SSN's existing webhook and Event Flow infrastructure. A new provider needs documented setup, signature verification, reconnect/deduplication behavior, and tests through the extension/Electron adapters.

## NinjaBacker: supported now

NinjaBacker is a free tipping service from the creators of Social Stream Ninja and VDO.Ninja, with 0% platform commission. Creators connect their own Stripe account; tips are direct charges on that account. Stripe processing fees still apply. This describes the current service, not a promise that provider terms can never change. [NinjaBacker](https://ninjabacker.com/)

Local service review: `C:/Users/steve/Code/vdoninja/tip-server/server.js` defaults `PLATFORM_FEE_PERCENT` to zero and creates PaymentIntents with the connected account's `stripeAccount`. `payment-utils.js` omits `application_fee_amount` for zero fees. The dashboard identifies the shared creators and free platform fee. A read-only check of the live `/v1/config` endpoint returned `platformFeePercent: 0`, and `/v1/health` returned `status: ok` on the review date.

SSN's setup supports the public username plus private Tip ID, account matching, live SSE, and optional signed queued delivery. Real tips preserve `hasDonation`, `donoValue`, anonymity, and currency; dashboard tests use a preview event without paid rewards. USD, EUR, GBP, CAD, AUD, and JPY are supported by the service. Live delivery does not replay missed tips; the signed receiver queues for up to seven days. Refund/dispute adjustments in NinjaBacker's own dashboard are not a downstream reversal feed.

The SSN setup panel, feature listing, and [monetization guide](monetization.html#ninjabacker) now explain the free service, 0% platform commission, Stripe connection, and shared creators. No live payment or deployment is needed for these documentation changes.

Validation completed: 18 SSN normalization/receiver tests, six NinjaBacker payment utility tests, popup search checks, the Electron popup suite, and the actual NinjaBacker-to-SSApp integration test passed. The integration test uses temporary databases and an isolated app profile; it verifies live delivery, signed queued delivery, server restart recovery, anonymity, JPY amounts, duplicate suppression, test isolation, and disabling delivery without real payments. Two existing tests were updated for the current collapsible setup panels and custom switches. No service deployment or git push was performed.

## Implemented follow-up

The existing Ko-fi, Buy Me a Coffee and Fourthwall adapters now normalize additional membership, product and gift events in the shared monetization core, retaining their existing receiver and destination paths. Fourthwall ordinary order donation values remain compatible; orders using gift cards no longer add prepaid value again. New test and private-note safeguards are in place. Buy Me a Coffee membership names are membership fields rather than donation amounts. Unsupported lifecycle/refund events are not payment confirmations.

The existing Monetization menu now offers a manual public product/link catalog, QR codes, rotation or pinning, and separate showcase, support-card and activity views. These use the existing overlay page, popup controls, saved settings and translation catalogs. No store connection is required for promotion; automatic alerts still require a configured provider. Shopify, Tiltify and Patreon payment connections remain later work, while their public product/support links can be promoted now. See the setup guide and event reference for the complete implemented contract.


## Creator setup and product import follow-up

The Monetization panel now links to the illustrated `creator-store-setup.html` guide. Provider selection generates the existing private session URL, reports the shared receiver connection and last normalized event in this app session, and opens a sample-only preview with no session connection. No new receiver deployment or signing-secret claims are introduced.

Fourthwall import uses its public Storefront API to load one product into the existing editor for review. Tokens are transient; imported fields remain the existing manual catalog shape. Hidden/unavailable products are rejected, variant and bundle prices are left blank when ambiguous, and no purchase event is inferred. This is an on-demand snapshot, not ongoing inventory synchronization. Shopify, Tiltify and Patreon payment connections remain the next integration phase.
