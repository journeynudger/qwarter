/**
 * Image work done in a browser canvas, so no image library is needed:
 *   diffPng     the share of pixels that differ between two PNGs, and a picture of where
 *   contactSheet  several PNGs side by side in one image, for looking at a capture quickly
 */
import fs from "node:fs";

const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;

export async function diffPng(browser, a, b, outPath, threshold = 48) {
  const page = await browser.newPage();
  const result = await page.evaluate(
    async ({ a, b, threshold }) => {
      const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const w = Math.max(ia.width, ib.width);
      const h = Math.max(ia.height, ib.height);
      const ca = new OffscreenCanvas(w, h).getContext("2d");
      const cb = new OffscreenCanvas(w, h).getContext("2d");
      ca.fillStyle = cb.fillStyle = "#f0f";
      ca.fillRect(0, 0, w, h); cb.fillRect(0, 0, w, h);
      ca.drawImage(ia, 0, 0); cb.drawImage(ib, 0, 0);
      const da = ca.getImageData(0, 0, w, h).data;
      const db = cb.getImageData(0, 0, w, h).data;
      const out = new OffscreenCanvas(w, h);
      const co = out.getContext("2d");
      co.drawImage(ia, 0, 0);
      co.fillStyle = "rgba(255,255,255,0.75)";
      co.fillRect(0, 0, w, h);
      const od = co.getImageData(0, 0, w, h);
      let diff = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
        if (d > threshold) {
          diff++;
          od.data[i] = 230; od.data[i + 1] = 30; od.data[i + 2] = 30; od.data[i + 3] = 255;
        }
      }
      co.putImageData(od, 0, 0);
      const blob = await out.convertToBlob({ type: "image/png" });
      return { ratio: diff / (w * h), w, h, png: Array.from(new Uint8Array(await blob.arrayBuffer())) };
    },
    { a: dataUrl(a), b: dataUrl(b), threshold },
  );
  if (outPath) fs.writeFileSync(outPath, Buffer.from(result.png));
  await page.close();
  return { ratio: result.ratio, w: result.w, h: result.h };
}

/** PNGs in a grid, each scaled to the column width, labelled. */
export async function contactSheet(browser, files, outPath, { cols = 3, width = 1800, labels = [] } = {}) {
  const page = await browser.newPage();
  const png = await page.evaluate(
    async ({ imgs, cols, width, labels }) => {
      const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
      const els = await Promise.all(imgs.map(load));
      const cw = Math.floor(width / cols);
      const heights = els.map((e) => Math.round(e.height * (cw / e.width)));
      const rows = Math.ceil(els.length / cols);
      const rowH = [...Array(rows)].map((_, r) => Math.max(...heights.slice(r * cols, r * cols + cols)) + 22);
      const c = new OffscreenCanvas(width, rowH.reduce((a, b) => a + b, 0));
      const x = c.getContext("2d");
      x.fillStyle = "#777";
      x.fillRect(0, 0, c.width, c.height);
      x.font = "14px sans-serif";
      let y = 0;
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < cols; k++) {
          const i = r * cols + k;
          if (i >= els.length) break;
          x.drawImage(els[i], k * cw + 2, y + 20, cw - 4, heights[i] - 2);
          x.fillStyle = "#fff";
          x.fillText(labels[i] || String(i), k * cw + 6, y + 15);
        }
        y += rowH[r];
      }
      const b = await c.convertToBlob({ type: "image/png" });
      return Array.from(new Uint8Array(await b.arrayBuffer()));
    },
    { imgs: files.map(dataUrl), cols, width, labels },
  );
  fs.writeFileSync(outPath, Buffer.from(png));
  await page.close();
}
