#!/usr/bin/env node
/**
 * The delivered pictures of Qwarter's work, from the raw captures (scripts/work/shoot.mjs).
 *
 * For each project in content/work.json, from public/media/work/<slug>/raw/:
 *   cover.jpg, cover@2x.jpg   the frame the project is introduced with (1440×900 and 2880×1800):
 *                             the Work card and the slideshow's first frame
 *   tile.jpg, tile@2x.jpg     the same frame's centre as a square (900 and 1800), the strip's tile
 *   blur.jpg                  the same frame at 96px, blurred to a colour field and darkened to a mean
 *                             brightness of 0.3 at most, for the echo behind the focused project (Depo
 *                             Luxe's background is that soft; pre-blurred, so no page pays for a filter
 *                             over a full-screen image, and a white site's echo is as deep as a dark one's)
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
const keepVideo = (dir) => ["scroll.mp4", "scroll.webm"].filter((f) => fs.existsSync(path.join(dir, f)));
const kb = (file) => `${Math.round(fs.statSync(file).size / 1024)} KB`;

for (const project of projects) {
  if (only.length && !only.includes(project.slug)) continue;
  if (project.media === false) continue; // a catalogue entry whose pictures are not here yet
  const dir = path.join(WORK, project.slug);
  const raw = path.join(dir, "raw");
  const cover = path.join(raw, `${project.cover}.png`);
  if (!fs.existsSync(cover)) throw new Error(`${project.slug}: no raw frame ${project.cover}.png (run scripts/work/shoot.mjs)`);

  await sharp(cover).resize(1440, 900, { fit: "cover", position: "top" }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(dir, "cover.jpg"));
  await sharp(cover).resize(2880, 1800, { fit: "cover", position: "top", withoutEnlargement: true }).jpeg({ quality: 68, mozjpeg: true }).toFile(path.join(dir, "cover@2x.jpg"));
  const meta = await sharp(cover).metadata();
  const side = Math.min(meta.width, meta.height), left = Math.round((meta.width - side) / 2);
  await sharp(cover).extract({ left, top: 0, width: side, height: side }).resize(900, 900).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(dir, "tile.jpg"));
  await sharp(cover).extract({ left, top: 0, width: side, height: side }).resize(1800, 1800, { withoutEnlargement: true }).jpeg({ quality: 66, mozjpeg: true }).toFile(path.join(dir, "tile@2x.jpg"));
  // the echo of a light site (a white page) is brought down to the same depth as a dark one's:
  // the field's mean brightness is held at or under 0.3, so the header reads on every one of them
  const field = sharp(cover).resize(96, 60, { fit: "cover", position: "top" }).blur(7);
  const { channels } = await field.clone().stats();
  const mean = channels.slice(0, 3).reduce((a, c) => a + c.mean, 0) / 3 / 255;
  const brightness = Math.min(0.48, 0.3 / Math.max(mean, 0.01));
  await field.modulate({ brightness, saturation: 0.92 }).jpeg({ quality: 72, mozjpeg: true }).toFile(path.join(dir, "blur.jpg"));

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
  const keep = new Set(["cover.jpg", "cover@2x.jpg", "tile.jpg", "tile@2x.jpg", "blur.jpg", "raw", ...keepVideo(dir), ...project.pages.map((p) => `page-${p.name}.jpg`)]);
  for (const f of fs.readdirSync(dir)) if (!keep.has(f)) fs.rmSync(path.join(dir, f));
  console.log(`${project.slug}: cover ${kb(path.join(dir, "cover.jpg"))} / tile ${kb(path.join(dir, "tile.jpg"))} / @2x ${kb(path.join(dir, "tile@2x.jpg"))} / blur ${kb(path.join(dir, "blur.jpg"))}\n  ${strips.join("\n  ")}`);
}
