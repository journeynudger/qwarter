#!/usr/bin/env node
/**
 * Each project's film: what plays full-screen behind the home's staircase and the Work page's list (Depo Luxe's
 * .visor-videos: a <video> covering the window, object-fit cover), the study's own film, and the tile when the
 * strip rests. 1920×1080 at 30 frames a second, so it fits a screen whole instead of being cut (the first films
 * were 900×900 squares and lost their top and bottom to the cover, Lorenzo, 2026-10-23).
 *
 * A film is a sequence of scenes, cross-faded, from content/work.json `film.scenes` or, without them, the
 * site's own clip (film.intro, when the catalogue found one) followed by its first three pages:
 *   {clip: "raw/<file>", from, seconds, speed}   the site's own footage or a recording (speed 0.8 slows it)
 *   {film: "<page>", seconds}                     the page filmed scrolling in a real browser (scrollfilm.mjs:
 *                                                 raw/film-<page>.mp4); falls back to the page strip when absent
 *   {page: "<page>", hold, pan, tail}             the page strip (prepare.mjs) glided down slowly, nothing cropped
 *                                                 side to side: 1920 wide, a 1080 window, rendered at 2× and scaled
 *   {still: "raw/<file>", seconds, move}          a picture held with a slow move (in, out)
 *   {card: {image, ground}, seconds}              a mark on its ground, held
 * Pace: a page holds 1.6 s, glides at 90 px/s (of its 1440px rendering) for at most 14 s, holds 1.2 s; scenes
 * cross-fade over 0.9 s. Slow on purpose: these play behind the type.
 *
 * Writes public/media/work/<slug>/scroll.mp4 (H.264), scroll.webm (VP9, the slow half of every render, so
 * --no-webm leaves it out and --webm-only makes only it) and scroll-poster.jpg (the first frame).
 * Usage: node scripts/work/video.mjs [--no-webm | --webm-only] [slug …]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WORK = path.join(ROOT, "public/media/work");
const W = 1920, H = 1080, FPS = 30;
const HOLD = 1.6, TAIL = 1.2, SPEED = 90, MAX_PAN = 14, FADE = 0.9, INTRO = 12, PAGES = 3;
const H264 = ["-c:v", "libx264", "-preset", "medium", "-crf", "22", "-maxrate", "4500k", "-bufsize", "9000k", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"];
const VP9 = ["-c:v", "libvpx-vp9", "-crf", "33", "-b:v", "2500k", "-maxrate", "3500k", "-deadline", "good", "-cpu-used", "4", "-row-mt", "1", "-tile-columns", "2", "-threads", "4", "-an"];
const SEG = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-an"];
const COVER = `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},fps=${FPS},format=yuv420p`;

const argv = process.argv.slice(2);
const flag = (f) => { const i = argv.indexOf(f); if (i >= 0) { argv.splice(i, 1); return true; } return false; };
const NO_WEBM = flag("--no-webm"), WEBM_ONLY = flag("--webm-only");
const only = argv;
const { projects } = JSON.parse(fs.readFileSync(path.join(ROOT, "content/work.json"), "utf8"));
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const probe = (file) => { const [w, h, d] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "csv=p=0:s=x", file]).toString().trim().split(/[x\n]/).map(Number); return { width: w, height: h, duration: d }; };
const kb = (f) => `${Math.round(fs.statSync(f).size / 1024)} KB`;
const smooth = (t) => `(${t})*(${t})*(3-2*(${t}))`;

for (const project of projects) {
  if (only.length && !only.includes(project.slug)) continue;
  if (project.media === false) continue;
  const dir = path.join(WORK, project.slug);
  const final = path.join(dir, "scroll.mp4");
  if (WEBM_ONLY) {
    if (!fs.existsSync(final)) { console.warn(`${project.slug}: no scroll.mp4 to copy`); continue; }
    ff(["-i", final, ...VP9, path.join(dir, "scroll.webm")]);
    console.log(`${project.slug}: webm ${kb(path.join(dir, "scroll.webm"))}`);
    continue;
  }
  const scenes = project.film?.scenes || [
    ...(project.film?.intro && fs.existsSync(path.join(dir, "raw", project.film.intro)) ? [{ clip: `raw/${project.film.intro}`, seconds: INTRO }] : []),
    ...project.pages.slice(0, project.featured ? PAGES : 2).map((pg) => ({ film: pg.name })), // a project kept to the Work page: two pages
  ];
  if (project.film?.intro && !fs.existsSync(path.join(dir, "raw", project.film.intro))) console.warn(`${project.slug}: film.intro ${project.film.intro} is not in raw/ (run scripts/port/catalogue.mjs)`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `qw-${project.slug}-`));
  const segments = [];
  let k = 0;
  for (let scene of scenes) {
    const seg = path.join(tmp, `s${String(k++).padStart(2, "0")}.mp4`);
    // a page filmed scrolling, when the film is there; its strip otherwise
    if (scene.film && !fs.existsSync(path.join(dir, "raw", `film-${scene.film}.mp4`))) scene = { page: scene.film, hold: scene.hold, pan: scene.pan, tail: scene.tail };
    if (scene.clip || scene.film) {
      const file = scene.clip ? path.join(dir, scene.clip) : path.join(dir, "raw", `film-${scene.film}.mp4`);
      if (!fs.existsSync(file)) { console.warn(`${project.slug}: ${path.relative(dir, file)} is not there, skipped`); continue; }
      const { duration: full } = probe(file);
      const from = scene.from || 0, speed = scene.speed || 1;
      const take = Math.max(0.5, Math.min(scene.seconds || (scene.film ? full : INTRO), (full || INTRO) - from));
      const duration = take / speed;
      ff(["-ss", String(from), "-i", file, "-t", take.toFixed(2), "-vf", `${speed !== 1 ? `setpts=PTS/${speed},` : ""}${COVER}`, ...SEG, seg]);
      segments.push({ out: seg, duration });
    } else if (scene.page) {
      const strip = path.join(dir, `page-${scene.page}.jpg`);
      if (!fs.existsSync(strip)) { console.warn(`${project.slug}: no strip page-${scene.page}.jpg, skipped`); continue; }
      const meta = await sharp(strip).metadata();
      // the strip at twice the film's width; the window glides down it (a smoothstep), rendered at 2× so it moves by half pixels
      const W2 = W * 2, H2 = H * 2, height = Math.max(H2, Math.round((meta.height * W2) / meta.width));
      const png = path.join(tmp, `${scene.page}.png`);
      await sharp(strip).resize(W2, height, { fit: "cover", position: "top" }).png({ compressionLevel: 1 }).toFile(png);
      const travel = height - H2;
      const hold = scene.hold ?? HOLD, tail = scene.tail ?? TAIL;
      const pan = travel ? Math.min(scene.pan ?? MAX_PAN, travel / (SPEED * (W2 / 1440))) : 0;
      const duration = hold + pan + tail;
      const y = travel ? `${travel}*${smooth(`clip((t-${hold})/${pan.toFixed(3)}\\,0\\,1)`)}` : "0";
      ff(["-i", png, "-vf", `loop=loop=-1:size=1:start=0,setpts=N/(${FPS}*TB),trim=duration=${duration.toFixed(2)},crop=${W2}:${H2}:0:'${y}',scale=${W}:${H}:flags=lanczos,format=yuv420p`, "-r", String(FPS), ...SEG, seg]);
      segments.push({ out: seg, duration });
    } else if (scene.still) {
      const file = path.join(dir, scene.still);
      if (!fs.existsSync(file)) { console.warn(`${project.slug}: ${scene.still} is not there, skipped`); continue; }
      const duration = scene.seconds || 6, frames = Math.round(duration * FPS);
      const z = scene.move === "out" ? `1.07-0.07*on/${frames}` : `1+0.07*on/${frames}`;
      ff(["-i", file, "-vf", `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W * 2}:${H * 2},zoompan=z='${z}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},format=yuv420p`, "-frames:v", String(frames), ...SEG, seg]);
      segments.push({ out: seg, duration });
    } else if (scene.card) {
      const file = path.join(dir, scene.card.image);
      if (!fs.existsSync(file)) { console.warn(`${project.slug}: ${scene.card.image} is not there, skipped`); continue; }
      const duration = scene.seconds || 3.5;
      const ground = (scene.card.ground || "#000000").replace("#", "0x");
      ff(["-f", "lavfi", "-i", `color=c=${ground}:s=${W}x${H}:r=${FPS}`, "-i", file, "-filter_complex", `[1:v]scale='min(iw\\,${Math.round(W * 0.32)})':-2:flags=lanczos[m];[0:v][m]overlay=(W-w)/2:(H-h)/2:format=auto,format=yuv420p`, "-t", duration.toFixed(2), ...SEG, seg]);
      segments.push({ out: seg, duration });
    }
  }
  if (!segments.length) { console.warn(`${project.slug}: nothing to cut`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
  if (segments.length === 1) {
    ff(["-i", segments[0].out, ...H264, final]);
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
    ff([...inputs, "-filter_complex", graph.slice(0, -1), "-map", "[v]", ...H264, final]);
  }
  ff(["-ss", "0.4", "-i", final, "-frames:v", "1", "-q:v", "3", path.join(dir, "scroll-poster.jpg")]);
  if (!NO_WEBM) ff(["-i", final, ...VP9, path.join(dir, "scroll.webm")]);
  else if (fs.existsSync(path.join(dir, "scroll.webm"))) fs.rmSync(path.join(dir, "scroll.webm"));
  fs.rmSync(tmp, { recursive: true, force: true });
  const seconds = segments.reduce((a, s) => a + s.duration, 0) - FADE * (segments.length - 1);
  console.log(`${project.slug}: ${seconds.toFixed(1)} s, ${segments.length} scene${segments.length === 1 ? "" : "s"}: mp4 ${kb(final)}${!NO_WEBM ? `, webm ${kb(path.join(dir, "scroll.webm"))}` : ""}`);
}
