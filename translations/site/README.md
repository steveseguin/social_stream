# Spanish website pilot

English HTML is the source. `es.json` holds saved Spanish translations for the
homepage, download page and getting-started guide. `ui` supplies the dynamic
theme, menu and Copy Markdown labels; `strings` translates visible HTML text,
page metadata and accessibility labels. Product names and code examples retain
their original spelling. English UI names accompany Spanish instructions where
needed to match the original screenshots.

These are AI-authored translations; native-speaker review remains outstanding.
The screenshots themselves are still English. The pilot notice explains that
other website pages remain English, including documentation search.

## Build and preview

Run from the checkout:

```sh
python scripts/build-site-translations.py
python scripts/build-site-translations.py --check
python tests/site-translations.test.py
node tests/site-translations.browser.cjs --serve
```

The browser check needs a local Playwright installation. Set `PLAYWRIGHT_MODULE`
to its package path if it is not on Node's normal module path. It uses local
Chromium, blocks external requests and intercepts session redirects rather than
connecting to an actual chat session. `--serve` leaves the preview running at the
localhost URL printed after the checks. Stop it with Ctrl+C. Screenshots go to
`.codex-tmp/site-translations/`.

Generated HTML lives in `es/` and is ignored by Git. CSS, scripts and images stay
in their existing folders; generated URLs account for the extra language folder.
Links to translated pages stay Spanish. All other destinations retain their
English URLs, including query strings and section anchors. Language switches
preserve the current query and section.

The Pages workflow builds the pilot inside the assembled **beta** tree, after
the existing SEO pass, and explicitly stages the generated `beta/es/` folder so
the copied checkout `.gitignore` cannot exclude it from publication. Its deployed
addresses will be:

- `/beta/es/`
- `/beta/es/docs/download.html`
- `/beta/es/docs/getting-started.html`

The existing production root is not relocated. Pilot pages carry `noindex` and
are excluded from the sitemap; production canonical and alternate-language SEO
links are deferred until an actual public translation rollout. The pilot's
metadata also survives a subsequent run of the existing SEO script.

## Updating translations

```sh
python scripts/build-site-translations.py --extract
```

This prints current English text with its saved Spanish translation. `null`
means translation is missing. English text is whitespace-normalized and used as
the key; an English edit therefore requires translating only the new text.
Existing corrections remain in the catalog. Builds fail before writing any
pages if a required static translation is missing, including in Pages CI.
Always translate fragments in their surrounding paragraph, since inline links
and emphasis divide some sentences into several strings.

New JavaScript-generated labels need an explicit `SSNSiteTranslate` lookup and
an entry in `ui`; arbitrary JavaScript is never rewritten as natural language.
This pilot covers the three named pages only. Other pages, data-driven galleries,
localized search and further languages need a separate expansion of the scope.

Before a stable rollout, generate the selected languages in the stable tree too,
replace the pilot notice, add self-canonical URLs and reciprocal `hreflang`,
extend the sitemap/SEO rules, and verify each translated page and language link.
Do not promote the English pilot language links to stable without publishing
their translated targets alongside them.
