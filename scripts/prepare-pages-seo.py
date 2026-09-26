#!/usr/bin/env python3
"""Maintain static SEO metadata, packaged favicons and the public sitemap.

Works on the checkout and the assembled Pages payload, including /beta/.
Only document heads are edited; body scripts and templates are preserved.
"""
import argparse
import html
import json
import os
import re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit
from xml.sax.saxutils import escape as xml_escape

ORIGIN = "https://socialstream.ninja"
BRAND = "Social Stream Ninja"
PUBLIC_ROOT_PAGES = {
    "index.html", "landing.html", "beta.html", "fonts.html", "privacy.html",
    "TOS.html", "streamelements-importer.html", "streamerbot.html",
}
PUBLIC_GUIDE_FOLDERS = {"docs", "lite", "streamdeck"}
SKIP_DIRECTORIES = {
    "node_modules", "thirdparty", "vendor", "tests", "scripts", "tmp",
    "artifacts", "test-results", "playwright-report", "public-shop-assets",
}
ALIASES = {"landing.html": "index.html"}
OVERRIDES = json.loads(Path(__file__).with_name("seo-pages.json").read_text(encoding="utf-8"))


class PageHead(HTMLParser):
    """Record source spans without matching markup inside scripts or templates."""
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.offsets = [0] + [m.end() for m in re.finditer("\n", source)]
        self.html_tag = self.head_start = self.head_end = None
        self.title = self.title_start = None
        self.tags = []
        self.feed(source)

    def source_position(self):
        line, column = self.getpos()
        return self.offsets[line - 1] + column

    def handle_starttag(self, tag, attrs):
        start = self.source_position()
        end = start + len(self.get_starttag_text())
        attrs = dict(attrs)
        if tag == "html" and self.html_tag is None:
            self.html_tag = (start, end, attrs)
        if tag == "head" and self.head_start is None:
            self.head_start = end
        if self.head_start is None or self.head_end is not None:
            return
        if tag in {"meta", "link"}:
            self.tags.append((start, end, tag, attrs))
        elif tag == "title" and self.title_start is None:
            self.title_start = (start, end)

    def handle_endtag(self, tag):
        if self.head_start is None or self.head_end is not None:
            return
        if tag == "head":
            self.head_end = self.source_position()
        elif tag == "title" and self.title_start is not None and self.title is None:
            start, content_start = self.title_start
            content_end = self.source_position()
            end = self.source.find(">", content_end) + 1
            self.title = (start, end, content_start, content_end,
                          html.unescape(self.source[content_start:content_end]).strip())

    def meta(self, key):
        return [t for t in self.tags if t[2] == "meta" and
                str(t[3].get("name") or t[3].get("property") or "").lower() == key]

    def links(self, rel):
        return [t for t in self.tags if t[2] == "link" and
                rel in str(t[3].get("rel") or "").lower().split()]


def eligible(relative):
    return not any(p.startswith(".") or p in SKIP_DIRECTORIES or
                   p.startswith(("tmp-", "tmp_")) for p in relative.parts)


def is_public(relative):
    if relative.as_posix() in PUBLIC_ROOT_PAGES:
        return True
    if len(relative.parts) == 2 and relative.parts[0] in PUBLIC_GUIDE_FOLDERS:
        return True
    return relative.parent.as_posix() == "actions" and relative.name.endswith("-guide.html")


def canonical_url(relative):
    path = ALIASES.get(relative.as_posix(), relative.as_posix())
    if path == "index.html":
        path = ""
    elif path.endswith("/index.html"):
        path = path[:-len("index.html")]
    return ORIGIN + "/" + quote(path, safe="/")


def local_asset(root, page, href):
    url = urlsplit(href)
    if url.scheme or url.netloc or not url.path:
        return None
    target = (root / unquote(url.path.lstrip("/")) if url.path.startswith("/")
              else page.parent / unquote(url.path)).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError:
        return None
    return target if target.is_file() else None


def fallback_icon(root, page, content_root):
    # Relative paths work in file://, extension packages, Electron and /beta/.
    candidates = [content_root / "icons/favicon.ico", content_root / "favicon.ico"]
    if page.parent.name == "streamdeck":
        candidates.insert(0, page.parent / "images/favicon.ico")
    for candidate in candidates:
        if candidate.is_file():
            return Path(os.path.relpath(candidate, page.parent)).as_posix()
    raise ValueError("No packaged favicon for " + str(page.relative_to(root)))


def description_for(relative, title, head):
    override = OVERRIDES.get(relative.as_posix(), {}).get("description")
    if override:
        return override
    current = head.meta("description")
    if current and str(current[0][3].get("content") or "").strip():
        return current[0][3]["content"].strip()
    subject = re.sub(r"\s*[-|–—·]\s*Social Stream(?: Ninja)?\s*$", "", title, flags=re.I)
    subject = re.sub(r"^Social Stream(?: Ninja)?\s*[-|–—·]\s*", "", subject, flags=re.I)
    if relative.parts[0] == "themes":
        return f"{subject}: a Social Stream Ninja chat overlay for OBS. Use your session link to display live messages from your connected chat sources."
    if relative.parts[0] == "games":
        return f"{subject}: an interactive stream activity for Social Stream Ninja. Connect your chat session and add the game to your OBS scene."
    if relative.parts[0] == "sources":
        return f"{subject}: a chat source connection page for Social Stream Ninja. Use it with the app or extension to bring chat into your session."
    if is_public(relative):
        return f"{subject}. Setup instructions and practical help for using Social Stream Ninja with live chat, OBS and streaming tools."
    return f"{subject}. Part of the Social Stream Ninja toolkit for managing live chat, stream overlays and audience interactions."


def prepare_page(root, path):
    relative = path.relative_to(root)
    beta = relative.parts[0] == "beta"
    logical = Path(*relative.parts[1:]) if beta else relative
    content_root = root / "beta" if beta else root
    source = path.read_bytes().decode("utf-8")
    head = PageHead(source)
    if head.head_start is None or head.head_end is None:
        return source, None  # Fragments are not standalone pages.
    body_tail = source[head.head_end:]
    changes, additions = [], []
    public = is_public(logical)
    existing_robots = ",".join(str(t[3].get("content") or "") for t in head.meta("robots"))
    indexable = public and not beta and not re.search(r"\b(noindex|none)\b", existing_robots, re.I)

    def replace_tags(tags, markup):
        if tags:
            changes.append((tags[0][0], tags[0][1], markup))
            changes.extend((t[0], t[1], "") for t in tags[1:])
        elif markup:
            additions.append(markup)

    def meta(key, value, attribute="name"):
        replace_tags(head.meta(key), '<meta ' + attribute + '="' + key + '" content="' + html.escape(value, quote=True) + '">')

    title = OVERRIDES.get(logical.as_posix(), {}).get("title") or (head.title[4] if head.title else "")
    title = title or logical.stem.replace("_", " ").replace("-", " ").title() + " - " + BRAND
    if head.title:
        if title != head.title[4]:
            changes.append((head.title[2], head.title[3], html.escape(title)))
    else:
        additions.append("<title>" + html.escape(title) + "</title>")
    description = description_for(logical, title, head)
    meta("description", description)
    # Retain stricter authored directives, adding noindex for runtime/beta pages.
    if not public or beta:
        directives = [x.strip().lower() for x in existing_robots.split(",") if x.strip()]
        directives = [x for x in directives if x != "index"]
        if "noindex" not in directives and "none" not in directives:
            directives.insert(0, "noindex")
        meta("robots", ", ".join(dict.fromkeys(directives)))
    elif not head.meta("robots"):
        meta("robots", "index, follow, max-image-preview:large")
    canonical = canonical_url(logical)
    replace_tags(head.links("canonical"), '<link rel="canonical" href="' + html.escape(canonical, quote=True) + '">' if public else "")

    icons = head.links("icon")
    for start, end, tag, attrs in icons:
        href = str(attrs.get("href") or "")
        if href.startswith("data:image/") or local_asset(root, path, href):
            continue
        # Source tabs keep their platform branding using packaged images.
        provider_icon = content_root / "sources/images" / (logical.stem + ".png")
        if logical.parts[0] == "sources" and provider_icon.is_file():
            href = Path(os.path.relpath(provider_icon, path.parent)).as_posix()
            mime = "image/png"
        else:
            href, mime = fallback_icon(root, path, content_root), "image/x-icon"
        icon_id = ' id="' + html.escape(attrs["id"], quote=True) + '"' if attrs.get("id") else ""
        changes.append((start, end, '<link rel="icon"' + icon_id + ' href="' + href + '" type="' + mime + '">'))
    if not icons:
        additions.append('<link rel="icon" href="' + fallback_icon(root, path, content_root) + '" type="image/x-icon">')

    if public:
        for key, value in {
            "og:type": "website", "og:site_name": BRAND, "og:locale": "en_US",
            "og:url": canonical, "og:title": title, "og:description": description,
            "og:image": ORIGIN + "/media/logo.png", "og:image:width": "1024",
            "og:image:height": "1024", "og:image:alt": "Social Stream Ninja logo",
        }.items():
            meta(key, value, "property")
        # The existing brand image is square, so use a matching summary card.
        for key, value in {
            "twitter:card": "summary", "twitter:url": canonical,
            "twitter:title": title, "twitter:description": description,
            "twitter:image": ORIGIN + "/media/logo.png",
            "twitter:image:alt": "Social Stream Ninja logo",
        }.items():
            meta(key, value)
    if head.html_tag and not head.html_tag[2].get("lang"):
        start, end, attrs = head.html_tag
        changes.append((start, end, source[start:end - 1] + ' lang="en">'))
    encoding_tags = [t for t in head.tags if t[2] == "meta" and (t[3].get("charset") or
                     (str(t[3].get("http-equiv") or "").lower() == "content-type" and
                      "charset=" in str(t[3].get("content") or "").lower()))]
    if not encoding_tags:
        additions.insert(0, '<meta charset="UTF-8">')
    elif additions:
        # The encoding declaration must stay in the first 1024 bytes, ahead of
        # social metadata and existing inline theme/bootstrap scripts.
        first = encoding_tags[0]
        additions.insert(0, source[first[0]:first[1]])
        changes.extend((t[0], t[1], "") for t in encoding_tags)
    if additions:
        newline = "\r\n" if "\r\n" in source else "\n"
        changes.append((head.head_start, head.head_start, newline + "    " + (newline + "    ").join(additions)))
    for start, end, value in sorted(changes, reverse=True):
        source = source[:start] + value + source[end:]
    # Moving encoding tags or removing duplicate metadata can leave indented
    # empty lines. Clean only the head; body/template bytes must stay intact.
    prefix = source[:-len(body_tail)]
    source = re.sub(r"(?m)^[\t ]+(?=\r?$)", "", prefix) + body_tail
    return source, {"path": relative.as_posix(), "title": title, "indexable": indexable,
                    "canonical": canonical if public else None, "description": description}


def sitemap(records):
    urls = sorted({r["canonical"] for r in records if r["indexable"]})
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    lines += ["  <url><loc>" + xml_escape(url) + "</loc></url>" for url in urls]
    return "\n".join(lines + ["</urlset>", ""])


def prepare(root, check=False):
    records, changed = [], []
    for path in sorted(root.rglob("*.html")):
        if not eligible(path.relative_to(root)):
            continue
        updated, record = prepare_page(root, path)
        if record:
            records.append(record)
        if updated.encode("utf-8") != path.read_bytes():
            changed.append(path.relative_to(root).as_posix())
            if not check:
                path.write_bytes(updated.encode("utf-8"))
    sitemap_path = root / "sitemap.xml"
    output = sitemap(records).encode("utf-8")
    if not sitemap_path.exists() or sitemap_path.read_bytes() != output:
        changed.append("sitemap.xml")
        if not check:
            sitemap_path.write_bytes(output)
    return changed, records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--check", action="store_true", help="Check for drift without modifying files.")
    args = parser.parse_args()
    root = args.root.resolve()
    if not root.is_dir():
        parser.error(f"root does not exist: {root}")
    changed, records = prepare(root, args.check)
    counts = Counter("indexable" if r["indexable"] else "noindex" for r in records)
    print(f"Checked {len(records)} pages: {counts['indexable']} indexable, {counts['noindex']} noindex.")
    print(f"{'Need updating' if args.check else 'Updated'}: {len(changed)} files (including sitemap).")
    if args.check and changed:
        for path in changed:
            print("  " + path)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
