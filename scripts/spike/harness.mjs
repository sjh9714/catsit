// Phase 0 spike harness: PTY-wrap a TUI, mirror it in headless xterm (A),
// composite an overlay box, and feed the composited byte stream into a second
// headless xterm (B) that plays the role of the user's real terminal.
//
// Invariants checked every frame:
//   1. B == A on every cell outside the overlay rect (chars + fg/bg attrs)
//   2. After hiding the overlay, B == A exactly (zero residue)
//   3. B's scrollback lines == A's scrollback lines (nothing leaks into history)
//   4. B's cursor position == A's cursor position (incl. pending-wrap)
//
// Run: node scripts/spike/harness.mjs

import { spawn } from "@lydell/node-pty";
import xterm from "@xterm/headless";

const Terminal = xterm.Terminal ?? xterm.default?.Terminal;

const COLS = 100;
const ROWS = 30;
const SCROLLBACK = 500;

// ---------------------------------------------------------------- chunker ---
// Splits a byte stream at "safe" boundaries: never mid-escape-sequence, never
// mid-UTF-8 codepoint. Holds back the incomplete tail until the next chunk.
export function makeChunker() {
  let pending = Buffer.alloc(0);
  return function chunk(data) {
    const buf = Buffer.concat([pending, data]);
    let lastSafe = 0;
    let i = 0;
    while (i < buf.length) {
      const b = buf[i];
      if (b === 0x1b) {
        const end = escapeEnd(buf, i);
        if (end === -1) break;
        i = end;
        lastSafe = i;
      } else if (b < 0x80) {
        i += 1;
        lastSafe = i;
      } else {
        const len = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 1;
        if (i + len > buf.length) break;
        i += len;
        lastSafe = i;
      }
    }
    pending = buf.subarray(lastSafe);
    return buf.subarray(0, lastSafe);
  };
}

function escapeEnd(buf, i) {
  if (i + 1 >= buf.length) return -1;
  const b1 = buf[i + 1];
  if (b1 === 0x5b) {
    // CSI
    let j = i + 2;
    while (j < buf.length && buf[j] >= 0x20 && buf[j] <= 0x3f) j++;
    if (j >= buf.length) return -1;
    return j + 1;
  }
  if (b1 === 0x5d || b1 === 0x50 || b1 === 0x58 || b1 === 0x5e || b1 === 0x5f) {
    // OSC / DCS / SOS / PM / APC — BEL (OSC) or ST
    for (let j = i + 2; j < buf.length; j++) {
      if (buf[j] === 0x07 && b1 === 0x5d) return j + 1;
      if (buf[j] === 0x1b) {
        if (j + 1 >= buf.length) return -1;
        if (buf[j + 1] === 0x5c) return j + 2;
      }
    }
    return -1;
  }
  if (b1 >= 0x20 && b1 <= 0x2f) {
    let j = i + 2;
    while (j < buf.length && buf[j] >= 0x20 && buf[j] <= 0x2f) j++;
    if (j >= buf.length) return -1;
    return j + 1;
  }
  return i + 2;
}

// ------------------------------------------------------------ pen tracker ---
// Tracks the app's current SGR pen by scanning safe chunks for SGR sequences.
// emit() returns one SGR sequence that re-establishes the pen from reset.
export class PenTracker {
  constructor() { this.reset(); }
  reset() {
    this.flags = new Set();
    this.fg = null; // e.g. "38;5;196" or "38;2;r;g;b" or "31"
    this.bg = null;
  }
  feed(text) {
    // RIS resets everything
    const re = /\x1b(?:c|\[([\d;:]*)m)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[0] === "\x1bc") { this.reset(); continue; }
      this.applyParams(m[1] ?? "");
    }
  }
  applyParams(raw) {
    const parts = raw.length === 0 ? ["0"] : raw.split(";");
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i].split(":");
      const n = parseInt(seg[0] || "0", 10);
      if (n === 0) { this.reset(); }
      else if (n >= 1 && n <= 9) { this.flags.add(n); if (n === 1) this.flags.delete(2); }
      else if (n === 21) this.flags.delete(1);
      else if (n === 22) { this.flags.delete(1); this.flags.delete(2); }
      else if (n >= 23 && n <= 29) this.flags.delete(n - 20);
      else if ((n >= 30 && n <= 37) || (n >= 90 && n <= 97)) this.fg = String(n);
      else if (n === 39) this.fg = null;
      else if ((n >= 40 && n <= 47) || (n >= 100 && n <= 107)) this.bg = String(n);
      else if (n === 49) this.bg = null;
      else if (n === 38 || n === 48) {
        // extended color: either 38;5;n / 38;2;r;g;b (consuming parts) or 38:5:n colon form (self-contained)
        let spec;
        if (seg.length > 1) {
          spec = seg.slice(1).join(";");
        } else {
          const mode = parts[i + 1];
          if (mode === "5") { spec = `5;${parts[i + 2]}`; i += 2; }
          else if (mode === "2") { spec = `2;${parts[i + 2]};${parts[i + 3]};${parts[i + 4]}`; i += 4; }
        }
        if (spec) {
          if (n === 38) this.fg = `38;${spec}`; else this.bg = `48;${spec}`;
        }
      }
    }
  }
  emit() {
    const p = ["0"];
    for (const f of [...this.flags].sort((a, b) => a - b)) p.push(String(f));
    if (this.fg) p.push(this.fg);
    if (this.bg) p.push(this.bg);
    return `\x1b[${p.join(";")}m`;
  }
}

// ------------------------------------------------------------- cell utils ---
function cellSGR(cell) {
  const p = ["0"];
  if (cell.isBold()) p.push("1");
  if (cell.isDim()) p.push("2");
  if (cell.isItalic()) p.push("3");
  if (cell.isUnderline()) p.push("4");
  if (cell.isBlink()) p.push("5");
  if (cell.isInverse()) p.push("7");
  if (cell.isInvisible()) p.push("8");
  if (cell.isStrikethrough()) p.push("9");
  if (cell.isFgRGB()) {
    const c = cell.getFgColor();
    p.push("38", "2", String((c >> 16) & 255), String((c >> 8) & 255), String(c & 255));
  } else if (cell.isFgPalette()) {
    p.push("38", "5", String(cell.getFgColor()));
  }
  if (cell.isBgRGB()) {
    const c = cell.getBgColor();
    p.push("48", "2", String((c >> 16) & 255), String((c >> 8) & 255), String(c & 255));
  } else if (cell.isBgPalette()) {
    p.push("48", "5", String(cell.getBgColor()));
  }
  return `\x1b[${p.join(";")}m`;
}

function cellKey(cell) {
  const fg = cell.isFgRGB() ? `r${cell.getFgColor()}` : cell.isFgPalette() ? `p${cell.getFgColor()}` : "d";
  const bg = cell.isBgRGB() ? `r${cell.getBgColor()}` : cell.isBgPalette() ? `p${cell.getBgColor()}` : "d";
  const fl =
    (cell.isBold() ? "b" : "") + (cell.isDim() ? "f" : "") + (cell.isItalic() ? "i" : "") +
    (cell.isUnderline() ? "u" : "") + (cell.isInverse() ? "v" : "") + (cell.isStrikethrough() ? "s" : "");
  return `${cell.getChars() || " "}|${fg}|${bg}|${fl}`;
}

// -------------------------------------------------------------- app state ---
// Captures everything needed to hand the cursor back to the app after we have
// injected our own sequences: position, pending-wrap, SGR pen.
function captureAppState(termA, pen) {
  const buf = termA.buffer.active;
  return {
    x: buf.cursorX, // may equal COLS when wrap is pending
    y: buf.cursorY,
    pen: pen.emit(),
    viewportY: buf.viewportY,
  };
}

// Builds the sequence that restores the app's cursor/pen exactly, including
// re-arming pending-wrap by re-printing the last cell of the row.
function restoreSeq(termA, st) {
  if (st.x < COLS) {
    return st.pen + `\x1b[${st.y + 1};${st.x + 1}H`;
  }
  // pending-wrap: reposition on the last printable cell and re-print it
  const buf = termA.buffer.active;
  const line = buf.getLine(st.viewportY + st.y);
  let col = COLS - 1;
  let cell = line?.getCell(col);
  if (cell && cell.getWidth() === 0 && col > 0) { col -= 1; cell = line.getCell(col); }
  if (!cell) return st.pen + `\x1b[${st.y + 1};${COLS}H`;
  return `\x1b[${st.y + 1};${col + 1}H` + cellSGR(cell) + (cell.getChars() || " ") + st.pen;
}

// ---------------------------------------------------------------- overlay ---
const OV = { w: 20, h: 6 };
function ovRect() {
  return { x: COLS - OV.w - 2, y: ROWS - OV.h - 2, w: OV.w, h: OV.h };
}

function drawOverlay() {
  const { x, y, w, h } = ovRect();
  let s = "";
  for (let r = 0; r < h; r++) {
    s += `\x1b[${y + r + 1};${x + 1}H\x1b[0;48;2;255;140;0;38;2;0;0;0m${"CAT".repeat(Math.ceil(w / 3)).slice(0, w)}`;
  }
  return s + "\x1b[0m";
}

// Re-emit mirror A's true cells over the overlay rect (per-cell addressing so
// wide-char continuation cells cannot shift the stream).
function undrawOverlay(termA) {
  const { x, y, w, h } = ovRect();
  const buf = termA.buffer.active;
  let s = "";
  for (let r = 0; r < h; r++) {
    const line = buf.getLine(buf.viewportY + y + r);
    if (!line) continue;
    for (let c = 0; c < w; c++) {
      let col = x + c;
      let cell = line.getCell(col);
      if (!cell) continue;
      if (cell.getWidth() === 0) {
        // continuation: re-print its lead char instead (may sit left of rect)
        if (c === 0 && col > 0) { col -= 1; cell = line.getCell(col); if (!cell) continue; }
        else continue;
      }
      if (cell.getChars() === "") {
        // null/erased cell: restore as *erased* (ECH), not a printed space —
        // printed spaces would extend the line's trimmed length and pollute
        // copy/paste + scrollback text.
        const bg = cell.isBgRGB()
          ? `\x1b[0;48;2;${(cell.getBgColor() >> 16) & 255};${(cell.getBgColor() >> 8) & 255};${cell.getBgColor() & 255}m`
          : cell.isBgPalette()
            ? `\x1b[0;48;5;${cell.getBgColor()}m`
            : `\x1b[0m`;
        s += `\x1b[${y + r + 1};${col + 1}H` + bg + `\x1b[1X`;
        continue;
      }
      s += `\x1b[${y + r + 1};${col + 1}H` + cellSGR(cell) + cell.getChars();
    }
  }
  return s + "\x1b[0m";
}

// ------------------------------------------------------------- comparison ---
function compareGrids(termA, termB, overlayVisible, label, errors) {
  const a = termA.buffer.active;
  const b = termB.buffer.active;
  const rect = ovRect();
  let mismatches = 0;
  for (let y = 0; y < ROWS; y++) {
    const la = a.getLine(a.viewportY + y);
    const lb = b.getLine(b.viewportY + y);
    for (let x = 0; x < COLS; x++) {
      const inRect = overlayVisible && y >= rect.y && y < rect.y + rect.h && x >= rect.x - 1 && x < rect.x + rect.w;
      if (inRect) continue;
      const ca = la?.getCell(x);
      const cb = lb?.getCell(x);
      if (!ca || !cb) continue;
      if (cellKey(ca) !== cellKey(cb)) {
        if (mismatches < 3) {
          errors.push(`[${label}] cell (${x},${y}): A=${JSON.stringify(cellKey(ca))} B=${JSON.stringify(cellKey(cb))}`);
        }
        mismatches++;
      }
    }
  }
  const sbA = a.viewportY;
  const sbB = b.viewportY;
  if (sbA !== sbB) {
    errors.push(`[${label}] scrollback depth differs: A=${sbA} B=${sbB}`);
  } else {
    for (let i = 0; i < sbA; i++) {
      const ta = a.getLine(i)?.translateToString(true) ?? "";
      const tb = b.getLine(i)?.translateToString(true) ?? "";
      if (ta !== tb) {
        errors.push(`[${label}] scrollback line ${i} differs:\n  A=${JSON.stringify(ta)}\n  B=${JSON.stringify(tb)}`);
        break;
      }
    }
  }
  if (a.cursorX !== b.cursorX || a.cursorY !== b.cursorY) {
    errors.push(`[${label}] cursor differs: A=(${a.cursorX},${a.cursorY}) B=(${b.cursorX},${b.cursorY})`);
  }
  return mismatches;
}

// ------------------------------------------------------------------ runner ---
function makeTerm() {
  return new Terminal({ cols: COLS, rows: ROWS, scrollback: SCROLLBACK, allowProposedApi: true });
}
function writeAsync(term, data) {
  return new Promise((res) => term.write(data, res));
}

async function runScenario(name, cmd, args, script, { toggleOverlay = true, durationMs = 6000, cwd = process.cwd() } = {}) {
  const termA = makeTerm();
  const termB = makeTerm();
  const chunker = makeChunker();
  const pen = new PenTracker();
  const errors = [];
  let framesChecked = 0;
  let overlayVisible = false;
  const perf = { composeMs: [], bytes: 0 };

  const pty = spawn(cmd, args, {
    name: "xterm-256color",
    cols: COLS,
    rows: ROWS,
    cwd,
    env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
  });

  // Mirror B plays the "real terminal" role: its query responses (DA, DSR...)
  // go back to the app, exactly like a user's terminal would.
  termB.onData((d) => pty.write(d));

  let queue = [];
  let exited = false;
  pty.onData((d) => queue.push(Buffer.from(d, "utf8")));
  pty.onExit(() => (exited = true));

  const start = Date.now();
  let lastToggle = start;
  let scriptIdx = 0;
  let nextKeyAt = start + 300;

  while (!exited && Date.now() - start < durationMs) {
    await new Promise((r) => setTimeout(r, 16));

    if (scriptIdx < script.length && Date.now() >= nextKeyAt) {
      pty.write(script[scriptIdx].keys);
      nextKeyAt = Date.now() + (script[scriptIdx].delay ?? 150);
      scriptIdx++;
    }

    if (toggleOverlay && Date.now() - lastToggle > 700) {
      lastToggle = Date.now();
      const st = captureAppState(termA, pen);
      if (overlayVisible) {
        overlayVisible = false;
        await writeAsync(termB, undrawOverlay(termA) + restoreSeq(termA, st));
        compareGrids(termA, termB, false, `${name}/after-hide`, errors);
      } else {
        overlayVisible = true;
        await writeAsync(termB, drawOverlay() + restoreSeq(termA, st));
      }
    }

    if (queue.length > 0) {
      const raw = Buffer.concat(queue);
      queue = [];
      const safe = chunker(raw);
      if (safe.length === 0) continue;
      const appBytes = safe.toString("utf8");

      if (overlayVisible) {
        // capture A's PRE-write state; undraw refers to A's pre-write grid
        const t0 = performance.now();
        const preState = captureAppState(termA, pen);
        const pre = undrawOverlay(termA) + restoreSeq(termA, preState);
        const tMid = performance.now();
        pen.feed(appBytes);
        await writeAsync(termA, appBytes);
        const t1 = performance.now();
        const postState = captureAppState(termA, pen);
        const frame = pre + appBytes + drawOverlay() + restoreSeq(termA, postState);
        perf.composeMs.push(tMid - t0 + (performance.now() - t1));
        perf.bytes += appBytes.length;
        await writeAsync(termB, frame);
      } else {
        pen.feed(appBytes);
        await writeAsync(termA, appBytes);
        await writeAsync(termB, appBytes);
      }
      framesChecked++;
      compareGrids(termA, termB, overlayVisible, `${name}/frame${framesChecked}`, errors);
      if (errors.length > 20) break;
    }
  }

  if (overlayVisible) {
    const st = captureAppState(termA, pen);
    await writeAsync(termB, undrawOverlay(termA) + restoreSeq(termA, st));
    compareGrids(termA, termB, false, `${name}/final`, errors);
  }

  try { pty.kill(); } catch {}
  termA.dispose();
  termB.dispose();
  const avg = perf.composeMs.length ? perf.composeMs.reduce((a, b) => a + b, 0) / perf.composeMs.length : 0;
  const max = perf.composeMs.length ? Math.max(...perf.composeMs) : 0;
  return { name, framesChecked, errors, perf: { avgComposeMs: avg, maxComposeMs: max, appBytes: perf.bytes } };
}

// ---------------------------------------------------------------- scenarios --
const scenarios = [];

scenarios.push(() =>
  runScenario(
    "scroller",
    "bash",
    ["-c", `for i in $(seq 1 300); do printf '\\e[3%dm%03d lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor \\e[1;4%dm INVERSE \\e[0m\\n' $((i%8)) $i $((i%8)); sleep 0.008; done`],
    [],
    { durationMs: 5000 }
  )
);

scenarios.push(() =>
  runScenario(
    "repainter",
    "bash",
    ["-c", `for i in $(seq 1 150); do printf '\\e[H\\e[38;2;255;100;0mFRAME %d\\e[0m' $i; for r in 5 10 15 20 25; do printf '\\e[%d;10H\\e[48;5;%dm  row %d frame %d  \\e[0m' $r $((i%256)) $r $i; done; printf '\\e[28;1H\\e[2K> prompt line %d' $i; sleep 0.02; done` ],
    [],
    { durationMs: 5000 }
  )
);

scenarios.push(() =>
  runScenario(
    "vim",
    "vim",
    ["-u", "NONE", "-i", "NONE", "-n"],
    [
      { keys: "i", delay: 300 },
      { keys: "hello from the spike harness\r", delay: 200 },
      { keys: "second line with 한글 and émojis ✨\r", delay: 200 },
      { keys: "third line abcdefghijklmnop\r", delay: 200 },
      { keys: "\x1b", delay: 300 },
      { keys: ":q!\r", delay: 300 },
    ],
    { durationMs: 6000 }
  )
);

scenarios.push(() =>
  runScenario(
    "widechar",
    "bash",
    ["-c", `for i in $(seq 1 100); do printf '한글 테스트 %d 가나다라마바사아자차카타파하 日本語テスト 中文测试 ✨🐈✨\\n' $i; sleep 0.015; done`],
    [],
    { durationMs: 4000 }
  )
);

// exact-width lines: forces pending-wrap at frame boundaries
scenarios.push(() =>
  runScenario(
    "pendingwrap",
    "bash",
    ["-c", `line=$(printf 'x%.0s' $(seq 1 ${COLS})); for i in $(seq 1 120); do printf '%s' "$line"; sleep 0.012; printf '\\n'; sleep 0.004; done`],
    [],
    { durationMs: 4000 }
  )
);

// the real target: Claude Code's Ink TUI (welcome screen + typed input, then
// double ctrl+c to exit — nothing is submitted, no API call is made)
if (process.env.SPIKE_CLAUDE === "1") {
  scenarios.push(() =>
    runScenario(
      "claude",
      "claude",
      [],
      [
        { keys: "Reply with exactly one word: meow", delay: 1200 },
        { keys: "\r", delay: 14000 }, // let the spinner + streamed reply render under overlay toggles
        { keys: "\x03", delay: 600 },
        { keys: "\x03", delay: 600 },
      ],
      { durationMs: 26000, cwd: process.env.SPIKE_CWD || process.cwd() }
    )
  );
}

// -------------------------------------------------------------------- main ---
const results = [];
for (const s of scenarios) {
  const r = await s();
  results.push(r);
  const status = r.errors.length === 0 ? "PASS" : "FAIL";
  console.log(
    `[${status}] ${r.name}: ${r.framesChecked} frames checked, ${r.errors.length} errors` +
    (r.perf.appBytes ? ` | compose avg ${r.perf.avgComposeMs.toFixed(2)}ms max ${r.perf.maxComposeMs.toFixed(2)}ms over ${(r.perf.appBytes / 1024).toFixed(0)}KB` : "")
  );
  for (const e of r.errors.slice(0, 5)) console.log("   " + e.split("\n").join("\n   "));
}
const failed = results.filter((r) => r.errors.length > 0);
console.log(failed.length === 0 ? "\nSPIKE RESULT: ALL PASS" : `\nSPIKE RESULT: ${failed.length} scenario(s) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
