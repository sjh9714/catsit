// Thin wrapper around @lydell/node-pty.

import { spawn, type IPty } from "@lydell/node-pty";

export interface Child {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(cb: (data: string) => void): void;
  onExit(cb: (code: number) => void): void;
  pid: number;
}

export function spawnChild(cmd: string, args: string[], cols: number, rows: number): Child {
  const pty: IPty = spawn(cmd, args, {
    name: "xterm-256color",
    cols,
    rows,
    cwd: process.cwd(),
    env: process.env as Record<string, string>,
  });
  return {
    write: (d) => pty.write(d),
    resize: (c, r) => pty.resize(c, r),
    kill: () => pty.kill(),
    onData: (cb) => pty.onData(cb),
    onExit: (cb) => pty.onExit(({ exitCode }) => cb(exitCode)),
    pid: pty.pid,
  };
}
