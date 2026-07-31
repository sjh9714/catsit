// Bakes the low-res half-block frames: every beat frame downsampled to a
// tiny RGBA grid (HB_W x HB_H), concatenated, deflated, and written to
// assets/cat-frames/half.bin with a JSON header line. Terminals without the
// kitty graphics protocol play THESE — same living cat, chunkier pixels.
//
//   node scripts/gen-half.mjs <keyedBeatsDir> [<keyedBeatsDir> ...]
//
// Each dir holds <beat>/fNNN.png full-res RGBA (pre-palette) frames, in the
// same beat order as assets/cat-frames/manifest.json.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const HB_W = 36; // half-block grid: cols x (rows*2) pixels at full size
const HB_H = 26;

const manifest = JSON.parse(fs.readFileSync("assets/cat-frames/manifest.json", "utf8"));
const beatNames = Object.keys(manifest.beats);

const srcDirs = process.argv.slice(2);
const findBeat = (name) => {
  for (const d of srcDirs) {
    const p = path.join(d, name);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`no source dir for beat ${name}`);
};

const chunks = [];
const index = {};
let frameCount = 0;
for (const name of beatNames) {
  const dir = findBeat(name);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
  index[name] = { offset: frameCount, count: files.length };
  for (const f of files) {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(dir, f), "-vf", `scale=${HB_W}:${HB_H}:flags=lanczos`, "-f", "rawvideo", "-pix_fmt", "rgba", "/tmp/hb.rgba"]);
    chunks.push(fs.readFileSync("/tmp/hb.rgba"));
    frameCount++;
  }
  console.log(`${name}: ${files.length} frames`);
}

const raw = Buffer.concat(chunks);
const packed = zlib.deflateSync(raw, { level: 9 });
const header = Buffer.from(JSON.stringify({ w: HB_W, h: HB_H, beats: index }) + "\n");
fs.writeFileSync("assets/cat-frames/half.bin", Buffer.concat([header, packed]));
console.log(`half.bin: ${frameCount} frames, ${(raw.length / 1024).toFixed(0)}KB raw -> ${(packed.length / 1024).toFixed(0)}KB packed`);
