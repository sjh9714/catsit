// Walk-cycle post-process: stabilize a tracked walking cat onto a fixed
// canvas (feet on the bottom line, body centered), find the gait loop, and
// bake both directions.
//   node post-walk.mjs <cutDir> <outDir>   → outDir/R/w*.png (facing right)
//                                            outDir/L/w*.png (mirrored)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [cutDir, outDir] = process.argv.slice(2);
const CANVAS_W = 420, CANVAS_H = 256, CAT_H = 140; // cat height inside canvas
const files = fs.readdirSync(cutDir).filter((f) => f.endsWith(".png")).sort();
const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path.join(cutDir, files[0])]).toString().trim();
const [W, H] = probe.split(",").map(Number);
console.log(`frames=${files.length} ${W}x${H}`);

const bufs = files.map((f) => {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(cutDir, f), "-f", "rawvideo", "-pix_fmt", "rgba", "/tmp/pw.rgba"]);
  return fs.readFileSync("/tmp/pw.rgba");
});

// temporal alpha median-3
const med = (a, b, c) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
for (let i = 0; i < bufs.length; i++) {
  const p = bufs[Math.max(0, i - 1)], c = bufs[i], n = bufs[Math.min(bufs.length - 1, i + 1)];
  if (p === c && c === n) continue;
  for (let px = 3; px < c.length; px += 4) c[px] = med(p[px], c[px], n[px]);
}

// per-frame bbox
const boxes = bufs.map((b) => {
  let minx = W, miny = H, maxx = -1, maxy = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (b[(y * W + x) * 4 + 3] > 16) {
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
  }
  return { minx, miny, maxx, maxy, cx: (minx + maxx) / 2, h: maxy - miny };
});
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const feetY = median(boxes.map((b) => b.maxy));
const catH = median(boxes.map((b) => b.h));
console.log(`feetY=${feetY} catH=${catH}`);

// smooth horizontal center (5-frame moving average)
const cxs = boxes.map((_, i) => {
  let s = 0, n = 0;
  for (let j = Math.max(0, i - 2); j <= Math.min(boxes.length - 1, i + 2); j++) { s += boxes[j].cx; n++; }
  return s / n;
});

// crop window in source px so the cat lands CAT_H tall on the canvas
const scale = CAT_H / catH;
const SRC_W = Math.round(CANVAS_W / scale), SRC_H = Math.round(CANVAS_H / scale);
const PAD_BOTTOM = Math.round(14 / scale);

// gait loop detection: alpha-mask IoU of frame 0 vs frame k (in the crop window)
const mask = (i) => {
  const b = bufs[i];
  const x0 = Math.round(cxs[i] - SRC_W / 2), y0 = feetY + PAD_BOTTOM - SRC_H;
  const m = new Uint8Array(64 * 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const sx = x0 + Math.floor((x * SRC_W) / 64), sy = y0 + Math.floor((y * SRC_H) / 64);
    if (sx >= 0 && sy >= 0 && sx < W && sy < H && b[(sy * W + sx) * 4 + 3] > 128) m[y * 64 + x] = 1;
  }
  return m;
};
const m0 = mask(0);
let best = { k: 0, iou: -1 };
for (let k = 6; k <= Math.min(20, bufs.length - 1); k++) {
  const mk = mask(k);
  let inter = 0, uni = 0;
  for (let i = 0; i < mk.length; i++) { inter += m0[i] & mk[i]; uni += m0[i] | mk[i]; }
  const iou = inter / uni;
  console.log(`k=${k} iou=${iou.toFixed(3)}`);
  if (iou > best.iou) best = { k, iou };
}
console.log(`cycle length=${best.k} (iou=${best.iou.toFixed(3)})`);

fs.mkdirSync(path.join(outDir, "R"), { recursive: true });
fs.mkdirSync(path.join(outDir, "L"), { recursive: true });
for (let i = 0; i < best.k; i++) {
  const x0 = Math.max(0, Math.min(W - SRC_W, Math.round(cxs[i] - SRC_W / 2))), y0 = feetY + PAD_BOTTOM - SRC_H;
  fs.writeFileSync("/tmp/pw.rgba", bufs[i]);
  const nn = `w${String(i + 1).padStart(3, "0")}.png`;
  const base = ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-i", "/tmp/pw.rgba"];
  execFileSync("ffmpeg", [...base, "-vf", `crop=${SRC_W}:${SRC_H}:${x0}:${y0},scale=${CANVAS_W}:${CANVAS_H}`, path.join(outDir, "R", nn)]);
  execFileSync("ffmpeg", [...base, "-vf", `crop=${SRC_W}:${SRC_H}:${x0}:${y0},scale=${CANVAS_W}:${CANVAS_H},hflip`, path.join(outDir, "L", nn)]);
}
console.log(`wrote ${best.k} frames x2 directions to ${outDir}`);
