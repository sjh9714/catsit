// The living cat: one AI-generated continuous take of a white kitten, split
// into beats (see assets/cat-frames/CREDITS.md). Every beat shares ONE crop
// window, so positions flow across beats with no jumps — the cat walks in,
// sits down, idles, startles, and walks out as a single connected performance.
//
// Beats are one-shot sequences except "idle", whose first and last frames are
// identical (a seamless loop). Each beat carries its own capture fps; the
// renderer maps animator ticks (100ms) onto frame indexes with that fps.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type BeatName = "walkIn" | "sitDown" | "idle" | "sleepDown" | "sleepLoop" | "wakeUp" | "alertUp" | "walkOut";

export interface Beat {
  b64: string[]; // PNG data, base64, ready for kitty a=t,f=100
  fps: number; // capture rate; playback maps 10 ticks/s onto this
  loop: boolean;
  w: number; // pixel size of every frame in this beat
  h: number;
}

export interface VideoFrames {
  beats: Record<BeatName, Beat>;
  centerX: number; // cat's horizontal center as a fraction of the canvas
}

let cached: VideoFrames | null | undefined;

/**
 * Load all beats, or null when assets are missing or incomplete (broken
 * install): callers degrade to the half-block tier — never crash the wrap.
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
      const manifest = JSON.parse(fs.readFileSync(path.join(base, "manifest.json"), "utf8")) as {
        centerX: number;
        beats: Record<BeatName, { fps: number; loop: boolean }>;
      };
      const beats = {} as Record<BeatName, Beat>;
      for (const name of Object.keys(manifest.beats) as BeatName[]) {
        const dir = path.join(base, name);
        const files = fs
          .readdirSync(dir)
          .filter((f) => f.endsWith(".png"))
          .sort();
        if (files.length === 0) throw new Error(`no frames in ${dir}`);
        const bufs = files.map((f) => fs.readFileSync(path.join(dir, f)));
        beats[name] = {
          b64: bufs.map((b) => b.toString("base64")),
          fps: manifest.beats[name].fps,
          loop: manifest.beats[name].loop,
          w: bufs[0]!.readUInt32BE(16), // PNG IHDR width
          h: bufs[0]!.readUInt32BE(20),
        };
      }
      cached = { beats, centerX: manifest.centerX };
      log?.(`beats loaded from ${base}`);
      return cached;
    } catch {
      // try the next candidate
    }
  }
  log?.("beats missing: kitty tier degrades to half blocks");
  return cached;
}

/** Test hook: forget the cached frame set. */
export function resetVideoFramesCache(): void {
  cached = undefined;
}
