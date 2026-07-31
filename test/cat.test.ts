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
    // turn ends before the appear delay elapses
    now += APPEAR_DELAY_MS - 400;
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

    // 60s since YOUR last input → the cat curls up and naps
    // (it still settles in for a 5s grace after sitting down)
    now += SLEEP_AFTER_MS;
    await tickN(51);
    expect(beat().beat).toBe("sleepDown");
    await tickN(50);
    expect(beat().beat).toBe("sleepLoop");

    // a keystroke wakes it groggily, back to sitting (no meow)
    animator.onUserActivity();
    expect(beat().beat).toBe("wakeUp");
    await tickN(51);
    expect(beat().beat).toBe("idle");

    // quiet again → asleep again; this time the task finishes
    now += SLEEP_AFTER_MS;
    await tickN(102);
    expect(beat().beat).toBe("sleepLoop");
    let bells = 0;
    (animator as unknown as { opts: { bell: () => void } }).opts.bell = () => bells++;
    animator.onState({ kind: "needs_human", reason: "done" });
    expect(bells).toBe(1); // the bell never waits for the animation
    expect(beat().beat).toBe("wakeUp");
    await tickN(51); // awake on the sitting anchor → stands up, no crying
    expect(beat().beat).toBe("sitDown");
    expect((beat() as { reverse?: boolean }).reverse).toBe(true);
    await tickN(51);
    expect(beat().beat).toBe("walkOut"); // done → the goodbye walk-off
    await tickN(51);
    expect(animator.isVisible).toBe(false);
    expect(diffScreens(comp.screen, user)).toEqual([]);
    animator.stop();
  });

  it("needs_human mid-entrance: bell and bubble now, rear-up once seated", async () => {
    let bells = 0;
    const animator = new CatAnimator({
      compositor: comp,
      mirror: comp.screen,
      renderer: new SpriteRenderer("half"),
      bell: () => bells++,
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
    await tickN(10); // mid walk-in
    expect(beat().beat).toBe("walkIn");
    animator.onState({ kind: "needs_human", reason: "permission" });
    expect(bells).toBe(1); // notified immediately, no jump cut
    expect(beat().beat).toBe("walkIn"); // entrance stays connected
    await tickN(41 + 50); // finish walkIn + sitDown
    expect(beat().beat).toBe("alertUp"); // then the rear-up plays
    await tickN(51); // a prompt is a call, not a goodbye: hold the watch
    expect(beat().beat).toBe("alertUp");
    expect((beat() as { reverse?: boolean }).reverse).toBeFalsy();
    await tickN(40);
    expect(beat().beat).toBe("alertUp"); // still standing, still yours to answer
    animator.stop();
  });

  it("answered: holds the watch, then quietly settles — never a second cry", async () => {
    const animator = new CatAnimator({
      compositor: comp,
      mirror: comp.screen,
      renderer: new SpriteRenderer("half"),
      bell: () => {},
      now: () => now,
    });
    const beat = () => (animator as unknown as { anim: { kind: string; beat?: string; reverse?: boolean } }).anim;
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
    await tickN(102); // seated
    animator.onState({ kind: "needs_human", reason: "permission" });
    await tickN(10); // mid rear-up
    expect(beat().beat).toBe("alertUp");
    animator.onState({ kind: "working" }); // you hit "yes" — agent resumes
    await tickN(41); // the rear-up finishes...
    expect(beat().beat).toBe("alertUp"); // ...and HOLDS the standing watch
    expect(beat().reverse).toBeFalsy();
    expect(animator.isVisible).toBe(true); // never leaves the screen
    await tickN(8); // answered → the quiet settle begins almost at once
    expect(beat().beat).toBe("alertUp");
    expect(beat().reverse).toBe(true);
    await tickN(45); // rear-down (meow frames skipped) lands on the anchor
    expect(beat().beat).toBe("idle");
    animator.stop();
  });

  it("comes back after a late answer: walkOut into working ends in waiting, not gone", async () => {
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
    await tickN(102); // seated
    animator.onState({ kind: "needs_human", reason: "done" });
    await tickN(51); // the goodbye rear-up plays out…
    expect(beat().beat).toBe("walkOut"); // …and the cat starts stepping aside
    animator.onState({ kind: "working" }); // you queued the next task mid-exit
    await tickN(51); // walk-out finishes, the appear delay passes…
    expect(beat().beat).toBe("walkIn"); // …and the cat walks right back in
    animator.stop();
  });

  it("an unanswered prompt: one meow, hold the watch — leave only on done", async () => {
    const animator = new CatAnimator({
      compositor: comp,
      mirror: comp.screen,
      renderer: new SpriteRenderer("half"),
      bell: () => {},
      now: () => now,
    });
    const beat = () => (animator as unknown as { anim: { kind: string; beat?: string; reverse?: boolean } }).anim;
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
    await tickN(102); // seated
    animator.onState({ kind: "needs_human", reason: "permission" });
    const meowTicks = () => (animator as unknown as { meowUntilTick: number }).meowUntilTick;
    expect(meowTicks()).toBeGreaterThan(0); // the call cries out
    animator.onState({ kind: "needs_human", reason: "question" });
    expect(beat().beat).toBe("alertUp"); // reason flicker: same prompt, no re-alert
    await tickN(51); // rear-up meow plays out with no answer
    expect(beat().beat).toBe("alertUp");
    expect(beat().reverse).toBeFalsy(); // …and holds the standing watch
    now += SLEEP_AFTER_MS + 60_000;
    await tickN(60);
    expect(beat().beat).toBe("alertUp"); // no settling, no dozing — you're needed
    animator.onState({ kind: "needs_human", reason: "done" }); // you answered; task finished
    expect(meowTicks()).toBe(0); // the goodbye is silent — one meow per visit
    await tickN(2);
    expect(beat().beat).toBe("walkOut"); // straight off from the held pose
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

describe("kitty graphics survive screen erases", () => {
  it("a full-screen erase forces a retransmit, not just a re-place", async () => {
    const animator = new CatAnimator({
      compositor: comp,
      mirror: comp.screen,
      renderer: new SpriteRenderer("kitty"),
      bell: () => {},
      now: () => now,
    });
    await feed("some app content\r\n");
    animator.onState({ kind: "working" });
    now += APPEAR_DELAY_MS;
    for (let i = 0; i < 102; i++) {
      now += 200;
      animator.tick();
      await pump();
    }
    // the app clears the whole screen while the cat's frame is unchanged —
    // kitty drops the image on ED, so the very same forward must carry a
    // fresh transmission (a=t), not only a placement (a=p)
    comp.feed(Buffer.from("\x1b[2J", "utf8"));
    await comp.flush();
    const out = written.join("");
    expect(out).toContain("\x1b[2J");
    expect(out).toContain("a=t,f=100");
    await pump();
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
