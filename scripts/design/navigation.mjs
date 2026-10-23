#!/usr/bin/env node
/** Regenerate just the carried pages' chrome from site.json, without a reference capture or browser.
 * The full swap pipeline emits the same five links through swaps-from-content.mjs. Keep reference
 * link ids so the existing animation can still address them. Stories uses a normal full-page load.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const { chrome } = JSON.parse(fs.readFileSync(path.join(root, "content/site.json"), "utf8"));
const pages = JSON.parse(fs.readFileSync(path.join(root, "content/pages.json"), "utf8"));
const escape = (value) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
for (const page of pages.filter((item) => item.template)) {
  const file = path.join(root, "content/pages", `${page.slug}.html`);
  let markup = fs.readFileSync(file, "utf8");
  const links = chrome.nav.map((item, index) => `<a id="h_a_${index + 2}" class="link-underline" href="${escape(item.href)}"${item.href === page.path ? ' aria-current="page"' : ""}${item.href === "/stories/" ? " data-internal" : ""}>${escape(item.label)}</a>`).join(" ");
  markup = markup.replace(/(<header id="Header">[\s\S]*?<nav\b[^>]*>)[\s\S]*?(<\/nav>)/, `$1${links}$2`);
  const menu = chrome.nav.map((item) => `<li><a href="${escape(item.href)}" class="nav-item"${item.href === page.path ? ' aria-current="page"' : ""}${item.href === "/stories/" ? " data-internal" : ""}><span class="__text">${escape(item.label)}</span></a></li>`).join("");
  markup = markup.replace(/(<nav id="Sidemenu"[\s\S]*?<ul class="list">)[\s\S]*?(<\/ul>)/, `$1${menu}$2`);
  fs.writeFileSync(file, markup);
  console.log(`${page.slug}: navigation regenerated`);
}
