// Tracks the app's current SGR pen by scanning safe output chunks.
//
// After the compositor injects its own colored sequences it must hand the pen
// back to the app exactly as the app left it; emit() produces one SGR sequence
// that re-establishes the tracked pen from a clean reset.

export class PenTracker {
  private flags = new Set<number>();
  private fg: string | null = null;
  private bg: string | null = null;

  reset(): void {
    this.flags.clear();
    this.fg = null;
    this.bg = null;
  }

  feed(text: string): void {
    const re = /\x1b(?:c|\[([\d;:]*)m)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0] === "\x1bc") {
        this.reset();
        continue;
      }
      this.applyParams(m[1] ?? "");
    }
  }

  private applyParams(raw: string): void {
    const parts = raw.length === 0 ? ["0"] : raw.split(";");
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i]!.split(":");
      const n = parseInt(seg[0] || "0", 10);
      if (n === 0) this.reset();
      else if (n >= 1 && n <= 9) {
        this.flags.add(n);
        if (n === 1) this.flags.delete(2);
      } else if (n === 21) this.flags.delete(1);
      else if (n === 22) {
        this.flags.delete(1);
        this.flags.delete(2);
      } else if (n >= 23 && n <= 29) this.flags.delete(n - 20);
      else if ((n >= 30 && n <= 37) || (n >= 90 && n <= 97)) this.fg = String(n);
      else if (n === 39) this.fg = null;
      else if ((n >= 40 && n <= 47) || (n >= 100 && n <= 107)) this.bg = String(n);
      else if (n === 49) this.bg = null;
      else if (n === 38 || n === 48) {
        let spec: string | undefined;
        if (seg.length > 1) {
          spec = seg.slice(1).join(";");
        } else {
          const mode = parts[i + 1];
          if (mode === "5") {
            spec = `5;${parts[i + 2]}`;
            i += 2;
          } else if (mode === "2") {
            spec = `2;${parts[i + 2]};${parts[i + 3]};${parts[i + 4]}`;
            i += 4;
          }
        }
        if (spec) {
          if (n === 38) this.fg = `38;${spec}`;
          else this.bg = `48;${spec}`;
        }
      }
    }
  }

  /** One SGR sequence that re-establishes the pen from reset. */
  emit(): string {
    const p = ["0"];
    for (const f of [...this.flags].sort((a, b) => a - b)) p.push(String(f));
    if (this.fg) p.push(this.fg);
    if (this.bg) p.push(this.bg);
    return `\x1b[${p.join(";")}m`;
  }
}
