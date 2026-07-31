<div align="center">

# catsit

**替你看管 AI 编程智能体的猫。**

Claude 工作时，一只真实的小猫坐在你的终端上守望。<br>
需要你的那一刻 —— 权限确认、提问、完成 —— 它直立起身喵一声，让开位置。

<img src="docs/assets/demo.gif" alt="catsit 演示：一只真实的白色小猫走进终端，在 Claude Code 工作时坐着等待；权限提示出现时它直立起身喵叫，然后走开" width="720">

<sub>同一只猫的连续一镜到底 —— 不是精灵图（制作方式见致谢）。默认情况下 catsit 绝不碰你的输入，<code>--guard</code> 为可选项。</sub>

[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md)

</div>

## 猫的一天

同一只猫的连续表演 —— 每个转场都无缝衔接。

<table>
<tr>
<td align="center" width="33%"><b>智能体开始工作</b><br><sub>走进来，安顿下来</sub><br><img src="docs/assets/states/arrive.gif" width="240"></td>
<td align="center" width="33%"><b>工作中</b><br><sub>坐着等待 —— 猫安静说明不需要你</sub><br><img src="docs/assets/states/idle.gif" width="240"></td>
<td align="center" width="33%"><b>60 秒无输入</b><br><sub>蜷成一团打盹</sub><br><img src="docs/assets/states/sleep.gif" width="240"></td>
</tr>
<tr>
<td align="center"><b>你碰了键盘</b><br><sub>慢悠悠醒来：打哈欠、伸懒腰、坐好</sub><br><img src="docs/assets/states/wake.gif" width="240"></td>
<td align="center"><b>需要你了</b><br><sub>直立起身喵叫（+ 终端铃声）</sub><br><img src="docs/assets/states/alert.gif" width="240"></td>
<td align="center"><b>让开位置</b><br><sub>走出画面 —— 屏幕空了就轮到你</sub><br><img src="docs/assets/states/leave.gif" width="240"></td>
</tr>
</table>

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
| 🐈 走进来坐下 | 智能体工作中。不需要你。该干嘛干嘛去。 |
| 😴 蜷成一团睡着 | 你离开有一会儿了。一切照常。 |
| 🥱 打着哈欠醒来 | 你碰了键盘 —— 它注意到了，仅此而已。 |
| ❗ 直立起身喵叫让开 | 权限确认 / 提问 / 完成 —— **该你了。** |

只要能看到猫，就可以无视终端。这是它的承诺。

## 猫绝不碰你的输入

默认是**纯观战**模式：工作中打字、排队消息、中途转向 —— 每一次按键都
和没有 catsit 时一模一样地到达智能体。猫只是信号。

### `--guard`：守门员模式（可选）

想让猫真的阻止你微观管理？`catsit --guard claude`：

- 智能体工作时吞掉普通输入和回车，并**用气泡展示吃了什么**（`🐟 hell…`），
  被拦截的按键绝不会看起来像 bug。第一次吞按键还附带提示：
  `guarding · ctrl+g to shoo`。
- `ctrl+c`、`ctrl+d`、`esc`、方向键等控制键在 guard 模式下也**永远立即放行**。
- 检测到权限提示的那一刻，闸门在任何动画之前**先**打开。
- 状态未知时闸门保持打开。内部出任何问题都会永久降级为透明直通 ——
  猫没了，会话还在。
- `ctrl+g` 把猫赶走（本次会话内）。

## 各终端下的效果

| 终端 | 效果 |
|---|---|
| kitty、Ghostty、WezTerm、iTerm2 3.6+ | 一只真实小猫**悬浮在文字上方** —— 走进来、坐下、等待、直立喵叫、走开，全程连续表演（kitty 图形协议） |
| 其他（含 tmux、VS Code、Terminal.app） | 同一只活猫的像素半块版 —— 低清但照样走路、打盹、喵叫 |
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
catsit --demo             用内置假智能体体验（guard 开启）
  --guard                 守门员模式：工作时猫会吞掉你的输入
                          （ctrl+g 赶走它）
  --no-cat                完全不显示
  --quiet                 关闭喵叫（响铃）
```

## 致谢

"可爱之物物理介入"的机制灵感来自 ZOKUZOKU 的
[Cat Gatekeeper](https://github.com/zokuzoku/cat-gatekeeper)（阻止你刷手机的
巨猫）。catsit 是独立项目 —— 不同的猫，不同的问题：它保护的是*智能体*，
防的是*你*。

小猫本身是 AI 生成的连续表演（Kling），按节拍无缝拼接 ——
参见 [assets/cat-frames/CREDITS.md](assets/cat-frames/CREDITS.md)。

MIT © JinHyuk Sung
