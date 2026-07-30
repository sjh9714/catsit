<div align="center">

# catsit

**A cat that babysits your AI agent, so you don't have to.**

While Claude works, a cat sits on your terminal and swallows your typing.<br>
The moment you're needed — permission prompt, question, done — the cat gets up, meows, and steps aside.

<img src="docs/assets/demo.gif" alt="catsit demo: a pixel tuxedo cat loafs on the terminal while Claude Code works, then gets up and meows when a permission prompt appears" width="720">

[한국어](README.ko.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

</div>

## Try it in 10 seconds (no agent, no tokens)

```
npx catsit --demo
```

## Use it

```
npx catsit claude
```

That's the whole setup. No config files, no hooks, no permissions to grant.

## Why

Agents made us babysitters. You can't look away — it might need a permission
*right now* — so you sit there, watching a spinner, guarding a process that
doesn't need you 95% of the time.

catsit inverts the notification. The cat's **presence** is the signal:

| The cat... | means |
|---|---|
| 🐈 walks in and loafs | the agent is working. You're not needed. Go do something else. |
| 😑 flicks its tail and eats your keystroke | *"not yet."* |
| 😴 falls asleep | it's been a long task. Still handled. |
| ❗ jumps up, meows, steps aside | permission prompt / question / finished — **your turn.** |

If you can see the cat, you can ignore the terminal. That's the deal.

## The cat never gets in the way

The gate is built to be impossible to regret:

- `ctrl+c`, `ctrl+d`, `esc`, arrows, every control key — **always pass through instantly.** The cat only ever swallows printable typing and Enter.
- The moment a permission prompt is detected, the gate opens **before** any animation runs.
- If the state is unknown, the gate is open. If anything inside catsit breaks, it permanently degrades to a transparent passthrough — the cat dies, your session doesn't.
- `ctrl+g` shoos the cat away for the rest of the session.
- `--no-swallow` keeps the cat purely decorative.

## How it looks where you are

| Terminal | You get |
|---|---|
| kitty, Ghostty, WezTerm, iTerm2 3.6+, Konsole | a real PNG cat floating **above** the text (kitty graphics protocol, alpha and all) |
| everything else (incl. tmux, VS Code, Terminal.app) | a truecolor pixel cat drawn in half-blocks |
| `NO_COLOR` / dumb terminals | a humble kaomoji `(=˘ω˘=)` |

## How it works

catsit wraps your agent in a PTY and forwards every byte verbatim, while
mirroring the screen into a headless terminal ([@xterm/headless](https://github.com/xtermjs/xterm.js)).
When the cat is visible, each output flush becomes one atomic
`repair → app bytes → cat → cursor restore` batch inside a synchronized
update — the cat and the app can't corrupt each other, and nothing ever leaks
into your scrollback.

Working / needs-you state is fused from two channels: screen patterns
(ported from [ccmanager](https://github.com/kbwo/ccmanager)'s
production-tested detectors, MIT) and the Claude Code session transcript
(`~/.claude/projects/…`), whose `turn_duration` record is the reliable
"turn ended" signal. Permission prompts are detected from the screen itself.

Two runtime dependencies. Node 20+. macOS & Linux.

## Flags

```
catsit <command> [args...]   wrap any agent CLI (claude today; more soon)
catsit --demo                bundled fake agent, for trying it out
  --no-swallow               cat never gates keystrokes
  --no-cat                   no overlay at all
  --quiet                    no bell when the cat gets up
```

## FAQ

**Why "catsit"?** The cat sits on your terminal, and it cat-sits your agent.

**Codex / Gemini CLI / opencode?** Planned — the detector is an interface,
and the transcript channel is Claude-specific but optional. PRs welcome.

**Windows?** Not yet (ConPTY port planned).

**Does it slow the agent down?** Compositing costs ~0.1 ms per frame and
nothing at all while the cat is off screen.

## Credits

The "cute thing physically intervenes" mechanic was inspired by
[Cat Gatekeeper](https://github.com/zokuzoku/cat-gatekeeper) by ZOKUZOKU —
a giant cat that blocks your doomscrolling. catsit is an independent project;
different cat, different problem: it guards the *agent*, from *you*.

MIT © JinHyuk Sung
