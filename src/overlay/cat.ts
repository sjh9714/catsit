// The cat's behavior: an animation state machine driven by the fused agent
// state. The cat's presence IS the "you're not needed" signal; its departure
// IS the notification.

import type { Compositor, Overlay } from "../compositor.js";
import type { Mirror } from "../mirror.js";
import type { CatState } from "../state.js";
import { CAT_COLS, CAT_ROWS, SpriteRenderer } from "./render.js";
import type { FrameName } from "./sprites.js";

type Anim =
  | { kind: "hidden" }
  | { kind: "walk-in"; step: number }
  | { kind: "loaf"; since: number }
  | { kind: "flick"; until: number }
  | { kind: "gulp"; until: number }
  | { kind: "alert"; until: number }
  | { kind: "walk-out"; step: number };

const TICK_MS = 200;
const WALK_STEPS = 6;
const SLEEP_AFTER_MS = 90_000;
const MEOW_HOLD_MS = 1400;

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
    switch (next.kind) {
      case "working":
        if (this.anim.kind === "hidden" || this.anim.kind === "walk-out") {
          this.anim = { kind: "walk-in", step: this.anim.kind === "walk-out" ? WALK_STEPS - this.anim.step : 0 };
        }
        break;
      case "needs_human":
        if (this.anim.kind !== "hidden") {
          this.anim = { kind: "alert", until: this.now() + MEOW_HOLD_MS };
          this.opts.bell();
          this.render(); // the gate is already open; this is just the show
        }
        break;
      case "shooed":
      case "unknown":
        if (this.anim.kind !== "hidden" && this.anim.kind !== "walk-out") {
          this.anim = { kind: "walk-out", step: 0 };
        }
        break;
    }
  }

  /** A keypress was swallowed — tail flick. */
  onSwallow(): void {
    if (this.anim.kind === "loaf") {
      this.anim = { kind: "flick", until: this.now() + 450 };
      this.render();
    }
  }

  /** A whole paste was swallowed — gulp. */
  onPaste(): void {
    if (this.anim.kind === "loaf" || this.anim.kind === "flick") {
      this.anim = { kind: "gulp", until: this.now() + 700 };
      this.render();
    }
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private tick(): void {
    if (this.stopped) return;
    this.tickNo++;
    const t = this.now();
    switch (this.anim.kind) {
      case "hidden":
        return;
      case "walk-in":
        this.anim.step++;
        if (this.anim.step >= WALK_STEPS) this.anim = { kind: "loaf", since: t };
        break;
      case "walk-out":
        this.anim.step++;
        if (this.anim.step >= WALK_STEPS) {
          this.anim = { kind: "hidden" };
          this.lastRenderKey = "";
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
      case "walk-out":
        return this.tickNo % 2 ? "walk1" : "walk2";
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
    const anchorX = Math.max(0, cols - CAT_COLS - 2);
    if (this.anim.kind === "walk-in") {
      const remaining = WALK_STEPS - this.anim.step;
      return anchorX + Math.round(((CAT_COLS + 2) * remaining) / WALK_STEPS);
    }
    if (this.anim.kind === "walk-out") {
      return anchorX + Math.round(((CAT_COLS + 2) * this.anim.step) / WALK_STEPS);
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
        return Math.max(0, top - CAT_ROWS - 3);
      }
    }
    return Math.max(0, rows - CAT_ROWS - 5);
  }

  // One persistent overlay object whose draw parameters mutate: the
  // compositor sees the same instance across frames (no clear/re-add churn),
  // and the kitty renderer can replace placements atomically.
  private cur = { frame: "loaf1" as FrameName, cellX: 0, cellY: 0, showMeow: false };
  private overlayObj: Overlay | null = null;
  private lastRenderKey = "";

  private ensureOverlay(): Overlay {
    if (this.overlayObj) return this.overlayObj;
    const renderer = this.opts.renderer;
    const cur = this.cur;
    const damages = () => renderer.modeName !== "kitty" || cur.showMeow;
    this.overlayObj = {
      get damagesCells() {
        return damages();
      },
      rect: () => ({
        x: cur.cellX - 1,
        y: cur.cellY - (cur.showMeow ? 1 : 0),
        w: CAT_COLS + 8,
        h: CAT_ROWS + 1 + (cur.showMeow ? 1 : 0),
      }),
      draw: (cols, rows) => {
        let s = renderer.draw({ frame: cur.frame, cellX: cur.cellX, cellY: cur.cellY, cols, rows });
        if (cur.showMeow) {
          const bx = Math.max(0, cur.cellX - 7);
          s += `\x1b[${Math.max(1, cur.cellY)};${bx + 1}H\x1b[0;1;38;2;255;220;120m mew! \x1b[0m`;
        }
        return s;
      },
      clear: () => renderer.clear(),
    };
    return this.overlayObj;
  }

  private render(): void {
    if (this.anim.kind === "hidden") return;
    const t = this.now();
    this.cur.frame = this.frameFor(t);
    this.cur.cellX = this.xOffset(this.opts.mirror.cols);
    this.cur.cellY = this.yAnchor(this.opts.mirror.rows);
    this.cur.showMeow = this.anim.kind === "alert";
    const key = `${this.cur.frame}|${this.cur.cellX}|${this.cur.cellY}|${this.cur.showMeow}`;
    if (key === this.lastRenderKey) return; // nothing changed; forwards keep it drawn
    this.lastRenderKey = key;
    this.opts.compositor.setOverlay(this.ensureOverlay());
  }
}
