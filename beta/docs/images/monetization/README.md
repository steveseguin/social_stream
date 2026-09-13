# Creator store guide screenshots

`live-sale-controls.png` is captured by the commerce boards SSApp test below. It shows a fictional eBay Live auction copied into a seller-confirmed sale linked to a board spot. The test also runs Whatnot/eBay auction snapshots through app intake, verifies drafts do not become purchases, protects typed drafts from the next auction, and checks that a linked refund clears the sale and reopens its spot. The audience source is checked with an eBay filter and no buyer identity.

Spot boards and recent sales: `SSN_GUIDE_SCREENSHOTS=1 node tests/commerce-boards-ssapp.e2e.cjs` captures `spot-board.png`, `team-board.png`, `sales-wall.png` and `board-controls.png` using actual SSApp with an isolated profile and fictional data. Board images are native overlay crops; the popup screenshot has its fixture connection field cleared before capture. No real sale, buyer or account is used. The same test checks desktop/mobile guide layouts and the host controls, purchase deduplication, persistent state and local overlay feed.

Run `node tests/commerce-visual-ssapp.e2e.cjs` for the extended visual audit. It saves both guides in light/dark themes, expanded sections, all five overlay layouts, long-label cases, and popup/OBS dock controls in its printed temporary directory. Checks cover 320–1280px guide widths, 200% text, recommended OBS source sizes, keyboard focus/scroll during incoming sales, and commands during a delayed refresh. It uses fictional data and the isolated SSApp runtime; no live accounts or payments.

The native OBS smoke test below also covers board commands, equal tile heights after a reveal, all five board/sales layouts, and board reload after a scene change. Its screenshots use OBS Browser Sources directly.

Captured September 7, 2026 from the actual sibling SSApp runtime using an isolated profile and fixture product data. No live payment or creator account is used. Each screenshot is cropped to its relevant controls or card; private webhook URLs stay masked and the transient storefront token has been cleared.

Regenerate with `SSN_GUIDE_SCREENSHOTS=1 node tests/commerce-ssapp.e2e.cjs` (set the environment variable using your shell). Screenshot mode briefly shows the isolated app because headless-control mode suppresses native window painting. The ordinary test remains hidden.

Reviewed provider-setup.png, fourthwall-import.png and product-showcase.png for readable text, complete controls, correct public QR destination and absence of account secrets. The guide was also rendered at 1200px and 390px with no horizontal overflow or broken images. Images link to their original size for small screens.


Shopify screenshots were captured with `SSN_GUIDE_SCREENSHOTS=1 node tests/shopify-ssapp.e2e.cjs`, through a local signed Shopify receiver and actual SSApp with fixture storefront data. Reviewed shopify-setup.png, shopify-setup-dark.png, shopify-import.png and shopify-purchase.png for complete crops, light/dark input contrast, readable labels and absence of signing secrets. The visible receiver belongs only to the isolated local fixture; its reader key is not shown. The guide was rendered at 1200px and 390px without overflow or missing images.


Live product controls and public viewer pages: regenerate with `SSN_GUIDE_SCREENSHOTS=1 node tests/product-controls-ssapp.e2e.cjs`. This uses the actual SSApp, an isolated profile, local SQLite API and public metadata fixtures; no live store, merchant account or payment. Reviewed product-controls.png, product-controls-dark.png, public-shop-setup.png and viewer-shop.png for complete crops, readable controls, light/dark input contrast and absence of publishing/session keys. Viewer screenshot is cropped at native capture to the mobile content. The product-controls guide was rendered and reviewed at 1200px and 390px; it has one page heading, no horizontal overflow and no broken images.

OBS product control dock: `obs-product-controls.png` is captured by the product-controls SSApp test above. Reviewed the native crop at a 390px-wide window for readable labels, all four controls, selection state, and no private connection fields. The dock is separate from the audience overlay. The updated OBS guide was rendered and reviewed at 1200px and 390px, with no horizontal overflow or broken images.

Native OBS follow-up: `obs-native-product-controls.png` was captured and cropped directly from an actual OBS 32.2.2 Custom Browser Dock through CEF. Reviewed readable controls and selected state. `node scripts/commerce-obs-smoke.cjs` creates an isolated portable profile and local fixture API, verifies Show/Next/Hide/Resume, scene unload/reload, QR rendering and reconnection, and leaves reviewed artifacts under its printed temporary directory. The normal OBS profile is never loaded. This complements the real SSApp integration test; it does not test live payments.
