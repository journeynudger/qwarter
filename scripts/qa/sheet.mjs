#!/usr/bin/env node
/**
 * Several screenshots side by side in one PNG, labelled: the quickest way to look at a capture
 * or a comparison (a route's scroll frames, the cursor states, reference against port).
 *
 * Usage: node scripts/qa/sheet.mjs out.png [--cols 3] [--width 1800] a.png b.png …
 */
import { launch } from "../lib/browser.mjs";
import { contactSheet } from "../lib/pixels.mjs";

const argv = process.argv.slice(2);
const take = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  if (i < 0) return d;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const cols = Number(take("cols", 3));
const width = Number(take("width", 1800));
const [out, ...files] = argv;
if (!out || !files.length) {
  console.error("Usage: node scripts/qa/sheet.mjs out.png [--cols 3] [--width 1800] a.png b.png …");
  process.exit(2);
}
const browser = await launch();
await contactSheet(browser, files, out, { cols, width, labels: files.map((f) => f.split("/").slice(-3).join("/")) });
await browser.close();
console.log(out);
