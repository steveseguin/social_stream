#!/usr/bin/env python3
"""Build the Spanish website pilot from English HTML and a saved catalog.

No network calls or third-party packages. Missing translations fail the build.
Only the three explicitly listed pages are generated; other links retain their
English destinations. Assets are shared with the original site.
"""
import argparse
import html
import json
import posixpath
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

PAGES = ("index.html", "docs/download.html", "docs/getting-started.html")
LANGUAGE = "es"
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
SKIP = {"script", "style", "code", "pre", "svg"}
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
        self.pending = None
        self.head_end = self.header_end = None
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
        self.pending = None

    def handle_starttag(self, tag, attrs):
        self.flush()
        start = self.position()
        self.tags.append((start, start + len(self.get_starttag_text()), tag, dict(attrs)))
        if tag not in VOID:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.stack.pop()

    def handle_endtag(self, tag):
        self.flush()
        if tag == "head":
            self.head_end = self.position()
        if tag == "header":
            self.header_end = self.source.index(">", self.position()) + 1
        if tag in self.stack:
            self.stack = self.stack[:len(self.stack) - 1 - self.stack[::-1].index(tag)]

    def handle_comment(self, data):
        self.flush()

    def handle_data(self, data):
        if not any(tag in SKIP for tag in self.stack):
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


def relative_url(value, source_page, localized_page, navigation=False):
    url = urlsplit(value)
    # Preserve external URLs, session links and same-page anchors exactly.
    if url.scheme or url.netloc or not url.path or url.path.startswith("/"):
        return value
    target = posixpath.normpath(posixpath.join(posixpath.dirname(source_page), url.path))
    if target.startswith("../"):
        raise ValueError("Link leaves the site: " + source_page + ": " + value)
    if navigation and target in PAGES:
        target = LANGUAGE + "/" + target
    path = posixpath.relpath(target, posixpath.dirname(localized_page))
    if url.path.endswith("/"):
        path += "/"
    return urlunsplit(("", "", path, url.query, url.fragment))


def render(source_page, document, catalog):
    strings = catalog["strings"]
    localized_page = LANGUAGE + "/" + source_page
    english = posixpath.relpath(source_page, posixpath.dirname(localized_page))
    changes = []
    for start, end, key in document.texts:
        raw = document.source[start:end]
        leading = re.match(r"\s*", raw).group()
        trailing = re.search(r"\s*$", raw).group()
        changes.append((start, end, leading + html.escape(strings[key], quote=False) + trailing))
    for start, end, tag, attrs in document.tags:
        raw = document.source[start:end]
        if tag == "link" and attrs.get("rel") == "canonical":
            changes.append((start, end, ""))
            continue
        if tag == "meta" and (attrs.get("name") or attrs.get("property")) in {"og:url", "twitter:url"}:
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
                value = relative_url(value, source_page, localized_page, tag == "a" and name == "href")
            elif tag == "html" and name == "lang":
                value = LANGUAGE
            elif tag == "meta" and name == "content":
                key = attrs.get("name") or attrs.get("property")
                if key == "robots":
                    value = "noindex, follow"
                elif key == "og:locale":
                    value = "es_ES"
            return match.group(1) + '="' + html.escape(value, quote=True) + '"'

        updated = ATTRIBUTE.sub(attribute, raw)
        if tag == "html":
            root = posixpath.relpath(".", posixpath.dirname(localized_page)) + "/"
            updated = updated[:-1] + ' data-site-root="' + root + '" data-site-language="es">'
        if updated != raw:
            changes.append((start, end, updated))
    # The pilot has no production canonical/hreflang targets until publication.
    # Its localized metadata is owned here, including when the SEO pass runs.
    config = json.dumps(catalog["ui"], ensure_ascii=False).replace("<", "\\u003c")
    additions = '\n<meta name="ssn-translation-pilot" content="es">\n'
    additions += '<script id="ssn-site-language" type="application/json">' + config + '</script>\n'
    changes.append((document.head_end, document.head_end, additions))
    start = posixpath.relpath("es/docs/getting-started.html", posixpath.dirname(localized_page))
    notice = ('\n<aside class="site-language-notice" data-copy-markdown-ignore aria-label="Idioma">'
              '<div class="container"><span>' + html.escape(catalog["notice"]) + '</span> '
              '<a href="' + start + '">Primeros pasos</a> · '
              '<a class="site-language-link" href="' + english + '" lang="en" hreflang="en">English</a>'
              '</div></aside>\n')
    changes.append((document.header_end, document.header_end, notice))
    output = document.source
    for start, end, replacement in sorted(changes, reverse=True):
        output = output[:start] + replacement + output[end:]
    # Match the SEO pass's head whitespace cleanup so both builders are stable.
    head_end = output.index('</head>')
    output = re.sub(r'(?m)^[\t ]+(?=\r?$)', '', output[:head_end]) + output[head_end:]
    return output


def build(root, check=False, extract=False):
    catalog_path = root / "translations/site/es.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    documents = {page: Document((root / page).read_text(encoding="utf-8")) for page in PAGES}
    required = set().union(*(strings_for(document) for document in documents.values()))
    missing = sorted(key for key in required if not isinstance(catalog["strings"].get(key), str) or not catalog["strings"][key])
    if extract:
        print(json.dumps({key: catalog["strings"].get(key) for key in sorted(required)}, ensure_ascii=False, indent=2))
        return
    if missing:
        raise ValueError("Missing Spanish translations (English text may have changed):\n" + "\n".join(missing))
    drift = []
    for page, document in documents.items():
        output = render(page, document, catalog).encode("utf-8")
        destination = root / LANGUAGE / page
        if not destination.exists() or destination.read_bytes() != output:
            drift.append(page)
            if not check:
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(output)
    if check and drift:
        raise ValueError("Generated Spanish pages need rebuilding: " + ", ".join(drift))
    print(f"Spanish pilot: {len(documents)} pages, {len(required)} translated strings; {len(drift)} {'outdated' if check else 'updated'} pages.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--extract", action="store_true", help="Print current English strings and saved translations; null means missing.")
    args = parser.parse_args()
    try:
        build(args.root.resolve(), args.check, args.extract)
    except ValueError as error:
        parser.exit(1, str(error) + "\n")
