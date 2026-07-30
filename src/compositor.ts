// Frame compositor: forwards app bytes verbatim and, while an overlay is
// visible, wraps each forward in an atomic undraw → forward → draw → restore
// batch (inside a DEC 2026 synchronized update) so the overlay and the app can
// never corrupt each other.

import { Chunker } from "./chunker.js";
import { Mirror, type AppState, type Rect } from "./mirror.js";
import { PenTracker } from "./pen.js";

const SYNC_START = "\x1b[?2026h";
const SYNC_END = "\x1b[?2026l";
const STALE_TAIL_MS = 50;

export interface Overlay {
  rect(cols: number, rows: number): Rect;
  /** Paint the overlay. May assume pen state is undefined; must not scroll. */
  draw(cols: number, rows: number): string;
}

export class Compositor {
  private mirror: Mirror;
  private chunker = new Chunker();
  private pen = new PenTracker();
  private overlay: Overlay | null = null;
  private overlayRect: Rect | null = null; // rect as last drawn
  private chain: Promise<void> = Promise.resolve();
  private degraded = false;
  private staleTimer: NodeJS.Timeout | null = null;

  constructor(
    private opts: {
      cols: number;
      rows: number;
      write: (s: string) => void;
      onError?: (err: unknown) => void;
      /** Called after each forward once the mirror reflects the new screen. */
      onAfterForward?: () => void;
    },
  ) {
    this.mirror = new Mirror(opts.cols, opts.rows);
  }

  get screen(): Mirror {
    return this.mirror;
  }
  get isDegraded(): boolean {
    return this.degraded;
  }

  /** Queue PTY output for processing. */
  feed(data: Buffer): void {
    if (this.degraded) {
      this.opts.write(data.toString("utf8"));
      return;
    }
    this.enqueue(async () => {
      const safe = this.chunker.split(data);
      this.armStaleTimer();
      if (safe.length === 0) return;
      await this.forward(safe.toString("utf8"));
    });
  }

  /** Show, replace, or hide (null) the overlay. */
  setOverlay(overlay: Overlay | null): void {
    if (this.degraded) return;
    this.enqueue(async () => {
      const prev = this.overlayRect;
      this.overlay = overlay;
      const st = this.mirror.captureState(this.pen);
      let out = "";
      if (prev) out += this.mirror.undrawRect(prev);
      if (overlay) {
        out += overlay.draw(this.mirror.cols, this.mirror.rows);
        this.overlayRect = overlay.rect(this.mirror.cols, this.mirror.rows);
      } else {
        this.overlayRect = null;
      }
      if (out) this.opts.write(SYNC_START + out + this.mirror.restoreSeq(st) + SYNC_END);
    });
  }

  resize(cols: number, rows: number): void {
    this.enqueue(async () => {
      // Old overlay cells cannot be repaired after reflow; drop the overlay
      // and let the caller re-show it after the app repaints.
      this.overlayRect = null;
      this.mirror.resize(cols, rows);
    });
  }

  /** Wait for all queued work (used by tests and shutdown). */
  flush(): Promise<void> {
    return this.chain;
  }

  private async forward(appBytes: string): Promise<void> {
    if (!this.overlayRect || !this.overlay) {
      this.pen.feed(appBytes);
      await this.mirror.feed(appBytes);
      this.opts.write(appBytes);
      this.opts.onAfterForward?.();
      return;
    }
    const preState: AppState = this.mirror.captureState(this.pen);
    const pre = this.mirror.undrawRect(this.overlayRect) + this.mirror.restoreSeq(preState);
    this.pen.feed(appBytes);
    await this.mirror.feed(appBytes);
    const post = this.overlay.draw(this.mirror.cols, this.mirror.rows) +
      this.mirror.restoreSeq(this.mirror.captureState(this.pen));
    this.overlayRect = this.overlay.rect(this.mirror.cols, this.mirror.rows);
    this.opts.write(SYNC_START + pre + appBytes + post + SYNC_END);
    this.opts.onAfterForward?.();
  }

  private armStaleTimer(): void {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    if (this.chunker.pendingLength === 0) return;
    this.staleTimer = setTimeout(() => {
      this.enqueue(async () => {
        const tail = this.chunker.takePending();
        if (tail.length) await this.forward(tail.toString("utf8"));
      });
    }, STALE_TAIL_MS);
    this.staleTimer.unref?.();
  }

  private enqueue(job: () => Promise<void>): void {
    this.chain = this.chain.then(job).catch((err) => {
      // Watchdog: any compositor failure degrades permanently to passthrough —
      // the cat dies, the session lives.
      this.degraded = true;
      const tail = this.chunker.takePending();
      if (tail.length) this.opts.write(tail.toString("utf8"));
      this.opts.onError?.(err);
    });
  }

  dispose(): void {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.mirror.dispose();
  }
}
