// Server-side model of the wrapped app's screen, backed by @xterm/headless.
//
// The mirror is the single source of truth for: what is under the overlay
// (repair source), where the app's cursor really is (incl. pending-wrap), and
// later, state detection via buffer pattern matching.

import xtermPkg from "@xterm/headless";
import type { Terminal as XtermTerminal, IBufferCell } from "@xterm/headless";
import type { PenTracker } from "./pen.js";

const Terminal: typeof XtermTerminal =
  (xtermPkg as { Terminal?: typeof XtermTerminal }).Terminal ??
  (xtermPkg as unknown as { default: { Terminal: typeof XtermTerminal } }).default.Terminal;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AppState {
  x: number; // may equal cols when wrap is pending
  y: number;
  penSeq: string;
  viewportY: number;
}

export function cellSGR(cell: IBufferCell): string {
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

export class Mirror {
  private term: XtermTerminal;

  constructor(cols: number, rows: number, scrollback = 1000) {
    this.term = new Terminal({ cols, rows, scrollback, allowProposedApi: true });
  }

  get cols(): number {
    return this.term.cols;
  }
  get rows(): number {
    return this.term.rows;
  }

  /**
   * Bumped whenever the app erases the display (ED/RIS) or flips screens.
   * Terminals that store graphics (kitty) drop placements on these erases,
   * so the renderer must retransmit — a re-place of a cached image id is
   * not enough after a clear.
   */
  clearEpoch = 0;

  feed(data: string): Promise<void> {
    if (/\x1b\[[0-3]?J|\x1bc/.test(data)) this.clearEpoch++;
    return new Promise((res) => this.term.write(data, res));
  }

  resize(cols: number, rows: number): void {
    this.term.resize(cols, rows);
  }

  /** The raw terminal, for detection code that scans the buffer. */
  get raw(): XtermTerminal {
    return this.term;
  }

  onAltScreen(): boolean {
    this.clearEpoch++;
    return this.term.buffer.active.type === "alternate";
  }

  captureState(pen: PenTracker): AppState {
    const buf = this.term.buffer.active;
    return { x: buf.cursorX, y: buf.cursorY, penSeq: pen.emit(), viewportY: buf.viewportY };
  }

  /**
   * Sequence that hands the cursor back to the app exactly as captured:
   * position, SGR pen, and pending-wrap (re-armed by re-printing the last
   * printable cell of the row).
   */
  restoreSeq(st: AppState): string {
    if (st.x < this.cols) {
      return st.penSeq + `\x1b[${st.y + 1};${st.x + 1}H`;
    }
    const buf = this.term.buffer.active;
    const line = buf.getLine(st.viewportY + st.y);
    let col = this.cols - 1;
    let cell = line?.getCell(col);
    if (cell && cell.getWidth() === 0 && col > 0) {
      col -= 1;
      cell = line!.getCell(col);
    }
    if (!cell) return st.penSeq + `\x1b[${st.y + 1};${this.cols}H`;
    return `\x1b[${st.y + 1};${col + 1}H` + cellSGR(cell) + (cell.getChars() || " ") + st.penSeq;
  }

  /**
   * Sequences that repaint the app's true cells over `rect` (per-cell
   * addressing; null cells restored as *erased* via ECH so copy/paste and
   * trimmed line lengths stay identical).
   */
  undrawRect(rect: Rect): string {
    const buf = this.term.buffer.active;
    let s = "";
    for (let r = 0; r < rect.h; r++) {
      const row = rect.y + r;
      if (row < 0 || row >= this.rows) continue;
      const line = buf.getLine(buf.viewportY + row);
      if (!line) continue;
      for (let c = 0; c < rect.w; c++) {
        let col = rect.x + c;
        if (col < 0 || col >= this.cols) continue;
        let cell = line.getCell(col);
        if (!cell) continue;
        if (cell.getWidth() === 0) {
          if (c === 0 && col > 0) {
            col -= 1;
            cell = line.getCell(col);
            if (!cell) continue;
          } else {
            continue; // covered by its lead char
          }
        }
        if (cell.getChars() === "") {
          const bg = cell.isBgRGB()
            ? `\x1b[0;48;2;${(cell.getBgColor() >> 16) & 255};${(cell.getBgColor() >> 8) & 255};${cell.getBgColor() & 255}m`
            : cell.isBgPalette()
              ? `\x1b[0;48;5;${cell.getBgColor()}m`
              : `\x1b[0m`;
          s += `\x1b[${row + 1};${col + 1}H` + bg + `\x1b[1X`;
          continue;
        }
        s += `\x1b[${row + 1};${col + 1}H` + cellSGR(cell) + cell.getChars();
      }
    }
    return s + "\x1b[0m";
  }

  dispose(): void {
    this.term.dispose();
  }
}
