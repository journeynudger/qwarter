/**
 * What the capture (scripts/design/capture.mjs) and the comparison (scripts/qa/compare-design.mjs)
 * measure on a page. Both use these same functions, so the reference and the port are always
 * measured the same way.
 *
 * Functions without `page` run inside the browser (page.evaluate(fn)); the rest drive a Playwright page.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
};

// ------------------------------------------------------------------ in-page probes

/** Ordered <head> elements and end-of-body scripts of the document as served (not as scripts left it). */
export function assetsOf(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const one = (el) => {
    const attrs = Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]));
    const tag = el.tagName.toLowerCase();
    if (tag === "style") return { tag, attrs, text: el.textContent };
    if (tag === "script") return { tag, attrs, text: el.src ? undefined : el.textContent };
    if (tag === "noscript") return { tag, attrs, html: el.innerHTML };
    return { tag, attrs };
  };
  const head = [...doc.head.children].map(one);
  const bodyScripts = [...doc.body.querySelectorAll("script, noscript, style")].map((el) => ({
    ...one(el),
    // where it sits: a top-level child of <body>, or inside the page's markup
    topLevel: el.parentElement === doc.body,
  }));
  return {
    html: Object.fromEntries([...doc.documentElement.attributes].map((a) => [a.name, a.value])),
    body: Object.fromEntries([...doc.body.attributes].map((a) => [a.name, a.value])),
    head,
    bodyScripts,
  };
}

/** What the page is built with: frameworks, animation and scroll libraries, by their globals and markers. */
export function detectStack() {
  const w = window;
  const has = (k) => {
    try {
      return typeof w[k] !== "undefined";
    } catch {
      return false;
    }
  };
  const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content || null;
  const scripts = [...document.scripts].map((s) => s.src).filter(Boolean);
  const anyScript = (re) => scripts.some((s) => re.test(s));
  const html = document.documentElement;
  return {
    generator: meta("generator"),
    webflow: !!html.getAttribute("data-wf-page") || has("Webflow"),
    webflowPage: html.getAttribute("data-wf-page"),
    webflowSite: html.getAttribute("data-wf-site"),
    nextjs: has("__NEXT_DATA__") || !!document.getElementById("__next") || has("__next_f"),
    nuxt: has("__NUXT__") || !!document.getElementById("__nuxt"),
    framer: !!document.querySelector("[data-framer-name], [data-framer-component-type]") || anyScript(/framer/i),
    wordpress: anyScript(/wp-content|wp-includes/) || !!document.querySelector('link[href*="wp-content"]'),
    squarespace: has("Squarespace") || anyScript(/squarespace/),
    wix: anyScript(/wix|parastorage/),
    shopify: has("Shopify"),
    gsap: has("gsap") ? w.gsap.version : has("TweenMax") ? "TweenMax" : null,
    scrollTrigger: has("ScrollTrigger") || !!w.gsap?.plugins?.scrollTrigger,
    splitText: has("SplitText"),
    lenis: has("Lenis") || has("lenis") || html.classList.contains("lenis") || anyScript(/lenis/i),
    locomotive: has("LocomotiveScroll") || !!document.querySelector("[data-scroll-container]"),
    barba: has("barba") || !!document.querySelector("[data-barba]"),
    swup: has("swup") || !!document.querySelector("#swup"),
    swiper: has("Swiper") || !!document.querySelector(".swiper"),
    three: has("THREE"),
    splitType: has("SplitType"),
    lottie: has("lottie") || has("bodymovin"),
    jquery: has("jQuery") ? w.jQuery.fn?.jquery : null,
    customCursorCss: getComputedStyle(document.body).cursor === "none" || getComputedStyle(html).cursor === "none",
    scripts,
  };
}

/** Every visible element's box and the computed styles that carry the look. */
export function layoutOf() {
  const props = [
    "display", "position", "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "textTransform",
    "textAlign", "color", "backgroundColor", "backgroundImage", "borderRadius", "borderTop", "borderBottom", "opacity", "transform",
    "filter", "mixBlendMode", "objectFit", "gap", "gridTemplateColumns", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "marginTop", "marginBottom", "zIndex", "overflow", "cursor", "transition", "animationName",
  ];
  const out = [];
  const path = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 6; e = e.parentElement) {
      const cls = [...e.classList].slice(0, 2).join(".");
      parts.unshift(e.tagName.toLowerCase() + (e.id ? `#${e.id}` : "") + (cls ? `.${cls}` : ""));
    }
    return parts.join(" > ");
  };
  for (const el of document.body.querySelectorAll("*")) {
    if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "LINK", "META"].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim();
    const item = {
      path: path(el),
      tag: el.tagName.toLowerCase(),
      x: Math.round(r.left + scrollX),
      y: Math.round(r.top + scrollY),
      w: Math.round(r.width),
      h: Math.round(r.height),
      text: own.slice(0, 80) || undefined,
      src: el.currentSrc || el.getAttribute("src") || undefined,
      href: el.getAttribute("href") || undefined,
    };
    for (const p of props) {
      const v = cs[p];
      if (v && v !== "none" && v !== "normal" && v !== "auto" && v !== "0px" && v !== "rgba(0, 0, 0, 0)" && v !== "static" && v !== "visible") item[p] = v;
    }
    out.push(item);
  }
  return {
    scrollHeight: document.documentElement.scrollHeight,
    viewport: { w: innerWidth, h: innerHeight },
    title: document.title,
    items: out,
  };
}

/** Fonts the page actually uses, and the @font-face rules that define them. */
export function fontsOf() {
  const faces = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      faces.push({ blockedSheet: sheet.href });
      continue;
    }
    for (const rule of rules) {
      if (rule.constructor.name === "CSSFontFaceRule") {
        faces.push({
          family: rule.style.getPropertyValue("font-family"),
          weight: rule.style.getPropertyValue("font-weight"),
          style: rule.style.getPropertyValue("font-style"),
          src: rule.style.getPropertyValue("src"),
          sheet: sheet.href,
        });
      }
    }
  }
  const loaded = [...document.fonts].map((f) => ({ family: f.family, weight: f.weight, style: f.style, status: f.status }));
  return { faces, loaded };
}

/** The breakpoints the stylesheets switch at. */
export function breakpointsOf() {
  const seen = new Set();
  const walk = (rules) => {
    for (const r of rules) {
      if (r.media && r.conditionText) seen.add(r.conditionText);
      if (r.cssRules) walk(r.cssRules);
    }
  };
  for (const s of document.styleSheets) {
    try {
      walk(s.cssRules);
    } catch {
      /* cross-origin sheet: read from the saved file instead */
    }
  }
  return [...seen];
}

// ------------------------------------------------------------------ page helpers

export async function dismissOverlays(page) {
  // cookie banners and newsletter popups would sit over every screenshot
  const candidates = page.locator("button, a, [role=button]").filter({ hasText: /^(accept( all)?|agree|allow( all)?|got it|ok|okay|i understand|close)$/i });
  const n = Math.min(await candidates.count().catch(() => 0), 3);
  for (let i = 0; i < n; i++) await candidates.nth(i).click({ timeout: 1000 }).catch(() => {});
}

export async function screenshotHash(page) {
  const buf = await page.screenshot({ type: "png" });
  return { buf, hash: crypto.createHash("sha1").update(buf).digest("hex") };
}

/**
 * Scroll the way a visitor does (wheel events: smooth-scroll libraries move as they do for people),
 * saving the viewport at every step, until two steps in a row show nothing new.
 */
export async function scrollThrough(page, dir, width, maxFrames = 40) {
  const { h } = await page.evaluate(() => ({ h: innerHeight }));
  const step = Math.round(h * 0.75);
  let still = 0;
  let last = "";
  let i = 0;
  for (; i < maxFrames; i++) {
    const { buf, hash } = await screenshotHash(page);
    fs.writeFileSync(path.join(dir, `${width}-${String(i).padStart(3, "0")}.png`), buf);
    if (hash === last && ++still >= 2) break;
    if (hash !== last) still = 0;
    last = hash;
    await page.mouse.wheel(0, step);
    await sleep(650);
  }
  return i + 1;
}

export async function scrollToTop(page) {
  for (let i = 0; i < 80; i++) {
    const y = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, -4000);
    await sleep(120);
    if (y === 0 && i > 2) break;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(800);
}

/** Elements that move with the pointer: a custom cursor and its followers. */
export async function cursorProbe(page, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const { w, h } = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  const boxes = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => {
          const cs = getComputedStyle(el);
          return (cs.position === "fixed" || cs.position === "absolute") && cs.pointerEvents === "none";
        })
        .map((el, i) => {
          const r = el.getBoundingClientRect();
          el.dataset.capCursorIdx ||= String(i);
          return { idx: el.dataset.capCursorIdx, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
        }),
    );
  await page.mouse.move(w * 0.25, h * 0.3, { steps: 8 });
  await sleep(700);
  const a = await boxes();
  await page.mouse.move(w * 0.7, h * 0.65, { steps: 8 });
  await sleep(700);
  const b = await boxes();
  const followers = a
    .map((p) => ({ p, q: b.find((x) => x.idx === p.idx) }))
    .filter(({ p, q }) => q && Math.hypot(q.x - p.x, q.y - p.y) > Math.hypot(w * 0.45, h * 0.35) * 0.5)
    .map(({ q }) => q.idx);
  const describe = () =>
    page.evaluate((ids) => {
      return ids.map((id) => {
        const el = document.querySelector(`[data-cap-cursor-idx="${id}"]`);
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          id,
          outerHTML: el.outerHTML.slice(0, 2000),
          className: el.className?.baseVal ?? el.className,
          box: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
          style: {
            transform: cs.transform, width: cs.width, height: cs.height, borderRadius: cs.borderRadius, backgroundColor: cs.backgroundColor,
            border: cs.border, mixBlendMode: cs.mixBlendMode, opacity: cs.opacity, transition: cs.transition, backdropFilter: cs.backdropFilter,
            color: cs.color, fontSize: cs.fontSize, zIndex: cs.zIndex,
          },
          text: el.textContent.trim().slice(0, 60),
        };
      });
    }, followers);
  const states = [{ over: "nothing", followers: await describe() }];
  await page.screenshot({ path: path.join(dir, "000-idle.png") });
  // over each kind of target: a link, a button, a card, an image, a video (scrolled into view first)
  const KINDS = [
    ["nav link", "nav a, header a"],
    ["text link", "main a:not(:has(img)):not(:has(video)), footer a"],
    ["button", "button, [role=button]"],
    ["card", "a:has(img), a:has(video), [class*=card i], [class*=project i]"],
    ["image", "img"],
    ["video", "video"],
  ];
  let n = 1;
  for (const [label, sel] of KINDS) {
    const target = page.locator(sel).filter({ visible: true }).first();
    if (!(await target.count().catch(() => 0))) continue;
    await target.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await sleep(500);
    const box = await target.boundingBox().catch(() => null);
    if (!box || box.width < 8 || box.height < 8) continue;
    const x = Math.min(Math.max(box.x + box.width / 2, 4), w - 4);
    const y = Math.min(Math.max(box.y + box.height / 2, 4), h - 4);
    await page.mouse.move(x, y, { steps: 10 });
    await sleep(600);
    await page.screenshot({ path: path.join(dir, `${String(n).padStart(3, "0")}-${label.replace(/\s/g, "-")}.png`) });
    states.push({ over: label, at: { x: Math.round(x), y: Math.round(y) }, followers: await describe() });
    n++;
  }
  // a fast sweep, to see easing and trails
  const trail = [];
  for (let k = 0; k <= 12; k++) {
    await page.mouse.move(w * (0.1 + 0.06 * k), h * 0.5);
    await sleep(16);
    trail.push(await describe());
  }
  writeJson(path.join(dir, "..", "cursor.json"), { followers, states, trail });
  return followers.length;
}

/** For each link, button and card in view: what changes when the pointer is on it. */
export async function hoverProbe(page, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const results = [];
  const STYLE = ["transform", "opacity", "color", "backgroundColor", "filter", "clipPath", "scale", "borderColor", "boxShadow", "textDecorationLine", "width", "height"];
  const ids = await page.evaluate(() => {
    const els = [...document.querySelectorAll("a, button, [role=button], [class*=card i]")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 10 && r.height > 10;
    });
    return els.slice(0, 40).map((el, i) => {
      el.dataset.capHover = String(i);
      return String(i);
    });
  });
  for (const id of ids) {
    const sel = `[data-cap-hover="${id}"]`;
    const el = page.locator(sel);
    if (!(await el.isVisible().catch(() => false))) continue;
    await el.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
    await page.mouse.move(2, 2);
    await sleep(350);
    const snap = () =>
      page.evaluate(
        ({ sel, STYLE }) => {
          const root = document.querySelector(sel);
          if (!root) return null;
          const nodes = [root, ...root.querySelectorAll("*")].slice(0, 30);
          return nodes.map((n) => {
            const cs = getComputedStyle(n);
            return Object.fromEntries(STYLE.map((p) => [p, cs[p]]));
          });
        },
        { sel, STYLE },
      );
    const before = await snap();
    const box = await el.boundingBox();
    if (!box) continue;
    const clip = { x: Math.max(0, box.x - 24), y: Math.max(0, box.y - 24), width: Math.min(box.width + 48, 1600), height: Math.min(box.height + 48, 1200) };
    await page.screenshot({ path: path.join(dir, `${id.padStart(3, "0")}-before.png`), clip }).catch(() => {});
    await el.hover({ timeout: 2000 }).catch(() => {});
    await sleep(700);
    const after = await snap();
    await page.screenshot({ path: path.join(dir, `${id.padStart(3, "0")}-after.png`), clip }).catch(() => {});
    const changes = [];
    (before || []).forEach((b, i) => {
      const a = after?.[i];
      if (!a) return;
      for (const p of STYLE) if (a[p] !== b[p]) changes.push({ node: i, prop: p, from: b[p], to: a[p] });
    });
    const info = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return { tag: el.tagName.toLowerCase(), className: String(el.className), text: el.textContent.trim().replace(/\s+/g, " ").slice(0, 60), href: el.getAttribute("href") };
    }, sel);
    results.push({ id, ...info, changes });
  }
  writeJson(path.join(dir, "..", "hover.json"), results);
  return results.length;
}

export async function menuProbe(page, file) {
  const button = page
    .locator(
      [
        "button[aria-expanded]", "[aria-controls][aria-expanded]", ".w-nav-button", "[class*=burger i]", "[class*=hamburger i]",
        "[class*=menu-button i]", "[class*=menu-btn i]", "[class*=menu-toggle i]", "button:has-text('Menu')", "a:has-text('Menu')",
      ].join(", "),
    )
    .filter({ visible: true })
    .first();
  if (!(await button.count().catch(() => 0))) return false;
  await button.click({ timeout: 2000 }).catch(() => {});
  await sleep(1400);
  await page.screenshot({ path: file });
  const opened = await page.evaluate(() => document.documentElement.outerHTML.length);
  await page.keyboard.press("Escape").catch(() => {});
  await button.click({ timeout: 2000 }).catch(() => {});
  await sleep(900);
  return !!opened;
}

