"""Run with: python tests/pages-seo.test.py (standard library only)."""
import importlib.util
import json
import re
import tempfile
import unittest
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("pages_seo", ROOT / "scripts/prepare-pages-seo.py")
SEO = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SEO)


class MetadataTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.write("icons/favicon.ico", "test icon")
        self.write("beta/icons/favicon.ico", "test beta icon")

    def write(self, path, content):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content.encode("utf-8"))
        return target

    def page(self, path, head="", body="<h1>Example</h1>"):
        return self.write(path, '<!doctype html><html lang="en"><head>' + head + '</head><body>' + body + '</body></html>')

    def prepare(self, path):
        updated, record = SEO.prepare_page(self.root, path)
        path.write_bytes(updated.encode("utf-8"))
        return updated, SEO.PageHead(updated), record

    def test_static_metadata_duplicates_and_body_templates(self):
        body = '<textarea><html><head><title>Embedded template</title></head></html></textarea><script>var example = "<meta name=robots>";</script>'
        path = self.page("docs/example.html", '<title data-i18n="title">A &amp; B</title><meta name="description" content="A practical guide."><meta name="description" content="duplicate"><link rel="canonical" href="https://socialstream.ninja/"><meta name="twitter:title" content="old"><meta property="twitter:title" content="duplicate">', body)
        updated, head, record = self.prepare(path)
        self.assertIn(body, updated)
        self.assertEqual(head.title[4], "A & B")
        self.assertIn('data-i18n="title"', updated)
        self.assertEqual(len(head.meta("description")), 1)
        self.assertEqual(len(head.meta("twitter:title")), 1)
        self.assertEqual(head.meta("og:title")[0][3]["content"], "A & B")
        self.assertEqual(head.links("canonical")[0][3]["href"], "https://socialstream.ninja/docs/example.html")
        self.assertTrue(record["indexable"])
        self.assertEqual(SEO.prepare_page(self.root, path)[0], updated)

    def test_charset_stays_early_and_scripts_are_untouched(self):
        script = '<script>var literal="<head><meta name=description>";' + "/*" + "x" * 1500 + "*/</script>"
        path = self.page("docs/encoding.html", script + '<meta charset="UTF-8"><title>Encoding</title>')
        updated, head, _ = self.prepare(path)
        self.assertIn(script, updated)
        self.assertLess(updated.index('charset="UTF-8"'), 1024)
        self.assertEqual(sum(bool(t[3].get("charset")) for t in head.tags), 1)

    def test_runtime_directives_and_broken_icons(self):
        path = self.page("themes/nested/chat.html", '<title>Chat</title><meta name="robots" content="index,nofollow"><link rel="canonical" href="https://socialstream.ninja"><link rel="icon" id="favicon" href="missing.ico">')
        updated, head, record = self.prepare(path)
        self.assertFalse(record["indexable"])
        self.assertEqual(head.meta("robots")[0][3]["content"], "noindex, nofollow")
        self.assertFalse(head.links("canonical"))
        icon = head.links("icon")[0][3]
        self.assertEqual(icon["id"], "favicon")
        self.assertEqual(SEO.local_asset(self.root, path, icon["href"]), self.root / "icons/favicon.ico")

    def test_beta_uses_stable_canonical_but_local_beta_favicon(self):
        path = self.page("beta/docs/example.html", '<title>Beta guide</title>')
        _, head, record = self.prepare(path)
        self.assertFalse(record["indexable"])
        self.assertIn("noindex", head.meta("robots")[0][3]["content"])
        self.assertEqual(head.links("canonical")[0][3]["href"], "https://socialstream.ninja/docs/example.html")
        self.assertEqual(SEO.local_asset(self.root, path, head.links("icon")[0][3]["href"]), self.root / "beta/icons/favicon.ico")

    def test_public_authored_noindex_is_respected(self):
        path = self.page("docs/private.html", '<meta name="robots" content="noindex,nofollow"><title>Private</title>')
        _, head, record = self.prepare(path)
        self.assertFalse(record["indexable"])
        self.assertEqual(head.meta("robots")[0][3]["content"], "noindex,nofollow")

    def test_provider_favicons_are_packaged_and_custom_icons_survive(self):
        self.write("sources/images/kick.png", "image")
        path = self.page("sources/websocket/kick.html", '<link rel="icon" href="https://kick.com/favicon.ico">')
        _, head, _ = self.prepare(path)
        self.assertEqual(head.links("icon")[0][3]["href"], "../images/kick.png")
        custom = 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E'
        path = self.page("custom.html", '<link rel="icon" href="' + custom + '">')
        _, head, _ = self.prepare(path)
        self.assertEqual(head.links("icon")[0][3]["href"], custom)

    def test_sitemap_aliases_and_page_classes(self):
        for name in ["index.html", "landing.html", "TOS.html", "docs/index.html", "docs/guide.html", "lite/index.html", "actions/event-flow-guide.html", "streamelements-importer.html", "dock.html", "affiliate.html", "404.html", "actions/index.html", "beta/docs/guide.html"]:
            self.page(name, '<title>Example</title>')
        SEO.prepare(self.root)
        tree = ElementTree.parse(self.root / "sitemap.xml")
        urls = [e.text for e in tree.findall("{*}url/{*}loc")]
        self.assertEqual(len(urls), len(set(urls)))
        self.assertIn("https://socialstream.ninja/TOS.html", urls)
        self.assertIn("https://socialstream.ninja/docs/", urls)
        self.assertIn("https://socialstream.ninja/lite/", urls)
        self.assertIn("https://socialstream.ninja/streamelements-importer.html", urls)
        for part in ["beta/", "dock.html", "affiliate.html", "404.html", "landing", "actions/index.html"]:
            self.assertFalse(any(part in url for url in urls), part)
        self.assertEqual(SEO.prepare(self.root, check=True)[0], [])

    def test_fragments_and_vendor_files_are_not_modified(self):
        path = self.write("fragment.html", '<div><script>var head="<head>";</script></div>')
        self.assertEqual(SEO.prepare_page(self.root, path), (path.read_text(), None))
        for name in ["tests/example.html", "thirdparty/example.html", "lite/vendor/example.html", ".cache/example.html", "scripts/fixtures/example.html"]:
            self.assertFalse(SEO.eligible(Path(name)))


class RepositoryTests(unittest.TestCase):
    def test_every_page_has_metadata_and_resolvable_packaged_icons(self):
        changed, records = SEO.prepare(ROOT, check=True)
        self.assertEqual(changed, [], "Run python scripts/prepare-pages-seo.py --root .")
        urls = set()
        titles, descriptions = [], []
        for record in records:
            path = ROOT / record["path"]
            source = path.read_bytes().decode("utf-8")
            head = SEO.PageHead(source)
            self.assertTrue(head.title and head.title[4], record["path"])
            self.assertEqual(len(head.meta("description")), 1, record["path"])
            self.assertTrue(head.meta("description")[0][3]["content"], record["path"])
            icons = head.links("icon")
            self.assertTrue(icons, record["path"])
            for icon in icons:
                href = icon[3].get("href", "")
                self.assertTrue(href.startswith("data:image/") or SEO.local_asset(ROOT, path, href), (record["path"], href))
            if record["indexable"]:
                self.assertEqual(len(head.links("canonical")), 1, record["path"])
                self.assertEqual(head.meta("og:url")[0][3]["content"], record["canonical"])
                self.assertEqual(head.meta("og:description")[0][3]["content"], record["description"])
                target = ROOT / unquote(urlsplit(record["canonical"]).path.lstrip("/"))
                self.assertTrue(target.is_file() or (target / "index.html").is_file(), record["canonical"])
                urls.add(record["canonical"])
                titles.append(record["title"])
                descriptions.append(record["description"])
        self.assertFalse([t for t, count in Counter(titles).items() if count > 1], "Public titles must be distinct")
        self.assertFalse([d for d, count in Counter(descriptions).items() if count > 1], "Public descriptions must be distinct")
        actual = {e.text for e in ElementTree.parse(ROOT / "sitemap.xml").findall("{*}url/{*}loc")}
        self.assertEqual(actual, urls)


if __name__ == "__main__":
    unittest.main()
