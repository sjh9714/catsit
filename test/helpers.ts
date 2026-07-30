import xtermPkg from "@xterm/headless";
import type { Terminal as XtermTerminal, IBufferCell } from "@xterm/headless";
import type { Mirror, Rect } from "../src/mirror.js";

export const Terminal: typeof XtermTerminal =
  (xtermPkg as { Terminal?: typeof XtermTerminal }).Terminal ??
  (xtermPkg as unknown as { default: { Terminal: typeof XtermTerminal } }).default.Terminal;

export function makeUserTerm(cols: number, rows: number): XtermTerminal {
  return new Terminal({ cols, rows, scrollback: 1000, allowProposedApi: true });
}

export function writeTo(term: XtermTerminal, data: string): Promise<void> {
  return new Promise((res) => term.write(data, res));
}

export function cellKey(cell: IBufferCell): string {
  const fg = cell.isFgRGB() ? `r${cell.getFgColor()}` : cell.isFgPalette() ? `p${cell.getFgColor()}` : "d";
  const bg = cell.isBgRGB() ? `r${cell.getBgColor()}` : cell.isBgPalette() ? `p${cell.getBgColor()}` : "d";
  const fl =
    (cell.isBold() ? "b" : "") +
    (cell.isDim() ? "f" : "") +
    (cell.isItalic() ? "i" : "") +
    (cell.isUnderline() ? "u" : "") +
    (cell.isInverse() ? "v" : "") +
    (cell.isStrikethrough() ? "s" : "");
  return `${cell.getChars() || ""}|${fg}|${bg}|${fl}`;
}

/**
 * Asserts user terminal B matches mirror A on every viewport cell (except an
 * optional excluded rect), on every scrollback line, and on cursor position.
 * Returns a list of human-readable differences (empty = equal).
 */
export function diffScreens(mirror: Mirror, user: XtermTerminal, exclude?: Rect): string[] {
  const a = mirror.raw.buffer.active;
  const b = user.buffer.active;
  const out: string[] = [];
  const rows = mirror.rows;
  const cols = mirror.cols;
  for (let y = 0; y < rows; y++) {
    const la = a.getLine(a.viewportY + y);
    const lb = b.getLine(b.viewportY + y);
    for (let x = 0; x < cols; x++) {
      if (exclude && y >= exclude.y && y < exclude.y + exclude.h && x >= exclude.x - 1 && x < exclude.x + exclude.w) continue;
      const ca = la?.getCell(x);
      const cb = lb?.getCell(x);
      if (!ca || !cb) continue;
      const ka = cellKey(ca);
      const kb = cellKey(cb);
      // A null cell and a space cell render identically but differ for
      // copy/paste; treat chars "" vs " " as a difference ONLY in trimmed
      // length, which the scrollback text check below covers. For viewport
      // compare, normalize.
      if (ka.replace(/^ \|/, "|") !== kb.replace(/^ \|/, "|")) {
        out.push(`cell (${x},${y}): A=${ka} B=${kb}`);
        if (out.length > 5) return out;
      }
    }
  }
  if (a.viewportY !== b.viewportY) {
    out.push(`scrollback depth: A=${a.viewportY} B=${b.viewportY}`);
  } else {
    // with an exclusion rect only scrollback text is comparable; without one
    // (exact-equality states) also compare viewport text to catch null-vs-space
    const upto = exclude ? a.viewportY : a.viewportY + rows;
    for (let i = 0; i < upto; i++) {
      const ta = a.getLine(i)?.translateToString(true) ?? "";
      const tb = b.getLine(i)?.translateToString(true) ?? "";
      if (ta !== tb) {
        out.push(`line ${i} text: A=${JSON.stringify(ta)} B=${JSON.stringify(tb)}`);
        if (out.length > 5) return out;
      }
    }
  }
  if (a.cursorX !== b.cursorX || a.cursorY !== b.cursorY) {
    out.push(`cursor: A=(${a.cursorX},${a.cursorY}) B=(${b.cursorX},${b.cursorY})`);
  }
  return out;
}
