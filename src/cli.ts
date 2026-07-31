#!/usr/bin/env node
// catsit — a cat that babysits your AI agent so you don't have to.
//
// While the agent works, a cat sits on your terminal and swallows your
// typing. The moment you're needed — permission prompt, question, done,
// error — the cat gets up, meows, and steps aside.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./args.js";
import { Compositor } from "./compositor.js";
import { runDemoAgent } from "./demo.js";
import { ClaudeScreenDetector } from "./detect/screen.js";
import { TranscriptWatcher } from "./detect/transcript.js";
import { InputGate } from "./input.js";
import { CatAnimator } from "./overlay/cat.js";
import { detectRenderMode, SpriteRenderer } from "./overlay/render.js";
import { spawnChild, type Child } from "./pty.js";
import { TerminalGuard } from "./restore.js";
import { StateMachine } from "./state.js";

const HELP = `catsit — a cat that babysits your AI agent so you don't have to.

While the agent works, a cat sits on your terminal. If the cat is loafing,
nothing needs you. The moment you're needed — permission prompt, question,
done — the cat gets up, meows, and steps aside.

By default the cat NEVER touches your input: typing, message queueing and
steering all work exactly as without catsit.

Usage:
  catsit <command> [args...]     e.g.  catsit claude
  catsit -- <command> [args...]
  catsit --demo                  try it with a bundled fake agent (no tokens)

Flags (before the command):
  --guard        gatekeeper mode: while the agent works, the cat swallows
                 your typing (shows what it ate; ctrl+g shoos it).
                 Control keys always pass through instantly.
  --no-cat       no overlay at all (plain transparent wrapper)
  --quiet        no bell when the cat gets up
  -h, --help     show this help
  -v, --version  show version
`;

if (process.argv[2] === "--demo-child") {
  await runDemoAgent();
}

/** Resolve the command like a shell would, so typos fail loudly (exit 127). */
function resolveCommand(cmd: string): string | null {
  const check = (p: string): boolean => {
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  };
  if (cmd.includes("/")) return check(cmd) ? cmd : null;
  for (const dir of (process.env["PATH"] ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const p = path.join(dir, cmd);
    if (check(p)) return p;
  }
  return null;
}

const parsed = parseArgs(process.argv.slice(2));
if (parsed.kind === "help") {
  process.stdout.write(HELP);
  process.exit(process.argv.length > 2 ? 0 : 2);
}
if (parsed.kind === "version") {
  process.stdout.write("catsit 0.4.4\n");
  process.exit(0);
}
if (parsed.kind === "error") {
  process.stderr.write(parsed.message + "\n");
  if (parsed.hint) process.stderr.write(parsed.hint + "\n");
  process.exit(2);
}

const flags = parsed.flags;
const { cmd, args } =
  parsed.kind === "demo"
    ? { cmd: process.execPath, args: [fileURLToPath(import.meta.url), "--demo-child"] }
    : parsed;

const resolved = resolveCommand(cmd);
if (!resolved) {
  process.stderr.write(`catsit: command not found: ${cmd}\n`);
  process.exit(127);
}


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

let child: Child;
try {
  child = await spawnChild(resolved, args, cols, rows);
} catch (err) {
  process.stderr.write(
    "catsit: could not load the terminal driver (@lydell/node-pty).\n" +
      "No native prebuild for this platform — on Alpine/musl try:\n" +
      "  npm_config_build_from_source=1 npx catsit ...\n" +
      `(${err instanceof Error ? err.message : String(err)})\n`,
  );
  process.exit(1);
}
guard.arm();

const sm = new StateMachine();
const detector = new ClaudeScreenDetector();
// Guard only gates while the cat is actually on screen: during the appear
// delay (short turns) nothing is ever swallowed invisibly.
const gate = new InputGate(() => flags.guard && !flags.noCat && sm.gateClosed && (animator?.isVisible ?? false));
if (debugLog) {
  sm.onChange((n, p) =>
    debugLog(`state ${p.kind}${"reason" in p ? ":" + (p as { reason: string }).reason : ""} -> ${n.kind}${"reason" in n ? ":" + (n as { reason: string }).reason : ""}`),
  );
}

let animator: CatAnimator | null = null;
if (!flags.noCat) {
  const renderer = new SpriteRenderer(detectRenderMode(), debugLog ?? undefined);
  animator = new CatAnimator({
    compositor,
    mirror: compositor.screen,
    renderer,
    bell: () => {
      if (!flags.quiet) process.stdout.write("\x07");
    },
    log: debugLog ?? undefined,
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
let lastScreenState = "";
function runDetect(): void {
  const s = detector.detect(compositor.screen);
  if (debugLog && s !== lastScreenState) {
    debugLog(`screen ${lastScreenState || "(start)"} -> ${s}`);
    lastScreenState = s;
  }
  sm.updateFromScreen(s);
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
  animator?.onUserActivity(); // any keystroke (or mouse report) wakes a napping cat
  const r = gate.process(d);
  if (r.pass) child.write(r.pass);
  if (r.shooRequested) sm.shoo();
  if (r.pasteSwallowed) animator?.onPaste();
  else if (r.swallowed > 0) animator?.onSwallow(r.swallowedText);
});
process.stdin.resume();

process.stdout.on("resize", () => {
  const c = process.stdout.columns || 80;
  const r = process.stdout.rows || 24;
  child.resize(c, r);
  compositor.resize(c, r);
});
