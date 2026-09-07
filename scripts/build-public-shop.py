"""Publish the standalone viewer from beta without replacing stable app assets."""
import argparse
import hashlib
import shutil
from pathlib import Path


def build(source, destination):
    files = ["shop.html", "favicon.ico", "docs/css/styles.css",
             "shared/monetization/core.js", "shared/monetization/shop.js",
             "shared/monetization/shop.css", "translations/page-i18n.js"]
    files += [p.relative_to(source).as_posix() for p in sorted((source / "translations").glob("*.json"))]
    digest = hashlib.sha256()
    for name in files:
        digest.update(name.encode())
        digest.update((source / name).read_bytes())
    prefix = "public-shop-assets/" + digest.hexdigest()[:16] + "/"
    for name in files:
        if name == "shop.html":
            continue
        output = destination / prefix / name
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / name, output)
    html = (source / "shop.html").read_text(encoding="utf-8")
    for name in files:
        if name != "shop.html":
            html = html.replace('"' + name + '"', '"' + prefix + name + '"')
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "shop.html").write_text(html, encoding="utf-8", newline="\n")
    print("Public shop viewer:", destination / "shop.html", "assets:", prefix)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    build(args.source.resolve(), args.output.resolve())
