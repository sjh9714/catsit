// The living cat: real-photo frames cut from free stock video (see
// assets/cat-frames/CREDITS.md), played through the kitty graphics protocol.
//
// Three sets: "idle" (sitting, ping-pong loop), "walkL"/"walkR" (side-profile
// gait, forward loop, one per direction). All canvases share the same height,
// with the cat's feet on the bottom edge, so every set stands on one baseline.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type FrameSetName = "idle" | "walkL" | "walkR";

export interface FrameSet {
  b64: string[]; // PNG data, base64, ready for kitty a=t,f=100
  order: number[]; // playback order (ping-pong for idle, forward loop for walk)
  w: number; // pixel size of every frame in this set
  h: number;
}

export type VideoFrames = Record<FrameSetName, FrameSet>;

let cached: VideoFrames | null | undefined;

function loadSet(dir: string, pingPong: boolean): FrameSet {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .sort();
  if (files.length === 0) throw new Error(`no frames in ${dir}`);
  const bufs = files.map((f) => fs.readFileSync(path.join(dir, f)));
  const keys = [...bufs.keys()];
  return {
    b64: bufs.map((b) => b.toString("base64")),
    order: pingPong ? [...keys, ...keys.slice(1, -1).reverse()] : keys,
    w: bufs[0]!.readUInt32BE(16), // PNG IHDR width
    h: bufs[0]!.readUInt32BE(20),
  };
}

/**
 * Load all frame sets, or null when the assets are missing (broken install):
 * callers degrade to the half-block tier — the cat must never crash the wrap.
 */
export function loadVideoFrames(log?: (msg: string) => void): VideoFrames | null {
  if (cached !== undefined) return cached;
  // dist/cli.js sits next to assets/ one level up; from src/overlay it is two.
  const candidates = ["../assets/cat-frames", "../../assets/cat-frames"];
  cached = null;
  for (const rel of candidates) {
    let base: string;
    try {
      base = fileURLToPath(new URL(rel, import.meta.url));
    } catch {
      continue;
    }
    try {
      cached = {
        idle: loadSet(path.join(base, "idle"), true),
        walkL: loadSet(path.join(base, "walkL"), false),
        walkR: loadSet(path.join(base, "walkR"), false),
      };
      log?.(`frames loaded from ${base}`);
      return cached;
    } catch {
      // try the next candidate
    }
  }
  log?.("frames missing: kitty tier degrades to half blocks");
  return cached;
}

/** Test hook: forget the cached frame set. */
export function resetVideoFramesCache(): void {
  cached = undefined;
}
