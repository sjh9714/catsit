// Fusion state machine: screen signals + transcript signals -> one cat state.
//
// Safety invariant: the input gate may be closed ONLY in "working". Every
// other state — including "unknown" — fails open.

import type { ScreenState } from "./detect/screen.js";
import type { TranscriptEvent } from "./detect/transcript.js";

export type NeedsHumanReason = "permission" | "question" | "done" | "error";

export type CatState =
  | { kind: "unknown" }
  | { kind: "working" }
  | { kind: "needs_human"; reason: NeedsHumanReason }
  | { kind: "shooed" };

export class StateMachine {
  private current: CatState = { kind: "unknown" };
  private listeners: Array<(next: CatState, prev: CatState) => void> = [];

  get state(): CatState {
    return this.current;
  }

  /** True only while the agent is autonomously working (and not shooed). */
  get gateClosed(): boolean {
    return this.current.kind === "working";
  }

  onChange(cb: (next: CatState, prev: CatState) => void): void {
    this.listeners.push(cb);
  }

  /** Ctrl+G: the cat leaves for the rest of the session; gate stays open. */
  shoo(): void {
    this.transition({ kind: "shooed" });
  }

  updateFromScreen(s: ScreenState): void {
    if (this.current.kind === "shooed") return;
    switch (s) {
      case "busy":
        this.transition({ kind: "working" });
        break;
      case "waiting_input":
        // Edge-triggered and immediate: the gate must open the same tick the
        // permission prompt is detected, before any animation runs.
        this.transition({ kind: "needs_human", reason: "permission" });
        break;
      case "idle":
        if (this.current.kind === "working") {
          this.transition({ kind: "needs_human", reason: "done" });
        }
        break;
      case "unknown":
        // no evidence — keep current belief; gate policy already fails open
        // for every non-working state, and a working state with an unknown
        // screen resolves via transcript turn_end or the idle debounce.
        break;
    }
  }

  updateFromTranscript(ev: TranscriptEvent): void {
    if (this.current.kind === "shooed") return;
    if (ev.type === "turn_end") {
      this.transition({ kind: "needs_human", reason: "done" });
    } else if (ev.type === "activity") {
      if (this.current.kind !== "needs_human" || this.current.reason === "done") {
        this.transition({ kind: "working" });
      }
    }
  }

  onChildExit(code: number): void {
    this.transition({ kind: "needs_human", reason: code === 0 ? "done" : "error" });
  }

  private transition(next: CatState): void {
    const prev = this.current;
    if (prev.kind === next.kind && (prev.kind !== "needs_human" || (prev as { reason?: string }).reason === (next as { reason?: string }).reason)) {
      return;
    }
    this.current = next;
    for (const l of this.listeners) l(next, prev);
  }
}
