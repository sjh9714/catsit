// Kitty graphics protocol z-index spike: draw text, place an alpha PNG cat
// blob ABOVE it (z=1), then repaint the text underneath. If z-layering works,
// the cat stays on top and text shows through the transparent pixels.
import { encodePNG } from "./png.mjs";

const W = 160, H = 100;
const px = new Uint8Array(W * H * 4);

function put(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
}

// chunky cat blob: body ellipse + two triangular ears, orange with dark eyes
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W / 2.2);
    const dy = (y - H / 1.65) / (H / 2.6);
    if (dx * dx + dy * dy < 1) put(x, y, 255, 150, 40);
  }
}
for (const ex of [W * 0.28, W * 0.72]) {
  for (let y = 0; y < H * 0.42; y++) {
    const half = ((y / (H * 0.42)) * W) / 9;
    for (let x = ex - half; x <= ex + half; x++) put(Math.round(x), Math.round(y + H * 0.05), 255, 150, 40);
  }
}
for (const ex of [W * 0.38, W * 0.62]) {
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
    if (x * x + y * y <= 9) put(Math.round(ex + x), Math.round(H * 0.6 + y), 30, 30, 30);
  }
}

const png = encodePNG(W, H, px);
const b64 = png.toString("base64");

const out = [];
out.push("\x1b[2J\x1b[H");
// background text grid
for (let r = 1; r <= 26; r++) {
  out.push(`\x1b[${r};1H\x1b[38;5;${(r % 6) + 31 - 30 + 31}m` + `TEXT${String(r).padStart(2, "0")} `.repeat(12) + "\x1b[0m");
}
// place image at row 4, col 30, above text (z=1), don't move cursor
out.push("\x1b[4;30H");
const CHUNK = 4000;
for (let i = 0; i < b64.length; i += CHUNK) {
  const last = i + CHUNK >= b64.length;
  const keys = i === 0 ? `a=T,f=100,t=d,i=1,z=1,C=1,m=${last ? 0 : 1}` : `m=${last ? 0 : 1}`;
  out.push(`\x1b_G${keys};${b64.slice(i, i + CHUNK)}\x1b\\`);
}
process.stdout.write(out.join(""));

// after 1.5s, repaint the text under the image — it must stay underneath
setTimeout(() => {
  const re = [];
  for (let r = 3; r <= 12; r++) {
    re.push(`\x1b[${r};25H\x1b[48;5;17;38;5;226m REPAINTED-AFTER-IMAGE row ${r} \x1b[0m`);
  }
  re.push("\x1b[28;1H\x1b[1mEXPECT: orange cat blob ON TOP of both text layers; text visible through transparent corners.\x1b[0m\n");
  process.stdout.write(re.join(""));
}, 1500);

setTimeout(() => {}, 30000); // keep window alive for screenshot
