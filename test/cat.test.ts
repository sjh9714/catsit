// End-to-end animator property: after any cat lifecycle (walk in, loaf,
// alert with meow bubble, walk out), the user's screen must be EXACTLY what
// the app drew — zero orphaned cells. This is the invariant that makes the
// cat trustworthy.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Compositor } from "../src/compositor.js";
import { CatAnimator } from "../src/overlay/cat.js";
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

  // working: cat walks in and loafs
  animator.onState({ kind: "working" });
  for (let i = 0; i < 12; i++) {
    now += 200;
    animator.tick();
    await pump();
    // the app keeps repainting beneath the cat
    await feed(`\x1b[2;1H\x1b[2K\x1b[36mrepaint tick ${i}\x1b[0m`);
  }

  // a swallowed keypress and a paste
  animator.onSwallow();
  await pump();
  now += 500;
  animator.tick();
  await pump();
  animator.onPaste();
  await pump();
  now += 800;
  animator.tick();
  await pump();

  // needs_human: alert + meow bubble, then walk-out to hidden
  animator.onState({ kind: "needs_human", reason: "permission" });
  await pump();
  for (let i = 0; i < 20; i++) {
    now += 200;
    animator.tick();
    await pump();
  }

  animator.stop();
  await pump();
}

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
