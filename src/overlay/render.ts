// Sprite renderers with a degradation ladder:
//   kitty  — real PNG floated above the text (kitty graphics protocol, z=1)
//   half   — truecolor half-blocks (2 vertical px per cell)
//   kaomoji — plain text cat for NO_COLOR / dumb terminals
//
// All modes draw the same frame geometry: FRAME_W cols × FRAME_H/2 rows.

import { FRAME_H, FRAME_W, framePixels, type FrameName } from "./sprites.js";
import { loadVideoFrames, type BeatName, type VideoFrames } from "./frames.js";

export type RenderMode = "kitty" | "half" | "kaomoji";

export const CAT_COLS = FRAME_W;
export const CAT_ROWS = FRAME_H / 2;

const KITTY_IMG_BASE = 4200; // arbitrary id namespace for catsit

// kitty tier shows the living cat: one continuous performance on a FIXED
// canvas — the cat's movement (walking in, sitting, leaving) is the motion
// baked into the footage itself, so nothing slides. All beats share one crop
// window; the cell box just has to match its aspect (cells are ~1:2).
export const VIDEO_ROWS = 13;

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
  frame: FrameName; // pose for the pixel-art fallback tiers
  beat: BeatName; // performance beat for the kitty tier
  beatTicks: number; // 100ms ticks since the beat started
  cellX: number;
  cellY: number;
  cols: number;
  rows: number;
}

export class SpriteRenderer {
  // Single image id: frame changes RETRANSMIT data under the same id (the
  // active placement keeps showing, updated in place) and position changes
  // re-place the same placement id (atomic replace). No deletes during
  // animation — a delete/place pair leaves a window where the terminal can
  // composite a frame with no cat at all.
  private lastVKey: string | null = null;
  private placed = false;
  private frames: VideoFrames | null = null;

  constructor(
    private mode: RenderMode,
    private log?: (msg: string) => void,
    private truecolor: boolean = detectTruecolor(),
  ) {
    if (mode === "kitty") {
      this.frames = loadVideoFrames(log);
      if (!this.frames) this.mode = "half"; // broken install: degrade, never die
    }
  }

  /** True when frames advance every animator tick (kitty video tier). */
  get animated(): boolean {
    return this.mode === "kitty" && this.frames !== null;
  }

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

  /** Cell footprint of the (shared) canvas in this render mode. */
  get catCols(): number {
    if (this.mode === "kitty") {
      const c = this.frames!.beats.idle;
      return Math.round((c.w / c.h) * VIDEO_ROWS * 2);
    }
    return CAT_COLS;
  }

  get catRows(): number {
    return this.mode === "kitty" ? VIDEO_ROWS : CAT_ROWS;
  }

  /** All kitty beats share one canvas, so the widest footprint == catCols. */
  get maxCols(): number {
    return this.catCols;
  }

  /**
   * Column (within the canvas) the speech bubble anchors to — near the cat's
   * head. The kitty canvas is wide with the cat off-center; fallback sprites
   * fill their canvas, so 0 keeps their old bubble spot.
   */
  get bubbleCol(): number {
    if (this.mode === "kitty") return Math.round(this.frames!.centerX * this.catCols);
    return 0;
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
      this.lastVKey = null; // force a retransmit on the next show
      this.log?.(`kitty clear i=${KITTY_IMG_BASE}`);
      return `\x1b_Ga=d,d=i,i=${KITTY_IMG_BASE},q=2\x1b\\`;
    }
    return "";
  }

  /**
   * Beat frame index for an animator tick count (ticks are 100ms). One-shot
   * beats clamp on their last frame; loops wrap.
   */
  beatFrame(beat: BeatName, ticks: number): number {
    const b = this.frames!.beats[beat];
    const idx = Math.floor((ticks * b.fps) / 10);
    return b.loop ? idx % b.b64.length : Math.min(idx, b.b64.length - 1);
  }

  /** True when a one-shot beat has played through at `ticks` animator ticks. */
  beatDone(beat: BeatName, ticks: number): boolean {
    if (this.frames) {
      const b = this.frames.beats[beat];
      return !b.loop && Math.floor((ticks * b.fps) / 10) >= b.b64.length - 1;
    }
    // pixel-art tiers have no footage; give each one-shot a nominal length
    const nominal: Record<BeatName, number> = {
      walkIn: 12,
      sitDown: 4,
      idle: Infinity,
      sleepDown: 4,
      sleepLoop: Infinity,
      wakeUp: 6,
      alertUp: 14,
      walkOut: 12,
    };
    return ticks >= nominal[beat];
  }

  // ------------------------------------------------------------- kitty ----
  private drawKitty(o: DrawOpts): string {
    const set = this.frames!.beats[o.beat];
    const cols = this.catCols;
    const visCols = Math.min(cols, o.cols - o.cellX);
    if (visCols <= 0) return this.clear();
    // the beat tick indexes frames deterministically, so app-repaint redraws
    // between animator ticks replay the SAME frame (no fast-forward)
    const idx = this.beatFrame(o.beat, o.beatTicks);
    const vkey = `${o.beat}:${idx}`;
    this.log?.(`kitty draw ${vkey} x=${o.cellX} y=${o.cellY} vis=${visCols}`);
    let s = "";
    if (this.lastVKey !== vkey) {
      const b64 = set.b64[idx]!;
      const CHUNK = 4000;
      for (let i = 0; i < b64.length; i += CHUNK) {
        const last = i + CHUNK >= b64.length;
        const keys = i === 0 ? `a=t,f=100,t=d,i=${KITTY_IMG_BASE},q=2,m=${last ? 0 : 1}` : `m=${last ? 0 : 1}`;
        s += `\x1b_G${keys};${b64.slice(i, i + CHUNK)}\x1b\\`;
      }
      this.lastVKey = vkey;
    }
    const srcW = Math.round((visCols / cols) * set.w);
    s += `\x1b[${o.cellY + 1};${o.cellX + 1}H`;
    s += `\x1b_Ga=p,i=${KITTY_IMG_BASE},p=1,z=1,C=1,q=2,w=${srcW},c=${visCols},r=${this.catRows}\x1b\\`;
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

