// End-to-end animator property: after any cat lifecycle (walk in, loaf,
// alert with meow bubble, walk out), the user's screen must be EXACTLY what
// the app drew — zero orphaned cells. This is the invariant that makes the
// cat trustworthy.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Compositor } from "../src/compositor.js";
import { APPEAR_DELAY_MS, CatAnimator, SLEEP_AFTER_MS } from "../src/overlay/cat.js";
import { SpriteRenderer, type RenderMode } from "../src/overlay/render.js";
import { diffScreens, makeUserTerm, writeTo } from "./helpers.js";
import type { Terminal as XtermTerminal } from "@xterm/headless";

const COLS = 100;
const ROWS = 30;

let written: string[];
let comp: Compositor;
let user: XtermTerminal;
let now: number;

async function pump(): Promise<void> {
  await comp.flush();
  const s = written.splice(0).join("");
  if (s) await writeTo(user, s);
}

async function feed(s: string): Promise<void> {
  comp.feed(Buffer.from(s, "utf8"));
  await pump();
}

beforeEach(() => {
  written = [];
  now = 1_000_000;
  comp = new Compositor({ cols: COLS, rows: ROWS, write: (s) => written.push(s) });
  user = makeUserTerm(COLS, ROWS);
});

afterEach(() => {
  comp.dispose();
  user.dispose();
});

async function runLifecycle(mode: RenderMode): Promise<void> {
  const animator = new CatAnimator({
    compositor: comp,
    mirror: comp.screen,
    renderer: new SpriteRenderer(mode),
    bell: () => {},
    now: () => now,
  });

  // app paints a screen with content near the cat's anchor
  for (let i = 0; i < ROWS - 4; i++) {
    await feed(`\x1b[3${i % 8}mrow ${i} abcdefghijklmnopqrstuvwxyz0123456789\x1b[0m\r\n`);
  }

  // working: after the appear delay the cat walks in (a full gait cycle) and loafs
  animator.onState({ kind: "working" });
  now += APPEAR_DELAY_MS;
  for (let i = 0; i < 24; i++) {
    now += 200;
    animator.tick();
    await pump();
    // the app keeps repainting beneath the cat
    await feed(`\x1b[2;1H\x1b[2K\x1b[36mrepaint tick ${i}\x1b[0m`);
  }

  // swallowed keypresses (guard mode): eaten-text bubble + first-time hint
  animator.onSwallow("hello");
  await pump();
  animator.onSwallow(" 고양이");
  await pump();
  now += 500;
  animator.tick();
  await pump();
  animator.onPaste();
  await pump();
  now += 800;
  animator.tick();
  await pump();
  // let the bubble and the hint both expire while the app repaints beneath
  for (let i = 0; i < 25; i++) {
    now += 200;
    animator.tick();
    await pump();
    await feed(`\x1b[3;1H\x1b[2K\x1b[35mbubble-phase repaint ${i}\x1b[0m`);
  }

  // needs_human: alert + meow bubble, then the long walk-out to hidden
  animator.onState({ kind: "needs_human", reason: "permission" });
  await pump();
  for (let i = 0; i < 40; i++) {
    now += 200;
    animator.tick();
    await pump();
  }

  animator.stop();
  await pump();
}

describe("CatAnimator appear delay", () => {
  it("short turns come and go without the cat appearing or meowing", async () => {
    let bells = 0;
    const animator = new CatAnimator({
      compositor: comp,
      mirror: comp.screen,
      renderer: new SpriteRenderer("half"),
      bell: () => bells++,
      now: () => now,
    });
    await feed("some app content\r\n");
    animator.onState({ kind: "working" });
    // turn ends 2s later — before the appear delay elapses
    now += 2000;
    animator.tick();
    await pump();
    animator.onState({ kind: "needs_human", reason: "done" });
    await pump();
    expect(bells).toBe(0);
    expect(animator.isVisible).toBe(false);
    expect(diffScreens(comp.screen, user)).toEqual([]); // nothing was ever drawn
    animator.stop();
  });

  it("naps after quiet, wakes groggily on input, and alert-wakes from sleep", async () => {
    const animator = new CatAnimator({
      compositor: comp,
      mirror: comp.screen,
      renderer: new SpriteRenderer("half"),
      bell: () => {},
      now: () => now,
    });
    const beat = () => (animator as unknown as { anim: { kind: string; beat?: string } }).anim;
    const tickN = async (n: number) => {
      for (let i = 0; i < n; i++) {
        now += 200;
        animator.tick();
        await pump();
      }
    };
    await feed("some app content\r\n");
    animator.onState({ kind: "working" });
    now += APPEAR_DELAY_MS;
    await tickN(50 + 50 + 2); // real beat lengths: walkIn + sitDown + idle
    expect(beat().beat).toBe("idle");

    // 60s of quiet → the cat curls up and naps
    now += SLEEP_AFTER_MS;
    await tickN(1);
    expect(beat().beat).toBe("sleepDown");
    await tickN(50);
    expect(beat().beat).toBe("sleepLoop");

    // a keystroke wakes it groggily, back to sitting (no meow)
    animator.onUserActivity();
    expect(beat().beat).toBe("wakeUp");
    await tickN(51);
    expect(beat().beat).toBe("idle");

    // quiet again → asleep again; this time the agent needs a human
    now += SLEEP_AFTER_MS;
    await tickN(52);
    expect(beat().beat).toBe("sleepLoop");
    let bells = 0;
    (animator as unknown as { opts: { bell: () => void } }).opts.bell = () => bells++;
    animator.onState({ kind: "needs_human", reason: "permission" });
    expect(bells).toBe(1); // the bell never waits for the animation
    expect(beat().beat).toBe("wakeUp");
    await tickN(51);
    expect(beat().beat).toBe("alertUp");
    await tickN(51);
    expect(beat().beat).toBe("walkOut");
    await tickN(51);
    expect(animator.isVisible).toBe(false);
    expect(diffScreens(comp.screen, user)).toEqual([]);
    animator.stop();
  });

  it("guard visibility follows the cat, not the state", async () => {
    const animator = new CatAnimator({
      compositor: comp,
      mirror: comp.screen,
      renderer: new SpriteRenderer("half"),
      bell: () => {},
      now: () => now,
    });
    animator.onState({ kind: "working" });
    expect(animator.isVisible).toBe(false); // waiting: no cat -> no gating
    now += APPEAR_DELAY_MS;
    animator.tick();
    await pump();
    expect(animator.isVisible).toBe(true);
    animator.stop();
  });
});

describe("CatAnimator leaves zero residue", () => {
  it("half-block mode: full lifecycle then screen is exactly the app's", async () => {
    await runLifecycle("half");
    expect(diffScreens(comp.screen, user)).toEqual([]);
  });

  it("kitty mode: full lifecycle then screen is exactly the app's (bubble cells repaired)", async () => {
    await runLifecycle("kitty");
    expect(diffScreens(comp.screen, user)).toEqual([]);
  });

  it("kaomoji mode: full lifecycle then screen is exactly the app's", async () => {
    await runLifecycle("kaomoji");
    expect(diffScreens(comp.screen, user)).toEqual([]);
  });
});
