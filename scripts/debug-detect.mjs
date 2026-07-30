// Headless debug: wrap demo-agent, log detector output + state transitions
// using the same settled-screen scheduling as the CLI.
import { spawn } from "@lydell/node-pty";
import { Compositor } from "../dist-debug/compositor.js";
import { ClaudeScreenDetector } from "../dist-debug/detect/screen.js";
import { StateMachine } from "../dist-debug/state.js";

const det = new ClaudeScreenDetector();
const sm = new StateMachine();
sm.onChange((n, p) => console.log(`STATE: ${p.kind} -> ${n.kind}${"reason" in n ? ":" + n.reason : ""}`));

let last = "";
let lastForwardAt = 0;
let settleTimer = null;
function runDetect() {
  const s = det.detect(comp.screen);
  if (s !== last) { console.log("SCREEN:", s); last = s; }
  sm.updateFromScreen(s);
}
function detectSoon() {
  lastForwardAt = Date.now();
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(runDetect, 80);
}
const comp = new Compositor({
  cols: 100, rows: 30,
  write: () => {},
  onError: (e) => console.log("COMPOSITOR ERROR:", e),
  onAfterForward: () => detectSoon(),
});
setInterval(() => { if (Date.now() - lastForwardAt >= 80) runDetect(); }, 400).unref();

const pty = spawn("node", ["scripts/demo-agent.mjs"], {
  name: "xterm-256color", cols: 100, rows: 30, cwd: process.cwd(), env: process.env,
});
pty.onData((d) => comp.feed(Buffer.from(d, "utf8")));

setTimeout(() => { pty.kill(); process.exit(0); }, 40000);
