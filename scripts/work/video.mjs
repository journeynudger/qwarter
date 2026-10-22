#!/usr/bin/env node
/**
 * The video of each site scrolling (Depo Luxe's tiles play a film when the strip comes to rest;
 * ours play the website itself): a square window, 900×900 at the page's own 1440px rendering,
 * pans down each page strip at a steady pace, holds at the top and the bottom, and cross-fades
 * to the next page. H.264 (plays everywhere, muted, inline), from the strips prepare.mjs made.
 *
 * A project whose film opens with the site's own clip (content/work.json film.intro → raw/intro.mp4,
 * placed there by scripts/port/catalogue.mjs) starts with up to INTRO seconds of it, cut to the same
 * square, muted, and cross-fades into the pages.
 *
 * Writes public/media/work/<slug>/scroll.mp4 (H.264) and scroll.webm (VP9: Chromium builds without
 * the H.264 codec, and a smaller file where it plays). Usage: node scripts/work/video.mjs [slug …]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WORK = path.join(ROOT, "public/media/work");
const SIDE = 900, FPS = 24, SPEED = 210, HOLD = 0.9, TAIL = 0.7, MAX_PAN = 6.5, FADE = 0.6, MAX_PAGES = 4, INTRO = 8, PAGES_AFTER_INTRO = 3;
// a tile's film is fetched when the strip rests: the bit rate is capped so moving footage (a reel, a render) stays a few MB
const H264_CAP = ["-maxrate", "2000k", "-bufsize", "4000k"], VP9_CAP = ["-b:v", "1200k", "-maxrate", "1800k", "-minrate", "0"];
const probe = (file) => { const [w, h, d] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "csv=p=0:s=x", file]).toString().trim().split(/[x\n]/).map(Number); return { width: w, height: h, duration: d }; };
const only = process.argv.slice(2);
const { projects } = JSON.parse(fs.readFileSync(path.join(ROOT, "content/work.json"), "utf8"));

for (const project of projects) {
  if (only.length && !only.includes(project.slug)) continue;
  if (project.media === false) continue;
  const dir = path.join(WORK, project.slug);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `qw-${project.slug}-`));
  const segments = [];
  const intro = project.film?.intro ? path.join(dir, "raw", project.film.intro) : null;
  if (intro && fs.existsSync(intro)) {
    // the site's own clip first: its centre square, scaled to the window, its first INTRO seconds, no sound
    const { width, height, duration } = probe(intro);
    const t = Math.min(INTRO, duration || INTRO);
    const out = path.join(tmp, "intro.mp4");
    const crop = width >= height ? `crop=ih:ih` : `crop=iw:iw`;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", intro, "-t", t.toFixed(2), "-an",
      "-vf", `${crop},scale=${SIDE}:${SIDE}:flags=lanczos,fps=${FPS},format=yuv420p`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", out]);
    segments.push({ out, duration: t });
  } else if (intro) console.warn(`${project.slug}: film.intro ${project.film.intro} is not in raw/ (run scripts/port/catalogue.mjs)`);
  for (const page of project.pages.slice(0, segments.length ? PAGES_AFTER_INTRO : MAX_PAGES)) {
    const strip = path.join(dir, `page-${page.name}.jpg`);
    const { width, height } = await sharp(strip).metadata();
    if (width < SIDE || height < SIDE) throw new Error(`${project.slug}: ${path.basename(strip)} is ${width}×${height}, smaller than the ${SIDE}px window (run scripts/work/prepare.mjs)`);
    const x = Math.round((width - SIDE) / 2);
    const travel = Math.max(0, height - SIDE);
    const pan = Math.min(MAX_PAN, travel / SPEED);
    const duration = HOLD + pan + TAIL;
    const speed = pan ? travel / pan : 0;
    const out = path.join(tmp, `${page.name}.mp4`);
    // ffmpeg reads a lossless copy of the strip: mozjpeg's optimised scan script (the delivered JPEGs) makes a
    // progressive JPEG its decoder refuses on a near-uniform picture (a page that photographed blank)
    const png = path.join(tmp, `${page.name}.png`);
    await sharp(strip).png({ compressionLevel: 1 }).toFile(png);
    // the window's top edge: still for HOLD, then down at `speed` px/s, never past the bottom
    const y = `min(${travel}\\,max(0\\,(t-${HOLD})*${speed.toFixed(2)}))`;
    // the strip is decoded once and looped in memory (the loop filter), not re-read for every frame
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", png,
      "-vf", `loop=loop=-1:size=1:start=0,setpts=N/(${FPS}*TB),trim=duration=${duration.toFixed(2)},crop=${SIDE}:${SIDE}:${x}:'${y}',format=yuv420p`, "-r", String(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", out]);
    segments.push({ out, duration });
  }
  const final = path.join(dir, "scroll.mp4");
  if (segments.length === 1) {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", segments[0].out, "-c:v", "libx264", "-preset", "slow", "-crf", "27", ...H264_CAP, "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", final]);
  } else {
    const inputs = segments.flatMap((s) => ["-i", s.out]);
    let graph = "", prev = "[0:v]", offset = 0;
    segments.forEach((s, i) => {
      if (i === 0) { offset = s.duration; return; }
      const label = i === segments.length - 1 ? "[v]" : `[v${i}]`;
      graph += `${prev}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${(offset - FADE).toFixed(2)}${label};`;
      prev = label;
      offset += s.duration - FADE;
    });
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", graph.slice(0, -1), "-map", "[v]",
      "-c:v", "libx264", "-preset", "slow", "-crf", "27", ...H264_CAP, "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", final]);
  }
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", final, "-c:v", "libvpx-vp9", "-crf", "36", ...VP9_CAP, "-deadline", "good", "-cpu-used", "2", "-row-mt", "1", "-an", path.join(dir, "scroll.webm")]);
  fs.rmSync(tmp, { recursive: true, force: true });
  const seconds = segments.reduce((a, s) => a + s.duration, 0) - FADE * (segments.length - 1);
  console.log(`${project.slug}: ${seconds.toFixed(1)} s, ${segments.length - (intro && fs.existsSync(intro) ? 1 : 0)} pages${intro && fs.existsSync(intro) ? " after its own clip" : ""}: mp4 ${Math.round(fs.statSync(final).size / 1024)} KB, webm ${Math.round(fs.statSync(path.join(dir, "scroll.webm")).size / 1024)} KB`);
}
