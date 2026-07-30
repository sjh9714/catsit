<div align="center">

# catsit

**替你看管 AI 编程智能体的猫。**

Claude 工作时，一只猫会坐在你的终端上，吞掉你的键盘输入。<br>
需要你的那一刻 —— 权限确认、提问、完成 —— 猫会起身喵一声，让开位置。

<img src="docs/assets/demo.gif" alt="catsit 演示：Claude Code 工作时，一只像素奶牛猫在终端上团成面包坐姿；权限提示出现时它起身喵叫" width="720">

[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md)

</div>

## 10 秒试用（无需智能体，不耗 token）

```
npx catsit --demo
```

## 使用

```
npx catsit claude
```

就这么多。没有配置文件，没有 hook，不需要任何授权。

## 为什么

智能体时代，我们都成了保姆。它*随时*可能弹出权限确认，于是你不敢移开
视线，盯着一个 95% 的时间都不需要你的进程转圈圈。

catsit 把通知反转过来。猫的**存在本身**就是信号：

| 猫在… | 含义 |
|---|---|
| 🐈 走进来趴成面包 | 智能体工作中。不需要你。该干嘛干嘛去。 |
| 😑 甩尾巴吞掉你的按键 | *"还没到你。"* |
| 😴 睡着了 | 任务很长，但一切正常。 |
| ❗ 跳起来喵一声让开 | 权限确认 / 提问 / 完成 —— **该你了。** |

只要能看到猫，就可以无视终端。这是它的承诺。

## 猫绝不添乱

- `ctrl+c`、`ctrl+d`、`esc`、方向键等所有控制键**永远立即放行**。猫只吞普通输入和回车。
- 检测到权限提示的那一刻，闸门在任何动画之前**先**打开。
- 状态未知时闸门保持打开。内部出任何问题都会永久降级为透明直通 —— 猫没了，会话还在。
- `ctrl+g` 把猫赶走（本次会话内）。
- `--no-swallow` 纯装饰模式。

## 各终端下的效果

| 终端 | 效果 |
|---|---|
| kitty、Ghostty、WezTerm、iTerm2 3.6+、Konsole | 真正的 PNG 猫**悬浮在文字上方**（kitty 图形协议，带透明通道） |
| 其他（含 tmux、VS Code、Terminal.app） | 真彩色半块像素猫 |
| `NO_COLOR` / dumb 终端 | 朴素的颜文字 `(=˘ω˘=)` |

## 原理

用 PTY 包裹智能体、逐字节透明转发，同时把屏幕镜像到无头终端
（[@xterm/headless](https://github.com/xtermjs/xterm.js)）。猫可见时，
每次输出都是一个 `修复 → 应用字节 → 猫 → 光标还原` 的原子批次 ——
互不破坏，滚动缓冲区也不会留下任何残影。

状态判定融合两条通道：屏幕模式（移植自 [ccmanager](https://github.com/kbwo/ccmanager)
经生产验证的检测器，MIT）+ Claude Code 会话转录中的 `turn_duration`
记录（回合结束的结构化信号）。

仅 2 个运行时依赖。Node 20+。macOS & Linux。

## 参数

```
catsit <命令> [参数...]   包裹智能体 CLI（目前支持 claude）
catsit --demo             用内置假智能体体验
  --no-swallow            永不拦截按键（纯装饰）
  --no-cat                完全不显示
  --quiet                 关闭喵叫（响铃）
```

## 致谢

"可爱之物物理介入"的机制灵感来自 ZOKUZOKU 的
[Cat Gatekeeper](https://github.com/zokuzoku/cat-gatekeeper)（阻止你刷手机的
巨猫）。catsit 是独立项目 —— 不同的猫，不同的问题：它保护的是*智能体*，
防的是*你*。

MIT © JinHyuk Sung
