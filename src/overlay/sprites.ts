// catsit's cat: a chunky tuxedo loaf, 26×14 px, facing left.
//
// Palette-indexed string frames; '.' is transparent. Rendered either as a
// real PNG (kitty graphics protocol) or as truecolor half-blocks.

export const PALETTE: Record<string, [number, number, number]> = {
  k: [28, 28, 34], // black fur
  d: [16, 16, 20], // outline/shadow
  w: [245, 242, 234], // white chest/muzzle/paws
  p: [242, 167, 179], // pink ears/nose
  e: [126, 200, 80], // green eyes
  m: [90, 90, 100], // whisker gray
  z: [170, 200, 255], // sleep z's
};

export type FrameName =
  | "loaf1"
  | "loaf2"
  | "sleep1"
  | "sleep2"
  | "flick"
  | "gulp"
  | "alert"
  | "walk1"
  | "walk2"
  | "walkE1" // walking right (leaving); tiers without directional art reuse walk1/2
  | "walkE2";

export const FRAME_W = 26;
export const FRAME_H = 14;

// prettier-ignore
const _FRAMES_BASE = {
  loaf1: [
    "..........................",
    "...kk....kk...............",
    "..kpdk..kpdk..............",
    "..kkkkkkkkkk..............",
    ".kkkkkkkkkkkkkkkkkkkkk....",
    ".kekkkkekkkkkkkkkkkkkkkk..",
    ".kkkkkkkkkkkkkkkkkkkkkkk..",
    ".kkwpwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkdk.",
    ".kwwwwkkkkkkkkkkkkkkkkkdk.",
    "..wwkkwwkkkwwkkkkkkkkkdd..",
    "..........................",
  ],
  loaf2: [
    "..........................",
    "..........................",
    "...kk....kk...............",
    "..kpdk..kpdk..............",
    ".kkkkkkkkkkkkkkkkkkkkk....",
    ".kekkkkekkkkkkkkkkkkkkkk..",
    ".kkkkkkkkkkkkkkkkkkkkkkk..",
    ".kkwpwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkdk.",
    ".kwwwwkkkkkkkkkkkkkkkkkdk.",
    "..wwkkwwkkkwwkkkkkkkkkdd..",
    "..........................",
  ],
  sleep1: [
    "..................z.......",
    "...kk....kk......z........",
    "..kpdk..kpdk....z.........",
    "..kkkkkkkkkk..............",
    ".kkkkkkkkkkkkkkkkkkkkk....",
    ".kkkkkkkkkkkkkkkkkkkkkkk..",
    ".kdkkkkdkkkkkkkkkkkkkkkk..",
    ".kkwpwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkdk.",
    ".kwwwwkkkkkkkkkkkkkkkkkdk.",
    "..wwkkwwkkkwwkkkkkkkkkdd..",
    "..........................",
  ],
  sleep2: [
    "..............z...........",
    "...kk....kk.....z.........",
    "..kpdk..kpdk...z..........",
    "..kkkkkkkkkk..............",
    ".kkkkkkkkkkkkkkkkkkkkk....",
    ".kkkkkkkkkkkkkkkkkkkkkkk..",
    ".kdkkkkdkkkkkkkkkkkkkkkk..",
    ".kkwpwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkdk.",
    ".kwwwwkkkkkkkkkkkkkkkkkdk.",
    "..wwkkwwkkkwwkkkkkkkkkdd..",
    "..........................",
  ],
  flick: [
    "......................dk..",
    "...kk....kk..........dk...",
    "..kpdk..kpdk........dk....",
    "..kkkkkkkkkk........kk....",
    ".kkkkkkkkkkkkkkkkkkkkk....",
    ".kekkkkekkkkkkkkkkkkkkkk..",
    ".kkkkkkkkkkkkkkkkkkkkkkk..",
    ".kkwpwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwwkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkkk.",
    ".kwwwwkkkkkkkkkkkkkkkkkkk.",
    "..wwkkwwkkkwwkkkkkkkkkkk..",
    "..........................",
  ],
  gulp: [
    "..........................",
    "...kk....kk...............",
    "..kpdk..kpdk..............",
    "..kkkkkkkkkk..............",
    ".kkkkkkkkkkkkkkkkkkkkk....",
    ".kdkkkkdkkkkkkkkkkkkkkkk..",
    ".kkkkkkkkkkkkkkkkkkkkkkk..",
    ".kwwwwwwkkkkkkkkkkkkkkkkk.",
    ".kwwwwwwkkkkkkkkkkkkkkkkk.",
    ".kwwwwwkkkkkkkkkkkkkkkkkk.",
    ".kwwwkkkkkkkkkkkkkkkkkkdk.",
    ".kwwwwkkkkkkkkkkkkkkkkkdk.",
    "..wwkkwwkkkwwkkkkkkkkkdd..",
    "..........................",
  ],
  alert: [
    "...kk....kk...............",
    "..kpdk..kpdk..............",
    "..kkkkkkkkkk..............",
    ".kkkkkkkkkkkk.......dk....",
    ".kekkkkekkkkk.......kd....",
    ".kkwpwkkkkkkk.......kk....",
    ".kwwwwkkkkkkkkkkkkkkkk....",
    ".kwwwkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkk.....",
    ".kwkk.kkk....kkk..kkk.....",
    ".kwkk.kkk....kkk..kkk.....",
    ".www..www....kkk..kkk.....",
  ],
  walk1: [
    "...kk....kk...............",
    "..kpdk..kpdk..............",
    "..kkkkkkkkkk..............",
    ".kkkkkkkkkkkk.......dk....",
    ".kekkkkekkkkk.......kd....",
    ".kkwpwkkkkkkk.......kk....",
    ".kwwwwkkkkkkkkkkkkkkkk....",
    ".kwwwkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkk.....",
    "..kwk..kkk...kkk...kkk....",
    ".kwk....kkk...kkk...kkk...",
    ".ww......www..kkk....kk...",
  ],
  walk2: [
    "...kk....kk...............",
    "..kpdk..kpdk..............",
    "..kkkkkkkkkk..............",
    ".kkkkkkkkkkkk.......dk....",
    ".kekkkkekkkkk.......kd....",
    ".kkwpwkkkkkkk.......kk....",
    ".kwwwwkkkkkkkkkkkkkkkk....",
    ".kwwwkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkkk....",
    ".kwwkkkkkkkkkkkkkkkkk.....",
    "...kwk..kkk..kkk..kkk.....",
    "..kwk..kkk....kkk..kkk....",
    "..ww...www....kkk...kk....",
  ],
};

export const FRAMES: Record<FrameName, string[]> = {
  ..._FRAMES_BASE,
  walkE1: _FRAMES_BASE.walk1,
  walkE2: _FRAMES_BASE.walk2,
};

const RIM: [number, number, number] = [104, 104, 122]; // silhouette rim so a
// black cat still pops on a pure-black terminal background

/** RGBA pixel buffer for a frame (FRAME_W × FRAME_H × 4). */
export function framePixels(name: FrameName, rim = true): Uint8Array {
  const rows = FRAMES[name];
  const px = new Uint8Array(FRAME_W * FRAME_H * 4);
  const solid = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H) return false;
    const ch = rows[y]?.[x] ?? ".";
    return ch !== "." && ch !== "z" && ch in PALETTE;
  };
  for (let y = 0; y < FRAME_H; y++) {
    const row = rows[y] ?? "";
    for (let x = 0; x < FRAME_W; x++) {
      const ch = row[x] ?? ".";
      const i = (y * FRAME_W + x) * 4;
      if (ch === "." || !(ch in PALETTE)) {
        if (rim && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) {
          px[i] = RIM[0];
          px[i + 1] = RIM[1];
          px[i + 2] = RIM[2];
          px[i + 3] = 255;
        }
        continue;
      }
      const rgb = PALETTE[ch]!;
      px[i] = rgb[0];
      px[i + 1] = rgb[1];
      px[i + 2] = rgb[2];
      px[i + 3] = 255;
    }
  }
  return px;
}
