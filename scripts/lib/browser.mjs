/**
 * Chromium for the scripts in scripts/: Playwright's own build when it is installed,
 * otherwise the one at PLAYWRIGHT_CHROMIUM or the cloud image's /opt/pw-browsers/chromium.
 */
import fs from "node:fs";
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
