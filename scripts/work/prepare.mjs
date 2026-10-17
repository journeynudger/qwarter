#!/usr/bin/env node
/**
 * The delivered pictures of Qwarter's work, from the raw captures (scripts/work/shoot.mjs).
 *
 * For each project in content/work.json, from public/media/work/<slug>/raw/:
 *   cover.jpg, cover@2x.jpg   the frame the project is introduced with (1440×900 and 2880×1800):
 *                             the home cascade's tile and the slideshow's first frame
 *   blur.jpg                  the same frame small, blurred and darkened, for the background echo
 *                             behind the focused project (pre-blurred, so no page pays for a filter
 *                             over a full-screen image)
 *   page-<name>.jpg           each page of the site as one tall strip, 1440 wide, at most MAX_STRIP
 *                             tall (cropped from the top): what slides inside the frame
 *
 * Raw PNGs are not committed (.gitignore); everything written here is.
 * Usage: node scripts/work/prepare.mjs [slug …]
 */
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WORK = path.join(ROOT, "public/media/work");
const MAX_STRIP = 5400;
const only = process.argv.slice(2);

const { projects } = JSON.parse(fs.readFileSync(path.join(ROOT, "content/work.json"), "utf8"));
const kb = (file) => `${Math.round(fs.statSync(file).size / 1024)} KB`;

for (const project of projects) {
  if (only.length && !only.includes(project.slug)) continue;
  const dir = path.join(WORK, project.slug);
  const raw = path.join(dir, "raw");
  const cover = path.join(raw, `${project.cover}.png`);
  if (!fs.existsSync(cover)) throw new Error(`${project.slug}: no raw frame ${project.cover}.png (run scripts/work/shoot.mjs)`);

  await sharp(cover).resize(1440, 900, { fit: "cover", position: "top" }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(dir, "cover.jpg"));
  await sharp(cover).resize(2880, 1800, { fit: "cover", position: "top", withoutEnlargement: true }).jpeg({ quality: 68, mozjpeg: true }).toFile(path.join(dir, "cover@2x.jpg"));
  await sharp(cover)
    .resize(640, 400, { fit: "cover", position: "top" })
    .blur(18)
    .modulate({ brightness: 0.55, saturation: 0.85 })
    .jpeg({ quality: 60, mozjpeg: true })
    .toFile(path.join(dir, "blur.jpg"));

  const strips = [];
  for (const page of project.pages) {
    // the whole page when the shoot could capture it, the viewport frame otherwise
    const full = path.join(raw, `${page.name}-full.png`);
    const src = fs.existsSync(full) ? full : path.join(raw, `${page.name}.png`);
    if (!fs.existsSync(src)) throw new Error(`${project.slug}: no raw frame for page ${page.name}`);
    const meta = await sharp(src).metadata();
    const scale = 1440 / meta.width;
    const height = Math.min(Math.round(meta.height * scale), MAX_STRIP);
    const out = path.join(dir, `page-${page.name}.jpg`);
    await sharp(src).resize(1440, height, { fit: "cover", position: "top" }).jpeg({ quality: 72, mozjpeg: true }).toFile(out);
    strips.push(`${page.name} ${height}px ${kb(out)}`);
  }
  // nothing else is delivered: a frame that is no longer listed is removed
  const keep = new Set(["cover.jpg", "cover@2x.jpg", "blur.jpg", "raw", ...project.pages.map((p) => `page-${p.name}.jpg`)]);
  for (const f of fs.readdirSync(dir)) if (!keep.has(f)) fs.rmSync(path.join(dir, f));
  console.log(`${project.slug}: cover ${kb(path.join(dir, "cover.jpg"))} / @2x ${kb(path.join(dir, "cover@2x.jpg"))} / blur ${kb(path.join(dir, "blur.jpg"))}\n  ${strips.join("\n  ")}`);
}
