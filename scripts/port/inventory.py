#!/usr/bin/env python3
"""
Everything qwarter.com has, from the snapshot in .port-cache/qwarter/ (scripts/port/fetch.py), as one
readable list: the material content/swaps/<slug>.json is written from.

Writes .port-cache/qwarter/inventory.md (for people) and inventory.json (for scripts):
  site         name and tagline, as WordPress reports them
  pages        each page: title, URL, modified date, headings, paragraphs, images (with alt), links
  posts        the same for posts
  <type>       every other public post type (clients, projects, testimonials…): each record's title, URL,
               featured image and custom fields
  menus        menu items, when WordPress exposes them
  media        the library: how many files of each type, and which records use each one
  sitemap      URLs the sitemaps list that no REST record covers

Text is quoted exactly as WordPress stores it (entities decoded), so a swap can cite it verbatim and
tests/swaps.test.ts finds it again.

Usage: python3 scripts/port/inventory.py
"""
import collections
import html
import json
import os
import re
import sys
import urllib.parse
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, ".port-cache", "qwarter")


def load(name, default=None):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return default


class Outline(HTMLParser):
    """Headings, paragraphs, images and links of a block of post content, in document order."""

    BLOCK = {"p", "li", "blockquote", "figcaption", "td", "th"}
    HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items = []
        self.stack = []
        self.buf = []
        self.links = []
        self.images = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("script", "style", "noscript"):
            self.skip += 1
        if tag in self.HEADINGS or tag in self.BLOCK:
            self.flush()
            self.stack.append(tag)
        if tag == "img":
            src = a.get("src") or a.get("data-src") or ""
            self.images.append({"src": src, "alt": a.get("alt")})
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])
        if tag == "br":
            self.buf.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self.skip = max(0, self.skip - 1)
        if (tag in self.HEADINGS or tag in self.BLOCK) and self.stack:
            self.flush(self.stack.pop())

    def handle_data(self, data):
        if not self.skip:
            self.buf.append(data)

    def flush(self, tag=None):
        text = re.sub(r"[ \t\r\f\v]+", " ", "".join(self.buf)).strip()
        self.buf = []
        if text:
            kind = tag if tag in self.HEADINGS else "text"
            self.items.append({"kind": kind, "text": text})


def outline(rendered):
    p = Outline()
    p.feed(rendered or "")
    p.close()
    p.flush()
    return p


def rendered(field):
    if isinstance(field, dict):
        return field.get("rendered") or ""
    return field or ""


def plain(field):
    return html.unescape(re.sub(r"<[^>]+>", "", rendered(field))).strip()


def path_of(link):
    return urllib.parse.urlparse(link or "").path or "/"


def main():
    if not os.path.isdir(CACHE):
        sys.exit("No snapshot at .port-cache/qwarter (run scripts/port/fetch.py first).")
    site = load("index.json", {}) or {}
    media = load("media.json", []) or []
    media_by_id = {m["id"]: m for m in media if isinstance(m, dict) and "id" in m}
    used_by = collections.defaultdict(list)

    def summarise(record, kind):
        content = rendered(record.get("content"))
        o = outline(content)
        featured = media_by_id.get(record.get("featured_media") or 0)
        entry = {
            "kind": kind,
            "id": record.get("id"),
            "title": plain(record.get("title")),
            "path": path_of(record.get("link")),
            "modified": record.get("modified"),
            "excerpt": plain(record.get("excerpt")),
            "outline": o.items,
            "images": o.images,
            "links": sorted(set(o.links)),
            "featured": {"src": featured.get("source_url"), "alt": featured.get("alt_text")} if featured else None,
        }
        for field in ("acf", "meta"):
            if record.get(field):
                entry[field] = record[field]
        for img in o.images:
            used_by[img["src"]].append(entry["path"])
        if featured:
            used_by[featured.get("source_url")].append(entry["path"])
        return entry

    inventory = {
        "site": {"name": site.get("name"), "description": site.get("description"), "url": site.get("url") or site.get("home")},
        "pages": [summarise(p, "page") for p in load("pages.json", []) or []],
        "posts": [summarise(p, "post") for p in load("posts.json", []) or []],
        "types": {},
        "menus": load("menu-items.json", None),
    }
    types = load("types.json", {}) or {}
    for name in sorted(types):
        if name in ("page", "post", "attachment"):
            continue
        records = load(f"{name}.json", None)
        if records:
            inventory["types"][name] = [summarise(r, name) for r in records]

    counts = collections.Counter(str(m.get("mime_type", "?")).split("/")[0] for m in media)
    inventory["media"] = {
        "count": len(media),
        "byType": dict(counts),
        "files": [
            {
                "id": m.get("id"),
                "src": m.get("source_url"),
                "alt": m.get("alt_text"),
                "mime": m.get("mime_type"),
                "size": [(m.get("media_details") or {}).get("width"), (m.get("media_details") or {}).get("height")],
                "usedBy": sorted(set(used_by.get(m.get("source_url"), []))),
            }
            for m in media
        ],
    }
    known = {e["path"].rstrip("/") for group in ("pages", "posts") for e in inventory[group]}
    known |= {e["path"].rstrip("/") for records in inventory["types"].values() for e in records}
    sitemap_file = os.path.join(CACHE, "sitemap.txt")
    sitemap = [l.strip() for l in open(sitemap_file, encoding="utf-8")] if os.path.exists(sitemap_file) else []
    inventory["sitemapOnly"] = sorted({path_of(u) for u in sitemap if u and path_of(u).rstrip("/") not in known})

    with open(os.path.join(CACHE, "inventory.json"), "w", encoding="utf-8") as f:
        json.dump(inventory, f, ensure_ascii=False, indent=1)

    out = [f"# qwarter.com inventory", "", f"**{inventory['site']['name'] or '?'}** — {inventory['site']['description'] or ''}", ""]

    def section(title, entries):
        out.append(f"## {title} ({len(entries)})")
        out.append("")
        for e in entries:
            out.append(f"### {e['title'] or '(untitled)'}  `{e['path']}`  (id {e['id']}, modified {e['modified']})")
            if e.get("featured"):
                out.append(f"- featured image: {e['featured']['src']} — alt: {e['featured']['alt']!r}")
            for item in e["outline"]:
                prefix = "#" * int(item["kind"][1]) + " " if item["kind"].startswith("h") and len(item["kind"]) == 2 else "- "
                out.append(f"  {prefix}{item['text']}")
            for img in e["images"]:
                out.append(f"  - image: {img['src']} — alt: {img['alt']!r}")
            for field in ("acf", "meta"):
                if e.get(field):
                    out.append(f"  - {field}: {json.dumps(e[field], ensure_ascii=False)[:600]}")
            out.append("")

    section("Pages", inventory["pages"])
    section("Posts", inventory["posts"])
    for name, records in inventory["types"].items():
        section(f"Post type: {name}", records)
    if inventory["menus"]:
        out += ["## Menus", "", "```json", json.dumps(inventory["menus"], ensure_ascii=False, indent=1)[:4000], "```", ""]
    out += [f"## Media library ({inventory['media']['count']} files: {dict(counts)})", ""]
    for m in inventory["media"]["files"]:
        out.append(f"- {m['src']}  {m['size'][0]}×{m['size'][1]}  alt {m['alt']!r}  used by {', '.join(m['usedBy']) or 'nothing'}")
    out += ["", f"## In the sitemaps but not the REST API ({len(inventory['sitemapOnly'])})", ""]
    out += [f"- {p}" for p in inventory["sitemapOnly"]]
    with open(os.path.join(CACHE, "inventory.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(
        f"pages={len(inventory['pages'])} posts={len(inventory['posts'])} "
        + " ".join(f"{k}={len(v)}" for k, v in inventory["types"].items())
        + f" media={len(media)} sitemap-only={len(inventory['sitemapOnly'])} → .port-cache/qwarter/inventory.md"
    )


if __name__ == "__main__":
    main()
