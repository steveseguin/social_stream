# Maintaining the overlay gallery

The public page is `docs/overlay-gallery.html`. Its catalogue is `overlay-gallery.json`; static cards are generated so screenshots and descriptions remain browseable without JavaScript. Images are local WebP files, with separate lazy-loaded thumbnails and full-size previews.

When adding an overlay or style:

1. Add its path, name, category, description, search tags and unique image ID to the catalogue. Keep preset query parameters in `path`; do not add a real session or password.
2. Run `scripts/capture-overlay-gallery.cjs` with the installed SSApp Electron binary. Optional arguments are catalogue IDs to capture individually; `--retry` retries failed captures. It uses an isolated profile, blocks external requests, maps packaged assets locally, and sends fictional chat through a local iframe bridge. Multi-alerts use their existing fixture API. Neutron uses a fixed fixture clock; its full scene is captured at 1920 × 1080.
3. Run `python scripts/prepare-overlay-gallery-images.py` (requires Pillow). Inspect the screenshots, including animation frames and wrappers; receiving fixture text does not by itself guarantee a good screenshot. Use `--clean` after review to remove the intermediate PNG captures.
4. Run `node scripts/build-overlay-gallery.cjs` to refresh the static cards.
5. Run `node tests/overlay-gallery.test.cjs` and run `scripts/electron-overlay-gallery-e2e.cjs` with Electron. The former checks assets, paths, menu coverage and discovery links; the latter checks desktop/mobile rendering, combined filters, image enlargement, keyboard focus and correctly encoded session links.
6. Run `tests/overlay-payload-safety.e2e.cjs` with Electron (optionally with id or path substrings). It sends hostile and ordinary payloads through each overlay's real bridge and a local WebSocket, then fails on executed script, live handlers or javascript: URLs in the DOM, and CSS that escapes its declaration. Add `--scenarios` for one screenshot per payload on featured, alert and welcome overlays.

Optional capture fields on a catalogue entry (the builder and gallery ignore them):

- `width`, `height`: window size in pixels (default 960 × 640).
- `zoom`: page zoom factor for the capture window. Use it with a smaller window when dense overlays would otherwise produce unreadable thumbnails.
- `fixtures`: payloads that replace the sample feed; `fixture`: fields merged into each sample payload. The bridge posts them as `overlayNinja` data, one every `gap` milliseconds (default 500). Any `avatar:Maple` string (or another sample name) becomes that sample avatar.
- `params`: capture-only URL parameters such as demo settings or a fictional poll question. Keep presets users should copy in `path`.
- `script`: JavaScript run in the page after it loads; it may return a promise. Use it to seed randomness or pause an animation at a fixed point.
- `delay`: milliseconds to wait before the screenshot.
- `expect`: a case-insensitive pattern that must appear in the rendered text, for widgets that show no sample names (default: one of the sample names).

Display fields used by the builder:

- `tier: "community"` marks community and early themes. Keep them at the end of the catalogue; their cards are labelled **Community**.
- `variants`: `[{label, path, image}]` for near-identical styles of one page. The first variant must equal the entry `path`; the card shows a **Variant** picker that swaps the overlay link and preview. Keep each variant image and its `-thumb.webp`.

Catalogue order is gallery order: primary overlays first, then matching sets, then the remaining styles by category, widgets, and community themes last.

Set `GALLERY_CATALOG=<draft.json>` for both the capture and image scripts to work from a draft catalogue before merging it.

No platform channels, user sessions or external services are contacted during capture. The gallery itself opens an overlay connection only when a visitor enters their session and follows an overlay link. Session/password fields are never persisted by the gallery.

Matching artwork sets use the same `collection` key on exactly three catalogue entries: chat, featured, and alerts. The builder adds **Use matching set** to those cards; the panel reuses their paths and previews. Keep all alert-category style parameters in the alerts entry. The gallery checks cover complete sets, encoded credentials, shared character motion, copying and narrow layouts.
