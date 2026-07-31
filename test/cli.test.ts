// Integration checks against the built CLI (dist/cli.js). CI builds before
// testing; locally run `npm run build` first (suite skips if dist is absent).
import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve(__dirname, "../dist/cli.js");

function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((res) => {
    execFile(process.execPath, [DIST, ...args], { timeout: 15000 }, (err, stdout, stderr) => {
      const code = err && typeof (err as { code?: unknown }).code === "number" ? ((err as { code: number }).code) : err ? 1 : 0;
      res({ code, stdout, stderr });
    });
  });
}

describe.skipIf(!fs.existsSync(DIST))("cli (built)", () => {
  it("nonexistent command fails loudly with exit 127", async () => {
    const r = await run(["definitely-not-a-command-xyz"]);
    expect(r.code).toBe(127);
    expect(r.stderr).toContain("command not found: definitely-not-a-command-xyz");
  });

  it("unknown flag fails with exit 2 and a hint", async () => {
    const r = await run(["--bogus", "claude"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("unknown flag: --bogus");
    expect(r.stderr).toContain("--");
  });

  it("--version prints the current version", async () => {
    const r = await run(["--version"]);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe("catsit 0.7.0");
  });

  it("wraps a command transparently and propagates the exit code", async () => {
    const r = await run(["--", "bash", "-c", "echo wrapped-ok; exit 7"]);
    expect(r.code).toBe(7);
    expect(r.stdout).toContain("wrapped-ok");
  });
});
