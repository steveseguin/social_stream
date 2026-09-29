#!/usr/bin/env python3
"""Build translated website editions from English HTML and saved catalogs.

No network calls or third-party packages. Missing translations fail the build.
The default retains the original three-page pilot. --all-pages builds the public
website, localized search, navigation and metadata. Assets stay shared.
"""
import argparse
import html
import hashlib
import importlib.util
import json
import posixpath
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, quote, urlsplit, urlunsplit

PAGES = ("index.html", "docs/download.html", "docs/getting-started.html")
LANGUAGE = "es"
LANGUAGES = {"es": "Español", "pt-br": "Português (Brasil)", "ru": "Русский", "fr": "Français", "de": "Deutsch",
             "ja": "日本語", "zh-cn": "简体中文", "zh-tw": "繁體中文", "it": "Italiano", "pl": "Polski",
             "ko": "한국어", "uk": "Українська", "ar": "العربية", "tr": "Türkçe", "cs": "Čeština", "th": "ไทย"}
LOCALES = {"es": "es_ES", "pt-br": "pt_BR", "ru": "ru_RU", "fr": "fr_FR", "de": "de_DE",
           "ja": "ja_JP", "zh-cn": "zh_CN", "zh-tw": "zh_TW", "it": "it_IT", "pl": "pl_PL",
           "ko": "ko_KR", "uk": "uk_UA", "ar": "ar_AR", "tr": "tr_TR", "cs": "cs_CZ", "th": "th_TH"}
ORIGIN = "https://socialstream.ninja"
LANGUAGE_BLOCK = re.compile(r"<!-- ssn-languages:start -->[\s\S]*?<!-- ssn-languages:end -->")
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
SKIP = {"script", "style", "code", "pre", "svg"}
LITERAL_CLASSES = {"code", "code-js", "url-example"}
TEXT_ATTRIBUTES = {"alt", "title", "aria-label", "placeholder"}
TEXT_METADATA = {"description", "keywords", "og:title", "og:description", "og:image:alt", "twitter:title", "twitter:description", "twitter:image:alt"}
ATTRIBUTE = re.compile(r'''([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))''')


def normalized(value):
    return " ".join(value.split())


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.offsets = [0] + [match.end() for match in re.finditer("\n", source)]
        self.stack, self.texts, self.tags = [], [], []
        self.literal_stack, self.markdown_stack, self.markdown_texts = [], [], set()
        self.pending = None
        self.head_end = self.header_end = None
        self.body_start = None
        self.feed(source)
        self.flush()

    def position(self):
        line, column = self.getpos()
        return self.offsets[line - 1] + column

    def flush(self):
        if self.pending is not None:
            start, end = self.pending
            value = html.unescape(self.source[start:end])
            key = normalized(value)
            if any(character.isalpha() for character in key):
                self.texts.append((start, end, key))
                if any(self.markdown_stack):
                    self.markdown_texts.add(start)
        self.pending = None

    def handle_starttag(self, tag, attrs):
        self.flush()
        start = self.position()
        attrs = dict(attrs)
        self.tags.append((start, start + len(self.get_starttag_text()), tag, attrs))
        if tag == "body" and self.body_start is None:
            self.body_start = start + len(self.get_starttag_text())
        if tag not in VOID:
            self.stack.append(tag)
            self.literal_stack.append(bool(LITERAL_CLASSES.intersection(attrs.get('class', '').split())) or attrs.get('translate') == 'no')
            self.markdown_stack.append(tag == 'template' and 'data-copy-markdown-extra' in attrs)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.stack.pop()
            self.literal_stack.pop()
            self.markdown_stack.pop()

    def handle_endtag(self, tag):
        self.flush()
        if tag == "head":
            self.head_end = self.position()
        if tag == "header" and self.header_end is None:
            self.header_end = self.source.index(">", self.position()) + 1
        if tag in self.stack:
            self.stack = self.stack[:len(self.stack) - 1 - self.stack[::-1].index(tag)]
            self.literal_stack = self.literal_stack[:len(self.stack)]
            self.markdown_stack = self.markdown_stack[:len(self.stack)]

    def handle_comment(self, data):
        self.flush()

    def handle_data(self, data):
        if not any(tag in SKIP for tag in self.stack) and not any(self.literal_stack):
            start = self.position()
            self.pending = (self.pending[0] if self.pending else start, start + len(data))

    def handle_entityref(self, name):
        self.handle_data("&" + name + ";")

    def handle_charref(self, name):
        self.handle_data("&#" + name + ";")


def translatable_attribute(tag, attrs, name):
    return name in TEXT_ATTRIBUTES or (tag == "meta" and name == "content" and
           (attrs.get("name") or attrs.get("property")) in TEXT_METADATA)


def strings_for(document):
    result = {text for _, _, text in document.texts}
    for _, _, tag, attrs in document.tags:
        for name, value in attrs.items():
            if value and translatable_attribute(tag, attrs, name):
                result.add(normalized(value))
    return result


def public_pages(root):
    """Public website copy, excluding applications and internal development notes."""
    pages = ["index.html", "privacy.html", "TOS.html", "beta.html", "fonts.html"]
    pages += [path.relative_to(root).as_posix() for path in sorted((root / "docs").glob("*.html"))]
    pages += [path.relative_to(root).as_posix() for path in sorted((root / "actions").glob("*-guide.html"))]
    pages += ["lite/guide.html", "streamdeck/index.html"]
    # These small learning pages belong to the translated game-building guide.
    pages += ["games/templates/coin-rocket.html", "games/templates/support-goal.html", "games/templates/event-garden.html"]
    return tuple(page for page in pages if (root / page).is_file())


def load_catalog(root, language):
    path = root / "translations/site" / (language + ".json")
    catalog = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"ui": {}, "strings": {}}
    catalog.setdefault("ui", {})
    catalog.setdefault("strings", {})
    for part in sorted((root / "translations/site" / (language + "-pages")).glob("*.json")):
        entries = json.loads(part.read_text(encoding="utf-8"))
        for section in ("strings", "ui"):
            for key, value in entries.get(section, {}).items():
                if key in catalog[section] and catalog[section][key] != value:
                    raise ValueError(f"Conflicting translation in {part}: {key}")
                catalog[section][key] = value
    return catalog


def runtime_keys(root, page):
    path = root / "translations/site/runtime" / (page.replace("/", "--") + ".json")
    if not path.exists():
        return set()
    return set(json.loads(path.read_text(encoding="utf-8"))["strings"])


def validate_runtime_sources(root, pages):
    for page in pages:
        path = root / "translations/site/runtime" / (page.replace("/", "--") + ".json")
        if not path.exists():
            continue
        manifest = json.loads(path.read_text(encoding="utf-8"))
        for source, expected in manifest.get("source_hashes", {}).items():
            actual = runtime_source_hash(root, source)
            if actual != expected:
                raise ValueError("Review dynamic translations after source change: " + source + " (" + str(path) + ")")


def runtime_source_hash(root, source):
    text = (root / source).read_text(encoding="utf-8")
    if source.endswith(".html") and source != "popup.html":
        text = '\n'.join(re.findall(r'<script\b[^>]*>([\s\S]*?)</script\s*>', clean_source(text), re.I))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def record_runtime_sources(root):
    """Record reviewed source versions after updating the authored text lists."""
    for path in sorted((root / 'translations/site/runtime').glob('*.json')):
        manifest = json.loads(path.read_text(encoding='utf-8'))
        page = path.name[:-len('.json')].replace('--', '/')
        sources = list(dict.fromkeys([page] + manifest.get('sources', [])))
        if page == 'docs/settings.html':
            sources.append('popup.html')
        manifest['source_hashes'] = {source:runtime_source_hash(root, source) for source in sources}
        path.write_bytes((json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))


def clean_source(source):
    return LANGUAGE_BLOCK.sub("", source)


def language_links(source, source_page, current_page, languages, language="en", base_path="/beta"):
    """Add a static, keyboard-accessible language menu and reciprocal alternates."""
    source = clean_source(source)
    document = Document(source)
    labels = {"en": "English", **LANGUAGES}
    links, alternates = [], []
    for code in ("en", *languages):
        page = (code + "/" if code != "en" else "") + source_page
        relative = posixpath.relpath(page, posixpath.dirname(current_page) or ".")
        current = ' aria-current="true"' if code == language else ""
        links.append('<a class="site-language-link" href="' + relative + '" lang="' + code + '" hreflang="' + code + '"' + current + '>' + labels[code] + '</a>')
        absolute = ORIGIN + base_path.rstrip("/") + "/" + page
        if absolute.endswith("/index.html"):
            absolute = absolute[:-len("index.html")]
        alternates.append('<link rel="alternate" hreflang="' + code + '" href="' + absolute + '">')
        if code == "en":
            alternates.append('<link rel="alternate" hreflang="x-default" href="' + absolute + '">')
    summary = '<summary title="' + labels[language] + '"><span aria-hidden="true">🌐 </span><span lang="' + language + '">' + labels[language] + '</span></summary>'
    menu = '<details class="site-language-picker" data-site-language-picker data-copy-markdown-ignore>' + summary + '<div class="site-language-options">' + ''.join(links) + '</div></details>'
    asset = lambda path: posixpath.relpath(path, posixpath.dirname(current_page) or ".")
    head = '\n<link rel="stylesheet" href="' + asset("docs/css/site-language.css") + '">\n'
    head += '<script src="' + asset("docs/js/site-language-links.js") + '" defer></script>\n'
    head += '\n'.join(alternates) + '\n'
    navigation = next((end for _, end, tag, attrs in document.tags if tag == "nav" and attrs.get("id") == "ssn-site-nav"), None)
    actions = next((end for _, end, _, attrs in document.tags if "site-actions" in attrs.get("class", "").split()), None)
    if actions is not None:
        position = actions
    elif navigation is not None:
        position = source.index('</nav>', navigation)
    elif document.header_end is not None:
        header_start = next(start for start, _, tag, _ in document.tags if tag == "header")
        container_end = source.rfind('</div>', header_start, document.header_end)
        position = container_end if container_end != -1 else source.rfind('</header>', header_start, document.header_end)
    else:
        position = document.body_start
    block = lambda value: '<!-- ssn-languages:start -->' + value + '<!-- ssn-languages:end -->'
    for start, value in sorted([(position, block(menu)), (document.head_end, block(head))], reverse=True):
        source = source[:start] + value + source[start:]
    return source


def relative_url(value, source_page, localized_page, navigation=False, pages=PAGES, language=LANGUAGE):
    url = urlsplit(value)
    # Preserve external URLs, session links and same-page anchors exactly.
    if url.scheme or url.netloc or not url.path or url.path.startswith("/"):
        return value
    target = posixpath.normpath(posixpath.join(posixpath.dirname(source_page), url.path))
    if target.startswith("../"):
        raise ValueError("Link leaves the site: " + source_page + ": " + value)
    directory_index = posixpath.normpath(posixpath.join(target, "index.html"))
    if directory_index in pages:
        target = directory_index
    # Markdown notes have deliberately not been published under each language.
    markdown_reader = target == "docs/index.html" and "file" in parse_qs(url.query)
    if navigation and target in pages and not markdown_reader:
        target = language + "/" + target
    path = posixpath.relpath(target, posixpath.dirname(localized_page))
    if url.path.endswith("/") and path.endswith("index.html"):
        path = path[:-len("index.html")]
    elif url.path.endswith("/"):
        path += "/"
    return urlunsplit(("", "", path, url.query, url.fragment))


def render(source_page, document, catalog, language=LANGUAGE, pages=PAGES, expanded=False, base_path="/beta", public=False):
    strings = catalog["strings"]
    localized_page = language + "/" + source_page
    english = posixpath.relpath(source_page, posixpath.dirname(localized_page))
    canonical = ORIGIN + base_path.rstrip("/") + "/" + localized_page
    if canonical.endswith("/index.html"):
        canonical = canonical[:-len("index.html")]
    changes = []
    for start, end, key in document.texts:
        raw = document.source[start:end]
        translated = strings[key]
        if translated == key:
            continue
        # Hidden Copy Markdown notes use a heading followed by bullet paragraphs.
        # Catalog keys normalize whitespace; retain the authored Markdown layout.
        if start in document.markdown_texts and '\n' not in translated:
            indents = re.findall(r'(?m)^([ \t]*)- ', raw)
            if indents and translated.count(' - ') != len(indents):
                raise ValueError('Preserve Markdown bullet layout in translation: ' + key)
            if indents:
                pieces = translated.split(' - ')
                translated = pieces[0] + ''.join('\n\n' + indent + '- ' + piece for indent, piece in zip(indents, pieces[1:]))
        leading = re.match(r"\s*", raw).group()
        trailing = re.search(r"\s*$", raw).group()
        changes.append((start, end, leading + html.escape(translated, quote=False) + trailing))
    for start, end, tag, attrs in document.tags:
        raw = document.source[start:end]
        if tag == "link" and attrs.get("rel") == "canonical":
            changes.append((start, end, '<link rel="canonical" href="' + canonical + '">' if expanded else ""))
            continue
        if not expanded and tag == "meta" and (attrs.get("name") or attrs.get("property")) in {"og:url", "twitter:url"}:
            changes.append((start, end, ""))
            continue
        if tag == "meta" and attrs.get("name") == "ssn-language-alternate":
            changes.append((start, end, '<meta name="ssn-language-alternate" content="' + english + '" data-label="English" data-lang="en">'))
            continue

        def attribute(match):
            name = match.group(1).lower()
            value = html.unescape(next(v for v in match.groups()[1:] if v is not None))
            if translatable_attribute(tag, attrs, name) and value:
                value = strings[normalized(value)]
            elif name in {"href", "src", "poster", "action"}:
                value = relative_url(value, source_page, localized_page, tag == "a" and name == "href", pages, language)
            elif tag == "html" and name == "lang":
                value = language
            elif tag == "meta" and name == "content":
                key = attrs.get("name") or attrs.get("property")
                if key == "robots":
                    value = value if public else "noindex, follow"
                elif key == "og:locale":
                    value = LOCALES[language]
                elif expanded and key in {"og:url", "twitter:url"}:
                    value = canonical
            return match.group(1) + '="' + html.escape(value, quote=True) + '"'

        updated = ATTRIBUTE.sub(attribute, raw)
        if tag == "html":
            root = posixpath.relpath(".", posixpath.dirname(localized_page)) + "/"
            updated = updated[:-1] + ' data-site-root="' + root + '" data-site-language="' + language + '">'
            if language == "ar":
                updated = updated[:-1] + ' dir="rtl">'
        if updated != raw:
            changes.append((start, end, updated))
    # The pilot has no production canonical/hreflang targets until publication.
    # Its localized metadata is owned here, including when the SEO pass runs.
    config = json.dumps(catalog["ui"], ensure_ascii=False).replace("<", "\\u003c")
    additions = '\n<meta name="ssn-translation-pilot" content="' + language + '">\n'
    if expanded:
        config_data = {"language": language, "page": source_page, "pages": list(pages), "ui": catalog["ui"],
                       "strings": {key: strings[key] for key in sorted(strings_for(document) | catalog.get("runtime", set()))}}
        config = json.dumps(config_data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
        additions = '\n<meta name="ssn-site-translation" content="' + language + '">\n'
    additions += '<script id="ssn-site-language" type="application/json">' + config + '</script>\n'
    if expanded:
        runtime = relative_url("docs/js/site-language.js", "index.html", localized_page, pages=pages, language=language)
        # Load before deferred page callbacks, after the JSON configuration exists.
        additions += '<script src="' + runtime + '"></script>\n'
    changes.append((document.head_end, document.head_end, additions))
    start = posixpath.relpath(language + "/docs/getting-started.html", posixpath.dirname(localized_page))
    notice = ('\n<aside class="site-language-notice" data-copy-markdown-ignore aria-label="Idioma">'
              '<div class="container"><span>' + html.escape(catalog.get("notice", "")) + '</span> '
              '<a href="' + start + '">Primeros pasos</a> · '
              '<a class="site-language-link" href="' + english + '" lang="en" hreflang="en">English</a>'
              '</div></aside>\n')
    if not expanded:
        position = document.header_end or document.body_start
        changes.append((position, position, notice))
    output = document.source
    for start, end, replacement in sorted(changes, reverse=True):
        output = output[:start] + replacement + output[end:]
    # Match the SEO pass's head whitespace cleanup so both builders are stable.
    head_end = output.index('</head>')
    output = re.sub(r'(?m)^[\t ]+(?=\r?$)', '', output[:head_end]) + output[head_end:]
    return output


def build(root, check=False, extract=False, language=LANGUAGE, pages=None, expanded=False, base_path="/beta", public=False, languages=None):
    pages = tuple(pages or PAGES)
    catalog = load_catalog(root, language)
    documents = {page: Document(clean_source((root / page).read_text(encoding="utf-8"))) for page in pages}
    required = set().union(*(strings_for(document) for document in documents.values()))
    if expanded:
        validate_runtime_sources(root, pages)
        required.update(set().union(*(runtime_keys(root, page) for page in pages)))
    missing = sorted(key for key in required if not isinstance(catalog["strings"].get(key), str) or not catalog["strings"][key])
    if extract:
        print(json.dumps({key: catalog["strings"].get(key) for key in sorted(required)}, ensure_ascii=False, indent=2))
        return
    if missing:
        raise ValueError("Missing " + language + " translations (English text may have changed):\n" + "\n".join(missing))
    for key in required:
        if set(re.findall(r'\{[A-Za-z_0-9]+\}', key)) != set(re.findall(r'\{[A-Za-z_0-9]+\}', catalog["strings"][key])):
            raise ValueError("Translation changed placeholders: " + language + ": " + key)
    drift = []
    for page, document in documents.items():
        catalog["runtime"] = runtime_keys(root, page)
        output = render(page, document, catalog, language, pages, expanded, base_path, public)
        if expanded:
            output = language_links(output, page, language + "/" + page, languages or (language,), language, base_path)
        output = output.encode("utf-8")
        destination = root / language / page
        if not destination.exists() or destination.read_bytes() != output:
            drift.append(page)
            if not check:
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(output)
    if check and drift:
        raise ValueError("Generated " + language + " pages need rebuilding: " + ", ".join(drift))
    print(f"{language}: {len(documents)} pages, {len(required)} translated strings; {len(drift)} {'outdated' if check else 'updated'} pages.")
    if expanded and "docs/index.html" in pages:
        search_spec = importlib.util.spec_from_file_location("docs_search", Path(__file__).with_name("build-docs-search-index.py"))
        search = importlib.util.module_from_spec(search_spec)
        search_spec.loader.exec_module(search)
        index = search.build_index(root / language / "docs")
        data = (json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
        path = root / language / "docs/search-index.json"
        if check:
            if not path.exists() or path.read_bytes() != data:
                raise ValueError("Localized search index needs rebuilding: " + str(path))
        else:
            path.write_bytes(data)


def publish_english_links(root, pages, languages, base_path, check=False):
    for page in pages:
        path = root / page
        source = path.read_text(encoding="utf-8")
        output = language_links(source, page, page, languages, base_path=base_path)
        if check:
            if source != output:
                raise ValueError("Language links need rebuilding: " + page)
        elif source != output:
            path.write_bytes(output.encode("utf-8"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--extract", action="store_true", help="Print current English strings and saved translations; null means missing.")
    parser.add_argument("--language", choices=LANGUAGES, default=LANGUAGE)
    parser.add_argument("--all-pages", action="store_true")
    parser.add_argument("--pages", nargs="+", help="Build selected public pages while preparing a language.")
    parser.add_argument("--base-path", default="/beta", help="URL prefix of the deployment, empty for production.")
    parser.add_argument("--public", action="store_true", help="Use production indexability; beta remains noindex by default.")
    parser.add_argument("--languages", nargs="+", choices=LANGUAGES, help="Build and link several complete language editions.")
    parser.add_argument("--publish-links", action="store_true", help="Also generate language menus in the English deployment pages.")
    parser.add_argument("--published", action="store_true", help="Use the language list in translations/site/publish.json.")
    parser.add_argument("--record-runtime-sources", action="store_true", help="Save reviewed source hashes after updating dynamic text manifests.")
    args = parser.parse_args()
    try:
        root = args.root.resolve()
        if args.record_runtime_sources:
            record_runtime_sources(root)
            parser.exit(0, 'Recorded reviewed dynamic text sources.\n')
        selected = public_pages(root) if args.all_pages else args.pages
        languages = args.languages or [args.language]
        if args.published:
            languages = json.loads((root / 'translations/site/publish.json').read_text(encoding='utf-8'))['languages']
            if not languages or any(language not in LANGUAGES for language in languages):
                raise ValueError('Invalid published website language list')
            selected = public_pages(root)
        for language in languages:
            build(root, args.check, args.extract, language, selected, bool(selected), args.base_path, args.public, languages)
        if args.publish_links or args.published:
            publish_english_links(root, selected or PAGES, languages, args.base_path, args.check)
    except ValueError as error:
        parser.exit(1, str(error) + "\n")
