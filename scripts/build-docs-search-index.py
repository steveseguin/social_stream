#!/usr/bin/env python3
"""Build the static full-text index used by docs/index.html."""

import argparse
import html
import json
import re
import unicodedata
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path


STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "but",
    "by",
    "can",
    "do",
    "does",
    "for",
    "from",
    "had",
    "has",
    "have",
    "how",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "may",
    "more",
    "of",
    "on",
    "or",
    "our",
    "page",
    "see",
    "should",
    "that",
    "the",
    "their",
    "then",
    "this",
    "to",
    "use",
    "using",
    "was",
    "were",
    "when",
    "where",
    "which",
    "while",
    "will",
    "with",
    "you",
    "your",
}

IGNORED_HTML_TAGS = {
    "script",
    "style",
    "noscript",
    "template",
    "svg",
    "header",
    "footer",
    "nav",
}

VOID_HTML_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}

EXCLUDED_DIRECTORIES = {"_templates", "issues", "md", "skills"}
TOKEN_PATTERN = re.compile(r"[a-z0-9]{2,}")
SPACE_PATTERN = re.compile(r"\s+")


class DocsHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title_parts = []
        self.description = ""
        self.headings = []
        self.text_parts = []
        self.in_title = False
        self.heading_tag = ""
        self.heading_parts = []
        self.ignored_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        attributes = dict(attrs)

        if tag == "meta" and attributes.get("name", "").lower() == "description":
            self.description = clean_text(attributes.get("content", ""))

        if self.ignored_depth:
            if tag not in VOID_HTML_TAGS:
                self.ignored_depth += 1
            return

        if tag in IGNORED_HTML_TAGS:
            self.ignored_depth = 1
            return

        if tag == "title":
            self.in_title = True
        elif tag in {"h1", "h2", "h3", "h4"}:
            self.heading_tag = tag
            self.heading_parts = []
        elif tag in {"p", "li", "td", "th", "section", "article", "main"}:
            self.text_parts.append(" ")

    def handle_endtag(self, tag):
        tag = tag.lower()
        if self.ignored_depth:
            self.ignored_depth -= 1
            return

        if tag == "title":
            self.in_title = False
        elif tag == self.heading_tag:
            heading = clean_text(" ".join(self.heading_parts))
            if heading:
                self.headings.append(heading)
            self.heading_tag = ""
            self.heading_parts = []

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag.lower() not in VOID_HTML_TAGS:
            self.handle_endtag(tag)

    def handle_data(self, data):
        if self.ignored_depth:
            return
        if self.in_title:
            self.title_parts.append(data)
        if self.heading_tag:
            self.heading_parts.append(data)
        self.text_parts.append(data)


def clean_text(value):
    return SPACE_PATTERN.sub(" ", html.unescape(str(value or ""))).strip()


def normalize_text(value):
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", str(value or ""))
    value = unicodedata.normalize("NFKD", html.unescape(value))
    value = value.encode("ascii", "ignore").decode("ascii").lower()
    return SPACE_PATTERN.sub(" ", re.sub(r"[^a-z0-9]+", " ", value)).strip()


def token_variants(value):
    for token in TOKEN_PATTERN.findall(normalize_text(value)):
        if token in STOP_WORDS:
            continue
        yield token
        if len(token) > 4 and token.endswith("ies"):
            yield token[:-3] + "y"
        elif len(token) > 4 and token.endswith("s") and not token.endswith(("ss", "us")):
            yield token[:-1]


def trim_title(value):
    title = clean_text(value)
    for suffix in (" - Social Stream Ninja", " | Social Stream Ninja"):
        if title.endswith(suffix):
            return title[: -len(suffix)].strip()
    return title


def strip_markdown(value):
    value = re.sub(r"<!--.*?-->", " ", value, flags=re.DOTALL)
    value = re.sub(r"```.*?```", " ", value, flags=re.DOTALL)
    value = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r" \1 ", value)
    value = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r" \1 \2 ", value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"^[ \t]*[#>*+-]+[ \t]*", " ", value, flags=re.MULTILINE)
    value = re.sub(r"[`*_~|]", " ", value)
    return clean_text(value)


def markdown_description(markdown):
    without_code = re.sub(r"```.*?```", " ", markdown, flags=re.DOTALL)
    for block in re.split(r"\n\s*\n", without_code):
        candidate = block.strip()
        if not candidate:
            continue
        first_line = candidate.splitlines()[0].lstrip()
        if first_line.startswith(("#", "-", "*", "|", "Status:")):
            continue
        candidate = strip_markdown(candidate)
        if len(candidate) >= 30:
            return candidate[:280].rstrip()
    return ""


def parse_html(path):
    parser = DocsHTMLParser()
    parser.feed(path.read_text(encoding="utf-8", errors="replace"))
    title = trim_title(" ".join(parser.title_parts))
    if not title and parser.headings:
        title = parser.headings[0]
    body = clean_text(" ".join(parser.text_parts))
    description = parser.description or body[:280].rstrip()
    return title, description, parser.headings, body


def parse_markdown(path):
    markdown = path.read_text(encoding="utf-8", errors="replace")
    headings = []
    for match in re.finditer(r"^\s{0,3}#{1,6}\s+(.+?)\s*$", markdown, flags=re.MULTILINE):
        heading = strip_markdown(match.group(1))
        if heading:
            headings.append(heading)
    title = headings[0] if headings else path.stem.replace("-", " ").replace("_", " ").title()
    return title, markdown_description(markdown), headings, strip_markdown(markdown)


def should_index(relative_path):
    lower_parts = {part.lower() for part in relative_path.parts[:-1]}
    if lower_parts & EXCLUDED_DIRECTORIES:
        return False
    if relative_path.name.lower() == "sitemap.md":
        return False
    return relative_path.as_posix().lower() != "index.html"


def add_weighted_tokens(scores, value, weight, frequency_cap):
    counts = Counter(token_variants(value))
    for token, count in counts.items():
        scores[token] += weight * min(count, frequency_cap)


def build_index(docs_root):
    documents = []
    postings = defaultdict(list)
    source_paths = sorted(
        (
            path
            for path in docs_root.rglob("*")
            if path.is_file() and path.suffix.lower() in {".html", ".md"}
        ),
        key=lambda path: path.relative_to(docs_root).as_posix().lower(),
    )

    for path in source_paths:
        relative_path = path.relative_to(docs_root)
        if not should_index(relative_path):
            continue

        if path.suffix.lower() == ".html":
            title, description, headings, body = parse_html(path)
            kind = "Guide"
        else:
            title, description, headings, body = parse_markdown(path)
            kind = "Agent doc"

        if not title:
            title = relative_path.stem.replace("-", " ").replace("_", " ").title()

        document_id = len(documents)
        document = {
            "path": relative_path.as_posix(),
            "title": title,
            "description": description,
            "headings": headings[:16],
            "kind": kind,
        }
        documents.append(document)

        scores = defaultdict(int)
        add_weighted_tokens(scores, relative_path.as_posix(), 10, 2)
        add_weighted_tokens(scores, title, 30, 2)
        add_weighted_tokens(scores, " ".join(headings), 12, 4)
        add_weighted_tokens(scores, description, 7, 3)
        add_weighted_tokens(scores, body, 1, 6)
        for token, score in scores.items():
            postings[token].append([document_id, score])

    return {
        "version": 1,
        "documents": documents,
        "terms": {term: postings[term] for term in sorted(postings)},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--docs-root", type=Path, default=Path("docs"))
    parser.add_argument("--output", type=Path, default=Path("docs/search-index.json"))
    args = parser.parse_args()

    docs_root = args.docs_root.resolve()
    if not docs_root.is_dir():
        parser.error(f"docs root does not exist: {docs_root}")

    index = build_index(docs_root)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="\n") as output_file:
        output_file.write(
            json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n"
        )
    print(
        f"Wrote {args.output} with {len(index['documents'])} documents "
        f"and {len(index['terms'])} terms"
    )


if __name__ == "__main__":
    main()
