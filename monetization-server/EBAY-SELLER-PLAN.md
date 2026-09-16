# eBay North Star: turn a stream into a shoppable show

Updated September 7, 2026. Proposed capabilities below are the delivery plan, not claims of current support.

## North Star

A seller connects eBay, selects products for a show, and starts streaming. Viewers browse and buy on eBay while Social Stream Ninja presents products, celebrates verified sales, and automatically moves the show forward.

The signature experience is the **price ladder**: start with an inexpensive item, then reveal the next more expensive item after a confirmed purchase. Make it easy to run without a dedicated producer, with manual controls when the host wants them.

Our primary success measure is **weekly seller-led shows with at least one verified purchase of a selected show item**. This measures association with the collection and show window, not proof that the stream caused the sale. Supporting measures: time to first featured product, time to first sale, sellers returning for another show, and failed or duplicate sale updates. Establish a baseline before setting adoption targets; use minimal aggregate data without buyer identities.

## The experience

1. **Connect:** select Sandbox or Production, authorize the seller, and see connection health and available capabilities.
2. **Prepare:** import listings, filter and select products, save a named show collection, and resolve missing stock or incompatible currencies.
3. **Run:** choose manual, rotating, cheapest-first or price-ladder presentation. Pin, skip, pause and resume without losing progress.
4. **Shop:** viewers scan a QR code or open the show gallery, select a product and complete checkout on eBay.
5. **React:** recognize a paid order once, show a privacy-safe alert, update progress and advance according to the host's rules.
6. **Reuse:** review the show and its order changes, then reuse the collection next time.

## Confirmed starting point

- Private sandbox credentials and both test accounts exist. Seller OAuth succeeded through the developer portal; Inventory, Account and Fulfillment API reads worked.
- The synthetic USD 5 notebook passed `VerifyAddFixedPriceItem` with `Ack=Success`, with no errors or warnings. Three sandbox listings have now been published and read through Browse API: USD 5 (110590594057), USD 10 (110590594059) and USD 20 (110590594060). The buyer committed to the USD 5 order, but checkout failed twice when saving its test address; payment remains unconfirmed.
- Account registration status is inconsistent across sandbox APIs. Trading confirms the user and payments reports onboarded; successful listing validation supports continuing, but publishing remains unverified.
- Existing code supports a 20-link showcase, first/cheapest/cycle selection, featured card/QR, paid-order polling and alerts. A first paid purchase completes an entry even when the listing has more stock.
- Backend sandbox support and synthetic SSApp tests exist. The local client now selects `/v1/ebay/` or `/v1/ebay-sandbox/` and preserves separate environment credentials/products across restart. The matching sandbox service and callback are implemented locally but not deployed. The temporary developer token is not a renewable SSN connection.
- Sandbox listing and Seller Hub pages failed. Use actual API and transaction results as acceptance evidence.

See [sandbox setup and validation](EBAY-SANDBOX.md) for operational details.

## Delivery milestones

| Milestone | Deliver | Acceptance gate |
| --- | --- | --- |
| **1. Prove the sandbox sale** | Isolated service/database, environment selector, SSN OAuth callback and token refresh; USD 5/10/20 single-quantity listings | Connect from SSN, add products unsorted, buy USD 5 with the sandbox buyer, receive one alert and display USD 10; restart SSApp and preserve progress. Real sandbox data must pass, not only fixtures. |
| **2. Make it usable for sellers** | Listing import, search/filter/bulk selection, saved collections, stock visibility, manual controls and first-sale/quantity/sellout advancement | Prepare and run a show without pasting URLs. Verify website-created listing coverage as well as API inventory. Stale stock and errors are visible. |
| **3. Make it useful to viewers** | Mobile show gallery, item and gallery QR links, featured/grid/progress overlays, moderator controls and optional announcements | Viewers select a product and reach its correct eBay page; public access exposes no seller credentials or buyer details. |
| **4. Create listings inside SSN** | Draft templates, photos, category/aspects, condition, quantity, location and seller policies; optional Inventory Mapping previews | Seller reviews and explicitly publishes a complete draft. Errors remain editable; retries cannot silently duplicate listings. |
| **5. Qualify a production pilot** | Production credentials and API eligibility, separate seller consent, monitoring, summaries and order lifecycle handling | A small consenting seller cohort completes repeatable shows with recovery, no duplicate alerts, no environment crossover and clear support instructions. |

Order lifecycle rules and failure recovery belong in the earliest tests; richer reporting can follow. Production is a separate release gate.

## Seller and streamer options

| Area | Planned options |
| --- | --- |
| Product library | Seller import; keyword, SKU, category, currency, price, stock and listing-type filters; supported variants; bulk add/refresh |
| Show collections | Name, save, duplicate, reorder, pin, skip, undo manual skip, pause/resume, end show and start a fresh run |
| Presentation | Manual item, timed rotation, cheapest available, fixed-price ladder, auction countdown/ending-soon views |
| Advancement | First paid unit, configured paid-unit target, sellout or host confirmation; visible progress and optional reveal delay |
| Overlays | Featured card, grid, upcoming queue, ladder stage, sales progress and alerts; image/title/price/shipping note/QR controls |
| Viewer shopping | Mobile gallery, current/upcoming products, selection, sold-out states and direct eBay links |
| Moderation | Authorized pin/skip/pause commands, current-item/shop links, rate limits and optional announcements |
| Sales activity | Paid units, per-currency gross item sales, order changes, recovery and export; distinguish sales from profit or payouts |
| Listing tools | Templates, category requirements, images, condition, variants, stock, seller policies, preview and explicit publish |
| Recommendations | Separate mode for other sellers' items; approved affiliate links if eligible; no claim to track another seller's purchases |

## Price-ladder rules

- Start with fixed-price items in one currency. At show start, snapshot ascending item-price order; use collection order to break ties. Label shipping and taxes separately.
- Flag live price changes. Pause automatic advancement if a change breaks the increasing-price promise; let the host rebuild the remaining ladder. Auctions use their own mode.
- Count deduplicated paid order lines for included items after show activation. Match listing and variant/SKU where available. Clicks, unpaid orders and stock decreases never count as payment.
- Count purchases of upcoming products too. Skip stages whose purchase target is already met, showing why each completed or became unavailable.
- First-sale mode completes after one paid unit. Quantity mode uses its configured target. Sellout mode additionally requires confirmed unavailable inventory; a failed refresh never means sellout.
- Refunds/cancellations update activity and adjusted totals. Default to keeping completed stages completed, with an explicit host reset; do not unexpectedly rewind the on-air show.
- Persist the show, progress and sale cursor. Use overlapping order reads and stable order-line deduplication to prevent replay after retries/restarts. A new show gets a fresh baseline.
- Establish one authoritative show controller per seller connection before allowing simultaneous hosts to advance the same show.

## Engineering and release boundaries

- Extend the existing monetization server and shared scripts. Keep Chrome 80 compatibility and extension/Electron parity; preserve eBay Live capture. Package/deploy shared assets with their consumers.
- Separate environment routes, databases, credentials, collections and cursors. Keep secrets server-side and request additional seller permissions only for implemented features.
- Verify complete seller listing coverage; do not assume Inventory API records include listings created on eBay's website or through other tools.
- Keep checkout on eBay initially. Inventory Mapping generates previews; publishing still requires a listing workflow. Embedded checkout, automated buying/bidding and affiliate revenue need separate investigation and eligibility.
- Respect API limits with caching, bounded pagination, backoff and token refresh. Polling is currently about once a minute. Proposed healthy-service target: update SSN within two minutes after an order becomes visible as paid through eBay's API; do not promise instantaneous reactions.
- Public galleries receive approved product fields only. Buyer names, addresses and payment details stay out of overlays/chat. A public shopping link must not grant moderator control.
- Update `docs/event-reference.html` for changed event shapes. Test failures with fixtures, then actual sandbox transactions in SSApp and the extension. Never use unrelated live channels.
- Test unpaid orders, multiple quantities, out-of-order updates, refunds/cancellations, expired listings, expired tokens, rate limits, API outages and restart recovery before production.
- This plan grants no deployment or Cloudflare authorization. The proposed existing-VPS route requires no Cloudflare access; any specific Cloudflare action needs Steve's explicit permission.

## Immediate next work

1. Publish three synthetic sandbox products through the API, record their IDs, and verify product reads and buyer checkout.
2. Locate the existing SSN API VPS connection; do not substitute another project's server.
3. Implement/test the sandbox route and environment selector locally, then deploy to the confirmed host when authorized.
4. Complete renewable seller OAuth through SSN and run the USD 5 to USD 10 purchase/advancement test.
5. Build seller import and saved collections once the sale path is proven, or while an external sandbox/deployment blocker prevents validation.

The first release succeeds when a seller can repeat this loop without developer assistance.

## References

- [OAuth configuration](https://developer.ebay.com/develop/guides-v2/authorization#get-oauth-access-tokens)
- [Listing creation](https://developer.ebay.com/develop/guides/sell/listing-creation)
- [Listing validation](https://developer.ebay.com/devzone/xml/docs/reference/ebay/VerifyAddFixedPriceItem.html)
- [Inventory Mapping](https://developer.ebay.com/develop/api/sell/inventory_mapping)
- [Inventory API](https://developer.ebay.com/develop/api/sell/inventory_api)
- [Buy API requirements](https://developer.ebay.com/api-docs/buy/buy-requirements.html)
