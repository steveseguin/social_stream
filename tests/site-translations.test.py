"""Spanish pilot build and path checks. Run: python tests/site-translations.test.py"""
import contextlib
import hashlib
import importlib.util
import io
import json
import re
import shutil
import tempfile
import unittest
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("site_translations", ROOT / "scripts/build-site-translations.py")
BUILD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILD)
SEO_SPEC = importlib.util.spec_from_file_location("pages_seo", ROOT / "scripts/prepare-pages-seo.py")
SEO = importlib.util.module_from_spec(SEO_SPEC)
SEO_SPEC.loader.exec_module(SEO)


class PilotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for page in (*BUILD.PAGES, "translations/site/es.json"):
            destination = self.root / page
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / page, destination)
        with contextlib.redirect_stdout(io.StringIO()):
            BUILD.build(self.root)

    def test_build_is_repeatable_and_keeps_english_sources(self):
        before = {page: hashlib.sha256((self.root / page).read_bytes()).hexdigest() for page in BUILD.PAGES}
        with contextlib.redirect_stdout(io.StringIO()):
            BUILD.build(self.root, check=True)
        for page in BUILD.PAGES:
            self.assertEqual(before[page], hashlib.sha256((ROOT / page).read_bytes()).hexdigest())
        self.assertEqual(len(list((self.root / "es").rglob("*.html"))), 3)

    def test_missing_changed_text_fails_without_writing_partial_pages(self):
        page = self.root / "index.html"
        page.write_text(page.read_text(encoding="utf-8").replace("</body>", "<p>New English instructions.</p></body>"), encoding="utf-8")
        output = self.root / "es/index.html"
        original = output.read_bytes()
        with self.assertRaisesRegex(ValueError, "New English instructions"):
            BUILD.build(self.root)
        self.assertEqual(original, output.read_bytes())

    def test_nested_urls_preserve_queries_fragments_and_english_fallbacks(self):
        rewrite = lambda value: BUILD.relative_url(value, "docs/download.html", "es/docs/download.html", True)
        self.assertEqual(rewrite("../index.html?lang=es#top"), "../index.html?lang=es#top")
        self.assertEqual(rewrite("getting-started.html#tts"), "getting-started.html#tts")
        self.assertEqual(rewrite("index.html?file=appImage.md"), "../../docs/index.html?file=appImage.md")
        self.assertEqual(rewrite("#manual-install"), "#manual-install")
        self.assertEqual(rewrite("https://github.com/steveseguin/social_stream/releases"), "https://github.com/steveseguin/social_stream/releases")
        self.assertEqual(rewrite("../featured.html?session=example&password=x"), "../../featured.html?session=example&password=x")

    def test_all_local_assets_and_links_resolve_at_root_and_under_beta(self):
        checked = 0
        for page in BUILD.PAGES:
            target = self.root / "es" / page
            document = BUILD.Document(target.read_text(encoding="utf-8"))
            for _, _, tag, attrs in document.tags:
                for attr in ("src", "href", "poster"):
                    value = attrs.get(attr, "")
                    url = urlsplit(value)
                    if not url.path or url.scheme or url.netloc:
                        continue
                    logical = (target.parent / unquote(url.path)).resolve().relative_to(self.root.resolve())
                    actual = self.root / logical if logical.parts[0] == "es" else ROOT / logical
                    self.assertTrue(actual.exists(), f"{page}: {attr}={value}")
                    if logical.parts[0] == "es" and url.fragment:
                        self.assertIn('id="' + url.fragment + '"', actual.read_text(encoding="utf-8"))
                    # Relative links have identical targets when the entire tree
                    # is mounted under /beta/ (no origin-root asset substitutions).
                    self.assertFalse(value.startswith("/"), f"{page}: {value}")
                    checked += 1
        self.assertGreater(checked, 150)

    def test_metadata_and_inline_scripts_survive_generation_and_seo(self):
        for page in BUILD.PAGES:
            source = (ROOT / page).read_text(encoding="utf-8")
            output = (self.root / "es" / page).read_text(encoding="utf-8")
            document = BUILD.Document(output)
            tags = [(tag, attrs) for _, _, tag, attrs in document.tags]
            self.assertIn(("meta", {"name": "robots", "content": "noindex, follow"}), tags)
            self.assertIn('lang="es"', output)
            self.assertNotIn('<link rel="canonical"', output)
            self.assertNotIn('property="og:url"', output)
            for script in re.findall(r"<script(?:\s[^>]*)?>[\s\S]*?</script>", source):
                if not re.match(r"<script[^>]*\bsrc=", script):
                    self.assertIn(script, output)
            for code in re.findall(r"<code(?:\s[^>]*)?>[\s\S]*?</code>", source):
                self.assertIn(code, output)
            config = re.search(r'<script id="ssn-site-language" type="application/json">(.*?)</script>', output).group(1)
            self.assertEqual(json.loads(config)["Copy Markdown"], "Copiar Markdown")
            # SEO can run again without pointing the pilot back to English or
            # replacing its translated title/description. Copy only its icon.
            icon = self.root / "icons/favicon.ico"
            icon.parent.mkdir(exist_ok=True)
            shutil.copyfile(ROOT / "icons/favicon.ico", icon)
            prepared, record = SEO.prepare_page(self.root, self.root / "es" / page)
            self.assertFalse(record["indexable"])
            self.assertIsNone(record["canonical"])
            self.assertEqual(output, prepared)

    def test_pages_deployment_order_builds_only_beta_and_passes_seo_again(self):
        beta = self.root / "beta"
        for page in (*BUILD.PAGES, "translations/site/es.json", "icons/favicon.ico"):
            destination = beta / page
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / page, destination)
        (self.root / "icons").mkdir(exist_ok=True)
        shutil.copyfile(ROOT / "icons/favicon.ico", self.root / "icons/favicon.ico")
        SEO.prepare(self.root)
        with contextlib.redirect_stdout(io.StringIO()):
            BUILD.build(beta)
            BUILD.build(beta, check=True)
        changed, records = SEO.prepare(self.root, check=True)
        self.assertEqual(changed, [])
        pilot = [record for record in records if record["path"].startswith("beta/es/")]
        self.assertEqual(len(pilot), 3)
        self.assertTrue(all(not record["indexable"] for record in pilot))
        self.assertNotIn("/beta/es/", (self.root / "sitemap.xml").read_text(encoding="utf-8"))


class ExpandedTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.pages = ('index.html', 'docs/index.html', 'docs/guide.html')
        for page in self.pages:
            path = self.root / page
            path.parent.mkdir(parents=True, exist_ok=True)
            home = '../index.html' if page.startswith('docs/') else 'index.html'
            path.write_text('<html lang="en"><head><meta charset="utf-8"><title>Live chat</title>'
                '<meta name="description" content="Setup"><meta name="robots" content="index, follow">'
                '<link rel="canonical" href="https://socialstream.ninja/">'
                '</head><body><header><nav id="ssn-site-nav"><a href="' + home + '">Live chat</a></nav></header>'
                '<h1>Setup</h1><p>Live chat</p><code>session=example</code>'
                '<a href="https://example.org">Link</a></body></html>', encoding='utf-8')
        catalog = self.root / 'translations/site'
        catalog.mkdir(parents=True)
        for language, values in [('es', ['Chat en directo', 'Configuración', 'Enlace']), ('ru', ['Прямой чат', 'Настройка', 'Ссылка'])]:
            (catalog / (language + '.json')).write_text(json.dumps({'ui': {}, 'strings':dict(zip(['Live chat', 'Setup', 'Link'],values))},ensure_ascii=False),encoding='utf-8')

    def build(self, language='es', **kwargs):
        with contextlib.redirect_stdout(io.StringIO()):
            BUILD.build(self.root, language=language, pages=self.pages, expanded=True, languages=['es','ru'], **kwargs)

    def test_reciprocal_languages_keep_page_queries_and_source_assets(self):
        self.build()
        self.build('ru')
        BUILD.publish_english_links(self.root, self.pages, ['es','ru'], '/beta')
        self.build(check=True)
        self.build('ru', check=True)
        BUILD.publish_english_links(self.root, self.pages, ['es','ru'], '/beta', check=True)
        source = (self.root / 'es/docs/guide.html').read_text(encoding='utf-8')
        self.assertIn('hreflang="ru" href="https://socialstream.ninja/beta/ru/docs/guide.html"',source)
        self.assertIn('href="../../ru/docs/guide.html" lang="ru"',source)
        self.assertIn('<code>session=example</code>',source)
        self.assertIn('src="../../docs/js/site-language.js"',source)
        self.assertEqual(source.count('data-site-language-picker'),1)
        self.assertEqual(BUILD.relative_url('index.html?file=agents/test.md#example','docs/guide.html','es/docs/guide.html',True,self.pages), '../../docs/index.html?file=agents/test.md#example')

    def test_language_menu_precedes_theme_control_outside_navigation(self):
        source = (self.root / 'docs/guide.html').read_text(encoding='utf-8').replace('</nav>',
            '</nav><div class="site-actions"><button class="site-theme"></button></div>')
        for language in ('en', 'ru'):
            page = ('ru/' if language == 'ru' else '') + 'docs/guide.html'
            output = BUILD.language_links(source, 'docs/guide.html', page, ['es', 'ru'], language)
            self.assertLess(output.index('</nav>'), output.index('data-site-language-picker'))
            self.assertLess(output.index('class="site-actions"'), output.index('data-site-language-picker'))
            self.assertLess(output.index('data-site-language-picker'), output.index('class="site-theme"'))
            self.assertEqual(output, BUILD.language_links(output, 'docs/guide.html', page, ['es', 'ru'], language))

    def test_search_keeps_cyrillic_and_matches_accented_words(self):
        self.build()
        self.build('ru')
        spanish = json.loads((self.root / 'es/docs/search-index.json').read_text(encoding='utf-8'))
        russian = json.loads((self.root / 'ru/docs/search-index.json').read_text(encoding='utf-8'))
        self.assertIn('configuracion',spanish['terms'])
        self.assertIn('настроика',russian['terms'])
        self.assertEqual([entry['path'] for entry in russian['documents']],['guide.html'])

    def test_root_directory_navigation_keeps_language_query_and_fragment(self):
        for language in BUILD.LANGUAGES:
            for prefix in ('', '/beta'):
                with self.subTest(language=language, prefix=prefix):
                    source_page = 'lite/guide.html'
                    localized_page = language + '/' + source_page
                    href = BUILD.relative_url('../?session=example#top', source_page,
                        localized_page, True, self.pages, language)
                    current = 'https://socialstream.ninja' + prefix + '/' + localized_page
                    self.assertEqual(urljoin(current, href),
                        'https://socialstream.ninja' + prefix + '/' + language + '/?session=example#top')
                    app_href = BUILD.relative_url('../actions/?session=example#top',
                        source_page, localized_page, True, self.pages, language)
                    self.assertEqual(urljoin(current, app_href),
                        'https://socialstream.ninja' + prefix + '/actions/?session=example#top')

    def test_search_finds_cjk_words_inside_sentences_and_preserves_voiced_kana(self):
        catalog = self.root / 'translations/site/ja.json'
        catalog.write_text(json.dumps({'ui': {}, 'strings': {
            'Live chat': '配信チャットで音声を設定',
            'Setup': 'ブラウザーでOBS设置と語音設定を確認',
            'Link': 'リンク'
        }}, ensure_ascii=False), encoding='utf-8')
        self.build('ja')
        index = json.loads((self.root / 'ja/docs/search-index.json').read_text(encoding='utf-8'))
        for term in ('チャ', 'ャッ', 'ット', '音声', '音', '設定', '设置', '語音', 'ブラ'):
            self.assertIn(term, index['terms'])
            self.assertEqual(index['terms'][term][0][0], 0)
        self.assertNotIn('フラ', index['terms'])

    def test_dynamic_copy_and_placeholders_are_required(self):
        path = self.root / 'translations/site/runtime/docs--guide.html.json'
        path.parent.mkdir(parents=True)
        path.write_text(json.dumps({'strings':['{0} results']}),encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'Missing es translations'):
            self.build()
        catalog_path = self.root / 'translations/site/es.json'
        catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
        catalog['strings']['{0} results'] = 'resultados'
        catalog_path.write_text(json.dumps(catalog),encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'changed placeholders'):
            self.build()

    def test_multiline_code_and_copied_markdown_keep_their_structure(self):
        path = self.root / 'docs/guide.html'
        code = '<div class="code-js">// Keep this comment\nreturn true;</div>'
        shell = '<div class="code">export LOCAL=1\nrun-helper</div>'
        source = path.read_text(encoding='utf-8').replace('</body>',code + shell +
            '<template data-copy-markdown-extra>\n## Context\n\n- First note.\n  - Nested note.\n- Second note.\n</template></body>')
        path.write_text(source,encoding='utf-8')
        catalog_path = self.root / 'translations/site/es.json'
        catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
        catalog['strings']['## Context - First note. - Nested note. - Second note.'] = '## Contexto - Primera nota. - Nota anidada. - Segunda nota.'
        catalog_path.write_text(json.dumps(catalog),encoding='utf-8')
        self.build()
        output = (self.root / 'es/docs/guide.html').read_text(encoding='utf-8')
        self.assertIn(code,output)
        self.assertIn(shell,output)
        self.assertIn('## Contexto\n\n- Primera nota.\n\n  - Nota anidada.\n\n- Segunda nota.',output)


if __name__ == "__main__":
    unittest.main()
