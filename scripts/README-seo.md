# Page metadata and favicons

Run `python scripts/prepare-pages-seo.py --root .` after adding public pages, then
`python scripts/build-docs-search-index.py`. Check with
`python tests/pages-seo.test.py` or `python scripts/prepare-pages-seo.py --root . --check`.

The deployment workflow runs the same preparation and drift check on its assembled
Pages payload. Metadata is static HTML: crawlers and link previews do not need to
execute browser JavaScript. No runtime scripts are added by the generator.

- Public docs, Lite, Stream Deck setup, Event Flow guides and the explicit root
  pages in `PUBLIC_ROOT_PAGES` get descriptions, canonical URLs and social cards.
- Existing descriptive titles and descriptions are retained. Editorial overrides
  for main landing pages and missing guide descriptions live in `seo-pages.json`.
  Add a tailored description to a new guide's head or to that file.
- Session-based overlays, source connectors, controls, tests served at the site
  root and all `/beta/` copies get `noindex`. Beta guides reference stable
  canonical URLs. An authored public `noindex` remains in effect.
- The sitemap is generated from indexable pages only, using the same canonical
  URLs as their heads. It does not invent modification dates. The legacy
  `landing.html` consolidates to the homepage; `beta.html` is the public download
  guide and is distinct from the excluded `/beta/` directory.
- Favicons use packaged relative paths so extension, Electron, file, nested and
  beta pages work. Valid custom/data icons remain; remote source icons use their
  packaged platform image. Stream Deck has an icon inside its images folder for
  offline copies. Keep the existing root favicon URL stable.
- Vendors, fixtures, generated assets and non-page fragments are excluded. The
  generator edits only the first document head and preserves page body code,
  embedded templates, title translation attributes and favicon element IDs.

`robots.txt` must allow crawlers to read pages carrying `noindex`; blocking those
pages there prevents crawlers from seeing the directive. It must also allow the
homepage and favicon assets. These tags do not control access to private data.

References: [Google's favicon guidance](https://developers.google.com/search/docs/appearance/favicon-in-search),
[canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls),
and [robots meta directives](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).
