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
from urllib.parse import unquote, urlsplit

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


if __name__ == "__main__":
    unittest.main()
