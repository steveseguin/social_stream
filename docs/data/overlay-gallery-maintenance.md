# Maintaining the overlay gallery

The public page is `docs/overlay-gallery.html`. Its catalogue is `overlay-gallery.json`; static cards are generated so screenshots and descriptions remain browseable without JavaScript. Images are local WebP files, with separate lazy-loaded thumbnails and full-size previews.

When adding an overlay or style:

1. Add its path, name, category, description, search tags and unique image ID to the catalogue. Keep preset query parameters in `path`; do not add a real session or password.
2. Run `scripts/capture-overlay-gallery.cjs` with the installed SSApp Electron binary. Optional arguments are catalogue IDs to capture individually; `--retry` retries failed captures. It uses an isolated profile, blocks external requests, maps packaged assets locally, and sends fictional chat through a local iframe bridge. Multi-alerts use their existing fixture API. Neutron uses a fixed fixture clock; its full scene is captured at 1920 × 1080.
3. Run `python scripts/prepare-overlay-gallery-images.py` (requires Pillow). Inspect the screenshots, including animation frames and wrappers; receiving fixture text does not by itself guarantee a good screenshot. Use `--clean` after review to remove the intermediate PNG captures.
4. Run `node scripts/build-overlay-gallery.cjs` to refresh the static cards.
5. Run `node tests/overlay-gallery.test.cjs` and run `scripts/electron-overlay-gallery-e2e.cjs` with Electron. The former checks assets, paths, menu coverage and discovery links; the latter checks desktop/mobile rendering, combined filters, image enlargement, keyboard focus and correctly encoded session links.

No platform channels, user sessions or external services are contacted during capture. The gallery itself opens an overlay connection only when a visitor enters their session and follows an overlay link. Session/password fields are never persisted by the gallery.
