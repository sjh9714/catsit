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

// src/overlay/png.ts
import zlib from "zlib";
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
function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (1 + w * 4) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// src/overlay/render.ts
var CAT_COLS = FRAME_W;
var CAT_ROWS = FRAME_H / 2;
var KITTY_SCALE = 8;
var KITTY_IMG_BASE = 4200;
function detectRenderMode(env = process.env) {
  const override = env["CATSIT_RENDER"];
  if (override === "kitty" || override === "half" || override === "kaomoji") return override;
  if (env["NO_COLOR"] !== void 0 || env["TERM"] === "dumb") return "kaomoji";
  if (env["TMUX"]) return "half";
  if (env["TERM"] === "xterm-kitty" || env["KITTY_WINDOW_ID"]) return "kitty";
  const prog = env["TERM_PROGRAM"] ?? "";
  if (/ghostty|wezterm|iterm\.app/i.test(prog)) return "kitty";
  return "half";
}
var SpriteRenderer = class {
  constructor(mode) {
    this.mode = mode;
  }
  mode;
  transmitted = /* @__PURE__ */ new Set();
  b64Cache = /* @__PURE__ */ new Map();
  frameIds = /* @__PURE__ */ new Map();
  lastPlacedId = null;
  get modeName() {
    return this.mode;
  }
  get cellSize() {
    return { w: CAT_COLS, h: CAT_ROWS };
  }
  draw(o) {
    if (this.mode === "kitty") return this.drawKitty(o);
    if (this.mode === "half") return this.drawHalf(o);
    return this.drawKaomoji(o);
  }
  /** Extra cleanup beyond cell repair (kitty must delete its placement). */
  clear() {
    if (this.mode === "kitty" && this.lastPlacedId !== null) {
      const id = this.lastPlacedId;
      this.lastPlacedId = null;
      return `\x1B_Ga=d,d=i,i=${id},q=2\x1B\\`;
    }
    return "";
  }
  // ------------------------------------------------------------- kitty ----
  frameId(name) {
    let id = this.frameIds.get(name);
    if (id === void 0) {
      id = KITTY_IMG_BASE + this.frameIds.size;
      this.frameIds.set(name, id);
    }
    return id;
  }
  frameB64(name) {
    let b64 = this.b64Cache.get(name);
    if (b64 === void 0) {
      const px = framePixels(name);
      const up = upscale(px, FRAME_W, FRAME_H, KITTY_SCALE);
      b64 = encodePNG(FRAME_W * KITTY_SCALE, FRAME_H * KITTY_SCALE, up).toString("base64");
      this.b64Cache.set(name, b64);
    }
    return b64;
  }
  drawKitty(o) {
    const visCols = Math.min(CAT_COLS, o.cols - o.cellX);
    if (visCols <= 0) return this.clear();
    const id = this.frameId(o.frame);
    let s = "";
    if (!this.transmitted.has(o.frame)) {
      const b64 = this.frameB64(o.frame);
      const CHUNK = 4e3;
      for (let i = 0; i < b64.length; i += CHUNK) {
        const last = i + CHUNK >= b64.length;
        const keys = i === 0 ? `a=t,f=100,t=d,i=${id},q=2,m=${last ? 0 : 1}` : `m=${last ? 0 : 1}`;
        s += `\x1B_G${keys};${b64.slice(i, i + CHUNK)}\x1B\\`;
      }
      this.transmitted.add(o.frame);
    }
    if (this.lastPlacedId !== null) s += `\x1B_Ga=d,d=i,i=${this.lastPlacedId},q=2\x1B\\`;
    const srcW = Math.round(visCols / CAT_COLS * FRAME_W * KITTY_SCALE);
    s += `\x1B[${o.cellY + 1};${o.cellX + 1}H`;
    s += `\x1B_Ga=p,i=${id},p=1,z=1,C=1,q=2,w=${srcW},c=${visCols},r=${CAT_ROWS}\x1B\\`;
    this.lastPlacedId = id;
    return s;
  }
  // -------------------------------------------------------- half blocks ----
  drawHalf(o) {
    const px = framePixels(o.frame);
    let s = "";
    const visCols = Math.min(CAT_COLS, o.cols - o.cellX);
    for (let cy = 0; cy < CAT_ROWS; cy++) {
      const row = o.cellY + cy;
      if (row < 0 || row >= o.rows) continue;
      let run = "";
      let runStart = -1;
      const flush = () => {
        if (runStart >= 0 && run) s += `\x1B[${row + 1};${o.cellX + runStart + 1}H` + run + "\x1B[0m";
        run = "";
        runStart = -1;
      };
      for (let cx = 0; cx < visCols; cx++) {
        const top = pixelAt(px, cx, cy * 2);
        const bot = pixelAt(px, cx, cy * 2 + 1);
        if (!top && !bot) {
          flush();
          continue;
        }
        if (runStart === -1) runStart = cx;
        if (top && bot) run += `\x1B[38;2;${top[0]};${top[1]};${top[2]};48;2;${bot[0]};${bot[1]};${bot[2]}m\u2580`;
        else if (top) run += `\x1B[0;38;2;${top[0]};${top[1]};${top[2]}m\u2580`;
        else run += `\x1B[0;38;2;${bot[0]};${bot[1]};${bot[2]}m\u2584`;
      }
      flush();
    }
    return s;
  }
  // ------------------------------------------------------------ kaomoji ----
  drawKaomoji(o) {
    const art = o.frame === "alert" ? ["  \u2227,,,\u2227", " (  \u0333> \xB7 < \u0333)", " /    \u3065 mew!"] : ["  \u2227,,,\u2227", " (  \u0333- \u1D25 - \u0333)", " /    \u3065 zzZ"];
    let s = "";
    art.forEach((line, i) => {
      const row = o.cellY + CAT_ROWS - art.length + i;
      if (row < 0 || row >= o.rows) return;
      s += `\x1B[${row + 1};${o.cellX + 1}H\x1B[0m${line}`;
    });
    return s;
  }
};
function pixelAt(px, x, y) {
  if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H) return null;
  const i = (y * FRAME_W + x) * 4;
  if (px[i + 3] === 0) return null;
  return [px[i], px[i + 1], px[i + 2]];
}
function upscale(px, w, h, scale) {
  const out = new Uint8Array(w * scale * h * scale * 4);
  for (let y = 0; y < h * scale; y++) {
    for (let x = 0; x < w * scale; x++) {
      const si = ((y / scale | 0) * w + (x / scale | 0)) * 4;
      const di = (y * w * scale + x) * 4;
      out[di] = px[si];
      out[di + 1] = px[si + 1];
      out[di + 2] = px[si + 2];
      out[di + 3] = px[si + 3];
    }
  }
  return out;
}
export {
  CAT_COLS,
  CAT_ROWS,
  SpriteRenderer,
  detectRenderMode
};
