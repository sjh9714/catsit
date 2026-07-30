#!/usr/bin/env node
// catsit — a cat that babysits your AI agent so you don't have to.
//
// While the agent works, a cat sits on your terminal and swallows your
// typing. The moment you're needed — permission prompt, question, done,
// error — the cat gets up, meows, and steps aside.

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Compositor } from "./compositor.js";
import { runDemoAgent } from "./demo.js";
import { ClaudeScreenDetector } from "./detect/screen.js";
import { TranscriptWatcher } from "./detect/transcript.js";
import { InputGate } from "./input.js";
import { CatAnimator } from "./overlay/cat.js";
import { detectRenderMode, SpriteRenderer } from "./overlay/render.js";
import { spawnChild } from "./pty.js";
import { TerminalGuard } from "./restore.js";
import { StateMachine } from "./state.js";

const HELP = `catsit — a cat that babysits your AI agent so you don't have to.

While the agent works, the cat sits on your terminal and swallows your
typing ("not yet"). The moment you're needed — permission prompt, question,
done — the cat gets up, meows, and steps aside ("your turn").

Usage:
  catsit <command> [args...]     e.g.  catsit claude
  catsit -- <command> [args...]
  catsit --demo                  try it with a bundled fake agent (no tokens)

Flags (before the command):
  --no-swallow   decorative cat only; never gates keystrokes
  --no-cat       no overlay at all (plain transparent wrapper)
  --quiet        no bell when the cat gets up
  -h, --help     show this help
  -v, --version  show version

Keys while the cat is sitting:
  ctrl+g         shoo the cat away for the rest of the session
  ctrl+c / esc   always pass through instantly — the cat never blocks these
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
    else if (a === "--demo") {
      // wrap ourselves running the bundled fake agent
      return { flags, cmd: process.execPath, args: [fileURLToPath(import.meta.url), "--demo-child"] };
    } else if (a === "-h" || a === "--help") {
      process.stdout.write(HELP);
      process.exit(0);
    } else if (a === "-v" || a === "--version") {
      process.stdout.write("catsit 0.1.0\n");
      process.exit(0);
    } else break;
  }
  if (i >= argv.length) return null;
  return { flags, cmd: argv[i]!, args: argv.slice(i + 1) };
}

if (process.argv[2] === "--demo-child") {
  await runDemoAgent();
}

const parsed = parseArgs(process.argv.slice(2));
if (!parsed) {
  process.stdout.write(HELP);
  process.exit(2);
}
const { flags, cmd, args } = parsed;

const cols = process.stdout.columns || 80;
const rows = process.stdout.rows || 24;

const debugLog = process.env["CATSIT_DEBUG"]
  ? (msg: string) => {
      try {
        fs.appendFileSync(process.env["CATSIT_DEBUG"]!, `${new Date().toISOString()} ${msg}\n`);
      } catch {
        /* ignore */
      }
    }
  : null;

const teePath = process.env["CATSIT_DEBUG_TEE"];
const compositor = new Compositor({
  cols,
  rows,
  write: (s) => {
    if (teePath) {
      try {
        fs.appendFileSync(teePath, s, "latin1");
      } catch {
        /* ignore */
      }
    }
    process.stdout.write(s);
  },
  onError: (err) => {
    debugLog?.(`COMPOSITOR DEGRADED: ${err instanceof Error ? err.stack : String(err)}`);
  },
  onAfterForward: () => detectSoon(),
});

const guard = new TerminalGuard((s) => process.stdout.write(s), {
  onAltScreen: () => compositor.screen.onAltScreen(),
});

const child = spawnChild(cmd, args, cols, rows);
guard.arm();

const sm = new StateMachine();
const detector = new ClaudeScreenDetector();
const gate = new InputGate(() => !flags.noSwallow && !flags.noCat && sm.gateClosed);

let animator: CatAnimator | null = null;
if (!flags.noCat) {
  const renderer = new SpriteRenderer(detectRenderMode());
  animator = new CatAnimator({
    compositor,
    mirror: compositor.screen,
    renderer,
    bell: () => {
      if (!flags.quiet) process.stdout.write("\x07");
    },
  });
  sm.onChange((next) => animator!.onState(next));
  animator.start();
}

// Screen detection runs only on SETTLED screens: a redraw burst can leave
// half-drawn frames in the mirror, and detecting on those oscillates the
// state. After each forward we wait for an 80ms quiet window; a slow tick
// advances the idle debounce when the app goes fully quiet.
const SETTLE_MS = 80;
let lastForwardAt = 0;
let settleTimer: NodeJS.Timeout | null = null;
function runDetect(): void {
  sm.updateFromScreen(detector.detect(compositor.screen));
}
function detectSoon(): void {
  lastForwardAt = Date.now();
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(runDetect, SETTLE_MS);
  settleTimer.unref?.();
}
const idleTick = setInterval(() => {
  if (Date.now() - lastForwardAt < SETTLE_MS) return;
  runDetect();
}, 400);
idleTick.unref?.();

// transcript tail (zero-config; silently inert for non-claude commands)
const transcript = new TranscriptWatcher({ cwd: process.cwd() });
transcript.onEvent((ev) => sm.updateFromTranscript(ev));
transcript.start();

child.onData((d) => compositor.feed(Buffer.from(d, "utf8")));
child.onExit((code) => {
  sm.onChildExit(code);
  transcript.stop();
  animator?.stop();
  void compositor.flush().then(() => {
    guard.restore(false);
    compositor.dispose();
    process.exit(code);
  });
});

if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on("data", (d: Buffer) => {
  const r = gate.process(d);
  if (r.pass) child.write(r.pass);
  if (r.shooRequested) sm.shoo();
  if (r.pasteSwallowed) animator?.onPaste();
  else if (r.swallowed > 0) animator?.onSwallow();
});
process.stdin.resume();

process.stdout.on("resize", () => {
  const c = process.stdout.columns || 80;
  const r = process.stdout.rows || 24;
  child.resize(c, r);
  compositor.resize(c, r);
});
