// The cat's behavior: an animation state machine driven by the fused agent
// state. The cat's presence IS the "you're not needed" signal; its departure
// IS the notification.
//
// In the kitty tier the cat is one continuous filmed performance on a fixed
// canvas: walkIn → sitDown → idle(loop) → alertUp → walkOut. Beats chain on
// identical boundary frames, so nothing jumps and nothing slides. Fallback
// tiers keep the pixel cat, mapped from the same states.

import type { Compositor, Overlay } from "../compositor.js";
import type { Mirror } from "../mirror.js";
import type { CatState } from "../state.js";
import type { BeatName } from "./frames.js";
import { clipColumns, SpriteRenderer } from "./render.js";
import type { FrameName } from "./sprites.js";

type Anim =
  | { kind: "hidden" }
  | { kind: "waiting"; since: number } // agent is working, but too recently —
  //   short turns come and go without the cat ever appearing (or meowing)
  | { kind: "beat"; beat: BeatName; ticks: number; reverse?: boolean; bridge?: boolean };
// reverse: sitDown played backwards — the calm stand-up before a walk-off.
// bridge: walkOut's opening used as the rear-DOWN of the meow gesture — the
// cat comes off its hind legs (frames 0–9, forward footage, mouth closed)
// and hands over to sitDown at the matching all-fours frame.

const TICK_MS = 100;
export const BUBBLE_HOLD_MS = 1400;
export const HINT_HOLD_MS = 4000;
// how long the agent must be working before the cat commits to walking in
// (very short turns come and go catless); env override eases tuning
export const APPEAR_DELAY_MS = Number(process.env["CATSIT_APPEAR_MS"]) || 1200;
// no user activity this long → curls up (env override eases manual testing)
export const SLEEP_AFTER_MS = Number(process.env["CATSIT_SLEEP_MS"]) || 60_000;
const MEOW_HOLD_TICKS = 14; // bubble rides the alertUp beat this long

// what plays after a one-shot beat finishes
const NEXT_BEAT: Partial<Record<BeatName, BeatName>> = {
  walkIn: "sitDown",
  sitDown: "idle",
  sleepDown: "sleepLoop",
  wakeUp: "alertUp", // overridden to walkOut when the cat was shooed awake
  // alertUp has no default: the rear-up ends in a HELD standing watch, and
  // tick() decides between holding, settling back, and the goodbye walk-off
};

// fallback-tier pose for each beat (pixel cat has no filmed transitions)
const FALLBACK_FRAME: Record<BeatName, (ticks: number) => FrameName> = {
  walkIn: (t) => (t % 2 ? "walk1" : "walk2"),
  sitDown: () => "loaf1",
  idle: (t) => (Math.floor(t / 9) % 2 ? "loaf1" : "loaf2"),
  sleepDown: () => "sleep1",
  sleepLoop: (t) => (Math.floor(t / 12) % 2 ? "sleep1" : "sleep2"),
  wakeUp: () => "alert",
  alertUp: () => "alert",
  walkOut: (t) => (t % 2 ? "walkE1" : "walkE2"),
};

export class CatAnimator {
  private anim: Anim = { kind: "hidden" };
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private opts: {
      compositor: Compositor;
      mirror: Mirror;
      renderer: SpriteRenderer;
      bell: () => void;
      now?: () => number;
      log?: (msg: string) => void;
      sleepAfterMs?: number; // override (the demo naps sooner, for show)
      settleTicks?: number; // how long the cat sits before it may curl up
    },
  ) {
    this.lastActivityAt = this.now(); // launching catsit counts as activity
  }

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
  private lastState: CatState = { kind: "unknown" };

  onState(next: CatState): void {
    if (this.stopped) return;
    const prev = this.lastState;
    this.lastState = next;
    const a = this.anim;
    this.opts.log?.(`anim<-state ${next.kind}${"reason" in next ? ":" + next.reason : ""} (anim=${a.kind === "beat" ? a.beat : a.kind})`);
    // the same unanswered prompt re-read as another reason (permission ↔
    // question flicker) is not a new event — no second bell, no re-alert
    if (
      next.kind === "needs_human" &&
      next.reason !== "done" &&
      prev.kind === "needs_human" &&
      a.kind === "beat" &&
      (a.beat === "idle" || a.beat === "alertUp")
    ) {
      return;
    }
    const exiting = a.kind === "beat" && (a.beat === "walkOut" || (a.beat === "sitDown" && a.reverse));
    switch (next.kind) {
      case "working":
        if (a.kind === "hidden") this.anim = { kind: "waiting", since: this.now() };
        // mid-walkOut: let the cat finish leaving; the next tick sees state
        // "working" again via hidden→waiting and it walks right back in
        if (prev.kind === "needs_human" && prev.reason !== "done") {
          // the agent only resumes after a prompt because YOU answered it —
          // that answer counts as activity (keeps the demo honest too)
          this.lastActivityAt = this.now();
        }
        this.pendingAlert = false; // the agent resumed; no alert theater owed
        break;
      case "needs_human":
        if (a.kind === "waiting") {
          // the turn ended before the cat ever appeared: stay silent — the
          // user was never told to look away, so no meow is owed
          this.anim = { kind: "hidden" };
        } else if (a.kind === "beat" && a.beat === "alertUp" && !a.reverse) {
          // mid-meow or holding the watch: ring the bell for a finished task;
          // tick() starts the walk-off as soon as the rear-up is done
          if (next.reason === "done") this.opts.bell();
        } else if (exiting) {
          this.opts.bell(); // already on the way out; the bell still tells you
        } else if (a.kind === "beat") {
          this.opts.bell(); // the gate is already open; the bell never waits
          const wantExit = next.reason === "done";
          if (a.beat === "sleepLoop") {
            this.wakeTarget = wantExit ? "walkOut" : "alertUp";
            this.anim = { kind: "beat", beat: "wakeUp", ticks: 0 };
          } else if (a.beat === "sleepDown") {
            this.wakeTarget = wantExit ? "walkOut" : "alertUp";
            this.pendingWake = true; // finish curling, then wake into it
          } else if (a.beat === "wakeUp") {
            this.wakeTarget = wantExit ? "walkOut" : "alertUp";
          } else if (a.beat === "walkIn" || a.beat === "sitDown") {
            // still arriving: meow right away, finish the entrance connected,
            // then do the rear-up once seated (no jump cuts)
            this.meow();
            this.pendingAlert = true;
          } else if (wantExit) {
            // finished while loafing: no crying — stand up and walk off
            this.anim = { kind: "beat", beat: "sitDown", ticks: 0, reverse: true };
          } else {
            this.anim = { kind: "beat", beat: "alertUp", ticks: 0 };
            this.meow();
          }
          this.render();
        }
        break;
      case "shooed":
      case "unknown":
        if (a.kind === "waiting") this.anim = { kind: "hidden" };
        else if (a.kind === "beat" && !exiting) {
          if (a.beat === "sleepLoop" || a.beat === "sleepDown" || a.beat === "wakeUp") {
            this.wakeTarget = "walkOut";
            if (a.beat === "sleepLoop") this.anim = { kind: "beat", beat: "wakeUp", ticks: 0 };
            else if (a.beat === "sleepDown") this.pendingWake = true;
          } else if (a.beat === "idle") {
            // from loafing: stand up first, then the walk-off — connected
            this.anim = { kind: "beat", beat: "sitDown", ticks: 0, reverse: true };
          } else {
            this.anim = { kind: "beat", beat: "walkOut", ticks: 0 };
          }
        }
        break;
    }
  }

  // sleep bookkeeping: the cat naps after SLEEP_AFTER_MS without user input,
  // and any keystroke (or mouse event reaching stdin) wakes it groggily
  private lastActivityAt = 0;
  private pendingWake = false;
  private pendingAlert = false; // needs_human arrived mid-entrance
  private wakeTarget: BeatName = "idle";

  /** Any user input byte (keys, mouse reports). Wakes a sleeping cat. */
  onUserActivity(): void {
    if (this.stopped) return;
    this.lastActivityAt = this.now();
    if (this.anim.kind !== "beat") return;
    if (this.anim.beat === "sleepLoop") {
      this.wakeTarget = "idle";
      this.anim = { kind: "beat", beat: "wakeUp", ticks: 0 };
      this.render();
    } else if (this.anim.beat === "sleepDown" && !this.pendingWake) {
      this.wakeTarget = "idle";
      this.pendingWake = true;
    }
  }

  /** In guard mode, keys are only gated while the cat is actually on screen. */
  get isVisible(): boolean {
    return this.anim.kind === "beat";
  }

  // feedback bubble state (guard mode): what the cat just ate, plus a
  // one-time hint so a blocked keystroke never reads as a bug
  private bubbleText = "";
  private bubbleUntil = 0;
  private hintUntil = 0;
  private hintShown = false;
  private hintText = " guarding · ctrl+g to shoo";
  private tierHintShown = false;
  private meowUntilTick = 0; // counts down while alertUp plays
  private meowedThisVisit = false; // one meow bubble per visit — the first
  //   call cries out; the goodbye rear-up is silent (the bell still rings)

  private meow(): void {
    if (this.meowedThisVisit) return;
    this.meowedThisVisit = true;
    this.meowUntilTick = MEOW_HOLD_TICKS;
  }

  /** A keypress was swallowed — show what was eaten. */
  onSwallow(text = ""): void {
    if (this.anim.kind !== "beat" || this.anim.beat === "walkOut") return;
    const t = this.now();
    this.bubbleText = t < this.bubbleUntil ? this.bubbleText + text : text;
    this.bubbleText = [...this.bubbleText].slice(-8).join("");
    this.bubbleUntil = t + BUBBLE_HOLD_MS;
    if (!this.hintShown) {
      this.hintShown = true;
      this.hintText = " guarding · ctrl+g to shoo";
      this.hintUntil = t + HINT_HOLD_MS;
    }
    this.render();
  }

  /** A whole paste was swallowed. */
  onPaste(): void {
    if (this.anim.kind !== "beat" || this.anim.beat === "walkOut") return;
    const t = this.now();
    this.bubbleText = "(paste)";
    this.bubbleUntil = t + BUBBLE_HOLD_MS;
    if (!this.hintShown) {
      this.hintShown = true;
      this.hintText = " guarding · ctrl+g to shoo";
      this.hintUntil = t + HINT_HOLD_MS;
    }
    this.render();
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  /** One animation step. Public so tests can drive time deterministically. */
  tick(): void {
    if (this.stopped) return;
    const t = this.now();
    switch (this.anim.kind) {
      case "hidden":
        return;
      case "waiting":
        if (t - this.anim.since >= APPEAR_DELAY_MS) {
          this.meowedThisVisit = false; // a fresh visit gets a fresh voice
          this.anim = { kind: "beat", beat: "walkIn", ticks: 0 };
        } else return;
        break;
      case "beat": {
        this.anim.ticks++;
        if (this.meowUntilTick > 0) this.meowUntilTick--;
        const nowDone = this.lastState.kind === "needs_human" && this.lastState.reason === "done";
        if (this.anim.beat === "walkOut" && this.anim.bridge && this.anim.ticks >= 9) {
          // the rear-down bridge reached the all-fours frame — hand over to
          // sitDown (forward footage) and settle beside the user
          this.anim = { kind: "beat", beat: "sitDown", ticks: 0 };
        } else if (this.anim.beat === "idle" && nowDone) {
          // catch-all: however we ended up loafing with the task finished,
          // stand up and walk off — never leave the cat sitting over "done"
          this.anim = { kind: "beat", beat: "sitDown", ticks: 0, reverse: true };
        } else if (
          this.anim.beat === "idle" &&
          this.lastState.kind === "working" && // never doze off while YOU are needed
          this.anim.ticks >= (this.opts.settleTicks ?? 50) && // settle in before napping
          t - this.lastActivityAt >= (this.opts.sleepAfterMs ?? SLEEP_AFTER_MS) // …from YOUR last key
        ) {
          this.pendingWake = false;
          this.wakeTarget = "idle";
          this.anim = { kind: "beat", beat: "sleepDown", ticks: 0 };
        } else if (this.opts.renderer.beatDone(this.anim.beat, this.anim.ticks, this.anim.reverse)) {
          let next = NEXT_BEAT[this.anim.beat];
          let reverse = false;
          let bridge = false;
          let startTicks = 0;
          const taskDone = nowDone;
          if (this.anim.beat === "sleepDown") next = this.pendingWake ? "wakeUp" : "sleepLoop";
          else if (this.anim.beat === "wakeUp") {
            next = this.wakeTarget;
            if (next === "walkOut") {
              // leaving from the sitting anchor: stand up first, connected
              next = "sitDown";
              reverse = true;
            }
          } else if (this.anim.beat === "sitDown" && this.anim.reverse) {
            // stood up — turn and walk off, skipping walkOut's reared opening
            // (frame ~9 is the same all-fours stance the stand-up ends on)
            next = "walkOut";
            startTicks = 8;
          } else if (this.anim.beat === "sitDown" && this.pendingAlert) next = "alertUp";
          else if (this.anim.beat === "alertUp") {
            // the meow is ONE gesture: rear up, cry, come right back down —
            // answered or not (the bell and the cry already did the telling).
            // The way down is all forward footage: walkOut's opening brings
            // the cat off its hind legs, then sitDown seats it. Only a task
            // that finished mid-cry walks straight off instead.
            next = "walkOut";
            if (!taskDone) bridge = true;
          }
          if (next) {
            this.pendingWake = false;
            if (next === "alertUp" && !reverse) {
              this.pendingAlert = false;
              this.meow();
            }
            // the nap timer runs from the user's last input on purpose: if
            // you've been away all along, the cat settles and naps soon after
            this.anim = {
              kind: "beat",
              beat: next,
              ticks: startTicks,
              ...(reverse ? { reverse: true } : {}),
              ...(bridge ? { bridge: true } : {}),
            };
          } else if (this.anim.beat === "walkOut") {
            // if the agent went back to work while the cat was busy leaving
            // (you approved the prompt), come back after the usual delay —
            // otherwise that "working" transition is already spent and the
            // cat would stay gone for the whole rest of the task
            this.anim = this.lastState.kind === "working" ? { kind: "waiting", since: t } : { kind: "hidden" };
            this.lastRenderKey = "";
            this.opts.log?.(`anim ${this.anim.kind} (walk-out complete)`);
            this.opts.compositor.setOverlay(null);
            return;
          }
        }
        break;
      }
    }
    this.render();
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
    beat: "idle" as BeatName,
    beatTicks: 0,
    reverse: false,
    cellX: 0,
    cellY: 0,
    showMeow: false,
    bubble: null as string | null,
    hint: false,
    hintText: "",
  };
  private overlayObj: Overlay | null = null;
  private lastRenderKey = "";

  private ensureOverlay(): Overlay {
    if (this.overlayObj) return this.overlayObj;
    const renderer = this.opts.renderer;
    const mirror = this.opts.mirror;
    const cur = this.cur;
    const damages = () => renderer.modeName !== "kitty" || cur.showMeow || cur.bubble !== null || cur.hint;
    this.overlayObj = {
      get damagesCells() {
        return damages();
      },
      // The rect must cover EVERYTHING draw() can paint — bubbles and the
      // hint line included — or hiding the overlay leaves orphaned cells.
      rect: () => ({
        x: cur.cellX - 8,
        y: cur.cellY - 1,
        w: renderer.maxCols + 10,
        h: renderer.catRows + 2,
      }),
      draw: (cols, rows) => {
        let s = renderer.draw({
          frame: cur.frame,
          beat: cur.beat,
          beatTicks: cur.beatTicks,
          reverse: cur.reverse,
          // read LIVE, not from cur: the compositor calls draw() on every app
          // forward, and a held pose must retransmit right after an erase
          clearEpoch: mirror.clearEpoch,
          cellX: cur.cellX,
          cellY: cur.cellY,
          cols,
          rows,
        });
        const bubbleRow = Math.max(1, cur.cellY); // 1-based CUP row = 0-based cellY-1
        const bx = Math.max(0, cur.cellX + renderer.bubbleCol - 8);
        // never paint past the right edge — a wrapped line lands OUTSIDE the
        // overlay rect and survives as residue
        const avail = Math.max(0, cols - bx - 1);
        if (cur.showMeow && avail > 2) {
          s += `\x1b[${bubbleRow};${bx + 2}H\x1b[0;1;${renderer.fg(255, 220, 120)}m${clipColumns(" mew! ", avail - 1)}\x1b[0m`;
        } else if (cur.bubble !== null && avail > 4) {
          // what the cat just ate (guard mode)
          s += `\x1b[${bubbleRow};${bx + 1}H\x1b[0;${renderer.fg(30, 30, 30)};${renderer.bg(255, 220, 120)}m${clipColumns(` 🐟 ${cur.bubble} `, Math.min(14, avail))}\x1b[0m`;
        }
        if (cur.hint && avail > 4) {
          const hintRow = cur.cellY + renderer.catRows + 1; // 1-based; last row of the rect
          if (hintRow >= 1 && hintRow <= rows) {
            s += `\x1b[${hintRow};${bx + 1}H\x1b[0;2m${clipColumns(cur.hintText, Math.min(renderer.catCols + 9, avail))}\x1b[0m`;
          }
        }
        return s;
      },
      clear: () => renderer.clear(),
    };
    return this.overlayObj;
  }

  private render(): void {
    if (this.anim.kind !== "beat") return;
    const t = this.now();
    this.opts.renderer.fit(this.opts.mirror.rows); // scale to the terminal
    if (!this.tierHintShown && this.opts.renderer.lofi) {
      // lo-fi tier: tell first-timers where the full-quality cat lives
      this.tierHintShown = true;
      this.hintText = " HD cat: kitty · ghostty · wezterm · iterm2";
      this.hintUntil = t + 6000;
    }
    const { beat, ticks } = this.anim;
    this.cur.beat = beat;
    this.cur.beatTicks = ticks;
    this.cur.reverse = this.anim.reverse ?? false;
    this.cur.frame = FALLBACK_FRAME[beat](ticks);
    this.cur.cellX = Math.max(0, this.opts.mirror.cols - this.opts.renderer.catCols - 1);
    this.cur.cellY = this.yAnchor(this.opts.mirror.rows);
    this.cur.showMeow = this.meowUntilTick > 0; // rides the entrance too

    this.cur.bubble = t < this.bubbleUntil && !this.cur.showMeow ? this.bubbleText : null;
    this.cur.hint = t < this.hintUntil && !this.cur.showMeow;
    this.cur.hintText = this.hintText;
    const frameIdx =
      this.opts.renderer.modeName === "kitty"
        ? this.opts.renderer.beatFrame(beat, ticks, this.cur.reverse)
        : this.cur.frame;
    const key = `${beat}|${frameIdx}|${this.cur.cellX}|${this.cur.cellY}|${this.cur.showMeow}|${this.cur.bubble ?? ""}|${this.cur.hint}`;
    if (key === this.lastRenderKey) return; // nothing changed; forwards keep it drawn
    this.lastRenderKey = key;
    this.opts.compositor.setOverlay(this.ensureOverlay());
  }
}
