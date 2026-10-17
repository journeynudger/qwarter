#!/usr/bin/env python3
"""
Snapshot qwarter.com (WordPress) into .port-cache/qwarter/ so the port can run offline.

Pulls, through the public REST API and the pages themselves:
  types.json                         every post type WordPress exposes, and its REST base
  pages.json / posts.json            REST records (content, excerpt, dates, featured media, SEO head)
  <type>.json                        every other public post type (portfolio, clients, testimonials…)
  media.json                         the whole media library: URL, alt text, sizes, captions
  categories.json / tags.json / users.json
  html/<slug>.html                   every page as rendered (the words as visitors see them)
  posthtml/<slug>.html / <type>html/<slug>.html
  sitemap.txt                        every URL in the sitemaps (catches anything the API does not list)
  uploads/<path>                     every file in the media library, at full size (resumable)

Nothing here writes into the site. The rendered look of qwarter.com is captured separately, if
wanted, with scripts/design/capture.mjs --origin https://qwarter.com --out .port-cache/qwarter-rendered.

Usage: python3 scripts/port/fetch.py [--force] [--no-uploads] [--origin https://qwarter.com]
"""
import concurrent.futures
import json
import os
import re
import subprocess
import sys
import urllib.parse

ARGS = sys.argv[1:]
ORIGIN = (ARGS[ARGS.index("--origin") + 1] if "--origin" in ARGS else "https://qwarter.com").rstrip("/")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141 Safari/537.36"
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, ".port-cache", "qwarter")
FORCE = "--force" in ARGS
UPLOADS = "--no-uploads" not in ARGS

# Post types that are WordPress plumbing, not content.
SKIP_TYPES = {
    "attachment", "nav_menu_item", "wp_block", "wp_template", "wp_template_part", "wp_navigation",
    "wp_global_styles", "wp_font_family", "wp_font_face", "elementor_library", "e-landing-page",
    "ae_global_templates", "oembed_cache", "user_request", "customize_changeset", "custom_css",
}


def curl(url, out, timeout=60):
    """GET url into out. Returns True when the file is there afterwards."""
    if not FORCE and os.path.exists(out) and os.path.getsize(out) > 0:
        return True
    os.makedirs(os.path.dirname(out), exist_ok=True)
    tmp = out + ".part"
    r = subprocess.run(
        ["curl", "-sfL", "--compressed", "-A", UA, "-m", str(timeout), "--retry", "2", url, "-o", tmp],
        check=False,
    )
    if r.returncode == 0 and os.path.exists(tmp):
        os.replace(tmp, out)
        return True
    if os.path.exists(tmp):
        os.remove(tmp)
    return False


def get_json(path, out):
    target = os.path.join(CACHE, out)
    if not curl(f"{ORIGIN}/wp-json/{path}", target):
        return None
    try:
        with open(target, encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError:
        return None


def paged(base, fields, out_prefix):
    """Every record of a collection, 100 at a time."""
    records = []
    for page in range(1, 100):
        sep = "&" if "?" in base else "?"
        batch = get_json(f"{base}{sep}per_page=100&page={page}&_fields={fields}", f"{out_prefix}-{page}.json")
        if not isinstance(batch, list) or not batch:
            break
        records += batch
        if len(batch) < 100:
            break
    with open(os.path.join(CACHE, f"{out_prefix}.json"), "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)
    return records


def sitemap_urls():
    """Every <loc> in robots.txt's sitemaps (Yoast and core WordPress both split them by type)."""
    robots_file = os.path.join(CACHE, "robots.txt")
    curl(f"{ORIGIN}/robots.txt", robots_file)
    maps = []
    if os.path.exists(robots_file):
        maps = re.findall(r"(?im)^sitemap:\s*(\S+)", open(robots_file, encoding="utf-8", errors="replace").read())
    maps = maps or [f"{ORIGIN}/sitemap_index.xml", f"{ORIGIN}/wp-sitemap.xml", f"{ORIGIN}/sitemap.xml"]
    seen, found = set(), []
    while maps and len(seen) < 60:
        m = maps.pop(0)
        if m in seen:
            continue
        seen.add(m)
        out = os.path.join(CACHE, "sitemaps", re.sub(r"[^\w.-]+", "_", urllib.parse.urlparse(m).path.strip("/")) or "index")
        if not curl(m, out):
            continue
        xml = open(out, encoding="utf-8", errors="replace").read()
        for loc in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml):
            loc = loc.replace("&amp;", "&")
            (maps if re.search(r"\.xml(\?|$)", loc) else found).append(loc)
    with open(os.path.join(CACHE, "sitemap.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(sorted(set(found))) + "\n")
    return sorted(set(found))


def slug_for(link):
    path = urllib.parse.urlparse(link).path.strip("/")
    return path.replace("/", "__") or "home"


def main():
    os.makedirs(CACHE, exist_ok=True)
    root = get_json("", "index.json")
    if root is None:
        sys.exit(f"{ORIGIN}/wp-json/ did not answer. Is the site reachable from here (network policy), and is the REST API on?")
    print(f"site: {root.get('name')!r} — {root.get('description')!r}")

    seo = "yoast_head_json,rank_math_head"  # whichever SEO plugin is there; absent fields are ignored
    common = f"id,slug,link,title,content,excerpt,date,date_gmt,modified,modified_gmt,status,featured_media,parent,menu_order,template,{seo}"
    pages = paged("wp/v2/pages", common, "pages")
    posts = paged("wp/v2/posts", f"{common},categories,tags,author,format,sticky", "posts")
    paged("wp/v2/categories", "id,slug,name,description,count,parent,link", "categories")
    paged("wp/v2/tags", "id,slug,name,description,count,link", "tags")
    paged("wp/v2/users", "id,slug,name,description,link,avatar_urls", "users")
    media = paged(
        "wp/v2/media",
        "id,slug,date,modified,link,title,caption,alt_text,description,mime_type,source_url,media_details,post",
        "media",
    )

    # every other public post type: a studio's clients, projects, testimonials and team usually live here
    types = get_json("wp/v2/types", "types.json") or {}
    extra = {}
    for name, t in types.items():
        base = t.get("rest_base")
        if name in SKIP_TYPES or name in ("page", "post") or not base:
            continue
        records = paged(f"{t.get('rest_namespace', 'wp/v2')}/{base}", f"{common},acf,meta", name)
        if records:
            extra[name] = records
    # Navigation menus need authentication on most sites; the rendered header carries them anyway.
    get_json("wp/v2/menu-items?per_page=100", "menu-items.json")

    urls = sitemap_urls()

    jobs = []
    for p in pages:
        jobs.append((p["link"], os.path.join(CACHE, "html", f"{slug_for(p['link'])}.html")))
    for p in posts:
        jobs.append((p["link"], os.path.join(CACHE, "posthtml", f"{slug_for(p['link'])}.html")))
    for name, records in extra.items():
        for p in records:
            if p.get("link"):
                jobs.append((p["link"], os.path.join(CACHE, f"{name}html", f"{slug_for(p['link'])}.html")))
    known = {j[0].rstrip("/") for j in jobs}
    for u in urls:
        if u.rstrip("/") not in known:
            jobs.append((u, os.path.join(CACHE, "otherhtml", f"{slug_for(u)}.html")))
    jobs.append((f"{ORIGIN}/this-page-does-not-exist-port-probe/", os.path.join(CACHE, "html", "_404.html")))

    if UPLOADS:
        # images and documents first, video last, so an interrupted run still leaves the useful half
        ordered = sorted(media, key=lambda m: (str(m.get("mime_type", "")).startswith("video"), m.get("id", 0)))
        for m in ordered:
            src = m.get("source_url") or ""
            rel = urllib.parse.unquote(urllib.parse.urlparse(src).path.split("/wp-content/uploads/", 1)[-1])
            if src and rel:
                jobs.append((src, os.path.join(CACHE, "uploads", rel)))

    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        ok = list(ex.map(lambda j: curl(j[0], j[1], timeout=300), jobs))
    failed = [j[0] for j, good in zip(jobs, ok) if not good and "port-probe" not in j[0]]
    with open(os.path.join(CACHE, "failed.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(failed) + ("\n" if failed else ""))
    print(
        f"pages={len(pages)} posts={len(posts)} media={len(media)} "
        + " ".join(f"{k}={len(v)}" for k, v in extra.items())
        + f" sitemap_urls={len(urls)} fetched={sum(ok)}/{len(jobs)} failed={len(failed)} → {CACHE}"
    )


if __name__ == "__main__":
    main()
