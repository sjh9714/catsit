// Video-cat playback spike: ping-pong a directory of PNG frames through the
// kitty graphics protocol using ONE image id (retransmit = in-place update).
// usage: node spike-video.mjs <frameDir> [seconds]
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const seconds = Number(process.argv[3] ?? 15);
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
const frames = files.map((f) => fs.readFileSync(path.join(dir, f)).toString("base64"));
// ping-pong order: 0..n-1, n-2..1
const order = [...frames.keys(), ...[...frames.keys()].slice(1, -1).reverse()];

const ID = 7777;
const COLS = 18, ROWS = 12;
const CELL_X = 30, CELL_Y = 3; // 1-based cell position of the sprite

const out = (s) => process.stdout.write(s);

function transmit(b64) {
  const CHUNK = 4000;
  let s = "";
  for (let i = 0; i < b64.length; i += CHUNK) {
    const last = i + CHUNK >= b64.length;
    const keys = i === 0 ? `a=t,f=100,t=d,i=${ID},q=2,m=${last ? 0 : 1}` : `m=${last ? 0 : 1}`;
    s += `\x1b_G${keys};${b64.slice(i, i + CHUNK)}\x1b\\`;
  }
  return s;
}

function place() {
  return `\x1b[${CELL_Y};${CELL_X}H\x1b_Ga=p,i=${ID},p=1,z=1,C=1,q=2,c=${COLS},r=${ROWS}\x1b\\`;
}

// backdrop: fake TUI so the overlay effect is visible
out("\x1b[2J\x1b[H\x1b[?25l");
for (let y = 1; y <= 24; y++) {
  out(`\x1b[${y};1H\x1b[2m${String(y).padStart(2)}  const work = agent.step(${y}); // busy busy busy\x1b[0m`);
}
out(`\x1b[26;1H\x1b[1mcatsit video spike — living cat, ${frames.length} frames ping-pong @10fps\x1b[0m`);

let tick = 0;
const t0 = Date.now();
const timer = setInterval(() => {
  const b64 = frames[order[tick % order.length]];
  out("\x1b[?2026h" + transmit(b64) + place() + "\x1b[?2026l");
  tick++;
  if (Date.now() - t0 > seconds * 1000) {
    clearInterval(timer);
    out(`\x1b_Ga=d,d=i,i=${ID},q=2\x1b\\`);
    out("\x1b[27;1H\x1b[?25h done\n");
    process.exit(0);
  }
}, 100);
