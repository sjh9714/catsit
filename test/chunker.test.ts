import { describe, expect, it } from "vitest";
import { Chunker } from "../src/chunker.js";

const B = (s: string) => Buffer.from(s, "latin1");

describe("Chunker", () => {
  it("passes complete plain text through", () => {
    const c = new Chunker();
    expect(c.split(B("hello")).toString()).toBe("hello");
    expect(c.pendingLength).toBe(0);
  });

  it("holds back an incomplete CSI and completes it on the next chunk", () => {
    const c = new Chunker();
    expect(c.split(B("ab\x1b[38;2;1"))).toEqual(B("ab"));
    expect(c.split(B("0;20m x")).toString("latin1")).toBe("\x1b[38;2;10;20m x");
  });

  it("holds back a lone trailing ESC", () => {
    const c = new Chunker();
    expect(c.split(B("xy\x1b")).toString()).toBe("xy");
    expect(c.split(B("[0m")).toString("latin1")).toBe("\x1b[0m");
  });

  it("handles OSC terminated by BEL", () => {
    const c = new Chunker();
    expect(c.split(B("\x1b]0;title")).length).toBe(0);
    expect(c.split(B("\x07after")).toString("latin1")).toBe("\x1b]0;title\x07after");
  });

  it("handles OSC/DCS terminated by ST across a split", () => {
    const c = new Chunker();
    expect(c.split(B("\x1bP+q1234\x1b")).length).toBe(0); // ST half-arrived
    expect(c.split(B("\\rest")).toString("latin1")).toBe("\x1bP+q1234\x1b\\rest");
  });

  it("holds back incomplete UTF-8 codepoints", () => {
    const c = new Chunker();
    const hangul = Buffer.from("한", "utf8"); // 3 bytes
    expect(c.split(Buffer.concat([Buffer.from("a"), hangul.subarray(0, 2)])).toString()).toBe("a");
    expect(c.split(hangul.subarray(2)).toString("utf8")).toBe("한");
  });

  it("handles 4-byte emoji split at every position", () => {
    const emoji = Buffer.from("🐈", "utf8");
    for (let cut = 1; cut < 4; cut++) {
      const c = new Chunker();
      expect(c.split(emoji.subarray(0, cut)).length).toBe(0);
      expect(c.split(emoji.subarray(cut)).toString("utf8")).toBe("🐈");
    }
  });

  it("handles ESC with intermediates (charset designation)", () => {
    const c = new Chunker();
    expect(c.split(B("\x1b(")).length).toBe(0);
    expect(c.split(B("Bx")).toString("latin1")).toBe("\x1b(Bx");
  });

  it("takePending force-flushes the tail", () => {
    const c = new Chunker();
    c.split(B("\x1b[1;2"));
    expect(c.takePending().toString("latin1")).toBe("\x1b[1;2");
    expect(c.pendingLength).toBe(0);
  });
});
