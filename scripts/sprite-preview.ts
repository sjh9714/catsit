// Renders every sprite frame into one contact-sheet PNG (scaled up) so the
// art can be reviewed visually. Build+run:
//   npx tsup scripts/sprite-preview.ts --format esm -d dist-preview --silent && node dist-preview/sprite-preview.js <out.png>
import zlib from "node:zlib";
import fs from "node:fs";
import { FRAMES, FRAME_H, FRAME_W, framePixels, type FrameName } from "../src/overlay/sprites.js";

const SCALE = 8;
const names = Object.keys(FRAMES) as FrameName[];
const cols = 3;
const rowsN = Math.ceil(names.length / cols);
const PAD = 8;
const W = cols * (FRAME_W * SCALE + PAD) + PAD;
const H = rowsN * (FRAME_H * SCALE + PAD) + PAD;
const out = new Uint8Array(W * H * 4);
// checkerboard background to reveal the alpha channel
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const c = ((x >> 4) + (y >> 4)) % 2 ? 70 : 55;
    out[i] = c; out[i + 1] = c; out[i + 2] = c + 6; out[i + 3] = 255;
  }
names.forEach((name, idx) => {
  const px = framePixels(name);
  const ox = PAD + (idx % cols) * (FRAME_W * SCALE + PAD);
  const oy = PAD + Math.floor(idx / cols) * (FRAME_H * SCALE + PAD);
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) {
      const si = (y * FRAME_W + x) * 4;
      if (px[si + 3] === 0) continue;
      for (let dy = 0; dy < SCALE; dy++)
        for (let dx = 0; dx < SCALE; dx++) {
          const di = ((oy + y * SCALE + dy) * W + ox + x * SCALE + dx) * 4;
          out[di] = px[si]!; out[di + 1] = px[si + 1]!; out[di + 2] = px[si + 2]!; out[di + 3] = 255;
        }
    }
});

// PNG encode (same logic as scripts/spike/png.mjs)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0;
  Buffer.from(out.buffer, y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
fs.writeFileSync(process.argv[2] ?? "sprites.png", png);
console.log(`wrote ${process.argv[2] ?? "sprites.png"} (${W}x${H})`);
