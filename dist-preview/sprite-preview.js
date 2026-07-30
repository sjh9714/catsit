// scripts/sprite-preview.ts
import zlib from "zlib";
import fs from "fs";

// src/overlay/sprites.ts
var PALETTE = {
  k: [28, 28, 34],
  // black fur
  d: [16, 16, 20],
  // outline/shadow
  w: [245, 242, 234],
  // white chest/muzzle/paws
  p: [242, 167, 179],
  // pink ears/nose
  e: [126, 200, 80],
  // green eyes
  m: [90, 90, 100],
  // whisker gray
  z: [170, 200, 255]
  // sleep z's
};
var FRAME_W = 26;
var FRAME_H = 14;
var FRAMES = {
  loaf1: [
    "..........................",
    "...kk....kk...............",
    "..kpdk..kpdk..............",
    "..kkkkkkkkkk..............",
    ".kkkkkkkkkkkkkkkkkkkkk....",
    ".kekkkkekkkkkkkkkkkkkkkk..",
    ".kkkkkkkkkkkkkkkkkkkkkkk..",
    ".kkwpwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkdk.",
    ".kwwwwkkkkkkkkkkkkkkkkkdk.",
    "..wwkkwwkkkwwkkkkkkkkkdd..",
    ".........................."
  ],
  loaf2: [
    "..........................",
    "..........................",
    "...kk....kk...............",
    "..kpdk..kpdk..............",
    ".kkkkkkkkkkkkkkkkkkkkk....",
    ".kekkkkekkkkkkkkkkkkkkkk..",
    ".kkkkkkkkkkkkkkkkkkkkkkk..",
    ".kkwpwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkdk.",
    ".kwwwwkkkkkkkkkkkkkkkkkdk.",
    "..wwkkwwkkkwwkkkkkkkkkdd..",
    ".........................."
  ],
  sleep1: [
    "..................z.......",
    "...kk....kk......z........",
    "..kpdk..kpdk....z.........",
    "..kkkkkkkkkk..............",
    ".kkkkkkkkkkkkkkkkkkkkk....",
    ".kkkkkkkkkkkkkkkkkkkkkkk..",
    ".kdkkkkdkkkkkkkkkkkkkkkk..",
    ".kkwpwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkdk.",
    ".kwwwwkkkkkkkkkkkkkkkkkdk.",
    "..wwkkwwkkkwwkkkkkkkkkdd..",
    ".........................."
  ],
  sleep2: [
    "..............z...........",
    "...kk....kk.....z.........",
    "..kpdk..kpdk...z..........",
    "..kkkkkkkkkk..............",
    ".kkkkkkkkkkkkkkkkkkkkk....",
    ".kkkkkkkkkkkkkkkkkkkkkkk..",
    ".kdkkkkdkkkkkkkkkkkkkkkk..",
    ".kkwpwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkdk.",
    ".kwwwwkkkkkkkkkkkkkkkkkdk.",
    "..wwkkwwkkkwwkkkkkkkkkdd..",
    ".........................."
  ],
  flick: [
    "......................dk..",
    "...kk....kk..........dk...",
    "..kpdk..kpdk........dk....",
    "..kkkkkkkkkk........kk....",
    ".kkkkkkkkkkkkkkkkkkkkk....",
    ".kekkkkekkkkkkkkkkkkkkkk..",
    ".kkkkkkkkkkkkkkkkkkkkkkk..",
    ".kkwpwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkkk.",
    ".kwwwwkkkkkkkkkkkkkkkkkkk.",
    "..wwkkwwkkkwwkkkkkkkkkkk..",
    ".........................."
  ],
  gulp: [
    "..........................",
    "...kk....kk...............",
    "..kpdk..kpdk..............",
    "..kkkkkkkkkk..............",
    ".kkkkkkkkkkkkkkkkkkkkk....",
    ".kdkkkkdkkkkkkkkkkkkkkkk..",
    ".kkkkkkkkkkkkkkkkkkkkkkk..",
    ".kwwwwwwkkkkkkkkkkkkkkkkk.",
    ".kwwwwwwkkkkkkkkkkkkkkkkk.",
    ".kwwwwwkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkdk.",
    ".kwwwwkkkkkkkkkkkkkkkkkdk.",
    "..wwkkwwkkkwwkkkkkkkkkdd..",
    ".........................."
  ],
  alert: [
    "...kk....kk...............",
    "..kpdk..kpdk..............",
    "..kkkkkkkkkk..............",
    ".kkkkkkkkkkkk.......dk....",
    ".kekkkkekkkkk.......kd....",
    ".kkwpwkkkkkkk.......kk....",
    ".kwwwwkkkkkkkkkkkkkkkk....",
    ".kwwwkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkk.....",
    ".kwkk.kkk....kkk..kkk.....",
    ".kwkk.kkk....kkk..kkk.....",
    ".www..www....kkk..kkk....."
  ],
  walk1: [
    "...kk....kk...............",
    "..kpdk..kpdk..............",
    "..kkkkkkkkkk..............",
    ".kkkkkkkkkkkk.......dk....",
    ".kekkkkekkkkk.......kd....",
    ".kkwpwkkkkkkk.......kk....",
    ".kwwwwkkkkkkkkkkkkkkkk....",
    ".kwwwkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkk.....",
    "..kwk..kkk...kkk...kkk....",
    ".kwk....kkk...kkk...kkk...",
    ".ww......www..kkk....kk..."
  ],
  walk2: [
    "...kk....kk...............",
    "..kpdk..kpdk..............",
    "..kkkkkkkkkk..............",
    ".kkkkkkkkkkkk.......dk....",
    ".kekkkkekkkkk.......kd....",
    ".kkwpwkkkkkkk.......kk....",
    ".kwwwwkkkkkkkkkkkkkkkk....",
    ".kwwwkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkk.....",
    "...kwk..kkk..kkk..kkk.....",
    "..kwk..kkk....kkk..kkk....",
    "..ww...www....kkk...kk...."
  ]
};
var RIM = [104, 104, 122];
function framePixels(name, rim = true) {
  const rows = FRAMES[name];
  const px = new Uint8Array(FRAME_W * FRAME_H * 4);
  const solid = (x, y) => {
    if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H) return false;
    const ch = rows[y]?.[x] ?? ".";
    return ch !== "." && ch !== "z" && ch in PALETTE;
  };
  for (let y = 0; y < FRAME_H; y++) {
    const row = rows[y] ?? "";
    for (let x = 0; x < FRAME_W; x++) {
      const ch = row[x] ?? ".";
      const i = (y * FRAME_W + x) * 4;
      if (ch === "." || !(ch in PALETTE)) {
        if (rim && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) {
          px[i] = RIM[0];
          px[i + 1] = RIM[1];
          px[i + 2] = RIM[2];
          px[i + 3] = 255;
        }
        continue;
      }
      const rgb = PALETTE[ch];
      px[i] = rgb[0];
      px[i + 1] = rgb[1];
      px[i + 2] = rgb[2];
      px[i + 3] = 255;
    }
  }
  return px;
}

// scripts/sprite-preview.ts
var SCALE = 8;
var names = Object.keys(FRAMES);
var cols = 3;
var rowsN = Math.ceil(names.length / cols);
var PAD = 8;
var W = cols * (FRAME_W * SCALE + PAD) + PAD;
var H = rowsN * (FRAME_H * SCALE + PAD) + PAD;
var out = new Uint8Array(W * H * 4);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const c = ((x >> 4) + (y >> 4)) % 2 ? 70 : 55;
    out[i] = c;
    out[i + 1] = c;
    out[i + 2] = c + 6;
    out[i + 3] = 255;
  }
names.forEach((name, idx) => {
  const px = framePixels(name);
  const ox = PAD + idx % cols * (FRAME_W * SCALE + PAD);
  const oy = PAD + Math.floor(idx / cols) * (FRAME_H * SCALE + PAD);
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) {
      const si = (y * FRAME_W + x) * 4;
      if (px[si + 3] === 0) continue;
      for (let dy = 0; dy < SCALE; dy++)
        for (let dx = 0; dx < SCALE; dx++) {
          const di = ((oy + y * SCALE + dy) * W + ox + x * SCALE + dx) * 4;
          out[di] = px[si];
          out[di + 1] = px[si + 1];
          out[di + 2] = px[si + 2];
          out[di + 3] = 255;
        }
    }
});
var CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 4294967295;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
var ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;
var raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0;
  Buffer.from(out.buffer, y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
}
var png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0))
]);
fs.writeFileSync(process.argv[2] ?? "sprites.png", png);
console.log(`wrote ${process.argv[2] ?? "sprites.png"} (${W}x${H})`);
