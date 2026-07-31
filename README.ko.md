<div align="center">

# catsit

**당신 대신 AI 에이전트를 봐주는 고양이.**

Claude가 일하는 동안 진짜 아기 고양이가 터미널 위에 앉아 지켜봅니다.<br>
당신이 필요해지는 순간 — 권한 요청, 질문, 완료 — 벌떡 일어서서 야옹하고 비켜줍니다.

<img src="docs/assets/demo.gif" alt="catsit 데모: 진짜 흰 아기 고양이가 터미널로 걸어 들어와 Claude Code가 일하는 동안 앉아 기다리다, 권한 프롬프트가 뜨면 벌떡 일어서서 야옹하고 걸어 나간다" width="720">

<sub>한 마리의 연속 원테이크 — 스프라이트가 아닙니다 (만든 방법은 FAQ에). 기본값에서는 입력을 절대 건드리지 않으며 <code>--guard</code>는 옵트인입니다.</sub>

<b>고화질 고양이는 kitty · Ghostty · WezTerm · iTerm2에서</b> — 그 외 터미널은 저해상 살아있는 고양이가 나옵니다.

[English](README.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

</div>

## 고양이의 하루

한 마리의 연속 연기 — 모든 전환이 이어집니다.

<table>
<tr>
<td align="center" width="33%"><b>에이전트가 일을 시작하면</b><br><sub>걸어 들어와 자리를 잡습니다</sub><br><img src="docs/assets/states/arrive.gif" width="240"></td>
<td align="center" width="33%"><b>작업 중</b><br><sub>앉아서 기다립니다 — 고양이가 평온하면 당신은 필요 없다는 뜻</sub><br><img src="docs/assets/states/idle.gif" width="240"></td>
<td align="center" width="33%"><b>60초간 입력이 없으면</b><br><sub>웅크리고 낮잠을 잡니다</sub><br><img src="docs/assets/states/sleep.gif" width="240"></td>
</tr>
<tr>
<td align="center"><b>키를 건드리면</b><br><sub>부스스 일어납니다: 하품, 기지개, 다시 앉기</sub><br><img src="docs/assets/states/wake.gif" width="240"></td>
<td align="center"><b>당신이 필요해지면</b><br><sub>벌떡 일어서서 야옹 (+ 터미널 벨)</sub><br><img src="docs/assets/states/alert.gif" width="240"></td>
<td align="center"><b>비켜줍니다</b><br><sub>걸어 나감 — 화면이 비면 당신 차례</sub><br><img src="docs/assets/states/leave.gif" width="240"></td>
</tr>
</table>

## 10초 체험 (에이전트·토큰 불필요)

```
npx catsit --demo
```

**kitty, Ghostty, WezTerm, iTerm2**에서 실행하면 고화질 고양이를 만납니다.
그 외(Terminal.app, VS Code, tmux…)에서는 저해상 반블록 버전이 나옵니다 —
같은 고양이, 굵은 픽셀.

## 사용법

```
npx catsit claude
```

설정 끝. 설정 파일도, 훅도, 권한 부여도 없습니다.

## 왜 만들었나

에이전트 시대에 우리는 베이비시터가 됐습니다. *지금 당장* 권한을 물어볼지도
모르니 눈을 못 떼고, 95%의 시간 동안 나를 필요로 하지 않는 프로세스를
지켜보며 스피너만 바라봅니다.

catsit은 알림을 뒤집습니다. 고양이의 **존재 자체**가 신호입니다:

| 고양이가... | 의미 |
|---|---|
| 🐈 걸어 들어와 앉는다 | 에이전트 작업 중. 당신은 필요 없음. 딴짓하세요. |
| 😴 웅크려 잠든다 | 당신이 자리 비운 지 꽤 됨. 여전히 잘 돌아가는 중. |
| 🥱 하품하며 깬다 | 당신이 키를 건드림 — 알아챘다는 뜻, 그뿐. |
| ❗ 벌떡 일어서서 야옹하고 비켜준다 | 권한 요청 / 질문 / 완료 — **당신 차례.** |

고양이가 보이면 터미널을 무시해도 됩니다. 그게 이 도구의 약속입니다.

## 고양이는 입력을 절대 건드리지 않습니다

기본값은 **관전 전용**입니다: 작업 중 타이핑, 메시지 예약, 방향 수정 —
모든 키 입력이 catsit 없을 때와 똑같이 에이전트에 도달합니다. 고양이는
순수한 신호일 뿐입니다.

### `--guard`: 게이트키퍼 모드 (옵트인)

고양이가 당신의 마이크로매니징을 진짜로 막아주길 원한다면 `catsit --guard claude`:

- 에이전트 작업 중 일반 타이핑과 Enter를 삼키되, **뭘 먹었는지 말풍선으로
  보여줍니다**(`🐟 hell…`) — 막힌 키가 버그처럼 보이지 않게. 첫 삼킴 때는
  힌트도 함께: `guarding · ctrl+g to shoo`.
- `ctrl+c`, `ctrl+d`, `esc`, 화살표 등 제어 키는 guard 모드에서도 **무조건
  즉시 통과**합니다.
- 권한 프롬프트가 감지되는 즉시, 애니메이션보다 **먼저** 게이트가 열립니다.
- 상태를 모르면 게이트는 열려 있습니다. 내부에서 뭔가 깨지면 투명한
  패스스루로 영구 강등됩니다 — 고양이만 죽고 세션은 삽니다.
- `ctrl+g`로 고양이를 쫓아낼 수 있습니다(세션 동안).

## 터미널별 모습

| 터미널 | 렌더링 |
|---|---|
| kitty, Ghostty, WezTerm, iTerm2 3.6+ | 텍스트 **위에 떠 있는** 진짜 아기 고양이 — 걸어 들어와 앉고, 기다리고, 벌떡 일어나 야옹하고, 걸어 나가는 연속 촬영 연기 (kitty 그래픽 프로토콜) |
| 그 외 (tmux, VS Code, Terminal.app 포함) | 같은 살아있는 고양이를 도트 느낌의 반블록으로 — 저해상이지만 걷고, 자고, 야옹까지 그대로 |
| `NO_COLOR` / dumb 터미널 | 소박한 카오모지 `(=˘ω˘=)` |

## 동작 원리

에이전트를 PTY로 감싸 모든 바이트를 그대로 통과시키면서, 화면을 헤드리스
터미널([@xterm/headless](https://github.com/xtermjs/xterm.js))로 미러링합니다.
고양이가 보이는 동안엔 매 출력이 `복구 → 앱 바이트 → 고양이 → 커서 복원`의
원자적 배치가 되어 서로를 깨뜨릴 수 없고, 스크롤백에 아무것도 남지 않습니다.

상태 판단은 2채널 융합: 화면 패턴([ccmanager](https://github.com/kbwo/ccmanager)의
프로덕션 검증 감지기 포팅, MIT) + Claude Code 세션 트랜스크립트의
`turn_duration` 레코드(턴 종료의 구조적 신호). 권한 대기는 화면에서만 감지됩니다.

런타임 의존성 2개. Node 20+. macOS & Linux.

## 플래그

```
catsit <명령> [인자...]   에이전트 CLI를 감쌈 (현재 claude; 확대 예정)
catsit --demo             내장 가짜 에이전트로 체험 (guard 켜짐)
  --guard                 게이트키퍼 모드: 작업 중 타이핑을 고양이가 삼킴
                          (ctrl+g로 쫓아내기)
  --no-cat                오버레이 없음
  --quiet                 야옹(벨) 끄기
```

## FAQ

**진짜 고양이인가요?** 한 마리 아기 고양이의 AI 생성(Kling) 연속 연기입니다 —
존재하지 않는 그린스크린에서, 모든 상태의 첫 프레임을 직전 상태의 끝 프레임에
고정 생성해서 컷도, 순간이동도, 미끄러짐도 없습니다. 자세한 제작기는
[assets/cat-frames/CREDITS.md](assets/cat-frames/CREDITS.md).

**왜 catsit?** 고양이가 앉고(cat sits), 에이전트를 봐줍니다(cat-sit = babysit).

**작업 중 메시지 예약은 되나요?** 됩니다 — 기본 모드는 입력을 전혀
가로채지 않아서 예약/조종이 그대로 동작합니다. *막히고 싶을 때* 쓰라고
`--guard`가 따로 있는 겁니다.

**Codex / Gemini CLI는?** 계획에 있습니다. 감지기는 인터페이스로 분리돼 있습니다.

**Windows는?** 아직입니다 (ConPTY 포팅 예정).

**느려지지 않나요?** 합성 비용은 프레임당 ~0.1ms, 고양이가 없을 땐 0입니다.

## 크레딧

"귀여운 것이 물리적으로 개입한다"는 메커니즘은 ZOKUZOKU의
[Cat Gatekeeper](https://github.com/zokuzoku/cat-gatekeeper)(둠스크롤을 막는
거대 고양이)에서 영감을 받았습니다. catsit은 독립 프로젝트입니다 —
다른 고양이, 다른 문제: *에이전트*를 *당신으로부터* 지킵니다.

고양이는 AI 생성 연속 연기(Kling)를 비트 단위로 이어붙인 것입니다 —
[assets/cat-frames/CREDITS.md](assets/cat-frames/CREDITS.md) 참고.

MIT © 성진혁
