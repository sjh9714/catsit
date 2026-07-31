// Built-in fake agent for `catsit --demo`: cycles idle → busy (spinner) →
// permission prompt → busy → done, forever. No account, no tokens — the
// screen detector reacts to it exactly like the real thing. Used for the
// README recording and for trying catsit without an agent.

const w = (s: string): boolean => process.stdout.write(s);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const ROWS = process.stdout.rows || 24;
const STATUS_ROW = ROWS - 4;
const SPINNERS = "✻✽✶";
const VERBS = ["Simmering", "Brewing", "Percolating", "Reticulating", "Pondering"];

function frame(lines: string[], status = ""): void {
  w("\x1b[2J\x1b[H");
  w("  \x1b[1m✳ demo-agent\x1b[0m — pretend Claude for catsit demos\n\n");
  for (const l of lines) w("  " + l + "\n");
  if (status) w(`\x1b[${STATUS_ROW};1H  ` + status);
  w(`\x1b[${ROWS - 3};1H  ─────────────────────────────────────────────`);
  w(`\x1b[${ROWS - 2};1H  ❯ `);
  w(`\x1b[${ROWS - 1};1H  ─────────────────────────────────────────────`);
  w(`\x1b[${ROWS};1H    ? for shortcuts`);
}

async function busy(seconds: number, label: string): Promise<void> {
  const start = Date.now();
  let i = 0;
  const spinnerLine = (n: number, s: number) =>
    `\x1b[38;5;208m${SPINNERS[n % SPINNERS.length]}\x1b[0m ${VERBS[n % VERBS.length]}… \x1b[2m(esc to interrupt · ${s}s · ↓ ${(1.2 + s * 0.4).toFixed(1)}k tokens)\x1b[0m`;
  frame([`\x1b[2m${label}\x1b[0m`], spinnerLine(0, 0));
  while (Date.now() - start < seconds * 1000) {
    const s = Math.floor((Date.now() - start) / 1000);
    w(`\x1b[${STATUS_ROW};1H\x1b[2K  ` + spinnerLine(i, s));
    i++;
    await sleep(400);
  }
}

async function permission(seconds: number): Promise<void> {
  // like the real Claude Code, the permission prompt renders just above the
  // input box — the detector only trusts the bottom of the screen
  frame([]);
  const lines = [
    "\x1b[1mBash command\x1b[0m",
    "",
    "  npm test",
    "",
    "Do you want to proceed?",
    "\x1b[36m❯ 1. Yes\x1b[0m",
    "  2. Yes, and don't ask again for npm test",
    "  3. No, and tell Claude what to do differently",
  ];
  lines.forEach((l, i) => w(`\x1b[${ROWS - 4 - lines.length + i};1H  ` + l));
  await sleep(seconds * 1000);
}

async function idle(seconds: number, note: string): Promise<void> {
  frame([note]);
  await sleep(seconds * 1000);
}

export async function runDemoAgent(): Promise<never> {
  for (;;) {
    await idle(2, "\x1b[2midle — the cat only guards while the agent works\x1b[0m");
    await busy(20, "refactoring src/auth.ts — guard mode: try typing, the cat swallows it");
    // long enough for the whole meow gesture: wake, rear up, cry, sit back —
    // the "yes" lands right as the cat settles
    await permission(13);
    await busy(6, "running the tests you approved");
    // long enough for the cat's full goodbye: stand up, walk off
    await idle(12, "⏺ Done! All tests pass.");
  }
}
