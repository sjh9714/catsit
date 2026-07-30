// Input gating: while the agent works, the cat "swallows" typing — and
// NOTHING else. Safety rules, in priority order:
//
//   1. ^C ^D ^Z, bare ESC, and every ESC-prefixed sequence pass instantly.
//   2. All other C0 control keys pass (ctrl+t todos, ctrl+r transcript, ...).
//   3. Ctrl+G is intercepted ONLY while gated: it shoos the cat for good.
//      When not gated it passes through untouched (Claude Code binds it).
//   4. Printable characters, Enter, Tab, Backspace are swallowed while gated.
//   5. Bracketed paste is swallowed atomically as one unit.
//   6. When not gated, everything passes verbatim.

export interface GateResult {
  /** Bytes to forward to the child right now. */
  pass: string;
  /** Number of typed units the cat swallowed (drives the tail-flick). */
  swallowed: number;
  /** What the cat swallowed, for the feedback bubble ("hell", "↵", "⌫"...). */
  swallowedText: string;
  /** A whole paste was swallowed (drives the gulp animation). */
  pasteSwallowed: boolean;
  /** Ctrl+G was pressed while gated. */
  shooRequested: boolean;
}

const PASTE_START = "\x1b[200~";
const PASTE_END = "\x1b[201~";

export class InputGate {
  private pending = Buffer.alloc(0);
  private inPaste = false;
  private pasteBuf = "";

  constructor(private isGated: () => boolean) {}

  process(data: Buffer): GateResult {
    const res: GateResult = { pass: "", swallowed: 0, swallowedText: "", pasteSwallowed: false, shooRequested: false };
    const buf = this.pending.length ? Buffer.concat([this.pending, data]) : data;
    this.pending = Buffer.alloc(0);
    const gated = this.isGated();

    let i = 0;
    while (i < buf.length) {
      if (this.inPaste) {
        // consume until PASTE_END
        const rest = buf.subarray(i).toString("latin1");
        const end = rest.indexOf(PASTE_END);
        if (end === -1) {
          // paste still streaming; hold nothing (we can classify bytes now)
          this.pasteBuf += rest;
          i = buf.length;
          break;
        }
        this.pasteBuf += rest.slice(0, end + PASTE_END.length);
        i += Buffer.byteLength(rest.slice(0, end + PASTE_END.length), "latin1");
        this.inPaste = false;
        if (gated) {
          res.pasteSwallowed = true;
          res.swallowedText += "(paste)";
        } else {
          res.pass += this.pasteBuf;
        }
        this.pasteBuf = "";
        continue;
      }

      const b = buf[i]!;
      if (b === 0x1b) {
        const unit = this.escUnit(buf, i);
        if (unit === null) {
          // Incomplete sequence: if more bytes may follow, hold the tail. A
          // bare ESC keypress arrives alone — forward it immediately when it
          // is the entire remaining input (interrupt must never be delayed).
          if (i === buf.length - 1) {
            res.pass += "\x1b";
            i++;
          } else {
            this.pending = Buffer.from(buf.subarray(i));
            i = buf.length;
          }
          continue;
        }
        const seq = buf.subarray(i, unit).toString("latin1");
        i = unit;
        if (seq === PASTE_START) {
          this.inPaste = true;
          this.pasteBuf = seq;
          continue;
        }
        res.pass += seq; // every ESC-prefixed sequence passes
        continue;
      }

      if (b < 0x20 || b === 0x7f || b === 0x08) {
        // C0 controls + backspace
        if (!gated) {
          res.pass += String.fromCharCode(b);
          i++;
          continue;
        }
        if (b === 0x07) {
          res.shooRequested = true; // Ctrl+G intercepted while gated
          i++;
          continue;
        }
        if (b === 0x0d || b === 0x0a || b === 0x09 || b === 0x7f || b === 0x08) {
          res.swallowed++; // Enter / Tab / Backspace are "typing"
          res.swallowedText += b === 0x09 ? "⇥" : b === 0x0d || b === 0x0a ? "↵" : "⌫";
          i++;
          continue;
        }
        res.pass += String.fromCharCode(b); // ^C ^D ^Z ^T ^R ... always pass
        i++;
        continue;
      }

      // printable: single UTF-8 codepoint
      const len = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 1;
      if (i + len > buf.length) {
        this.pending = Buffer.from(buf.subarray(i));
        break;
      }
      const ch = buf.subarray(i, i + len).toString("utf8");
      i += len;
      if (gated) {
        res.swallowed++;
        res.swallowedText += ch;
      } else {
        res.pass += ch;
      }
    }
    return res;
  }

  /** End index of the ESC sequence at i, or null if incomplete. */
  private escUnit(buf: Buffer, i: number): number | null {
    if (i + 1 >= buf.length) return null;
    const b1 = buf[i + 1]!;
    if (b1 === 0x5b) {
      // CSI
      let j = i + 2;
      while (j < buf.length && buf[j]! >= 0x20 && buf[j]! <= 0x3f) j++;
      if (j >= buf.length) return null;
      return j + 1;
    }
    if (b1 === 0x4f) {
      // SS3 (F1-F4, keypad)
      return i + 2 < buf.length ? i + 3 : null;
    }
    if (b1 === 0x1b) return i + 1; // ESC ESC: treat first as bare
    return i + 2; // alt+key and other two-byte forms
  }
}
