import { describe, expect, it } from "vitest";
import { detectTruecolor, rgbTo256, SpriteRenderer } from "../src/overlay/render.js";

describe("rgbTo256", () => {
  it("maps primaries into the color cube", () => {
    expect(rgbTo256(0, 0, 0)).toBe(16);
    expect(rgbTo256(255, 255, 255)).toBe(231);
    expect(rgbTo256(255, 0, 0)).toBe(196);
    expect(rgbTo256(0, 255, 0)).toBe(46);
    expect(rgbTo256(0, 0, 255)).toBe(21);
  });

  it("prefers the gray ramp for near-grays", () => {
    const idx = rgbTo256(104, 104, 104);
    expect(idx).toBeGreaterThanOrEqual(232);
  });
});

describe("detectTruecolor", () => {
  it("Apple Terminal gets 256-color", () => {
    expect(detectTruecolor({ TERM_PROGRAM: "Apple_Terminal", TERM: "xterm-256color" })).toBe(false);
  });
  it("COLORTERM=truecolor wins", () => {
    expect(detectTruecolor({ COLORTERM: "truecolor" })).toBe(true);
  });
  it("kitty/ghostty/wezterm/iterm are truecolor", () => {
    expect(detectTruecolor({ TERM: "xterm-kitty" })).toBe(true);
    expect(detectTruecolor({ TERM_PROGRAM: "ghostty" })).toBe(true);
    expect(detectTruecolor({ TERM_PROGRAM: "WezTerm" })).toBe(true);
    expect(detectTruecolor({ TERM_PROGRAM: "iTerm.app" })).toBe(true);
  });
  it("CATSIT_COLOR override", () => {
    expect(detectTruecolor({ CATSIT_COLOR: "256", COLORTERM: "truecolor" })).toBe(false);
    expect(detectTruecolor({ CATSIT_COLOR: "truecolor" })).toBe(true);
  });
});

describe("SpriteRenderer color depth", () => {
  it("emits 38;5 params when truecolor is off", () => {
    const r = new SpriteRenderer("half", undefined, false);
    expect(r.fg(255, 140, 0)).toMatch(/^38;5;\d+$/);
    expect(r.bg(255, 140, 0)).toMatch(/^48;5;\d+$/);
  });
  it("emits 38;2 params when truecolor is on", () => {
    const r = new SpriteRenderer("half", undefined, true);
    expect(r.fg(1, 2, 3)).toBe("38;2;1;2;3");
  });
});
