// Safe-boundary splitter for the PTY output stream.
//
// The compositor may only inject its own escape sequences between complete
// units of app output — never mid-escape-sequence, never mid-UTF-8 codepoint.
// The chunker returns the longest safe prefix and holds back the incomplete
// tail until more bytes arrive (or the caller force-flushes a stale tail).

export class Chunker {
  private pending: Buffer = Buffer.alloc(0);

  get pendingLength(): number {
    return this.pending.length;
  }

  /** Returns the longest safe prefix of pending+data; holds back the rest. */
  split(data: Buffer): Buffer {
    const buf = this.pending.length ? Buffer.concat([this.pending, data]) : data;
    let lastSafe = 0;
    let i = 0;
    while (i < buf.length) {
      const b = buf[i]!;
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
    this.pending = Buffer.from(buf.subarray(lastSafe));
    return buf.subarray(0, lastSafe);
  }

  /** Force-flush the held tail (used when a tail sits stale too long). */
  takePending(): Buffer {
    const p = this.pending;
    this.pending = Buffer.alloc(0);
    return p;
  }
}

/**
 * Index just past the escape sequence starting at `i`, or -1 if the buffer
 * ends before the sequence is complete.
 */
function escapeEnd(buf: Buffer, i: number): number {
  if (i + 1 >= buf.length) return -1;
  const b1 = buf[i + 1]!;
  if (b1 === 0x5b) {
    // CSI: params 0x20-0x3f, final 0x40-0x7e
    let j = i + 2;
    while (j < buf.length && buf[j]! >= 0x20 && buf[j]! <= 0x3f) j++;
    if (j >= buf.length) return -1;
    return j + 1;
  }
  if (b1 === 0x5d || b1 === 0x50 || b1 === 0x58 || b1 === 0x5e || b1 === 0x5f) {
    // OSC / DCS / SOS / PM / APC — terminated by BEL (OSC only) or ST (ESC \)
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
    // ESC with intermediates, e.g. ESC ( B
    let j = i + 2;
    while (j < buf.length && buf[j]! >= 0x20 && buf[j]! <= 0x2f) j++;
    if (j >= buf.length) return -1;
    return j + 1;
  }
  return i + 2; // two-byte sequence like ESC 7, ESC M
}
