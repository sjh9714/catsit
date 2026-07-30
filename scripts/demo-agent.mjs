// Fake Claude-Code-like TUI for demos and manual testing: cycles through
// idle → busy (spinner) → permission prompt → busy → done, forever.
// catsit's screen detector reacts to it exactly like the real thing.

const w = (s) => process.stdout.write(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ROWS = process.stdout.rows || 24;
const SPINNERS = "✻✽✶✻✽✶";
const VERBS = ["Simmering", "Brewing", "Percolating", "Reticulating", "Pondering"];

// Layout mirrors the real Claude Code TUI: any spinner/status line sits
// IMMEDIATELY above the prompt box (the detector only trusts that block).
// Bottom block is placed by absolute addressing so busy() can patch the
// status row in place.
const STATUS_ROW = ROWS - 4;
function frame(lines, status = "") {
  w("\x1b[2J\x1b[H");
  w("  \x1b[1m✳ demo-agent\x1b[0m — pretend Claude for catsit demos\n\n");
  for (const l of lines) w("  " + l + "\n");
  if (status) w(`\x1b[${STATUS_ROW};1H  ` + status);
  w(`\x1b[${ROWS - 3};1H  ─────────────────────────────────────────────`);
  w(`\x1b[${ROWS - 2};1H  ❯ `);
  w(`\x1b[${ROWS - 1};1H  ─────────────────────────────────────────────`);
  w(`\x1b[${ROWS};1H    ? for shortcuts`);
}

async function busy(seconds, label) {
  const start = Date.now();
  let i = 0;
  const spinnerLine = (n, s) =>
    `\x1b[38;5;208m${SPINNERS[n % SPINNERS.length]}\x1b[0m ${VERBS[n % VERBS.length]}… \x1b[2m(esc to interrupt · ${s}s · ↓ ${(1.2 + s * 0.4).toFixed(1)}k tokens)\x1b[0m`;
  frame([`\x1b[2m${label}\x1b[0m`], spinnerLine(0, 0));
  while (Date.now() - start < seconds * 1000) {
    const s = Math.floor((Date.now() - start) / 1000);
    // like the real Ink TUI: patch only the changed line, no full clears
    w(`\x1b[${STATUS_ROW};1H\x1b[2K  ` + spinnerLine(i, s));
    i++;
    await sleep(400);
  }
}

async function permission() {
  frame([
    "\x1b[1mBash command\x1b[0m",
    "",
    "  npm test",
    "",
    "Do you want to proceed?",
    "\x1b[36m❯ 1. Yes\x1b[0m",
    "  2. Yes, and don't ask again for npm test",
    "  3. No, and tell Claude what to do differently",
  ]);
  await sleep(8000);
}

async function idle(seconds, note) {
  frame([note]);
  await sleep(seconds * 1000);
}

for (;;) {
  await idle(3, "\x1b[2midle — type something; nothing is being guarded yet\x1b[0m");
  await busy(20, "refactoring src/auth.ts — the cat should walk in and sit");
  await permission();
  await busy(10, "running the tests you approved");
  await idle(5, "⏺ Done! All tests pass. (cat should have left)");
}
