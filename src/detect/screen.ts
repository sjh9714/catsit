// Claude Code screen-state detection over the mirror buffer.
//
// Detection patterns ported from ccmanager (MIT License, © kbwo)
// https://github.com/kbwo/ccmanager — src/services/stateDetector/claude.ts
// which runs these against real Claude Code sessions in production.

import type { Mirror } from "../mirror.js";

export type ScreenState = "busy" | "waiting_input" | "idle" | "unknown";

const SPINNER_CHARS = "✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❀❁❂❃❇❈❉❊❋✢✣✤✥✦✧✨⊛⊕⊙◉◎◍⁂⁕※⍟☼★☆·•⏺▸▹∙⋅○●";

// e.g. "✽ Tempering…", "✳ Simplifying…", "· Misting…"
const SPINNER_ACTIVITY_PATTERN = new RegExp(`^[${SPINNER_CHARS}] \\S+ing.*\u2026`, "m");

// e.g. "(9m 21s · ↓ 13.7k tokens)"
const TOKEN_STATS_LINE_PATTERN = /\([^)]*\d[^)]*tokens\s*\)/i;

export const IDLE_DEBOUNCE_MS = 1500;

export class ClaudeScreenDetector {
  private lastContent = "";
  private contentStableSince = 0;
  private lastState: ScreenState = "unknown";

  detect(mirror: Mirror, now: number = Date.now()): ScreenState {
    const state = this.detectRaw(mirror, now);
    this.lastState = state;
    return state;
  }

  private detectRaw(mirror: Mirror, now: number): ScreenState {
    const full = this.screenText(mirror, 30);
    const fullLower = full.toLowerCase();

    // ctrl+r transcript toggle view — keep whatever we believed before
    if (fullLower.includes("ctrl+r to toggle")) return this.lastState;

    // permission / question prompts
    if (/(?:do you want|would you like).+\n+[\s\S]*?(?:yes|❯)/.test(fullLower)) {
      return "waiting_input";
    }
    if (fullLower.includes("esc to cancel")) return "waiting_input";

    const above = this.recentContentAbovePromptBox(mirror, 30);
    const aboveLower = above.toLowerCase();
    if (aboveLower.includes("esc to interrupt") || aboveLower.includes("ctrl+c to interrupt")) {
      return "busy";
    }
    if (SPINNER_ACTIVITY_PATTERN.test(above)) return "busy";
    if (TOKEN_STATS_LINE_PATTERN.test(above)) return "busy";

    return this.debounceIdle(full, now);
  }

  /**
   * Claude Code sometimes looks idle mid-redraw; require the screen to be
   * unchanged for IDLE_DEBOUNCE_MS before trusting "idle" (ccmanager
   * workaround, IDLE_DEBOUNCE_MS = 1500).
   */
  private debounceIdle(content: string, now: number): ScreenState {
    if (content !== this.lastContent) {
      this.lastContent = content;
      this.contentStableSince = now;
    }
    if (now - this.contentStableSince >= IDLE_DEBOUNCE_MS) return "idle";
    return this.lastState === "idle" ? "idle" : "unknown";
  }

  /** Last `maxLines` viewport lines, trimmed of trailing empties. */
  private screenLines(mirror: Mirror, maxLines: number): string[] {
    const buf = mirror.raw.buffer.active;
    const lines: string[] = [];
    for (let y = 0; y < mirror.rows; y++) {
      lines.push(buf.getLine(buf.viewportY + y)?.translateToString(true) ?? "");
    }
    while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
    return lines.slice(-maxLines);
  }

  private screenText(mirror: Mirror, maxLines: number): string {
    return this.screenLines(mirror, maxLines).join("\n");
  }

  /**
   * Content above the ─-bordered prompt box; then scoped to the most recent
   * contiguous block, because xterm's grid can retain transient fragments from
   * cursor-addressed redraws (ccmanager, learned in production).
   */
  private recentContentAbovePromptBox(mirror: Mirror, maxLines: number): string {
    const all = this.screenLines(mirror, maxLines);
    let borderCount = 0;
    let lines = all;
    for (let i = all.length - 1; i >= 0; i--) {
      const trimmed = all[i]!.trim();
      if (trimmed.length > 0 && /^─+$/.test(trimmed)) {
        borderCount++;
        if (borderCount === 2) {
          lines = all.slice(0, i);
          break;
        }
      }
    }
    while (lines.length > 0) {
      const t = lines[lines.length - 1]!.trim();
      if (t === "" || t === "❯" || /^[-─\s]+$/.test(t)) {
        lines.pop();
        continue;
      }
      break;
    }
    if (lines.length === 0) return "";
    let start = lines.length - 1;
    while (start >= 0) {
      const t = lines[start]!.trim();
      if (t === "" || /^[-─\s]+$/.test(t)) {
        start++;
        break;
      }
      start--;
    }
    return lines.slice(Math.max(start, 0)).join("\n");
  }
}
