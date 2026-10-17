import fs from "node:fs";
import path from "node:path";

import { getSite } from "@/lib/content";

/*
 * What every page carries, in Depo Luxe's arrangement as the sister site (JR Pugh) wears it:
 * a fixed, centred header with the brand split either side of the menu and the tagline under
 * it, a fixed footer line, and the film treatment (vignette and grain) that site.css puts on
 * <body>. The menu's current item is marked on the server, so it is right before any script runs.
 */

export function Header({ current }: { current: string }) {
  const { brand, nav } = getSite().chrome;
  return (
    <header className="site" id="siteHeader">
      <div className="header-blur" aria-hidden="true" />
      <div className="lockup">
        <a className="brand brand-l" href="/" aria-label={`${brand.left} ${brand.right}, home`}>
          {brand.left}
        </a>
        <nav className="site" aria-label="Site">
          {nav.map((item) => {
            const active = item.href === current;
            return (
              <a key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
                {item.label}
              </a>
            );
          })}
        </nav>
        <span className="brand brand-r" aria-hidden="true">
          {brand.right}
        </span>
      </div>
      <p className="tagline">{brand.tagline}</p>
    </header>
  );
}

/** Fixed at the foot of a pinned page; in the flow at the end of a page that scrolls. */
export function Footer({ flow = false }: { flow?: boolean }) {
  return <footer className={flow ? "site flow" : "site"}>{getSite().chrome.footer}</footer>;
}

/**
 * The blurred, darkened echo of the focused project behind everything (Depo Luxe's device):
 * two layers, so site.js can cross-fade from one project to the next.
 */
export function Echo({ src }: { src: string }) {
  return (
    <div className="echo" id="echo" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- the design's own element; next/image would wrap and restyle it */}
      <img className="echo-layer on" src={src} alt="" decoding="async" />
      <div className="echo-layer" />
    </div>
  );
}

/** The pixel Q (public/design/qwarter/q-mark.svg) with each square numbered, so the loader can light them in order. */
export function QMark({ className }: { className?: string }) {
  const svg = fs.readFileSync(path.join(process.cwd(), "public/design/qwarter/q-mark.svg"), "utf8");
  let i = 0;
  const numbered = svg
    .replace("<svg ", `<svg class="${className ?? "q-mark"}" focusable="false" `)
    .replace(/<rect /g, () => `<rect style="--i:${i++}" `);
  return <span className="q-mark-host" dangerouslySetInnerHTML={{ __html: numbered }} />;
}
