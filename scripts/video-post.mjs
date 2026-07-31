// Post-process cutout frames: temporal alpha median → union bbox crop → resized PNGs.
// usage: node post.mjs <cutDir> <outDir>
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [cutDir, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(cutDir).filter((f) => f.endsWith(".png")).sort();

// decode all frames to raw RGBA (same dimensions assumed)
const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path.join(cutDir, files[0])]).toString().trim();
const [W, H] = probe.split(",").map(Number);
console.log(`frames=${files.length} ${W}x${H}`);

const bufs = files.map((f) => {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(cutDir, f), "-f", "rawvideo", "-pix_fmt", "rgba", "/tmp/pp.rgba"]);
  return fs.readFileSync("/tmp/pp.rgba");
});

// temporal alpha median-3 (kills single-frame matte flicker)
const med = (a, b, c) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
for (let i = 0; i < bufs.length; i++) {
  const p = bufs[Math.max(0, i - 1)], c = bufs[i], n = bufs[Math.min(bufs.length - 1, i + 1)];
  if (p === c && c === n) continue;
  for (let px = 3; px < c.length; px += 4) c[px] = med(p[px], c[px], n[px]);
}

// union bbox across all frames
let minx = W, miny = H, maxx = -1, maxy = -1;
for (const b of bufs) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (b[(y * W + x) * 4 + 3] > 16) {
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
  }
}
const pad = 4;
minx = Math.max(0, minx - pad); miny = Math.max(0, miny - pad);
maxx = Math.min(W - 1, maxx + pad); maxy = Math.min(H - 1, maxy + pad);
const CW = maxx - minx + 1, CH = maxy - miny + 1;
console.log(`bbox ${CW}x${CH} @${minx},${miny}`);

for (let i = 0; i < bufs.length; i++) {
  fs.writeFileSync("/tmp/pp.rgba", bufs[i]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-i", "/tmp/pp.rgba",
    "-vf", `crop=${CW}:${CH}:${minx}:${miny},scale=-1:256`, path.join(outDir, files[i])]);
}
console.log(`wrote ${bufs.length} frames to ${outDir}`);
