# Website translations

English HTML remains the source. The builder creates separate language folders
without relocating the site or its applications. It covers the homepage, all
public HTML guides in `docs/`, and the linked legal, font, actions, Lite and
Stream Deck guide pages (97 pages at the time of this expansion).

Supported catalogs are Spanish (`es`), Brazilian Portuguese (`pt-br`), Russian
(`ru`), French (`fr`) and German (`de`). `publish.json` selects the complete
editions to publish. A configured language must translate every required string;
missing translations fail the build. Partial catalogs can be saved without
adding their language to that list.

Translations are authored by Codex and same-model parallel agents, stored in
this repository, and served as static files. No online translation service runs
during builds or visits. Native-speaker review remains outstanding.

## Build and preview

```sh
python scripts/build-site-translations.py --language es --all-pages
python scripts/build-site-translations.py --language es --all-pages --check
python tests/site-translations.test.py
python tests/pages-seo.test.py
node tests/site-translations-expanded.browser.cjs
```

The browser check needs Playwright and Chromium. Set `PLAYWRIGHT_MODULE` to the
installed package path if necessary. `SITE_LANGUAGE` selects the language
(default `es`); `SITE_PAGES` optionally limits the check to comma-separated
source paths. It serves the checkout locally under `/beta/`, blocks external
requests, checks local resources and narrow layouts, and exercises translated
search, galleries, settings, and language controls.

To preview a partially translated language, specify complete pages:

```sh
python scripts/build-site-translations.py --language ru --pages index.html docs/download.html docs/getting-started.html
```

Generated language folders are ignored by Git. Scripts, images and executable
app pages use their original locations. Guide links stay in the chosen language;
app links, technical code examples and the Markdown reference library retain
their original targets. Language switching preserves the query and fragment.
Screenshots, text inside images, user-submitted service descriptions, and the
applications themselves are outside the website-text translation scope.

## Deployment

Run this against an assembled deployment tree, not the source checkout, because
it also adds language menus to English pages:

```sh
python scripts/build-site-translations.py --root PATH_TO_BETA_TREE --published --base-path /beta
python scripts/build-site-translations.py --root PATH_TO_BETA_TREE --published --base-path /beta --check
```

The Pages workflow reads each checkout's own `publish.json`. Beta editions live
at `/beta/es/`, `/beta/fr/`, and so on, with `noindex`. Production gets editions
only when its source branch contains the catalogs and publication configuration.
For a production tree, use `--base-path "" --public`. Public editions receive
self-canonical URLs, reciprocal `hreflang` links, and sitemap entries; beta stays
out of the sitemap. The workflow explicitly stages generated language folders
so copied ignore rules cannot omit them.

Each generated documentation library has its own translated search index.
Search retains Unicode letters, including Cyrillic, and folds Latin accents.
The legacy three-page Spanish pilot command and tests remain available for
compatibility; expanded builds replace its notice with the language menu.

## Updating translations

`LANGUAGE.json` and `LANGUAGE-pages/*.json` are merged into one catalog. `strings`
maps whitespace-normalized English text to translations; `ui` covers common
dynamic controls. Conflicting translations for the same key fail the build.
Use the surrounding source paragraph when translating fragments split by links
or emphasis. Preserve brands, URLs, code, command names and `{placeholders}`.

```sh
python scripts/build-site-translations.py --language es --all-pages --extract
```

This prints current required strings and saved translations; `null` means
missing. Changes to English text require new catalog entries. Placeholder
changes also fail the build.

`runtime/*.json` explicitly lists authored JavaScript-generated text and the
source files it depends on. The browser helper uses only these saved strings;
it does not translate arbitrary user content or rewrite JavaScript. Dynamic
counts use placeholders, and executable destination URLs resolve against the
original page. Source hashes detect changes to reviewed scripts and the popup
settings source. After reviewing a source change, update runtime keys and all
published catalogs, then record the reviewed sources:

```sh
python scripts/build-site-translations.py --record-runtime-sources
```

Recording hashes acknowledges the review; it does not extract or translate new
text. Rebuild and validate the affected pages afterward.
