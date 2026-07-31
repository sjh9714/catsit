// The cat's behavior: an animation state machine driven by the fused agent
// state. The cat's presence IS the "you're not needed" signal; its departure
// IS the notification.

import type { Compositor, Overlay } from "../compositor.js";
import type { Mirror } from "../mirror.js";
import type { CatState } from "../state.js";
import { clipColumns, SpriteRenderer } from "./render.js";
import type { FrameName } from "./sprites.js";

type Anim =
  | { kind: "hidden" }
  | { kind: "waiting"; since: number } // agent is working, but too recently —
  //   short turns come and go without the cat ever appearing (or meowing)
  | { kind: "walk-in"; step: number }
  | { kind: "loaf"; since: number }
  | { kind: "flick"; until: number }
  | { kind: "gulp"; until: number }
  | { kind: "alert"; until: number }
  | { kind: "walk-out"; step: number };

const TICK_MS = 100; // fast enough for the kitty video tier's 10fps frames
const WALK_STEPS = 8;
const SLEEP_AFTER_MS = 90_000;
const MEOW_HOLD_MS = 1400;
export const BUBBLE_HOLD_MS = 1400;
export const HINT_HOLD_MS = 4000;
export const APPEAR_DELAY_MS = 3500;

export class CatAnimator {
  private anim: Anim = { kind: "hidden" };
  private timer: NodeJS.Timeout | null = null;
  private tickNo = 0;
  private stopped = false;

  constructor(
    private opts: {
      compositor: Compositor;
      mirror: Mirror;
      renderer: SpriteRenderer;
      bell: () => void;
      now?: () => number;
      log?: (msg: string) => void;
    },
  ) {}

  start(): void {
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.opts.compositor.setOverlay(null);
  }

  /** Wire to StateMachine.onChange. */
  onState(next: CatState): void {
    if (this.stopped) return;
    this.opts.log?.(`anim<-state ${next.kind}${"reason" in next ? ":" + next.reason : ""} (anim=${this.anim.kind})`);
    switch (next.kind) {
      case "working":
        if (this.anim.kind === "hidden") {
          this.anim = { kind: "waiting", since: this.now() };
        } else if (this.anim.kind === "walk-out") {
          // the cat was just here — come straight back, no delay
          this.anim = { kind: "walk-in", step: WALK_STEPS - this.anim.step };
        }
        break;
      case "needs_human":
        if (this.anim.kind === "waiting") {
          // the turn ended before the cat ever appeared: stay silent — the
          // user was never told to look away, so no meow is owed
          this.anim = { kind: "hidden" };
        } else if (this.anim.kind !== "hidden") {
          this.anim = { kind: "alert", until: this.now() + MEOW_HOLD_MS };
          this.opts.bell();
          this.render(); // the gate is already open; this is just the show
        }
        break;
      case "shooed":
      case "unknown":
        if (this.anim.kind === "waiting") this.anim = { kind: "hidden" };
        else if (this.anim.kind !== "hidden" && this.anim.kind !== "walk-out") {
          this.anim = { kind: "walk-out", step: 0 };
        }
        break;
    }
  }

  /** In guard mode, keys are only gated while the cat is actually on screen. */
  get isVisible(): boolean {
    return this.anim.kind !== "hidden" && this.anim.kind !== "waiting";
  }

  // feedback bubble state (guard mode): what the cat just ate, plus a
  // one-time hint so a blocked keystroke never reads as a bug
  private bubbleText = "";
  private bubbleUntil = 0;
  private hintUntil = 0;
  private hintShown = false;

  /** A keypress was swallowed — tail flick + show what was eaten. */
  onSwallow(text = ""): void {
    if (this.anim.kind !== "loaf" && this.anim.kind !== "flick" && this.anim.kind !== "gulp") return;
    const t = this.now();
    this.bubbleText = t < this.bubbleUntil ? this.bubbleText + text : text;
    this.bubbleText = [...this.bubbleText].slice(-8).join("");
    this.bubbleUntil = t + BUBBLE_HOLD_MS;
    if (!this.hintShown) {
      this.hintShown = true;
      this.hintUntil = t + HINT_HOLD_MS;
    }
    if (this.anim.kind === "loaf") this.anim = { kind: "flick", until: t + 450 };
    this.render();
  }

  /** A whole paste was swallowed — gulp. */
  onPaste(): void {
    if (this.anim.kind === "loaf" || this.anim.kind === "flick") {
      const t = this.now();
      this.bubbleText = "(paste)";
      this.bubbleUntil = t + BUBBLE_HOLD_MS;
      if (!this.hintShown) {
        this.hintShown = true;
        this.hintUntil = t + HINT_HOLD_MS;
      }
      this.anim = { kind: "gulp", until: t + 700 };
      this.render();
    }
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  /** One animation step. Public so tests can drive time deterministically. */
  tick(): void {
    if (this.stopped) return;
    this.tickNo++;
    const t = this.now();
    switch (this.anim.kind) {
      case "hidden":
        return;
      case "waiting":
        if (t - this.anim.since >= APPEAR_DELAY_MS) this.anim = { kind: "walk-in", step: 0 };
        else return;
        break;
      case "walk-in":
        this.anim.step++;
        if (this.anim.step >= WALK_STEPS) this.anim = { kind: "loaf", since: t };
        break;
      case "walk-out":
        this.anim.step++;
        if (this.anim.step >= WALK_STEPS) {
          this.anim = { kind: "hidden" };
          this.lastRenderKey = "";
          this.opts.log?.("anim hidden (walk-out complete)");
          this.opts.compositor.setOverlay(null);
          return;
        }
        break;
      case "flick":
        if (t >= this.anim.until) this.anim = { kind: "loaf", since: t - 1000 };
        break;
      case "gulp":
        if (t >= this.anim.until) this.anim = { kind: "loaf", since: t - 1000 };
        break;
      case "alert":
        if (t >= this.anim.until) this.anim = { kind: "walk-out", step: 0 };
        break;
      case "loaf":
        break; // breathing handled by frame choice below
    }
    this.render();
  }

  private frameFor(t: number): FrameName {
    switch (this.anim.kind) {
      case "walk-in":
        return this.tickNo % 2 ? "walk1" : "walk2";
      case "walk-out":
        return this.tickNo % 2 ? "walkE1" : "walkE2";
      case "flick":
        return "flick";
      case "gulp":
        return "gulp";
      case "alert":
        return "alert";
      case "loaf": {
        if (t - this.anim.since > SLEEP_AFTER_MS) return Math.floor(t / 1200) % 2 ? "sleep1" : "sleep2";
        return Math.floor(t / 900) % 2 ? "loaf1" : "loaf2";
      }
      default:
        return "loaf1";
    }
  }

  /** Cat x offset: walks in from the right edge to the anchor. */
  private xOffset(cols: number): number {
    const catCols = this.opts.renderer.catCols;
    const anchorX = Math.max(0, cols - catCols - 2);
    if (this.anim.kind === "walk-in") {
      const remaining = WALK_STEPS - this.anim.step;
      return anchorX + Math.round(((catCols + 2) * remaining) / WALK_STEPS);
    }
    if (this.anim.kind === "walk-out") {
      return anchorX + Math.round(((catCols + 2) * this.anim.step) / WALK_STEPS);
    }
    return anchorX;
  }

  /**
   * The cat sits just above Claude Code's prompt box: scan the bottom of the
   * mirror for the box's top border; fall back to a bottom-anchored position.
   */
  private yAnchor(rows: number): number {
    const buf = this.opts.mirror.raw.buffer.active;
    for (let y = rows - 1; y >= Math.max(0, rows - 8); y--) {
      const text = buf.getLine(buf.viewportY + y)?.translateToString(true).trim() ?? "";
      if (/^─+$/.test(text) || /^╭─+╮?$/.test(text)) {
        // found a border; the box top is above it — sit on top of the box
        const top = Math.min(y, rows - 1);
        return Math.max(0, top - this.opts.renderer.catRows - 3);
      }
    }
    return Math.max(0, rows - this.opts.renderer.catRows - 5);
  }

  // One persistent overlay object whose draw parameters mutate: the
  // compositor sees the same instance across frames (no clear/re-add churn),
  // and the kitty renderer can replace placements atomically.
  private cur = {
    frame: "loaf1" as FrameName,
    cellX: 0,
    cellY: 0,
    showMeow: false,
    bubble: null as string | null,
    hint: false,
    vtick: 0,
  };
  private overlayObj: Overlay | null = null;
  private lastRenderKey = "";

  private ensureOverlay(): Overlay {
    if (this.overlayObj) return this.overlayObj;
    const renderer = this.opts.renderer;
    const cur = this.cur;
    const damages = () => renderer.modeName !== "kitty" || cur.showMeow || cur.bubble !== null || cur.hint;
    this.overlayObj = {
      get damagesCells() {
        return damages();
      },
      // The rect must cover EVERYTHING draw() can paint — bubbles, the hint
      // line, and the wider walk frames — or hiding leaves orphaned cells.
      // (maxCols ≥ catCols; walk canvases extend ~(maxCols-catCols)/2 ≤ 8
      // cells left of cellX, inside the bubble margin.)
      rect: () => ({
        x: cur.cellX - 8,
        y: cur.cellY - 1,
        w: renderer.maxCols + 10,
        h: renderer.catRows + 2,
      }),
      draw: (cols, rows) => {
        let s = renderer.draw({ frame: cur.frame, cellX: cur.cellX, cellY: cur.cellY, cols, rows, vtick: cur.vtick });
        const bubbleRow = Math.max(1, cur.cellY); // 1-based CUP row = 0-based cellY-1
        const bx = Math.max(0, cur.cellX - 8);
        if (cur.showMeow) {
          s += `\x1b[${bubbleRow};${bx + 2}H\x1b[0;1;${renderer.fg(255, 220, 120)}m mew! \x1b[0m`;
        } else if (cur.bubble !== null) {
          // what the cat just ate (guard mode)
          s += `\x1b[${bubbleRow};${bx + 1}H\x1b[0;${renderer.fg(30, 30, 30)};${renderer.bg(255, 220, 120)}m 🐟 ${clipColumns(cur.bubble, 8)} \x1b[0m`;
        }
        if (cur.hint) {
          const hintRow = cur.cellY + renderer.catRows + 1; // 1-based; last row of the rect
          if (hintRow >= 1 && hintRow <= rows) {
            s += `\x1b[${hintRow};${bx + 1}H\x1b[0;2m${clipColumns(" guarding · ctrl+g to shoo", renderer.catCols + 9)}\x1b[0m`;
          }
        }
        return s;
      },
      clear: () => renderer.clear(),
    };
    return this.overlayObj;
  }

  private render(): void {
    if (this.anim.kind === "hidden" || this.anim.kind === "waiting") return;
    const t = this.now();
    this.cur.frame = this.frameFor(t);
    this.cur.cellX = this.xOffset(this.opts.mirror.cols);
    this.cur.cellY = this.yAnchor(this.opts.mirror.rows);
    this.cur.showMeow = this.anim.kind === "alert";
    this.cur.bubble = t < this.bubbleUntil && !this.cur.showMeow ? this.bubbleText : null;
    this.cur.hint = t < this.hintUntil && !this.cur.showMeow;
    // video tier: every tick is a new frame of the living cat
    this.cur.vtick = this.opts.renderer.animated ? this.tickNo : 0;
    const key = `${this.cur.frame}|${this.cur.cellX}|${this.cur.cellY}|${this.cur.showMeow}|${this.cur.bubble ?? ""}|${this.cur.hint}|${this.cur.vtick}`;
    if (key === this.lastRenderKey) return; // nothing changed; forwards keep it drawn
    this.lastRenderKey = key;
    this.opts.compositor.setOverlay(this.ensureOverlay());
  }
}
