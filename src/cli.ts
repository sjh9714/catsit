#!/usr/bin/env node
// catsit — a cat that babysits your AI agent so you don't have to.
//
// v0 wiring: PTY passthrough with the compositor in place. The cat overlay,
// state detection, and input gating land in later phases; CATSIT_BOX=1 shows
// a dev overlay box for manual testing.

import { Compositor, type Overlay } from "./compositor.js";
import { spawnChild } from "./pty.js";
import { TerminalGuard } from "./restore.js";

const HELP = `catsit — a cat that babysits your AI agent so you don't have to.

Usage:
  catsit <command> [args...]     wrap a command (e.g. catsit claude)
  catsit -- <command> [args...]

Flags (before the command):
  --no-cat       disable the overlay entirely
  --no-swallow   cat is decorative only; never gates keystrokes
  --quiet        no bell when the cat gets up
  -h, --help     show this help
  -v, --version  show version
`;

interface Flags {
  noCat: boolean;
  noSwallow: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): { flags: Flags; cmd: string; args: string[] } | null {
  const flags: Flags = { noCat: false, noSwallow: false, quiet: false };
  let i = 0;
  for (; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--") {
      i++;
      break;
    }
    if (a === "--no-cat") flags.noCat = true;
    else if (a === "--no-swallow") flags.noSwallow = true;
    else if (a === "--quiet") flags.quiet = true;
    else if (a === "-h" || a === "--help") {
      process.stdout.write(HELP);
      process.exit(0);
    } else if (a === "-v" || a === "--version") {
      process.stdout.write("catsit 0.0.0\n");
      process.exit(0);
    } else break;
  }
  if (i >= argv.length) return null;
  return { flags, cmd: argv[i]!, args: argv.slice(i + 1) };
}

const parsed = parseArgs(process.argv.slice(2));
if (!parsed) {
  process.stdout.write(HELP);
  process.exit(2);
}

const cols = process.stdout.columns || 80;
const rows = process.stdout.rows || 24;

const compositor = new Compositor({
  cols,
  rows,
  write: (s) => process.stdout.write(s),
});

const guard = new TerminalGuard((s) => process.stdout.write(s), {
  onAltScreen: () => compositor.screen.onAltScreen(),
});
guard.arm();

const child = spawnChild(parsed.cmd, parsed.args, cols, rows);

child.onData((d) => compositor.feed(Buffer.from(d, "utf8")));
child.onExit((code) => {
  void compositor.flush().then(() => {
    guard.restore(false);
    compositor.dispose();
    process.exit(code);
  });
});

// stdin: raw passthrough for now (gating lands with the state machine)
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on("data", (d: Buffer) => child.write(d.toString("utf8")));
process.stdin.resume();

process.stdout.on("resize", () => {
  const c = process.stdout.columns || 80;
  const r = process.stdout.rows || 24;
  child.resize(c, r);
  compositor.resize(c, r);
});

// dev overlay box for manual verification until the cat lands
if (process.env.CATSIT_BOX === "1" && !parsed.flags.noCat) {
  const box: Overlay = {
    rect: (c, r) => ({ x: c - 24, y: r - 9, w: 22, h: 7 }),
    draw: (c, r) => {
      let s = "";
      for (let i = 0; i < 7; i++) {
        s += `\x1b[${r - 9 + i + 1};${c - 24 + 1}H\x1b[0;48;2;255;140;0;38;2;40;20;0m${" CATSIT DEV BOX ".padEnd(22).slice(0, 22)}`;
      }
      return s + "\x1b[0m";
    },
  };
  let on = false;
  setInterval(() => {
    on = !on;
    compositor.setOverlay(on ? box : null);
  }, 2000).unref();
}
