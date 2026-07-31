<div align="center">

# catsit

**AI 에이전트 돌보는 일, 고양이한테 맡기세요.**

Claude가 일하는 동안 진짜 아기 고양이 한 마리가 터미널을 지킵니다.<br>
사람 손이 필요해지면 벌떡 일어나 야옹 한 번, 그러고는 다시 옆에 앉습니다.<br>
작업이 끝나면 조용히 일어나 나갑니다 — 고양이가 떠났다면 끝난 겁니다.

<img src="docs/assets/demo.gif" alt="catsit 데모: 진짜 흰 아기 고양이가 터미널로 걸어 들어와 Claude Code가 일하는 동안 앉아 기다리다 낮잠을 자고, 권한 프롬프트가 뜨면 벌떡 일어나 야옹한 뒤 다시 앉고, 작업이 끝나면 걸어 나간다" width="720">

<sub>스프라이트가 아니라 한 마리를 이어 찍은 원테이크입니다 (제작기는 FAQ 참고). 기본 설정에서는 키 입력을 절대 건드리지 않으며, <code>--guard</code>를 켰을 때만 개입합니다.</sub>

<b>온전한 화질의 고양이는 kitty · Ghostty · WezTerm · iTerm2에서 나옵니다</b> — 그 밖의 터미널에서는 도트 화질로 살아 움직입니다.

[English](README.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

</div>

## 고양이의 하루

한 마리가 처음부터 끝까지 연기합니다 — 장면 전환도 전부 이어져 있습니다.

<table>
<tr>
<td align="center" width="33%"><b>에이전트가 일을 시작하면</b><br><sub>걸어 들어와 자리를 잡습니다</sub><br><img src="docs/assets/states/arrive.gif" width="240"></td>
<td align="center" width="33%"><b>작업 중</b><br><sub>얌전히 앉아 있으면 신경 쓸 일이 없다는 뜻</sub><br><img src="docs/assets/states/idle.gif" width="240"></td>
<td align="center" width="33%"><b>60초 동안 입력이 없으면</b><br><sub>웅크리고 낮잠에 듭니다</sub><br><img src="docs/assets/states/sleep.gif" width="240"></td>
</tr>
<tr>
<td align="center"><b>키를 누르면</b><br><sub>부스스 깹니다: 하품하고, 기지개 켜고, 다시 앉고</sub><br><img src="docs/assets/states/wake.gif" width="240"></td>
<td align="center"><b>손이 필요해지면</b><br><sub>벌떡 일어나 야옹 (+ 터미널 벨), 그리고 다시 앉습니다</sub><br><img src="docs/assets/states/alert.gif" width="240"></td>
<td align="center"><b>작업 완료</b><br><sub>조용히 일어나 나갑니다 — 고양이가 떠나면 끝난 것</sub><br><img src="docs/assets/states/leave.gif" width="240"></td>
</tr>
</table>

## 10초 체험 (에이전트도 토큰도 필요 없음)

```
npx catsit --demo
```

**kitty, Ghostty, WezTerm, iTerm2**에서 실행하면 온전한 화질의 고양이를
만날 수 있습니다. 그 밖의 터미널(Terminal.app, VS Code, tmux…)에서는
반블록 도트 버전이 나옵니다 — 같은 고양이인데 픽셀만 굵어집니다.

## 사용법

```
npx catsit claude
```

이게 전부입니다. 설정 파일도, 훅도, 따로 줄 권한도 없습니다.

## 왜 만들었나

에이전트 시대에 개발자는 베이비시터가 됐습니다. 언제 권한을 물어볼지 몰라
화면에서 눈을 떼지 못한 채, 정작 95%의 시간은 나를 찾지도 않는 스피너만
바라보고 있으니까요.

catsit은 알림의 방향을 뒤집습니다. 고양이가 **거기 있다는 사실 자체**가 신호입니다:

| 고양이가... | 뜻 |
|---|---|
| 🐈 걸어 들어와 앉는다 | 에이전트가 일하는 중. 신경 꺼도 됩니다. |
| 😴 웅크리고 잔다 | 자리 비운 지 꽤 됐지만 여전히 순항 중. |
| 🥱 하품하며 깬다 | 방금 키를 눌렀죠 — 알아챘다는 뜻, 그 이상은 아님. |
| ❗ 벌떡 일어나 야옹한다 | 권한 요청 / 질문 / 완료 — **이제 사람이 나설 차례.** |

고양이가 앉아 있는 동안은 터미널을 잊고 지내도 됩니다. catsit이 지키는 약속입니다.

## 키 입력은 절대 건드리지 않습니다

기본 설정에서 고양이는 **구경만** 합니다. 작업 중에 타이핑을 하든, 메시지를
미리 쌓아두든, 방향을 틀든 — 모든 키 입력이 catsit이 없을 때와 똑같이
에이전트에 전달됩니다. 고양이는 신호일 뿐입니다.

### `--guard`: 문지기 모드 (원할 때만)

작업 중에 나도 모르게 끼어드는 손버릇까지 막고 싶다면 `catsit --guard claude`:

- 에이전트가 일하는 동안 일반 타이핑과 Enter를 삼키되, **삼킨 내용을
  말풍선으로 보여줍니다**(`🐟 hell…`). 키가 안 먹는 게 버그처럼 보이지
  않도록, 처음 삼킬 때는 `guarding · ctrl+g to shoo` 힌트도 함께 띄웁니다.
- `ctrl+c`, `ctrl+d`, `esc`, 화살표 같은 제어 키는 guard 모드에서도 **항상
  그대로 통과**합니다.
- 권한 프롬프트가 감지되면 애니메이션이 나오기 **전에** 게이트부터 엽니다.
- 상태를 확신할 수 없으면 게이트는 열어둡니다. 내부에서 뭔가 잘못되면
  투명 패스스루로 영구 전환됩니다 — 고양이만 사라지고 세션은 멀쩡합니다.
- `ctrl+g`를 누르면 그 세션 동안 고양이를 내보낼 수 있습니다.

## 터미널별 모습

| 터미널 | 렌더링 |
|---|---|
| kitty, Ghostty, WezTerm, iTerm2 3.6+ | 글자 **위에 떠 있는** 진짜 아기 고양이 — 걸어 들어오고, 앉아 기다리고, 벌떡 일어나 야옹하고, 걸어 나가는 장면이 전부 이어진 연속 촬영본 (kitty 그래픽 프로토콜) |
| 그 외 (tmux, VS Code, Terminal.app 포함) | 같은 고양이를 도트 느낌의 반블록으로 — 화질만 낮아질 뿐 걷고 자고 야옹하는 건 그대로 |
| `NO_COLOR` / dumb 터미널 | 소박한 카오모지 `(=˘ω˘=)` |

## 동작 원리

에이전트를 PTY로 감싸 모든 바이트를 그대로 흘려보내면서, 화면을 헤드리스
터미널([@xterm/headless](https://github.com/xtermjs/xterm.js))로 미러링합니다.
고양이가 떠 있는 동안의 모든 출력은 `지우기 → 앱 출력 → 고양이 → 커서 복원`이
한 덩어리로 묶인 원자적 배치라 서로를 깨뜨릴 수 없고, 스크롤백에도 흔적이
남지 않습니다.

상태 판단은 두 채널을 함께 씁니다: 화면 패턴([ccmanager](https://github.com/kbwo/ccmanager)에서
실서비스로 검증된 감지기를 포팅, MIT), 그리고 Claude Code 세션 트랜스크립트의
`turn_duration` 레코드(턴이 끝났다는 구조적 신호). 권한 대기만큼은 화면에서만
판단합니다.

런타임 의존성은 2개. Node 20+. macOS & Linux.

## 플래그

```
catsit <명령> [인자...]   에이전트 CLI를 감쌉니다 (지금은 claude, 점차 확대)
catsit --demo             내장 가짜 에이전트로 체험 (guard 켜짐)
  --guard                 문지기 모드: 작업 중 타이핑을 고양이가 삼킴
                          (ctrl+g로 내보내기)
  --no-cat                오버레이 없이 실행
  --quiet                 야옹(벨) 끄기
```

## FAQ

**진짜 고양이인가요?** 한 마리 아기 고양이를 AI(Kling)로 이어 찍은 연속
연기입니다. 실재하지 않는 그린스크린 무대에서 각 상태의 첫 프레임을 직전
상태의 마지막 프레임에 고정해 생성했기 때문에 컷도, 순간이동도, 미끄러짐도
없습니다. 자세한 제작기는 [assets/cat-frames/CREDITS.md](assets/cat-frames/CREDITS.md).

**이름이 왜 catsit인가요?** 고양이가 앉아 있고(cat sits), 에이전트를
돌봐줍니다(cat-sit = babysit).

**작업 중에 메시지를 미리 보내둘 수 있나요?** 됩니다. 기본 모드는 입력을
아예 가로채지 않아서 예약이든 조종이든 평소처럼 동작합니다. 오히려 *막아주길*
바라는 사람을 위해 `--guard`가 따로 있는 겁니다.

**Codex / Gemini CLI 지원은요?** 계획에 있습니다. 감지기가 인터페이스로
분리돼 있어서 붙일 자리는 이미 마련돼 있습니다.

**Windows는요?** 아직입니다 (ConPTY 포팅 예정).

**느려지지는 않나요?** 합성 비용은 프레임당 ~0.1ms이고, 고양이가 화면에
없을 때는 0입니다.

## 크레딧

"귀여운 것이 물리적으로 개입한다"는 발상은 ZOKUZOKU의
[Cat Gatekeeper](https://github.com/zokuzoku/cat-gatekeeper)(둠스크롤을
막아서는 거대 고양이)에서 영감을 받았습니다. catsit은 별개의 프로젝트입니다 —
고양이도 다르고 문제도 다릅니다. 이쪽은 *에이전트*를 *사람으로부터* 지킵니다.

고양이는 AI로 생성한 연속 연기(Kling)를 비트 단위로 이어붙인 것입니다 —
[assets/cat-frames/CREDITS.md](assets/cat-frames/CREDITS.md) 참고.

MIT © 성진혁
