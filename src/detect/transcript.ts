// Live tail of the Claude Code session transcript (~/.claude/projects/...).
//
// The JSONL gives us the one structural, version-stable signal the screen
// cannot: `system.turn_duration`, written when a turn ends. Permission waits
// do NOT appear here — the screen detector owns those.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type TranscriptEvent =
  | { type: "turn_end"; durationMs: number }
  | { type: "activity" }; // assistant text / tool_use on the main chain

export interface TranscriptWatcherOptions {
  cwd: string;
  baseDir?: string; // default ~/.claude/projects (injectable for tests)
  pollMs?: number;
  spawnedAt?: number;
}

/** Claude Code encodes the project cwd by replacing '/', '.' and '_' with '-'. */
export function projectSlug(cwd: string): string {
  return cwd.replace(/[/._]/g, "-");
}

export class TranscriptWatcher {
  private dir: string;
  private file: string | null = null;
  private offset = 0;
  private carry = "";
  private timer: NodeJS.Timeout | null = null;
  private listeners: Array<(ev: TranscriptEvent) => void> = [];
  private spawnedAt: number;
  private pollMs: number;

  constructor(opts: TranscriptWatcherOptions) {
    const base = opts.baseDir ?? path.join(os.homedir(), ".claude", "projects");
    this.dir = path.join(base, projectSlug(opts.cwd));
    this.spawnedAt = opts.spawnedAt ?? Date.now();
    this.pollMs = opts.pollMs ?? 300;
  }

  onEvent(cb: (ev: TranscriptEvent) => void): void {
    this.listeners.push(cb);
  }

  start(): void {
    const tick = () => {
      try {
        this.pollOnce();
      } catch {
        /* transcript reading must never take the session down */
      }
    };
    this.timer = setInterval(tick, this.pollMs);
    this.timer.unref?.();
    tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One synchronous poll step (public so tests can drive it directly). */
  pollOnce(): void {
    if (!this.file) {
      this.file = this.findSessionFile();
      if (!this.file) return;
    }
    let stat: fs.Stats;
    try {
      stat = fs.statSync(this.file);
    } catch {
      this.file = null;
      return;
    }
    if (stat.size < this.offset) this.offset = 0; // rotated/truncated
    if (stat.size === this.offset) return;
    const fd = fs.openSync(this.file, "r");
    try {
      const buf = Buffer.alloc(stat.size - this.offset);
      fs.readSync(fd, buf, 0, buf.length, this.offset);
      this.offset = stat.size;
      this.consume(buf.toString("utf8"));
    } finally {
      fs.closeSync(fd);
    }
  }

  /** Newest .jsonl in the project dir touched after we spawned. */
  private findSessionFile(): string | null {
    let entries: string[];
    try {
      entries = fs.readdirSync(this.dir);
    } catch {
      return null;
    }
    let best: { file: string; mtime: number } | null = null;
    for (const e of entries) {
      if (!e.endsWith(".jsonl")) continue;
      const p = path.join(this.dir, e);
      try {
        const st = fs.statSync(p);
        // Only sessions CREATED after we spawned: another Claude session may
        // be live in the same cwd (mtime keeps moving) and must not be
        // mistaken for the one we wrapped.
        if (st.birthtimeMs >= this.spawnedAt - 2000 && (!best || st.mtimeMs > best.mtime)) {
          best = { file: p, mtime: st.mtimeMs };
        }
      } catch {
        /* raced */
      }
    }
    if (best) this.offset = 0;
    return best?.file ?? null;
  }

  private consume(text: string): void {
    const data = this.carry + text;
    const lines = data.split("\n");
    this.carry = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let obj: Record<string, unknown>;
      try {
        obj = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      const ev = classify(obj);
      if (ev) for (const l of this.listeners) l(ev);
    }
  }
}

function classify(obj: Record<string, unknown>): TranscriptEvent | null {
  if (obj["type"] === "system" && obj["subtype"] === "turn_duration") {
    return { type: "turn_end", durationMs: Number(obj["durationMs"] ?? 0) };
  }
  if (obj["type"] === "assistant" && obj["isSidechain"] !== true) {
    return { type: "activity" };
  }
  return null;
}
