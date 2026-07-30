import { describe, expect, it } from "vitest";
import { InputGate } from "../src/input.js";

const B = (s: string) => Buffer.from(s, "latin1");

function gate(gated: boolean): InputGate {
  return new InputGate(() => gated);
}

describe("InputGate — safety invariants (gated)", () => {
  it.each([
    ["^C", "\x03"],
    ["^D", "\x04"],
    ["^Z", "\x1a"],
    ["^T", "\x14"],
    ["^R", "\x12"],
    ["^B", "\x02"],
    ["^O", "\x0f"],
    ["^V", "\x16"],
    ["^_", "\x1f"],
  ])("always forwards %s instantly", (_n, byte) => {
    const r = gate(true).process(B(byte));
    expect(r.pass).toBe(byte);
    expect(r.swallowed).toBe(0);
  });

  it("forwards a bare trailing ESC immediately (interrupt latency = 0)", () => {
    const r = gate(true).process(B("\x1b"));
    expect(r.pass).toBe("\x1b");
  });

  it("forwards arrow keys and other CSI sequences", () => {
    const r = gate(true).process(B("\x1b[A\x1b[B\x1b[Z\x1b[1;5C"));
    expect(r.pass).toBe("\x1b[A\x1b[B\x1b[Z\x1b[1;5C");
    expect(r.swallowed).toBe(0);
  });

  it("forwards SS3 function keys and alt+key", () => {
    const r = gate(true).process(B("\x1bOP\x1bx"));
    expect(r.pass).toBe("\x1bOP\x1bx");
  });

  it("swallows printables, Enter, Tab, Backspace", () => {
    const r = gate(true).process(B("hi\r\tx\x7f"));
    expect(r.pass).toBe("");
    expect(r.swallowed).toBe(6);
  });

  it("swallows multibyte characters as single units", () => {
    const r = gate(true).process(Buffer.from("한글🐈", "utf8"));
    expect(r.pass).toBe("");
    expect(r.swallowed).toBe(3);
  });

  it("intercepts Ctrl+G as shoo while gated", () => {
    const r = gate(true).process(B("\x07"));
    expect(r.pass).toBe("");
    expect(r.shooRequested).toBe(true);
  });

  it("swallows a bracketed paste atomically", () => {
    const r = gate(true).process(B("\x1b[200~pasted stuff\rmore\x1b[201~"));
    expect(r.pass).toBe("");
    expect(r.pasteSwallowed).toBe(true);
  });

  it("handles a paste split across reads", () => {
    const g = gate(true);
    const r1 = g.process(B("\x1b[200~part one "));
    expect(r1.pass).toBe("");
    expect(r1.pasteSwallowed).toBe(false);
    const r2 = g.process(B("part two\x1b[201~"));
    expect(r2.pasteSwallowed).toBe(true);
    expect(r2.pass).toBe("");
  });

  it("mixed input: controls pass while typing is swallowed", () => {
    const r = gate(true).process(B("abc\x03def\x1b[A"));
    expect(r.pass).toBe("\x03\x1b[A");
    expect(r.swallowed).toBe(6);
  });
});

describe("InputGate — ungated is fully transparent", () => {
  it.each([
    ["typing", "hello world\r"],
    ["ctrl+g (claude binds it)", "\x07"],
    ["paste", "\x1b[200~data\x1b[201~"],
    ["controls", "\x03\x04\x1a"],
  ])("passes %s verbatim", (_n, s) => {
    const r = gate(false).process(B(s));
    expect(r.pass).toBe(s);
    expect(r.swallowed).toBe(0);
    expect(r.shooRequested).toBe(false);
  });

  it("passes split UTF-8 once complete", () => {
    const g = gate(false);
    const cat = Buffer.from("🐈", "utf8");
    expect(g.process(cat.subarray(0, 2)).pass).toBe("");
    expect(g.process(cat.subarray(2)).pass).toBe("🐈");
  });
});
