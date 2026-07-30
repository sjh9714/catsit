import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Compositor, type Overlay } from "../src/compositor.js";
import { diffScreens, makeUserTerm, writeTo } from "./helpers.js";
import type { Terminal as XtermTerminal } from "@xterm/headless";

const COLS = 60;
const ROWS = 16;

const box: Overlay = {
  rect: (c, r) => ({ x: c - 22, y: r - 8, w: 20, h: 6 }),
  draw: (c, r) => {
    let s = "";
    for (let i = 0; i < 6; i++) {
      s += `\x1b[${r - 8 + i + 1};${c - 22 + 1}H\x1b[0;48;2;255;140;0;38;2;0;0;0m${"CAT".repeat(7).slice(0, 20)}`;
    }
    return s + "\x1b[0m";
  },
};

let written: string[];
let comp: Compositor;
let user: XtermTerminal;

async function pump(): Promise<void> {
  await comp.flush();
  const s = written.splice(0).join("");
  if (s) await writeTo(user, s);
}

async function feed(s: string): Promise<void> {
  comp.feed(Buffer.from(s, "utf8"));
  await pump();
}

function expectEqual(exclude?: ReturnType<Overlay["rect"]>): void {
  expect(diffScreens(comp.screen, user, exclude)).toEqual([]);
}

beforeEach(() => {
  written = [];
  comp = new Compositor({ cols: COLS, rows: ROWS, write: (s) => written.push(s) });
  user = makeUserTerm(COLS, ROWS);
});

afterEach(() => {
  comp.dispose();
  user.dispose();
});

describe("Compositor", () => {
  it("plain passthrough is byte-transparent", async () => {
    await feed("hello \x1b[1;32mworld\x1b[0m\r\nline two\r\n");
    expectEqual();
  });

  it("overlay shows, app scrolls beneath, overlay hides with zero residue", async () => {
    for (let i = 0; i < 10; i++) await feed(`\x1b[3${i % 8}mline ${i} content here\x1b[0m\r\n`);
    comp.setOverlay(box);
    await pump();
    // scroll a lot while the overlay is visible
    for (let i = 10; i < 40; i++) await feed(`\x1b[3${i % 8}mline ${i} content here\x1b[0m\r\n`);
    expectEqual(box.rect(COLS, ROWS));
    comp.setOverlay(null);
    await pump();
    expectEqual(); // exact equality incl. scrollback text and cursor
  });

  it("repaint-style TUI updates under the overlay stay intact", async () => {
    comp.setOverlay(box);
    await pump();
    for (let f = 0; f < 30; f++) {
      await feed(`\x1b[H\x1b[38;2;255;100;0mFRAME ${f}\x1b[0m\x1b[10;5H\x1b[48;5;${f % 256}m row ${f} \x1b[0m\x1b[15;1H\x1b[2K> prompt ${f}`);
    }
    expectEqual(box.rect(COLS, ROWS));
    comp.setOverlay(null);
    await pump();
    expectEqual();
  });

  it("pending-wrap survives overlay toggles at the boundary", async () => {
    await feed("x".repeat(COLS)); // exactly full row -> wrap pending
    comp.setOverlay(box);
    await pump();
    comp.setOverlay(null);
    await pump();
    await feed("y"); // must land on the NEXT line in both screens
    expectEqual();
  });

  it("escape sequences split across feeds are never corrupted by injection", async () => {
    comp.setOverlay(box);
    await pump();
    // split a truecolor SGR mid-sequence
    await feed("A\x1b[38;2;1");
    await feed("0;20;30mB\x1b[0m");
    // split an emoji mid-codepoint
    const cat = Buffer.from("🐈", "utf8");
    comp.feed(cat.subarray(0, 2));
    await pump();
    comp.feed(cat.subarray(2));
    await pump();
    comp.setOverlay(null);
    await pump();
    expectEqual();
  });

  it("wide chars at the overlay edge restore correctly", async () => {
    // paint wide chars across the row where the overlay sits
    for (let i = 0; i < ROWS - 2; i++) await feed("가나다라마바사아자차카타파하 日本語 中文 ✨\r\n");
    comp.setOverlay(box);
    await pump();
    comp.setOverlay(null);
    await pump();
    expectEqual();
  });

  it("null cells are restored as erased, not printed spaces", async () => {
    await feed("short\r\n"); // rest of the row is null cells
    comp.setOverlay(box);
    await pump();
    comp.setOverlay(null);
    await pump();
    // push everything into scrollback and compare trimmed text
    for (let i = 0; i < ROWS + 2; i++) await feed(`fill ${i}\r\n`);
    expectEqual();
  });

  it("degrades to passthrough when the overlay throws, session survives", async () => {
    const evil: Overlay = {
      rect: box.rect,
      draw: () => {
        throw new Error("sprite exploded");
      },
    };
    let sawError: unknown = null;
    comp.dispose();
    comp = new Compositor({
      cols: COLS,
      rows: ROWS,
      write: (s) => written.push(s),
      onError: (e) => (sawError = e),
    });
    await feed("before\r\n");
    comp.setOverlay(evil);
    await pump(); // draw throws -> degrade
    expect(comp.isDegraded).toBe(true);
    expect(sawError).toBeInstanceOf(Error);
    await feed("after crash\r\n"); // still flows
    expect(user.buffer.active.getLine(user.buffer.active.viewportY + 1)?.translateToString(true)).toBe("after crash");
  });

  it("overlay animation frames (replace overlay while visible) leave no trail", async () => {
    const at = (x: number): Overlay => ({
      rect: () => ({ x, y: 2, w: 6, h: 3 }),
      draw: () => {
        let s = "";
        for (let i = 0; i < 3; i++) s += `\x1b[${2 + i + 1};${x + 1}H\x1b[0;48;5;208m======`;
        return s + "\x1b[0m";
      },
    });
    for (let i = 0; i < 10; i++) await feed(`row ${i} abcdefghijklmnopqrstuvwxyz\r\n`);
    // walk the overlay across the screen like a cat walking in
    for (let x = 0; x < 30; x += 3) {
      comp.setOverlay(at(x));
      await pump();
      await feed(`\x1b[12;1Htick ${x}   `);
    }
    comp.setOverlay(null);
    await pump();
    expectEqual();
  });
});
