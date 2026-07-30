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

export interface DrawOpts {
  frame: FrameName;
  cellX: number; // may be > cols-CAT_COLS during walk-in (clipped)
  cellY: number;
  cols: number;
  rows: number;
}

export class SpriteRenderer {
  private transmitted = new Set<FrameName>();
  private b64Cache = new Map<FrameName, string>();
  private frameIds = new Map<FrameName, number>();
  private lastPlacedId: number | null = null;

  constructor(private mode: RenderMode) {}

  get modeName(): RenderMode {
    return this.mode;
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
    if (this.mode === "kitty" && this.lastPlacedId !== null) {
      const id = this.lastPlacedId;
      this.lastPlacedId = null;
      return `\x1b_Ga=d,d=i,i=${id},q=2\x1b\\`;
    }
    return "";
  }

  // ------------------------------------------------------------- kitty ----
  private frameId(name: FrameName): number {
    let id = this.frameIds.get(name);
    if (id === undefined) {
      id = KITTY_IMG_BASE + this.frameIds.size;
      this.frameIds.set(name, id);
    }
    return id;
  }

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
    if (visCols <= 0) return this.clear();
    const id = this.frameId(o.frame);
    let s = "";
    if (!this.transmitted.has(o.frame)) {
      const b64 = this.frameB64(o.frame);
      const CHUNK = 4000;
      for (let i = 0; i < b64.length; i += CHUNK) {
        const last = i + CHUNK >= b64.length;
        const keys = i === 0 ? `a=t,f=100,t=d,i=${id},q=2,m=${last ? 0 : 1}` : `m=${last ? 0 : 1}`;
        s += `\x1b_G${keys};${b64.slice(i, i + CHUNK)}\x1b\\`;
      }
      this.transmitted.add(o.frame);
    }
    // Re-placing the same placement id replaces it atomically — no delete, no
    // flicker. Only an image-id switch (frame change) needs the old placement
    // removed, immediately followed by the new one in the same write.
    if (this.lastPlacedId !== null && this.lastPlacedId !== id) {
      s += `\x1b_Ga=d,d=i,i=${this.lastPlacedId},q=2\x1b\\`;
    }
    const srcW = Math.round((visCols / CAT_COLS) * FRAME_W * KITTY_SCALE);
    s += `\x1b[${o.cellY + 1};${o.cellX + 1}H`;
    s += `\x1b_Ga=p,i=${id},p=1,z=1,C=1,q=2,w=${srcW},c=${visCols},r=${CAT_ROWS}\x1b\\`;
    this.lastPlacedId = id;
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
        if (top && bot) run += `\x1b[38;2;${top[0]};${top[1]};${top[2]};48;2;${bot[0]};${bot[1]};${bot[2]}m▀`;
        else if (top) run += `\x1b[0;38;2;${top[0]};${top[1]};${top[2]}m▀`;
        else run += `\x1b[0;38;2;${bot![0]};${bot![1]};${bot![2]}m▄`;
      }
      flush();
    }
    return s;
  }

  // ------------------------------------------------------------ kaomoji ----
  private drawKaomoji(o: DrawOpts): string {
    const art = o.frame === "alert" ? ["  ∧,,,∧", " (  ̳> · < ̳)", " /    づ mew!"] : ["  ∧,,,∧", " (  ̳- ᴥ - ̳)", " /    づ zzZ"];
    let s = "";
    art.forEach((line, i) => {
      const row = o.cellY + CAT_ROWS - art.length + i;
      if (row < 0 || row >= o.rows) return;
      s += `\x1b[${row + 1};${o.cellX + 1}H\x1b[0m${line}`;
    });
    return s;
  }
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
