# 인계문 2 — 세션 10부터

현재 브랜치 **`3-branch`** / HEAD **`09654b6`** (`공용컴포파일생성`).
`main`은 **`04fa48f`** (`doc_10_갱신`)이고 origin/`main`과 같습니다.

사운드 재생 개선(세션 1~9)은 **끝났다.** 그 기록은 [`doc/handoff.md`](./handoff.md)에 있다. **이 파일이 현재 인계문이다.** 구 인계문 전체를 읽지 않는다.

세션 12~13 UI(칩·문구·홈 아이콘·다크 테마)는 **아직 커밋 안 됨.**
(`MatchGameShared.tsx`, AI/PG, `index.tsx`, `doc/conversation_12.md`, `doc/conversation_13.md`, 비교 md 두 개)

---

## 진행 현황

| | 항목 | 상태 |
|---|---|---|
| 사운드 1~5 + 추가 1~4 | 완료, `main` 병합·푸시됨 | 구 인계문 참조 |
| CLAUDE.md 2-4 | **"인계문 머리 읽어"** 규칙 추가 | 완료 |
| PG 결과화면 `🏠 홈으로` | AI와 같이 `statsButton`(80%) | **완료** (`52a5f86`) |
| AI/PG 하드코딩 색 → `COLORS` | 화면 색 그대로, 변수만 | **완료** (세션 11) |
| Stats/LISTENING 공용 분리 | `MatchGameShared.tsx` | **완료** (`09654b6`) |
| 플레이 상태 줄 칩 3개 | `MatchGameStatusChips` (LV / 하트 / 점) | **코드 완료, 미커밋** (세션 12) |
| ~~PG 안내 빼서 AI에 맞추기~~ | 반대로, **둘 다** `"들었던 소리를 모두 선택하세요"` | **완료** (세션 13) |
| 패배 문구 `"남은 정답:"` | AI 라벨만 통일. PG `\|\| '없음'`은 유지 | **완료** (세션 13) |
| 홈 카드 🚀📊🐾 | Ionicons + 원 글로우. `🔀`는 이모지 | **코드 완료, 미커밋** (세션 13) |
| AI/PG 다크 테마 A | 홈 `#352B46` 톤, 공용 스타일 포함 | **코드 완료, 미커밋** (세션 13) |
| 훈련 화면 동물 칸 대비 | `tile` `#53486A` + 악센트 테두리 | **코드 완료, 미커밋** (세션 13) |
| ~~PG 정답 버튼 색 AI hex에 맞추기~~ | 둘 다 `COLORS.successLight` / `success` | **완료** (세션 11, 값은 원래와 같음) |

---

## 남은 일

PG를 AI UI에 맞추는 문구 작업은 **끝났다.** (안내 둘 다 있음, 패배 라벨 `"남은 정답:"`) 알고리즘은 그대로.

선택(지시 없음):

| 항목 | 지금 | 메모 |
|---|---|---|
| 커밋 | 세션 12~13 미커밋 | 푸시는 사용자가 함 |
| AI/PG 리스닝 웨이브 | `MATCH_THEME.gold` (`#FFD54F`) | 소리 맞추기·순서는 `#79A1FF`. 골드는 A안 때 맞춤. 되돌리려면 Shared의 `color` |
| `WaveRipple` 기본값 | 사용자가 `#fff`로 바꿈 | 호출부가 `color`를 넘겨서 화면에 안 먹음 |
| 게임 Stack 전환 | 기본(살짝 확대처럼 보임) | `(games)/_layout.tsx`에 `animation: 'none'` 미적용 |
| 홈 `🔀` | 이모지 유지 | 나머지 3카드는 Ionicons |
| AI `userStats` | Q 루프 안 | 고치면 약점 대상도 바뀜. 문서만 있음 |

제목 `청능 훈련 (PG)` / `(Q-Learning)` 은 **구분용이라 그대로** 둔다.

---

## 작업 로그

### 2026-08-16 (세션 10)

- 구 인계문 전체를 읽고 `이어서`를 시작해 컨텍스트가 커졌다. 이후 **"인계문 머리 읽어"** 규칙을 `CLAUDE.md` 2-4에 넣음.
- 사용자는 iOS 대응 안 함(안드로이드 전용), 푸시는 직접 한다고 함. `main`을 `04fa48f`까지 푸시함.
- 병합 후 `main`에서 `doc_10_갱신`을 커밋·푸시함. 기대한 것은 새 브랜치 이어가기였음. 이후 **`3-branch`** 를 만들어 UI 작업을 이어감.
- PG 결과화면 `🏠 홈으로`를 AI와 같은 `statsButton`으로 바꿈. 커밋 `52a5f86`.

### 2026-08-16 (세션 11)

- AI/PG 남은 하드코딩 색을 `COLORS`로 바꿈. 화면 색은 같음.
- 내용이 같은 `StatsScreen` / LISTENING만 `MatchGameShared.tsx`로 뺌. 커밋 `09654b6`.
- Home/Game/Results는 문구가 달라서 안 합침 (화면 유지).

### 2026-08-16 (세션 12)

- Expo 런처(홈/업데이트/설정)와 청능 앱 진입: `npm start` 후 개발 서버 탭.
- 플레이 상태 줄을 칩 3개로 변경 (`MatchGameStatusChips`). **UI만.** 점수 계산·전송 키 그대로. 미커밋.
- AI vs PG 비교·백엔드 전송 이전/현재를 md로 정리. 미커밋.
- 확인: 컴포넌트 이름(`StatsScreen` → `MatchGameStatsScreen` 등)은 화면용. `syncData('matchGameAI'|'matchGamePG', payload)` 키는 그대로. `useSyncGameData`의 `return;`도 그대로.

### 2026-08-16 (세션 13)

- 안내 문구: 처음엔 PG에서 뺐다가, 사용자가 반대로 말해 **AI에도** `"들었던 소리를 모두 선택하세요"` 넣음. PG도 복구.
- 패배 문구: AI `"정답:"` → `"남은 정답:"`. PG `|| '없음'`은 안 맞춤. (`correctSoundNames`는 남은 정답 Set)
- 홈 `index.tsx`: 🚀📊가 안드로이드에서 단색 남색. `\uFE0F` 무효. Ionicons `rocket` / `stats-chart`. 🐾도 어두워 `paw` 없음 → `volume-high`. 원 글로우 + 아이콘 `#FFF7E8`. `🔀` 유지.
- AI/PG UI **A안 다크**: `MATCH_THEME` + `createMatchGameScreenStyles`. 통계·칩·리스닝·홈/플레이/결과. 표준 버튼 AI 분홍 / PG 보라. **알고리즘·payload 그대로.**
- 훈련 화면 동물 칸이 배경과 묻힘 → `tile` `#53486A`, 테두리 악센트 불투명.
- 웨이브가 노란 이유: A안 때 Shared를 `gold`로 바꿈. `matchGame.tsx`는 `#79A1FF` 유지. `WaveRipple` 기본 `#fff`는 호출부가 덮음.
- 진입 시 살짝 확대: 우리가 넣은 연출 아님. native stack 기본. `animation: 'none'`은 안 넣음.

---

## 주의사항

- **현재 인계문은 `doc/handoff_2.md`.** `"인계문 작성해"` / `"이어서"` / `"인계문 머리 읽어"` 는 이 파일을 본다. 구 `doc/handoff.md`는 사운드 작업 아카이브.
- **인계문은 작업 지시서가 아니라 상태 보고서.** 머리만으로 남은 일을 알 수 있으면 로그·코드를 전수하지 않는다.
- **iOS 대응하지 않음.** 안드로이드 전용.
- **푸시는 사용자가 한다.**
- 동물게임 겹침 소리, 단어 탭 재진입 초기화, `useSyncGameData`의 `return;`, matchGame 1500ms 등은 **구 인계문의 확인된 의도**다. 이 작업에서 건드리지 않음.
- PG/AI는 화면이 거의 복제다. UI를 맞출 때 **알고리즘 파일은 바꾸지 않는다.**
- **공용 화면 분리 ≠ 전송 계약 변경.** payload 키와 gameId는 AI/PG 파일에 그대로 있다. 근거: [`doc/matchGame-백엔드-전송-이전현재.md`](./matchGame-백엔드-전송-이전현재.md)
- 점수: 라운드마다 0, `계속하기`도 0. 쌓이는 건 `userStats`. AI 통계는 남은 정답 기준, PG는 누른 동물 기준. [`doc/matchGame-AI-PG-비교.md`](./matchGame-AI-PG-비교.md)
- ~~PG 안내 빼서 AI(없음)에 맞추기~~ → **둘 다 안내 있음.**
- A안 다크는 `MatchGameShared.tsx` 공통 스타일까지 같이 만짐. 통계만 밝게 남기지 않음.
- `WaveRipple` 기본값을 바꿔도 `color` prop이 있으면 안 바뀜. AI/PG는 `MATCH_THEME.gold`.
- 홈→게임 확대 느낌은 `(games)/_layout.tsx` Stack 기본 전환. 다크 맞춘 뒤 더 티가 남.

---

## 참고

| 파일 | 내용 |
|---|---|
| `doc/handoff.md` | 세션 1~9 사운드 작업 (아카이브) |
| `doc/conversation_10.md` | 세션 10 대화 |
| `doc/conversation_11.md` | 세션 11 대화 (색·공용 분리) |
| `doc/conversation_12.md` | 세션 12 대화 (칩·비교·백엔드) |
| `doc/conversation_13.md` | 세션 13 대화 (문구·홈 아이콘·다크 A) |
| `doc/matchGame-AI-PG-비교.md` | Q-Learning vs PG, 통계·약점 모드 |
| `doc/matchGame-백엔드-전송-이전현재.md` | 공용 분리와 payload 불변 근거 |
| `CLAUDE.md` | 작업 규칙 (2-4 포함) |
