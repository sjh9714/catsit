import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/args.js";

describe("parseArgs", () => {
  it("plain command", () => {
    expect(parseArgs(["claude"])).toEqual({
      kind: "run",
      flags: { noCat: false, guard: false, quiet: false },
      cmd: "claude",
      args: [],
    });
  });

  it("flags before command", () => {
    const r = parseArgs(["--guard", "--quiet", "claude", "--model", "opus"]);
    expect(r).toMatchObject({ kind: "run", cmd: "claude", args: ["--model", "opus"] });
    expect((r as { flags: { guard: boolean; quiet: boolean } }).flags).toMatchObject({ guard: true, quiet: true });
  });

  it("-- separator lets the child take dash-args", () => {
    expect(parseArgs(["--", "--weird-cmd"])).toMatchObject({ kind: "run", cmd: "--weird-cmd" });
  });

  it("unknown flags are an error, never treated as the command", () => {
    const r = parseArgs(["--bogus", "claude"]);
    expect(r.kind).toBe("error");
    expect((r as { message: string }).message).toContain("--bogus");
  });

  it("--demo turns guard on", () => {
    const r = parseArgs(["--demo"]);
    expect(r).toMatchObject({ kind: "demo" });
    expect((r as { flags: { guard: boolean } }).flags.guard).toBe(true);
  });

  it("help and version", () => {
    expect(parseArgs([]).kind).toBe("help");
    expect(parseArgs(["-h"]).kind).toBe("help");
    expect(parseArgs(["--version"]).kind).toBe("version");
  });
});
