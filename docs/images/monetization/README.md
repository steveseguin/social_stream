# Creator store guide screenshots

Captured September 7, 2026 from the actual sibling SSApp runtime using an isolated profile and fixture product data. No live payment or creator account is used. Each screenshot is cropped to its relevant controls or card; private webhook URLs stay masked and the transient storefront token has been cleared.

Regenerate with `SSN_GUIDE_SCREENSHOTS=1 node tests/commerce-ssapp.e2e.cjs` (set the environment variable using your shell). Screenshot mode briefly shows the isolated app because headless-control mode suppresses native window painting. The ordinary test remains hidden.

Reviewed provider-setup.png, fourthwall-import.png and product-showcase.png for readable text, complete controls, correct public QR destination and absence of account secrets. The guide was also rendered at 1200px and 390px with no horizontal overflow or broken images. Images link to their original size for small screens.


Shopify screenshots were captured with `SSN_GUIDE_SCREENSHOTS=1 node tests/shopify-ssapp.e2e.cjs`, through a local signed Shopify receiver and actual SSApp with fixture storefront data. Reviewed shopify-setup.png, shopify-setup-dark.png, shopify-import.png and shopify-purchase.png for complete crops, light/dark input contrast, readable labels and absence of signing secrets. The visible receiver belongs only to the isolated local fixture; its reader key is not shown. The guide was rendered at 1200px and 390px without overflow or missing images.
