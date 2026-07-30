import { describe, expect, it } from "vitest";
import { PenTracker } from "../src/pen.js";

const pen = (...seqs: string[]) => {
  const p = new PenTracker();
  for (const s of seqs) p.feed(s);
  return p.emit();
};

describe("PenTracker", () => {
  it("starts reset", () => {
    expect(new PenTracker().emit()).toBe("\x1b[0m");
  });

  it("tracks basic colors and attributes", () => {
    expect(pen("\x1b[1;31m")).toBe("\x1b[0;1;31m");
    expect(pen("\x1b[31m", "\x1b[44m")).toBe("\x1b[0;31;44m");
  });

  it("reset clears everything", () => {
    expect(pen("\x1b[1;31;44m", "\x1b[0m")).toBe("\x1b[0m");
    expect(pen("\x1b[1;31;44m", "\x1b[m")).toBe("\x1b[0m"); // empty = reset
  });

  it("tracks 256-color and RGB in semicolon form", () => {
    expect(pen("\x1b[38;5;196m")).toBe("\x1b[0;38;5;196m");
    expect(pen("\x1b[38;2;10;20;30;48;2;1;2;3m")).toBe("\x1b[0;38;2;10;20;30;48;2;1;2;3m");
  });

  it("tracks colon subparameter form", () => {
    expect(pen("\x1b[38:5:100m")).toBe("\x1b[0;38;5;100m");
    expect(pen("\x1b[38:2:1:2:3m")).toBe("\x1b[0;38;2;1;2;3m");
  });

  it("partial clears work", () => {
    expect(pen("\x1b[1;3;31;44m", "\x1b[22;39m")).toBe("\x1b[0;3;44m");
    expect(pen("\x1b[4;31m", "\x1b[24m")).toBe("\x1b[0;31m");
    expect(pen("\x1b[41m", "\x1b[49m")).toBe("\x1b[0m");
  });

  it("RIS resets the pen", () => {
    expect(pen("\x1b[1;31m", "\x1bc")).toBe("\x1b[0m");
  });

  it("bright colors tracked", () => {
    expect(pen("\x1b[97;100m")).toBe("\x1b[0;97;100m");
  });

  it("ignores non-SGR sequences in the stream", () => {
    expect(pen("abc\x1b[2Jdef\x1b[5;5H\x1b[31mzz")).toBe("\x1b[0;31m");
  });
});
