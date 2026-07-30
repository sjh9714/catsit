import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Mirror } from "../src/mirror.js";
import { ClaudeScreenDetector, IDLE_DEBOUNCE_MS } from "../src/detect/screen.js";
import { TranscriptWatcher, projectSlug, type TranscriptEvent } from "../src/detect/transcript.js";
import { StateMachine } from "../src/state.js";

const COLS = 80;
const ROWS = 24;

let mirror: Mirror;

beforeEach(() => {
  mirror = new Mirror(COLS, ROWS);
});
afterEach(() => {
  mirror.dispose();
});

async function screen(...lines: string[]): Promise<void> {
  await mirror.feed("\x1b[2J\x1b[H" + lines.join("\r\n"));
}

const PROMPT_BOX = ["────────────────────────────", "❯ ", "────────────────────────────", "  ? for shortcuts"];

describe("ClaudeScreenDetector", () => {
  it("detects busy from esc-to-interrupt line", async () => {
    await screen("✻ Simmering… (esc to interrupt · 32s · ↓ 2.1k tokens)", "", ...PROMPT_BOX);
    expect(new ClaudeScreenDetector().detect(mirror)).toBe("busy");
  });

  it("detects busy from spinner activity label alone", async () => {
    await screen("✽ Tempering…", "", ...PROMPT_BOX);
    expect(new ClaudeScreenDetector().detect(mirror)).toBe("busy");
  });

  it("detects busy from token stats line", async () => {
    await screen("(9m 21s · ↓ 13.7k tokens)", "", ...PROMPT_BOX);
    expect(new ClaudeScreenDetector().detect(mirror)).toBe("busy");
  });

  it("detects permission prompts immediately", async () => {
    await screen(
      "  Bash command: rm -rf node_modules",
      "",
      "  Do you want to proceed?",
      "  ❯ 1. Yes",
      "    2. Yes, and don't ask again for rm commands",
      "    3. No, and tell Claude what to do differently",
    );
    expect(new ClaudeScreenDetector().detect(mirror)).toBe("waiting_input");
  });

  it("detects AskUserQuestion-style prompts", async () => {
    await screen("  Would you like to continue?", "", "  ❯ Option A", "    Option B", "", "  esc to cancel");
    expect(new ClaudeScreenDetector().detect(mirror)).toBe("waiting_input");
  });

  it("idle requires the debounce to elapse", async () => {
    const d = new ClaudeScreenDetector();
    await screen("⏺ Done. All tests pass.", "", ...PROMPT_BOX);
    const t0 = 1_000_000;
    expect(d.detect(mirror, t0)).toBe("unknown"); // not stable yet
    expect(d.detect(mirror, t0 + IDLE_DEBOUNCE_MS + 1)).toBe("idle");
  });

  it("screen changes reset the idle debounce", async () => {
    const d = new ClaudeScreenDetector();
    const t0 = 1_000_000;
    await screen("⏺ working on it", "", ...PROMPT_BOX);
    d.detect(mirror, t0);
    await screen("⏺ now something else", "", ...PROMPT_BOX);
    expect(d.detect(mirror, t0 + IDLE_DEBOUNCE_MS + 1)).toBe("unknown"); // changed at +debounce → not stable
    expect(d.detect(mirror, t0 + 2 * (IDLE_DEBOUNCE_MS + 1))).toBe("idle");
  });

  it("busy detection ignores stale fragments below prompt box", async () => {
    // stale "esc to interrupt" remnants BELOW the box must not read as busy
    await screen("⏺ finished reply text", "", ...PROMPT_BOX, "esc to interrupt");
    const d = new ClaudeScreenDetector();
    const t0 = 5_000_000;
    d.detect(mirror, t0);
    expect(d.detect(mirror, t0 + IDLE_DEBOUNCE_MS + 1)).toBe("idle");
  });
});

describe("projectSlug", () => {
  it("encodes cwd like Claude Code does", () => {
    expect(projectSlug("/Users/sungjh/orca/projects/star3")).toBe("-Users-sungjh-orca-projects-star3");
    expect(projectSlug("/home/a.b/c_d")).toBe("-home-a-b-c-d");
  });
});

describe("TranscriptWatcher", () => {
  let base: string;
  let events: TranscriptEvent[];

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), "catsit-test-"));
    events = [];
  });
  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  function setup(cwd = "/proj/x"): { w: TranscriptWatcher; file: string } {
    const dir = path.join(base, projectSlug(cwd));
    fs.mkdirSync(dir, { recursive: true });
    // the watcher starts BEFORE the wrapped agent creates its session file
    const w = new TranscriptWatcher({ cwd, baseDir: base });
    w.onEvent((e) => events.push(e));
    const file = path.join(dir, "11111111-2222-3333-4444-555555555555.jsonl");
    fs.writeFileSync(file, "");
    return { w, file };
  }

  it("emits turn_end on system.turn_duration", () => {
    const { w, file } = setup();
    w.pollOnce(); // discovers file
    fs.appendFileSync(file, JSON.stringify({ type: "system", subtype: "turn_duration", durationMs: 1234 }) + "\n");
    w.pollOnce();
    expect(events).toEqual([{ type: "turn_end", durationMs: 1234 }]);
  });

  it("emits activity for main-chain assistant events, ignores sidechains", () => {
    const { w, file } = setup();
    w.pollOnce();
    fs.appendFileSync(
      file,
      JSON.stringify({ type: "assistant", isSidechain: false, message: {} }) + "\n" +
        JSON.stringify({ type: "assistant", isSidechain: true, message: {} }) + "\n",
    );
    w.pollOnce();
    expect(events).toEqual([{ type: "activity" }]);
  });

  it("handles partial lines across polls", () => {
    const { w, file } = setup();
    w.pollOnce();
    const line = JSON.stringify({ type: "system", subtype: "turn_duration", durationMs: 5 }) + "\n";
    fs.appendFileSync(file, line.slice(0, 20));
    w.pollOnce();
    expect(events).toEqual([]);
    fs.appendFileSync(file, line.slice(20));
    w.pollOnce();
    expect(events).toEqual([{ type: "turn_end", durationMs: 5 }]);
  });

  it("ignores pre-existing session files, even ones still being written", () => {
    const cwd = "/proj/x";
    const dir = path.join(base, projectSlug(cwd));
    fs.mkdirSync(dir, { recursive: true });
    const other = path.join(dir, "other-live-session.jsonl");
    fs.writeFileSync(other, "");
    const w = new TranscriptWatcher({ cwd, baseDir: base });
    w.onEvent((e) => events.push(e));
    // the other session keeps writing after we started — must not be tracked
    fs.appendFileSync(other, JSON.stringify({ type: "system", subtype: "turn_duration", durationMs: 1 }) + "\n");
    w.pollOnce();
    w.pollOnce();
    expect(events).toEqual([]);
    // but OUR child's new session file is picked up
    const ours = path.join(dir, "new-session.jsonl");
    fs.writeFileSync(ours, JSON.stringify({ type: "system", subtype: "turn_duration", durationMs: 7 }) + "\n");
    w.pollOnce();
    expect(events).toEqual([{ type: "turn_end", durationMs: 7 }]);
  });
});

describe("StateMachine fusion", () => {
  it("gate is closed only while working", () => {
    const sm = new StateMachine();
    expect(sm.gateClosed).toBe(false); // unknown fails open
    sm.updateFromScreen("busy");
    expect(sm.gateClosed).toBe(true);
    sm.updateFromScreen("waiting_input");
    expect(sm.gateClosed).toBe(false);
    expect(sm.state).toEqual({ kind: "needs_human", reason: "permission" });
  });

  it("permission opens the gate even from working, immediately", () => {
    const sm = new StateMachine();
    sm.updateFromScreen("busy");
    const seen: string[] = [];
    sm.onChange((n) => seen.push(n.kind));
    sm.updateFromScreen("waiting_input");
    expect(sm.gateClosed).toBe(false);
    expect(seen).toEqual(["needs_human"]);
  });

  it("transcript turn_end ends working", () => {
    const sm = new StateMachine();
    sm.updateFromScreen("busy");
    sm.updateFromTranscript({ type: "turn_end", durationMs: 100 });
    expect(sm.state).toEqual({ kind: "needs_human", reason: "done" });
    expect(sm.gateClosed).toBe(false);
  });

  it("activity resumes working after done, but not during permission", () => {
    const sm = new StateMachine();
    sm.updateFromScreen("busy");
    sm.updateFromTranscript({ type: "turn_end", durationMs: 100 });
    sm.updateFromTranscript({ type: "activity" });
    expect(sm.state).toEqual({ kind: "working" });
    sm.updateFromScreen("waiting_input");
    sm.updateFromTranscript({ type: "activity" }); // late buffered event
    expect(sm.state).toEqual({ kind: "needs_human", reason: "permission" });
  });

  it("unknown screen keeps current belief", () => {
    const sm = new StateMachine();
    sm.updateFromScreen("busy");
    sm.updateFromScreen("unknown");
    expect(sm.gateClosed).toBe(true);
  });

  it("shoo is terminal and opens the gate", () => {
    const sm = new StateMachine();
    sm.updateFromScreen("busy");
    sm.shoo();
    expect(sm.gateClosed).toBe(false);
    sm.updateFromScreen("busy");
    expect(sm.state).toEqual({ kind: "shooed" });
  });

  it("child exit maps code to done/error", () => {
    const sm = new StateMachine();
    sm.onChildExit(0);
    expect(sm.state).toEqual({ kind: "needs_human", reason: "done" });
    const sm2 = new StateMachine();
    sm2.onChildExit(1);
    expect(sm2.state).toEqual({ kind: "needs_human", reason: "error" });
  });
});
