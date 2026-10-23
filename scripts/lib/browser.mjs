/**
 * Chromium for the scripts in scripts/: Playwright's own build when it is installed,
 * otherwise the one at PLAYWRIGHT_CHROMIUM or the cloud image's /opt/pw-browsers/chromium.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

export async function launch(options = {}) {
  try {
    return await chromium.launch(options);
  } catch (err) {
    const fallback = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium"].find((p) => p && fs.existsSync(p));
    if (!fallback) throw err;
    return chromium.launch({ ...options, executablePath: fallback });
  }
}

/**
 * The headless shell (Chromium's old headless), the one build that takes BeginFrame control
 * (HeadlessExperimental.beginFrame: one composited frame per call, deterministic); the full browser's headless mode
 * does not have the domain. Playwright's own copy when it is installed (`playwright install chromium` brings it),
 * else PLAYWRIGHT_HEADLESS_SHELL, else the newest headless_shell under the browsers folder.
 */
export async function launchHeadlessShell(options = {}) {
  try {
    return await chromium.launch({ ...options, channel: "chromium-headless-shell" });
  } catch (err) {
    const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(os.homedir(), ".cache/ms-playwright"), "/opt/pw-browsers"].filter((r) => r && fs.existsSync(r));
    const shells = roots.flatMap((root) => fs.readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell-")).sort().reverse()
      .flatMap((d) => fs.readdirSync(path.join(root, d)).map((sub) => path.join(root, d, sub, "headless_shell"))));
    const exe = [process.env.PLAYWRIGHT_HEADLESS_SHELL, ...shells].find((p) => p && fs.existsSync(p));
    if (!exe) throw err;
    return chromium.launch({ ...options, executablePath: exe });
  }
}

/**
 * ffmpeg: the system's when it is on the PATH, else the build Playwright installs beside its browsers (a GitHub runner
 * has none on the PATH: the first films there were recorded and then lost to "spawnSync ffmpeg ENOENT").
 */
export function ffmpegPath() {
  const onPath = (process.env.PATH || "").split(path.delimiter).map((d) => path.join(d, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg")).find((f) => fs.existsSync(f));
  if (onPath) return onPath;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(os.homedir(), ".cache/ms-playwright"), "/opt/pw-browsers"].filter((r) => r && fs.existsSync(r));
  const name = process.platform === "win32" ? "ffmpeg-win64.exe" : process.platform === "darwin" ? "ffmpeg-mac" : "ffmpeg-linux";
  const bundled = roots.flatMap((root) => fs.readdirSync(root).filter((d) => d.startsWith("ffmpeg-")).sort().reverse().map((d) => path.join(root, d, name))).find((f) => fs.existsSync(f));
  return bundled || "ffmpeg";
}
