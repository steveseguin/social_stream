#!/usr/bin/env python3
"""Apply deployment-only SEO metadata to the GitHub Pages payload."""

import argparse
import re
from pathlib import Path


INDEXABLE_ROOT_HTML = {
    "affiliate.html",
    "beta.html",
    "fonts.html",
    "index.html",
    "landing.html",
    "privacy.html",
    "tos.html",
}

RUNTIME_PREFIXES = (
    "games/",
    "sources/websocket/",
    "themes/",
)

RUNTIME_PATHS = {
    "actions/index.html",
}

ROBOTS_META_RE = re.compile(
    r"""<meta\b(?=[^>]*\bname\s*=\s*["']robots["'])[^>]*>""",
    re.IGNORECASE,
)
HOME_CANONICAL_RE = re.compile(
    r"""\s*<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])(?=[^>]*\bhref\s*=\s*["']https://socialstream\.ninja/?["'])[^>]*>\s*""",
    re.IGNORECASE,
)
HEAD_RE = re.compile(r"<head\b[^>]*>", re.IGNORECASE)
HTML_RE = re.compile(r"<html\b[^>]*>", re.IGNORECASE)
NOINDEX_META = '<meta name="robots" content="noindex">'


def is_runtime_page(relative_path):
    path = relative_path.as_posix()
    if path in RUNTIME_PATHS or path.startswith(RUNTIME_PREFIXES):
        return True
    return len(relative_path.parts) == 1 and relative_path.name.lower() not in INDEXABLE_ROOT_HTML


def add_noindex(path, remove_home_canonical=False):
    html = path.read_text(encoding="utf-8")
    if remove_home_canonical:
        html = HOME_CANONICAL_RE.sub("\n", html)

    if ROBOTS_META_RE.search(html):
        updated = ROBOTS_META_RE.sub(NOINDEX_META, html)
    else:
        updated, replacements = HEAD_RE.subn(
            lambda match: match.group(0) + "\n    " + NOINDEX_META,
            html,
            count=1,
        )
        if not replacements:
            updated, replacements = HTML_RE.subn(
                lambda match: (
                    match.group(0)
                    + "\n<head>\n    "
                    + NOINDEX_META
                    + "\n</head>"
                ),
                html,
                count=1,
            )
        if not replacements:
            print(f"Skipped SEO metadata for HTML fragment without <html>: {path}")
            return False

    if updated != html:
        path.write_text(updated, encoding="utf-8", newline="")
        return True
    return False


def prepare(root):
    changed = 0
    beta_root = root / "beta"

    if beta_root.is_dir():
        for path in sorted(beta_root.rglob("*.html")):
            changed += add_noindex(path)

    for path in sorted(root.rglob("*.html")):
        relative_path = path.relative_to(root)
        if relative_path.parts[0] == "beta":
            continue
        if is_runtime_page(relative_path):
            changed += add_noindex(path, remove_home_canonical=True)

    return changed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()

    root = args.root.resolve()
    if not root.is_dir():
        parser.error(f"deployment root does not exist: {root}")

    changed = prepare(root)
    print(f"Prepared SEO metadata in {changed} deployed HTML files")


if __name__ == "__main__":
    main()
