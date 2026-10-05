#!/usr/bin/env python3
"""Validate local links, assets, viewer targets, anchors, and IDs in docs HTML."""

import argparse
import re
import sys
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit


SKIPPED_SCHEMES = {"data", "javascript", "mailto", "tel", "blob"}
REPO_RELATIVE_PREFIXES = (
    ".github/",
    "actions/",
    "docs/",
    "doc/",
    "lite/",
    "providers/",
    "scripts/",
    "shared/",
    "sources/",
    "themes/",
    "thirdparty/",
)
MARKDOWN_LINK_PATTERN = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = Counter()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if attributes.get("id"):
            self.ids[attributes["id"]] += 1
        if tag.lower() == "a" and attributes.get("name"):
            self.ids[attributes["name"]] += 1
        for attribute in ("href", "src"):
            if attributes.get(attribute):
                self.links.append((self.getpos()[0], attribute, attributes[attribute]))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)


def resolve_target(repo_root, source, raw_path):
    decoded = unquote(raw_path).replace("\\", "/")
    if decoded.startswith("/"):
        return (repo_root / decoded.lstrip("/")).resolve()
    return (source.parent / decoded).resolve()


def markdown_target_value(raw_value):
    value = raw_value.strip()
    if value.startswith("<") and ">" in value:
        return value[1 : value.index(">")]
    return value.split()[0] if value else ""


def validate(repo_root, docs_root):
    pages = {}
    errors = set()
    checked_links = 0
    inbound_public_links = defaultdict(set)

    for path in sorted(docs_root.rglob("*.html")):
        parser = LinkParser()
        parser.feed(path.read_text(encoding="utf-8", errors="replace"))
        pages[path.resolve()] = parser
        for anchor_id, count in parser.ids.items():
            if count > 1:
                errors.add((path, 0, f'duplicate id "{anchor_id}"'))

    generated_skill_zip = (docs_root / "skills" / "control-social-stream.zip").resolve()
    generated_paths = {generated_skill_zip}

    for source, parser in pages.items():
        for line, attribute, raw_value in parser.links:
            value = raw_value.strip()
            if (
                not value
                or value == "#"
                or value.startswith("//")
                or any(marker in value for marker in ("{{", "}}", "${", "<%"))
            ):
                continue

            try:
                parts = urlsplit(value)
            except ValueError as error:
                errors.add((source, line, f'invalid {attribute} "{value}": {error}'))
                continue

            if parts.scheme.lower() in SKIPPED_SCHEMES or parts.scheme or parts.netloc:
                continue

            checked_links += 1
            target = source if not parts.path else resolve_target(repo_root, source, parts.path)
            if not target.exists() and target not in generated_paths:
                errors.add((source, line, f'missing {attribute} target "{value}"'))
                continue
            if (
                attribute == "href"
                and target.parent == docs_root
                and target.suffix.lower() == ".html"
                and target != source
            ):
                inbound_public_links[target].add(source)

            query = parse_qs(parts.query)
            if target == (docs_root / "index.html").resolve() and query.get("file"):
                for requested_file in query["file"]:
                    viewer_target = (docs_root / unquote(requested_file)).resolve()
                    try:
                        viewer_target.relative_to(docs_root)
                    except ValueError:
                        errors.add((source, line, f'viewer target escapes docs root: "{value}"'))
                        continue
                    if not viewer_target.is_file():
                        errors.add((source, line, f'missing viewer target "{requested_file}"'))
                continue

            fragment = unquote(parts.fragment)
            if fragment and fragment.lower() != "top" and target.suffix.lower() == ".html":
                target_parser = pages.get(target)
                if target_parser and fragment not in target_parser.ids:
                    errors.add((source, line, f'missing anchor "#{fragment}" in "{value}"'))

    public_pages = sorted(docs_root.glob("*.html"))
    for public_page in public_pages:
        if public_page.name != "index.html" and not inbound_public_links[public_page.resolve()]:
            errors.add((public_page.resolve(), 0, "public documentation page has no inbound HTML link"))

    checked_markdown_links = 0
    for source in sorted(docs_root.rglob("*.md")):
        markdown = source.read_text(encoding="utf-8", errors="replace")
        for match in MARKDOWN_LINK_PATTERN.finditer(markdown):
            value = markdown_target_value(match.group(1))
            if not value or value.startswith(("#", "//")):
                continue
            try:
                parts = urlsplit(value)
            except ValueError as error:
                line = markdown.count("\n", 0, match.start()) + 1
                errors.add((source, line, f'invalid Markdown link "{value}": {error}'))
                continue
            if parts.scheme.lower() in SKIPPED_SCHEMES or parts.scheme or parts.netloc:
                continue

            raw_path = unquote(parts.path).replace("\\", "/")
            if not raw_path or any(marker in raw_path for marker in ("*", "?", "{", "}")):
                continue
            checked_markdown_links += 1
            if raw_path.startswith(REPO_RELATIVE_PREFIXES):
                target = (repo_root / raw_path).resolve()
            else:
                target = (source.parent / raw_path).resolve()
            line = markdown.count("\n", 0, match.start()) + 1
            try:
                target.relative_to(repo_root)
            except ValueError:
                errors.add((source, line, f'Markdown link escapes repository: "{value}"'))
                continue
            if not target.exists():
                errors.add((source, line, f'missing Markdown target "{value}"'))
                continue
            fragment = unquote(parts.fragment)
            if fragment and target.suffix.lower() == ".html":
                target_parser = pages.get(target)
                if target_parser and fragment not in target_parser.ids:
                    errors.add((source, line, f'missing anchor "#{fragment}" in "{value}"'))

    return (
        checked_links,
        checked_markdown_links,
        len(public_pages),
        sorted(errors, key=lambda item: (str(item[0]), item[1], item[2])),
    )


def main():
    default_repo_root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=default_repo_root)
    parser.add_argument("--docs-root", type=Path)
    args = parser.parse_args()

    repo_root = args.repo_root.resolve()
    docs_root = (args.docs_root or repo_root / "docs").resolve()
    if not docs_root.is_dir():
        parser.error(f"docs root does not exist: {docs_root}")

    checked_links, checked_markdown_links, public_page_count, errors = validate(repo_root, docs_root)
    if errors:
        for source, line, message in errors:
            location = source.relative_to(repo_root).as_posix()
            if line:
                location += f":{line}"
            print(f"{location}: {message}", file=sys.stderr)
        print(f"Documentation link validation failed with {len(errors)} error(s).", file=sys.stderr)
        return 1

    print(
        "Documentation link validation passed "
        f"({checked_links} HTML links, {checked_markdown_links} Markdown links, "
        f"and {public_page_count} discoverable public pages checked)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
