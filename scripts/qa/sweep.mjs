#!/usr/bin/env node
/**
 * Rendered-page sweep over every route of a running build (default http://localhost:3100):
 *   console errors · broken images · images without alt · horizontal overflow at phone width ·
 *   <h1> count · links without a name · target=_blank without rel=noopener · dead internal links
 *   (status checked once per unique href).
 *
 * Usage: node scripts/qa/sweep.mjs [--base URL] [--widths 375,1280] [--only slug,slug]
 * Exit code 1 when anything is found. Findings that the reference design has too are
 * still reported: the point is to see them.
 */
import fs from "node:fs";

import { launch } from "../lib/browser.mjs";

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const BASE = opt("base", "http://localhost:3100");
const WIDTHS = opt("widths", "375,1280").split(",").map(Number);
const pages = JSON.parse(fs.readFileSync("content/pages.json", "utf8"));
let paths = [...pages.map((p) => p.path), "/this-does-not-exist/"];
if (opt("only")) {
  const only = new Set(opt("only").split(","));
  paths = paths.filter((p) => only.has(p.replace(/\//g, "") || "home"));
}

const browser = await launch();
const findings = [];
const hrefs = new Map();
const add = (path, width, kind, detail) => findings.push({ path, width, kind, detail });

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  for (const path of paths) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
    const res = await page.goto(BASE + path, { waitUntil: "load" });
    const expect404 = path === "/this-does-not-exist/";
    if (!res || (expect404 ? res.status() !== 404 : res.status() !== 200)) add(path, width, "status", res?.status());
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 25));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const out = {};
      const doc = document.documentElement;
      out.overflow = doc.scrollWidth - doc.clientWidth;
      out.wide = [];
      if (out.overflow > 0) {
        for (const el of document.querySelectorAll("body *")) {
          const b = el.getBoundingClientRect();
          if (b.right > doc.clientWidth + 1 && b.width > 0 && getComputedStyle(el).position !== "fixed") {
            let clipped = false;
            for (let p = el.parentElement; p; p = p.parentElement) {
              const o = getComputedStyle(p).overflowX;
              if (o === "hidden" || o === "clip" || o === "auto" || o === "scroll") { clipped = true; break; }
            }
            if (!clipped) out.wide.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} right=${Math.round(b.right)}`);
          }
        }
        out.wide = out.wide.slice(0, 5);
      }
      out.broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && !i.src.startsWith("data:")).map((i) => i.currentSrc || i.src).slice(0, 5);
      out.noAlt = [...document.images].filter((i) => !i.hasAttribute("alt")).map((i) => i.src.split("/").pop()).slice(0, 5);
      out.h1 = document.querySelectorAll("h1").length;
      out.unnamed = [...document.querySelectorAll("a[href], button")]
        .filter((a) => !a.closest('[aria-hidden="true"]'))
        .filter((a) => !(a.textContent.trim() || a.getAttribute("aria-label") || a.getAttribute("title") || a.querySelector("img[alt]:not([alt=''])")))
        .map((a) => a.outerHTML.slice(0, 80)).slice(0, 5);
      out.blank = [...document.querySelectorAll('a[target="_blank"]')].filter((a) => !/noopener|noreferrer/.test(a.rel)).map((a) => a.href).slice(0, 5);
      out.hrefs = [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => h.startsWith("/") && !h.startsWith("//")))];
      return out;
    });
    if (r.overflow > 0 && width < 768) add(path, width, "overflow-x", `${r.overflow}px ${r.wide.join(" | ")}`);
    if (r.broken.length) add(path, width, "broken-image", r.broken.join(", "));
    if (r.noAlt.length) add(path, width, "img-no-alt", r.noAlt.join(", "));
    if (r.h1 !== 1) add(path, width, "h1-count", r.h1);
    if (r.unnamed.length) add(path, width, "unnamed-control", r.unnamed.join(" | "));
    if (r.blank.length) add(path, width, "blank-no-noopener", r.blank.join(", "));
    if (errors.length) add(path, width, "console", [...new Set(errors)].join(" | "));
    for (const h of r.hrefs) if (!hrefs.has(h)) hrefs.set(h, path);
    await page.close();
  }
  await ctx.close();
}

// every internal href, once
const ctx = await browser.newContext();
for (const [href, from] of hrefs) {
  const res = await ctx.request.get(BASE + href, { maxRedirects: 5 }).catch(() => null);
  if (!res || res.status() >= 400) add(from, 0, "dead-link", `${href} → ${res?.status()}`);
}
await browser.close();

const byKind = {};
for (const f of findings) (byKind[f.kind] ||= []).push(f);
for (const [kind, list] of Object.entries(byKind)) {
  console.log(`\n${kind}: ${list.length}`);
  for (const f of list.slice(0, 40)) console.log(`  ${f.path} @${f.width}: ${f.detail}`);
}
console.log(`\n${findings.length} findings over ${paths.length} routes × ${WIDTHS.length} widths, ${hrefs.size} unique internal links`);
fs.writeFileSync(opt("out", "sweep-report.json"), JSON.stringify(findings, null, 2));
process.exit(findings.length ? 1 : 0);
