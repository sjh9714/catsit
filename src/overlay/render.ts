// Sprite renderers with a degradation ladder:
//   kitty  — real PNG floated above the text (kitty graphics protocol, z=1)
//   half   — truecolor half-blocks (2 vertical px per cell)
//   kaomoji — plain text cat for NO_COLOR / dumb terminals
//
// All modes draw the same frame geometry: FRAME_W cols × FRAME_H/2 rows.

import { FRAME_H, FRAME_W, framePixels, type FrameName } from "./sprites.js";
import { encodePNG } from "./png.js";

export type RenderMode = "kitty" | "half" | "kaomoji";

export const CAT_COLS = FRAME_W;
export const CAT_ROWS = FRAME_H / 2;

const KITTY_SCALE = 8; // transmit crisp upscaled pixels; terminal fits to cells
const KITTY_IMG_BASE = 4200; // arbitrary id namespace for catsit

export function detectRenderMode(env: NodeJS.ProcessEnv = process.env): RenderMode {
  const override = env["CATSIT_RENDER"];
  if (override === "kitty" || override === "half" || override === "kaomoji") return override;
  if (env["NO_COLOR"] !== undefined || env["TERM"] === "dumb") return "kaomoji";
  if (env["TMUX"]) return "half"; // kitty APC needs passthrough plumbing; later
  if (env["TERM"] === "xterm-kitty" || env["KITTY_WINDOW_ID"]) return "kitty";
  const prog = env["TERM_PROGRAM"] ?? "";
  if (/ghostty|wezterm|iterm\.app/i.test(prog)) return "kitty";
  return "half";
}

/** Terminals without 24-bit color (notably Apple Terminal) get xterm-256. */
export function detectTruecolor(env: NodeJS.ProcessEnv = process.env): boolean {
  const override = env["CATSIT_COLOR"];
  if (override === "truecolor") return true;
  if (override === "256") return false;
  if (/truecolor|24bit/i.test(env["COLORTERM"] ?? "")) return true;
  if ((env["TERM"] ?? "").includes("direct")) return true;
  if (env["TERM"] === "xterm-kitty" || env["KITTY_WINDOW_ID"]) return true;
  const prog = env["TERM_PROGRAM"] ?? "";
  if (/ghostty|wezterm|iterm\.app|vscode|orca/i.test(prog)) return true;
  return false; // unknown terminal: 256-color is safe everywhere
}

/** Nearest xterm-256 index: 6×6×6 color cube + the grayscale ramp. */
export function rgbTo256(r: number, g: number, b: number): number {
  const cube = (v: number): number => (v < 48 ? 0 : v < 115 ? 1 : Math.min(5, Math.floor((v - 35) / 40)));
  const cr = cube(r);
  const cg = cube(g);
  const cb = cube(b);
  const cv = (i: number): number => (i === 0 ? 0 : 55 + i * 40);
  const cubeDist = (cv(cr) - r) ** 2 + (cv(cg) - g) ** 2 + (cv(cb) - b) ** 2;
  const grayIdx = Math.max(0, Math.min(23, Math.round(((r + g + b) / 3 - 8) / 10)));
  const gv = 8 + grayIdx * 10;
  const grayDist = (gv - r) ** 2 + (gv - g) ** 2 + (gv - b) ** 2;
  return grayDist < cubeDist ? 232 + grayIdx : 16 + 36 * cr + 6 * cg + cb;
}

export interface DrawOpts {
  frame: FrameName;
  cellX: number; // may be > cols-CAT_COLS during walk-in (clipped)
  cellY: number;
  cols: number;
  rows: number;
}

export class SpriteRenderer {
  private b64Cache = new Map<FrameName, string>();
  // Single image id: frame changes RETRANSMIT data under the same id (the
  // active placement keeps showing, updated in place) and position changes
  // re-place the same placement id (atomic replace). No deletes during
  // animation — a delete/place pair leaves a window where the terminal can
  // composite a frame with no cat at all.
  private lastFrame: FrameName | null = null;
  private placed = false;

  constructor(
    private mode: RenderMode,
    private log?: (msg: string) => void,
    private truecolor: boolean = detectTruecolor(),
  ) {}

  get modeName(): RenderMode {
    return this.mode;
  }

  /** SGR foreground params for an RGB color, honoring the color depth. */
  fg(r: number, g: number, b: number): string {
    return this.truecolor ? `38;2;${r};${g};${b}` : `38;5;${rgbTo256(r, g, b)}`;
  }

  /** SGR background params for an RGB color, honoring the color depth. */
  bg(r: number, g: number, b: number): string {
    return this.truecolor ? `48;2;${r};${g};${b}` : `48;5;${rgbTo256(r, g, b)}`;
  }

  get cellSize(): { w: number; h: number } {
    return { w: CAT_COLS, h: CAT_ROWS };
  }

  draw(o: DrawOpts): string {
    if (this.mode === "kitty") return this.drawKitty(o);
    if (this.mode === "half") return this.drawHalf(o);
    return this.drawKaomoji(o);
  }

  /** Extra cleanup beyond cell repair (kitty must delete its placement). */
  clear(): string {
    if (this.mode === "kitty" && this.placed) {
      this.placed = false;
      this.lastFrame = null; // force a retransmit on the next show
      this.log?.(`kitty clear i=${KITTY_IMG_BASE}`);
      return `\x1b_Ga=d,d=i,i=${KITTY_IMG_BASE},q=2\x1b\\`;
    }
    return "";
  }

  // ------------------------------------------------------------- kitty ----
  private frameB64(name: FrameName): string {
    let b64 = this.b64Cache.get(name);
    if (b64 === undefined) {
      const px = framePixels(name);
      const up = upscale(px, FRAME_W, FRAME_H, KITTY_SCALE);
      b64 = encodePNG(FRAME_W * KITTY_SCALE, FRAME_H * KITTY_SCALE, up).toString("base64");
      this.b64Cache.set(name, b64);
    }
    return b64;
  }

  private drawKitty(o: DrawOpts): string {
    const visCols = Math.min(CAT_COLS, o.cols - o.cellX);
    this.log?.(`kitty draw f=${o.frame} x=${o.cellX} y=${o.cellY} vis=${visCols}`);
    if (visCols <= 0) return this.clear();
    let s = "";
    if (this.lastFrame !== o.frame) {
      const b64 = this.frameB64(o.frame);
      const CHUNK = 4000;
      for (let i = 0; i < b64.length; i += CHUNK) {
        const last = i + CHUNK >= b64.length;
        const keys = i === 0 ? `a=t,f=100,t=d,i=${KITTY_IMG_BASE},q=2,m=${last ? 0 : 1}` : `m=${last ? 0 : 1}`;
        s += `\x1b_G${keys};${b64.slice(i, i + CHUNK)}\x1b\\`;
      }
      this.lastFrame = o.frame;
    }
    const srcW = Math.round((visCols / CAT_COLS) * FRAME_W * KITTY_SCALE);
    s += `\x1b[${o.cellY + 1};${o.cellX + 1}H`;
    s += `\x1b_Ga=p,i=${KITTY_IMG_BASE},p=1,z=1,C=1,q=2,w=${srcW},c=${visCols},r=${CAT_ROWS}\x1b\\`;
    this.placed = true;
    return s;
  }

  // -------------------------------------------------------- half blocks ----
  private drawHalf(o: DrawOpts): string {
    const px = framePixels(o.frame);
    let s = "";
    const visCols = Math.min(CAT_COLS, o.cols - o.cellX);
    for (let cy = 0; cy < CAT_ROWS; cy++) {
      const row = o.cellY + cy;
      if (row < 0 || row >= o.rows) continue;
      let run = "";
      let runStart = -1;
      const flush = () => {
        if (runStart >= 0 && run) s += `\x1b[${row + 1};${o.cellX + runStart + 1}H` + run + "\x1b[0m";
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
        if (top && bot) run += `\x1b[${this.fg(top[0], top[1], top[2])};${this.bg(bot[0], bot[1], bot[2])}m▀`;
        else if (top) run += `\x1b[0;${this.fg(top[0], top[1], top[2])}m▀`;
        else run += `\x1b[0;${this.fg(bot![0], bot![1], bot![2])}m▄`;
      }
      flush();
    }
    return s;
  }

  // ------------------------------------------------------------ kaomoji ----
  private drawKaomoji(o: DrawOpts): string {
    const art = o.frame === "alert" ? ["  ∧,,,∧", " (  ̳> · < ̳)", " /    づ mew!"] : ["  ∧,,,∧", " (  ̳- ᴥ - ̳)", " /    づ zzZ"];
    const avail = o.cols - o.cellX; // clip by COLUMNS at the right edge — a
    if (avail <= 0) return ""; //      wrapped line would paint residue at col 0
    let s = "";
    art.forEach((line, i) => {
      const row = o.cellY + CAT_ROWS - art.length + i;
      if (row < 0 || row >= o.rows) return;
      s += `\x1b[${row + 1};${o.cellX + 1}H\x1b[0m${clipColumns(line, avail)}`;
    });
    return s;
  }
}

/** Truncate a string to fit `cols` terminal columns (wide chars count 2, combining marks 0). */
export function clipColumns(line: string, cols: number): string {
  let used = 0;
  let out = "";
  for (const ch of line) {
    const cp = ch.codePointAt(0)!;
    const w =
      (cp >= 0x0300 && cp <= 0x036f) ? 0 : // combining marks
      (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0x9fff) ||
      (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0x3000 && cp <= 0x303e) ? 2 : 1;
    if (used + w > cols) break;
    used += w;
    out += ch;
  }
  return out;
}

function pixelAt(px: Uint8Array, x: number, y: number): [number, number, number] | null {
  if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H) return null;
  const i = (y * FRAME_W + x) * 4;
  if (px[i + 3] === 0) return null;
  return [px[i]!, px[i + 1]!, px[i + 2]!];
}

function upscale(px: Uint8Array, w: number, h: number, scale: number): Uint8Array {
  const out = new Uint8Array(w * scale * h * scale * 4);
  for (let y = 0; y < h * scale; y++) {
    for (let x = 0; x < w * scale; x++) {
      const si = ((y / scale | 0) * w + (x / scale | 0)) * 4;
      const di = (y * w * scale + x) * 4;
      out[di] = px[si]!;
      out[di + 1] = px[si + 1]!;
      out[di + 2] = px[si + 2]!;
      out[di + 3] = px[si + 3]!;
    }
  }
  return out;
}
