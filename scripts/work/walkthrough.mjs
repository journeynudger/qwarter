#!/usr/bin/env node
/**
 * The site recorded, for its case study: a smooth walkthrough of its first pages (four on a desktop,
 * 1440×900, 60 frames a second; three on a phone, 780×1688; a study can script more), rendered from
 * the raw captures (scripts/work/shoot.mjs): the window holds at the top of each page, glides down
 * it with a soft start and stop (8 s at most, so a long page moves faster), holds at the foot, and
 * cross-fades to the next page. The reference (Valerin's project pages) runs about 10 s a device. Rendered at twice the size
 * and scaled down, so the glide moves by half pixels and never judders. Beside each recording its
 * poster (the first frame) and the stills the study's notes show: d-<page>.jpg (1440×900) and
 * m-<page>.jpg (780×1688), the top of each page as the site shows it.
 *
 * Writes public/media/work/<slug>/study/{desktop,phone}.{mp4,webm}, {desktop,phone}-poster.jpg,
 * d-<page>.jpg, m-<page>.jpg. H.264 for everywhere, VP9 for browsers without it.
 * A study can script its own walkthrough (content/studies/<slug>.json → walkthrough.desktop / .phone): a list
 * of scenes in order, each {page: "<name>"} (the page glides as above; hold/pan/tail in seconds to override),
 * {clip: "raw/<file>", seconds: N, from: <offset>} (one of the site's own films, or a recording made with
 * scripts/work/record.mjs, cut to the device's size, muted) or {still: "<name>", seconds: N} (a page's top,
 * held). Without a script every page glides, in order.
 *
 * Usage: node scripts/work/walkthrough.mjs [slug …] [--no-webm | --webm-only]
 *   (a project without phone frames gets no phone recording; --no-webm leaves the VP9 copies for a later pass,
 *   --webm-only makes them from the H.264 recordings already there: VP9 at 60 frames a second is the slow part)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WORK = path.join(ROOT, "public/media/work");
const FPS = 60, HOLD = 1.1, TAIL = 0.9, FADE = 0.8, MAX_PAN = 8;
const DEVICES = {
  desktop: { width: 1440, height: 900, speed: 150, maxPages: 4, maxStrip: 6600, raw: (raw, name) => [`${name}-full.png`, `${name}.png`].map((f) => path.join(raw, f)), still: "d-" },
  phone: { width: 780, height: 1688, speed: 125, maxPages: 3, maxStrip: 7600, raw: (raw, name) => [`m-${name}-full.png`, `m-${name}.png`].map((f) => path.join(raw, f)), still: "m-" },
};
const H264 = ["-c:v", "libx264", "-preset", "slow", "-crf", "25", "-maxrate", "3200k", "-bufsize", "6400k", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"];
const VP9 = ["-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "1500k", "-maxrate", "2400k", "-minrate", "0", "-deadline", "good", "-cpu-used", "2", "-row-mt", "1", "-an"];
const argv = process.argv.slice(2);
const flag = (k) => { const i = argv.indexOf(`--${k}`); if (i < 0) return false; argv.splice(i, 1); return true; };
const NO_WEBM = flag("no-webm"), WEBM_ONLY = flag("webm-only");
const only = argv;
const { projects } = JSON.parse(fs.readFileSync(path.join(ROOT, "content/work.json"), "utf8"));
// the study's scenes: from the compiled study, else from its override (scripts/port/studies.mjs lays the override over the
// generated study, so a scripted walkthrough is honoured before the first compile too)
const studyOf = (slug) => {
  for (const f of [path.join(ROOT, "content/studies", `${slug}.json`), path.join(ROOT, "content/studies/_overrides", `${slug}.json`)]) {
    if (!fs.existsSync(f)) continue;
    const study = JSON.parse(fs.readFileSync(f, "utf8"));
    if (study.walkthrough) return study;
  }
  return null;
};
const probe = (file) => { const [w, h, d] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "csv=p=0:s=x", file]).toString().trim().split(/[x\n]/).map(Number); return { width: w, height: h, duration: d }; };
const kb = (file) => `${Math.round(fs.statSync(file).size / 1024)} KB`;
const first = (files) => files.find((f) => fs.existsSync(f));

for (const project of projects) {
  if (only.length && !only.includes(project.slug)) continue;
  if (project.media === false) continue;
  const dir = path.join(WORK, project.slug);
  const raw = path.join(dir, "raw");
  const out = path.join(dir, "study");
  fs.mkdirSync(out, { recursive: true });
  const made = [];
  if (WEBM_ONLY) {
    for (const device of Object.keys(DEVICES)) {
      const final = path.join(out, `${device}.mp4`);
      if (!fs.existsSync(final)) continue;
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", final, ...VP9, path.join(out, `${device}.webm`)]);
      made.push(`${device} webm ${kb(path.join(out, `${device}.webm`))}`);
    }
    console.log(`${project.slug}: ${made.join(" · ") || "no recordings yet"}`);
    continue;
  }
  for (const [device, D] of Object.entries(DEVICES)) {
    const pages = project.pages.filter((pg) => first(D.raw(raw, pg.name)));
    const study = studyOf(project.slug);
    const scenes = study?.walkthrough?.[device] || pages.slice(0, D.maxPages).map((pg) => ({ page: pg.name }));
    if (!pages.length) continue;
    // every page's still, whether or not the script shows it
    for (const pg of pages) {
      const stillSrc = first(D.raw(raw, pg.name).slice().reverse()); // the viewport frame when there is one
      await sharp(stillSrc).resize(D.width, D.height, { fit: "cover", position: "top" }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(out, `${D.still}${pg.name}.jpg`));
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `qw-${project.slug}-${device}-`));
    const W2 = D.width * 2, H2 = D.height * 2;
    const segments = [];
    let k = 0;
    for (const scene of scenes) {
      const seg = path.join(tmp, `s${String(k++).padStart(2, "0")}.mp4`);
      if (scene.clip) {
        // one of the site's own films, or a recording: cut to the device's frame (cover), muted, at the walkthrough's rate
        const file = path.join(dir, scene.clip);
        if (!fs.existsSync(file)) { console.warn(`${project.slug}: ${scene.clip} is not there, skipped`); continue; }
        const { duration: full } = probe(file);
        const from = scene.from || 0;
        const duration = Math.max(0.5, Math.min(scene.seconds || 6, (full || 6) - from));
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(from), "-i", file, "-t", duration.toFixed(2), "-an",
          "-vf", `scale=${D.width}:${D.height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${D.width}:${D.height},fps=${FPS},format=yuv420p`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", seg]);
        segments.push({ out: seg, duration });
        continue;
      }
      const name = scene.page || scene.still;
      const src = first(D.raw(raw, name));
      if (!src) { console.warn(`${project.slug}: no ${device} frame for ${name}, skipped`); continue; }
      if (scene.still) {
        const duration = scene.seconds || 2.5;
        // ffmpeg reads a lossless copy: mozjpeg's optimised scan script writes a progressive JPEG its decoder refuses on a near-uniform picture
        const stillPng = path.join(tmp, `${name}-still.png`);
        await sharp(path.join(out, `${D.still}${name}.jpg`)).png({ compressionLevel: 1 }).toFile(stillPng);
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", stillPng,
          "-vf", `loop=loop=-1:size=1:start=0,setpts=N/(${FPS}*TB),trim=duration=${duration.toFixed(2)},scale=${D.width}:${D.height},format=yuv420p`, "-r", String(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", seg]);
        segments.push({ out: seg, duration });
        continue;
      }
      // the strip at twice the device's width (the captures were taken at 2× and 3×), never taller than the page needs
      const meta = await sharp(src).metadata();
      const height = Math.max(H2, Math.min(Math.round((meta.height * W2) / meta.width), D.maxStrip * 2));
      // a lossless strip (PNG, level 1: quick to write, read once): a JPEG from mozjpeg can carry a scan script ffmpeg refuses (a blank page)
      const strip = path.join(tmp, `${name}.png`);
      await sharp(src).resize(W2, height, { fit: "cover", position: "top" }).png({ compressionLevel: 1 }).toFile(strip);
      const travel = height - H2;
      const hold = scene.hold ?? HOLD, tail = scene.tail ?? TAIL;
      const pan = Math.min(scene.pan ?? MAX_PAN, travel / (D.speed * 2));
      const duration = hold + pan + tail;
      // the window's top edge (in the 2× strip): still, then eased down the page (smoothstep), then still
      const y = travel ? `${travel}*(st(0\\,clip((t-${hold})/${pan.toFixed(3)}\\,0\\,1))*ld(0)*(3-2*ld(0)))` : "0";
      // the strip is decoded once and looped in memory (the loop filter), not re-read for every frame: three and a half times faster
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", strip,
        "-vf", `loop=loop=-1:size=1:start=0,setpts=N/(${FPS}*TB),trim=duration=${duration.toFixed(2)},crop=${W2}:${H2}:0:'${y}',scale=${D.width}:${D.height}:flags=lanczos,format=yuv420p`, "-r", String(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", seg]);
      segments.push({ out: seg, duration });
    }
    if (!segments.length) { fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    const final = path.join(out, `${device}.mp4`);
    if (segments.length === 1) {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", segments[0].out, ...H264, final]);
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
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", graph.slice(0, -1), "-map", "[v]", ...H264, final]);
    }
    if (!NO_WEBM) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", final, ...VP9, path.join(out, `${device}.webm`)]);
    else if (fs.existsSync(path.join(out, `${device}.webm`))) fs.rmSync(path.join(out, `${device}.webm`)); // a stale VP9 copy of an older recording
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", final, "-frames:v", "1", "-q:v", "3", path.join(out, `${device}-poster.jpg`)]);
    fs.rmSync(tmp, { recursive: true, force: true });
    const seconds = segments.reduce((a, s) => a + s.duration, 0) - FADE * (segments.length - 1);
    made.push(`${device} ${seconds.toFixed(1)} s, ${segments.length} scenes: mp4 ${kb(final)}${NO_WEBM ? "" : `, webm ${kb(path.join(out, `${device}.webm`))}`}`);
  }
  console.log(`${project.slug}: ${made.join(" · ") || "no raw frames (run scripts/work/shoot.mjs)"}`);
}
