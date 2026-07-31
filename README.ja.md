<div align="center">

# catsit

**あなたの代わりに AI エージェントの面倒を見る猫。**

Claude が作業している間、猫がターミナルの上に座り、あなたのタイピングを飲み込みます。<br>
あなたの出番になった瞬間 — 権限確認、質問、完了 — 猫は立ち上がり、鳴いて、道を譲ります。

<img src="docs/assets/demo.gif" alt="catsit デモ: 本物の白い子猫がターミナルに歩いて入り、Claude Code の作業中は座って待ち、権限プロンプトが出ると立ち上がって鳴き、歩き去る" width="720">

<sub>実写映像です — スプライトではなく一匹の連続した演技。デフォルトでは入力に一切触れず、<code>--guard</code> はオプトインです。</sub>

[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md)

</div>

## 10秒で試す（エージェント・トークン不要）

```
npx catsit --demo
```

## 使い方

```
npx catsit claude
```

セットアップはこれだけ。設定ファイルもフックも不要です。

## なぜ

エージェント時代、私たちはベビーシッターになりました。*今すぐ*権限を
聞かれるかもしれないから目が離せず、95% の時間は自分を必要としない
プロセスのスピナーを眺め続けています。

catsit は通知を反転させます。猫の**存在そのもの**がシグナルです：

| 猫が… | 意味 |
|---|---|
| 🐈 歩いてきて香箱座り | エージェントは作業中。あなたは不要。離席どうぞ。 |
| 😑 尻尾を振ってキー入力を飲み込む | *「まだだよ」* |
| 😴 眠る | 長いタスク。でも順調。 |
| ❗ 立ち上がって鳴き、道を譲る | 権限確認 / 質問 / 完了 — **あなたの番。** |

猫が見えている限り、ターミナルは無視していい。それがこのツールの約束です。

## 猫は入力に一切触れません

デフォルトは**観戦専用**：作業中のタイピング、メッセージ予約、方向修正 —
すべてのキー入力は catsit なしのときと全く同じにエージェントへ届きます。
猫は純粋なシグナルです。

### `--guard`：ゲートキーパーモード（オプトイン）

猫に本気でマイクロマネジメントを止めてほしいなら `catsit --guard claude`：

- 作業中の通常タイピングと Enter を飲み込み、**何を食べたか吹き出しで
  見せます**（`🐟 hell…`）— ブロックがバグに見えないように。初回は
  ヒント付き：`cat is guarding · ctrl+g to shoo`。
- `ctrl+c`、`ctrl+d`、`esc`、矢印キーなど制御キーは guard モードでも
  **常に即座に通過**。
- 権限プロンプトを検出した瞬間、アニメーションより**先に**ゲートが開きます。
- 状態が不明ならゲートは開いたまま。内部で何かが壊れたら透過パススルーに
  永久降格 — 猫は消えてもセッションは生き続けます。
- `ctrl+g` で猫を追い払えます（セッション中）。

## 猫の一日

一匹の連続した演技 — すべての遷移がつながっています。

<table>
<tr>
<td align="center" width="33%"><b>エージェントが作業開始</b><br><sub>歩いて入り、腰を落ち着けます</sub><br><img src="docs/assets/states/arrive.gif" width="250"></td>
<td align="center" width="33%"><b>作業中</b><br><sub>座って待つ — 猫が穏やかなら出番なし</sub><br><img src="docs/assets/states/idle.gif" width="250"></td>
<td align="center" width="33%"><b>60秒間入力がないと</b><br><sub>丸くなって昼寝</sub><br><img src="docs/assets/states/sleep.gif" width="250"></td>
</tr>
<tr>
<td align="center"><b>キーに触れると</b><br><sub>ゆっくり目覚めます：あくび、伸び、座り直し</sub><br><img src="docs/assets/states/wake.gif" width="250"></td>
<td align="center"><b>あなたの出番</b><br><sub>立ち上がって鳴く（+ ターミナルベル）</sub><br><img src="docs/assets/states/alert.gif" width="250"></td>
<td align="center"><b>道を譲る</b><br><sub>歩き去る — 画面が空いたらあなたの番</sub><br><img src="docs/assets/states/leave.gif" width="250"></td>
</tr>
</table>

## ターミナル別の見え方

| ターミナル | 表示 |
|---|---|
| kitty, Ghostty, WezTerm, iTerm2 3.6+, Konsole | テキストの**上に浮かぶ**本物の子猫 — 歩いて入り、座って待ち、立ち上がって鳴き、歩き去る連続撮影の演技（kitty graphics protocol） |
| その他（tmux, VS Code, Terminal.app 含む） | トゥルーカラー半ブロックのピクセル猫 |
| `NO_COLOR` / dumb 端末 | つつましい顔文字 `(=˘ω˘=)` |

## 仕組み

エージェントを PTY でラップして全バイトをそのまま転送しつつ、画面を
ヘッドレス端末（[@xterm/headless](https://github.com/xtermjs/xterm.js)）に
ミラーリング。猫の表示中は毎フレームが `修復 → アプリ出力 → 猫 → カーソル復元`
の原子的バッチになり、互いを壊せず、スクロールバックにも何も残りません。

状態判定は 2 チャンネルの融合：画面パターン（[ccmanager](https://github.com/kbwo/ccmanager)
の実運用検証済み検出器を移植、MIT）+ Claude Code セッショントランスクリプトの
`turn_duration` レコード（ターン終了の構造的シグナル）。

ランタイム依存は 2 つ。Node 20+。macOS & Linux。

## フラグ

```
catsit <コマンド> [引数...]   エージェント CLI をラップ（現在 claude）
catsit --demo                同梱のフェイクエージェントで体験（guard オン）
  --guard                    ゲートキーパーモード：作業中のタイピングを
                             猫が飲み込む（ctrl+g で追い払う）
  --no-cat                   オーバーレイなし
  --quiet                    鳴き声（ベル）オフ
```

## クレジット

「かわいいものが物理的に介入する」メカニズムは ZOKUZOKU さんの
[Cat Gatekeeper](https://github.com/zokuzoku/cat-gatekeeper)（ドゥームスクロール
を阻止する巨大猫）に着想を得ました。catsit は独立プロジェクトです —
別の猫、別の問題：*エージェント*を*あなたから*守ります。

子猫は AI 生成の連続演技（Kling）をビート単位でつないだものです —
[assets/cat-frames/CREDITS.md](assets/cat-frames/CREDITS.md) 参照。

MIT © JinHyuk Sung
