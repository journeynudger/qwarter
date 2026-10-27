#!/usr/bin/env python3
"""
Every old qwarter.com URL lands on its page here: writes content/redirects.json from the WordPress
snapshot (.port-cache/qwarter/, scripts/port/fetch.py) and the pages this site serves (content/pages.json).

  ids     every page, post and custom-post-type record whose page exists here, so /?p=123 and
          /?page_id=45 (proxy.ts) go straight to it
  paths   every old URL that is not served at the same path here → where it went, so next.config.ts can
          answer it with one permanent redirect

Where an old URL went is decided, never guessed:
  1. the same path, when content/pages.json serves it (no redirect needed);
  2. content/route-map.json, written here when a page moved or merged: { "/old-path/": "/new-path/" };
  3. otherwise it is listed as unresolved and the run fails, so a decision is made (map it, or accept
     that it 404s by mapping it to null).

Usage: python3 scripts/port/redirects.py
"""
import json
import os
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, ".port-cache", "qwarter")


def load(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def canonical(link):
    """A WordPress URL or path → this site's spelling of it: lowercase, trailing slash, no query."""
    path = urllib.parse.unquote(urllib.parse.urlparse(link).path or "/").lower()
    if not path.startswith("/"):
        path = "/" + path
    if not path.endswith("/") and "." not in path.rsplit("/", 1)[-1]:
        path += "/"
    return path


def main():
    if not os.path.isdir(CACHE):
        sys.exit("No snapshot at .port-cache/qwarter (run scripts/port/fetch.py first).")
    served = {p["path"] for p in load(os.path.join(ROOT, "content", "pages.json"), [])}
    served.discard("/__project__/")
    served.update(f"/work/{p['slug']}/" for p in load(os.path.join(ROOT, "content", "work.json"), {})["projects"] if p.get("media") is not False)
    served.add("/stories/")
    served.update(f"/stories/{s['slug']}/" for s in load(os.path.join(ROOT, "content", "stories.json"), []))
    route_map = {canonical(k): v for k, v in (load(os.path.join(ROOT, "content", "route-map.json"), {}) or {}).items()}

    records = []
    for name in ["pages", "posts"] + sorted(k for k in (load(os.path.join(CACHE, "types.json"), {}) or {}) if k not in ("page", "post", "attachment")):
        file = os.path.join(CACHE, f"{name}.json")
        for r in load(file, []) or []:
            if isinstance(r, dict) and r.get("link"):
                records.append((r.get("id"), canonical(r["link"])))
    sitemap_file = os.path.join(CACHE, "sitemap.txt")
    if os.path.exists(sitemap_file):
        for line in open(sitemap_file, encoding="utf-8"):
            if line.strip():
                records.append((None, canonical(line.strip())))

    # Explicit aliases can also come from links in old page markup, outside the sitemap.
    records.extend((None, old) for old in route_map)
    ids, paths, unresolved, dropped, retired_ids = {}, {}, set(), set(), set()
    for wp_id, old in records:
        if old in route_map:
            dest = route_map[old]
            if dest is None:
                dropped.add(old)
                if wp_id is not None:
                    retired_ids.add(wp_id)
                continue
            dest = canonical(dest)
        elif old in served:
            dest = old
        else:
            unresolved.add(old)
            continue
        if dest not in served:
            unresolved.add(f"{old} → {dest} (not a page here)")
            continue
        if wp_id is not None:
            ids[wp_id] = dest
        if old != dest:
            paths[old] = dest

    out = {
        "paths": [{"source": s, "destination": d} for s, d in sorted(paths.items())],
        "ids": [{"id": i, "path": p} for i, p in sorted(ids.items())],
        "retired": {"paths": sorted(dropped), "ids": sorted(retired_ids)},
    }
    if unresolved:
        print("Unresolved routes; existing redirects.json was not changed:")
        for u in sorted(unresolved):
            print(f"  {u}")
        sys.exit(1)
    with open(os.path.join(ROOT, "content", "redirects.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"{len(out['ids'])} ids, {len(out['paths'])} path redirects, {len(dropped)} dropped on purpose → content/redirects.json")
if __name__ == "__main__":
    main()
