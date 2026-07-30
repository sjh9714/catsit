# catsit — 터미널 위에서 AI 에이전트를 지키는 고양이

## Context

- 목표: GitHub 스타 확보 (star3 프로젝트, 핸드오프 후보 ③ "터미널 스펙터클 토이"의 실행).
- 리서치 3건(귀여움/펫 계열, 터미널 스펙터클 계열, Claude Code 생태계)을 실측 데이터로 완료:
  - 귀여움 × 실활동 반응 = 검증된 공식(반응형 펫이 장식형 대비 ~145배 스타 속도, Bongo Cat 17개월 후에도 동접 13.9만).
  - 그러나 "에이전트 펫" 레인은 Anthropic `/buddy`·OpenAI `/pet` 퍼스트파티 + clawd-on-desk(5.7k★)로 닫힘. 기존 30+개 펫은 전부 장식/반응만 함 — **"개입(intervention)"하는 물건은 없음**.
  - "같은 명사의 N번째 구현"은 확정 사망(블랙홀 아류 9개 중 8개 ≤27★).
- 사용자가 Cat Gatekeeper(SNS를 오래 보면 고양이가 화면을 점거하는 바이럴 크롬 확장, ZOKUZOKU작, MIT)를 제안 → 그대로 포팅은 아류 함정이라 기각하고, **개입 메커니즘을 에이전트 시대 페인포인트에 리믹스**하기로 사용자와 합의.

## 제품 정의

**한 문장 훅**: *"Claude가 일하는 동안 고양이가 터미널 위에 앉아 너를 막는다. 네가 필요해지는 순간, 고양이가 비켜준다."* — a cat that babysits your AI agent so you don't have to.

동작:
1. `npx catsit claude` 한 줄 (제로 설정, 훅/설정 파일 불필요).
2. Claude Code가 자율 작업 중 → 통통한 고양이가 걸어 들어와 화면 위에 식빵 자세로 눕는다. 일반 키 입력은 고양이가 "삼킨다"(꼬리 흔들기 애니메이션) — "아직이야".
3. 권한 요청/질문/완료/에러 → 고양이가 벌떡 일어나 야옹(BEL)하고 비켜준다 — "네 차례야". **고양이의 존재 = 볼 필요 없음, 고양이가 비킴 = 알림.**

안전 불변식 (절대 규칙):
- Ctrl+C / Ctrl+D / Ctrl+Z / Esc / 모든 ESC 시퀀스(화살표 등) / 기타 C0 제어키는 **무조건 즉시 통과**.
- 권한 프롬프트 감지 즉시(애니메이션보다 먼저, 엣지 트리거) 게이트 해제.
- 상태 불명/감지기 예외 = 게이트 열림(fail-open). 렌더러 예외 = 순수 패스스루로 영구 강등(고양이만 죽고 세션은 산다).
- 종료/크래시 시 터미널 상태 복원(SGR 0, 커서 표시, 마우스 모드 해제, termios 복원). SIGKILL당해도 Claude는 `--resume` 가능.
- Ctrl+G = 고양이 쫓아내기(세션 동안 게이트 영구 해제). `--no-swallow`(장식만) / `--no-cat` / `--quiet` 플래그.

## 확정된 결정 (사용자 합의 완료)

| 항목 | 결정 |
|---|---|
| 이름 | **catsit** (npm 미점유 확인, unscoped → `npx catsit`) |
| 아트 | **진짜 PNG 고양이(kitty 그래픽 프로토콜, 알파 투명·z-index로 TUI 위에 부양) + 반블록 픽셀 폴백 + 카오모지 최종 폴백**. 고해상도 픽셀아트 풍 PNG(~96×64px). 원작과 구별되는 우리 고양이(턱시도 고양이 제안 — 변경 가능), 이름·디자인 독자적, README에 "inspired by Cat Gatekeeper" 크레딧 |
| v1 범위 | Claude Code만, macOS+Linux, Node 20+. Windows/codex/gemini/테마/사운드는 이후 |
| 스택 | TypeScript/ESM, tsup, vitest. 런타임 의존성 2개: `@lydell/node-pty` 1.1.0(프리빌드, install script 없음), `@xterm/headless` 6.0.0 |

## 아키텍처 (Plan 에이전트 검증 완료)

```
claude ── PTY master ──> chunker(이스케이프/UTF-8 안전 경계 분할)
                            ├──> mirror(@xterm/headless, 상시: 상태감지+복원 소스)
                            └──> compositor ──> 실제 stdout
stdin ──> key parser ──> gate ──> PTY master
```

- **하이브리드 렌더링**: 앱 출력 바이트는 원본 그대로 통과(스크롤백/복사/트루컬러 완전 보존). 고양이가 보일 때만 프레임(≤16ms 병합)마다 `DEC 2026 시작 → 고양이 밑 셀 복원(미러 참조) → 앱 바이트 → 고양이 그리기 → 커서 위치/펜 복구 → DEC 2026 끝`을 한 번의 원자적 쓰기로. kitty 그래픽 모드에서는 이미지가 텍스트 위에 떠 있으므로 셀 복원 불필요(더 단순).
- **상태 감지 2채널 융합**: (a) 미러 화면 파싱 — 권한 프롬프트 문자열("Do you want to proceed" 등, Claude Code 2.1.220 바이너리에서 실측), busy 신호("esc to interrupt", 스피너), idle 프롬프트(1500ms 디바운스, ccmanager 검증값) (b) `~/.claude/projects/<cwd-slug>/<session>.jsonl` 테일링 — `system.turn_duration` 이벤트가 턴 종료의 구조적 신호(버전 안정적). 권한 대기는 JSONL에 안 남으므로 화면이 유일 채널.
- 선행 사례: asciinema 작가의 `ht`(PTY랩+서버측 화면 모델), `ccmanager`(xterm-headless로 Claude Code 화면 파싱을 프로덕션 운용 — 감지 정규식 포팅 가능).
- 모듈 구성: `cli / pty / chunker / mirror / compositor / overlay/{cat,sprites,render} / detect/{screen,transcript} / state / input / restore` (Plan 에이전트 산출물 그대로).

## 구현 단계

**Phase 0 — 스파이크 (최우선, go/no-go 게이트)**
실제 Claude Code를 PTY랩 → xterm-headless 미러 → 정적 20×6 컬러 박스 오버레이. 고문 테스트: 긴 생성, ctrl+r 트랜스크립트 뷰, 리사이즈 폭풍, Ghostty/iTerm2/Terminal.app/VS Code/tmux 내부. 합격 기준: 10분 세션 후 스크롤백 잔상 0, 커서 항상 정확, 추가 지연 <5ms, 유휴 CPU <2%. 동시 검증: kitty 프로토콜 z-index over-text가 Ghostty/WezTerm/iTerm2에서 실제 동작하는지, per-frame 재배치 성능. 실패 시 폴백: full-mirror 재렌더 모드(serialize addon) 또는 조용할 때만 그리기.

**Phase 1 — 코어**: chunker(~50줄 상태기계), mirror, compositor, restore(크래시 안전). 여기가 품질의 전부.

**Phase 2 — 감지**: detect/screen(ccmanager 패턴 포팅) + detect/transcript(JSONL 발견·테일) + state 융합(엣지 트리거 게이트).

**Phase 3 — 고양이**: 스프라이트 제작(PNG 프레임: 걸어들어옴/앉기/식빵숨쉬기/잠+zzZ/꼬리치기/꿀꺽/벌떡+야옹/퇴장), kitty 프로토콜 렌더러 + 반블록 렌더러 + 카오모지, input 게이팅 정책, Ctrl+G.

**Phase 4 — 폴리시**: 플래그, 강등 사다리, README(한 줄 훅 → 데모 GIF → `npx catsit claude` → 설명; red-handed 구조 재사용, 영/한/중/일 다국어), 테스트(vitest + 실제 PTY 캡처 픽스처 회귀), CI, npm 배포.

**Phase 5 — 런칭 + 1~2주 팔로업** (아래 별도 절).

구현 세션은 사용자 운용 방식대로 Opus 전환 가능. 각 Phase는 superpowers writing-plans/TDD 프로세스로 상세화하며, 승인 후 첫 커밋에 이 설계를 `docs/superpowers/specs/2026-07-31-catsit-design.md`로 저장.

## 데모 파이프라인 (GIF가 곧 제품)

- `catsit --demo`: 번들된 가짜 에이전트 TUI(작업→권한 프롬프트→완료 시나리오 재현)를 래핑 — 결정론적 데모, Claude 계정/토큰 불필요.
- 히어로 데모(README 최상단): **실제 Ghostty에서 `catsit --demo` 화면 녹화**(vhs는 xterm.js 기반이라 kitty 그래픽 미지원) → mp4/GIF 변환 스크립트. 15초 각본: 고양이 등장→식빵→키 입력 삼킴→권한 요청 순간 벌떡+야옹→비켜줌.
- 보조 GIF(픽셀 폴백 모습)는 red-handed의 vhs 파이프라인(`scripts/demo.tape`) 재사용.

## 배포 / 런칭 (핸드오프 §4·5 준수)

- npm: unscoped `catsit`. 최초 배포는 사용자의 보안 키 인증 필요 → 이후 GitHub Actions OIDC Trusted Publishing(핸드오프의 검증된 `publish.yml` 재사용, 태그 푸시로 릴리스). 토큰 값 대화창 노출 금지.
- **HN 직접 제출 절대 금지** (계정 제한 + 서면 약속). 유기적 유입만; 제3자 제출 시 댓글 등판만 허용.
- 순서(하루 1채널, 스프레이 금지): ① X(사용자 직접, 히어로 영상 첨부 — 이 장르의 검증된 확산 경로는 X→GitHub Trending→Trendshift→릴스/중국 커뮤니티) ② r/coolgithubprojects(링크 전용, 맥락은 첫 댓글, Markdown 에디터+4칸 들여쓰기) ③ r/ClaudeCode(Resource flair — Showcase 없음) ④ GeekNews(사용자 직접, Turnstile) ⑤ 중국(LINUX.DO)·일본 채널 — 다국어 README가 진입점. `LAUNCH.md`(star2, gitignore됨)를 런칭 전 열람.
- 100~300★ 도달 후 awesome-claude-code 브라우저 이슈 폼 제출.
- **팔로업 1~2주**: 이슈 응답을 차별점으로(블랙홀은 바이럴 당일 커밋 중단+이슈 8개 무응답으로 죽음). 터미널 호환성 이슈 대응이 곧 마케팅.
- 지어낸 개인 경험 카피 금지 — 검증 가능한 사실만.

## 검증 방법

- 유닛: chunker(이스케이프/UTF-8 경계), state 융합(픽스처 이벤트 시퀀스), detect/screen(실캡처 버퍼 회귀), input 정책(제어키 통과 표).
- 통합: `catsit --demo` E2E(자동), 실제 `catsit claude`를 Ghostty/iTerm2/Terminal.app/VS Code/tmux에서 수동 체크리스트(스파이크 합격 기준 재사용).
- 크래시 안전: kill -9 후 터미널 상태·Claude `--resume` 확인.
- CI: mac/linux × Node 20/22 매트릭스에서 `npx` 설치 검증.

## 리스크 (상위 3)

1. 오버레이/패스스루 간섭 깨짐 → Phase 0 스파이크로 선검증, 폴백 2단 준비.
2. Claude Code 릴리스마다 감지 문자열 변동 → JSONL 구조 신호 우선, ccmanager 업스트림 추적, fail-open, 버전별 캡처 픽스처.
3. node-pty 네이티브 프리빌드 매트릭스(musl 미지원) → @lydell 프리빌드 + 사전 점검 에러 메시지 + CI 매트릭스.

## 재사용 자산

- `sjh9714/red-handed`: README 구조, 다국어 README, vhs 데모 파이프라인, tsup/vitest 스캐폴드, publish.yml.
- ccmanager(MIT): Claude Code 화면 상태 감지 정규식.
- star2 메모리·LAUNCH.md: 채널 실측 데이터.
