// Crash safety: no matter how catsit dies, the user's terminal must come back
// usable and nothing the app printed may be lost.

export class TerminalGuard {
  private restored = false;
  private handlers: Array<[NodeJS.Signals | "exit", (...a: never[]) => void]> = [];

  constructor(
    private write: (s: string) => void,
    private opts: { onAltScreen?: () => boolean } = {},
  ) {}

  arm(onFatal?: (err: unknown) => void): void {
    const restoreAndExit = (code: number) => {
      this.restore(true);
      process.exit(code);
    };
    process.on("exit", () => this.restore(false));
    for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
      const h = () => restoreAndExit(sig === "SIGINT" ? 130 : 143);
      process.on(sig, h);
      this.handlers.push([sig, h]);
    }
    process.on("uncaughtException", (err) => {
      onFatal?.(err);
      this.restore(true);
      process.stderr.write(`catsit: fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
      process.exit(1);
    });
    process.on("unhandledRejection", (err) => {
      onFatal?.(err);
      this.restore(true);
      process.stderr.write(`catsit: fatal: ${String(err)}\n`);
      process.exit(1);
    });
  }

  /**
   * Idempotent, append-only terminal cleanup.
   * `full` additionally clears modes the app might have left on when we are
   * dying abnormally (mouse tracking, bracketed paste, alt screen).
   */
  restore(full: boolean): void {
    if (this.restored) return;
    this.restored = true;
    let s = "\x1b[?2026l\x1b[0m\x1b[?25h";
    if (full) {
      s += "\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?2004l";
      if (this.opts.onAltScreen?.()) s += "\x1b[?1049l";
    }
    try {
      this.write(s);
    } catch {
      /* stdout may already be gone */
    }
    try {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
    } catch {
      /* ignore */
    }
  }
}
