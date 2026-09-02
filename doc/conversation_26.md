# 대화 기록 — 세션 26

## 1. 사용자

@app/(tabs)\ @app/(tabs)/guitar\  이 탭도 @screens/MusicTrainingScreen.tsx 탭의 디자인처럼 통일성을 가질려면 어떻게 하면되지? 또한 너의 추천은 ?

## 1. Claude

코드를 다 확인했습니다. 먼저 **지금 두 화면이 실제로 뭐가 다른지**부터 정리하고, 통일 방법과 추천을 드리겠습니다.

### 1. 현재 차이

| 항목 | 피아노 `screens/MusicTrainingScreen.tsx` | 기타 `app/(tabs)/guitar/_layout.tsx` |
|---|---|---|
| 레이아웃 축 | **세로** — 악기(위) / 제어반(아래, 전체 폭) | **가로** — 사이드바 170px(왼쪽) / 프렛보드(오른쪽) |
| 배경 | `#000` | `#1a120b` (우드) |
| 액센트 | `#007BFF` · `#00e5ff` | `#d4a373` · `#8b5e3c` |
| SafeArea | `react-native-safe-area-context` + `insets`로 프레임(`safeAreaFrameStyle`) | RN 기본 `SafeAreaView` (안드로이드 노치 미반영) |
| 반응형 | `useWindowDimensions` + `clampConsole()`로 폰트·패딩·건반 크기 계산 | **전부 고정 px**. `useWindowDimensions`를 import만 하고 안 씀 (`_layout.tsx:10`) |
| 제어반 높이 | 110 / 폴링모드 76 | 없음 (사이드바 고정 170) |
| 버튼 | `trainingButton` / `difficultyButton` / `scaleToggleButton` 3종 체계 | `mainBtn` / `repeatBtn` / `diffBtn` — 이름도 값도 별개 |
| 프레임 아트 | `pan_res.svg`, `console_res.svg` | 없음 |
| 피드백 레이어 | 리플·파티클, 미션 오버레이, 카운트다운 | 없음 |
| 미션 아이콘 | `insets` 반영 | `top:10, right:20` 고정 |

핵심은 **색이 아니라 축과 골격이 다르다**는 겁니다. 색만 맞춰도 통일돼 보이지 않습니다.

### 2. 통일하는 방법 — 3층으로 나누기

**① 토큰층** — `constants/instrumentTheme.ts` 신설
배경 / 제어반 배경·테두리 / 버튼 색·radius / 폰트 스케일 / 제어반 높이(110·76)를 한 곳에 모으고, 악센트만 악기별 override로 둡니다. 지금 두 파일에 하드코딩된 `#007BFF`, `#d4a373`, `borderRadius: 8`이 전부 여기로 갑니다.

**② 컴포넌트층** — `components/instrument/` 로 추출
피아노에만 있는 걸 기타가 재사용할 수 있게 뽑습니다.
- `InstrumentControlBar` ← `styles.trainingContainer` (하단 제어반 껍데기)
- `InstrumentButton` ← `trainingButton` / `difficultyButton` / `scaleToggleButton`을 variant 3종으로
- `DifficultyRow` ← `difficultyContainer` (기타 `diffList`가 이걸 그대로 씀)
- `ScoreFeedbackSection` ← `infoSection` (점수 + 피드백 텍스트)
- `useResponsiveFit()` ← `consoleFit`의 `clampConsole` 계산을 훅으로

`RippleLayer` / `ParticleVisualizer` / `MissionProgressIcon`은 이미 범용이라 기타에 그냥 붙일 수 있습니다.

**③ 골격층** — 기타를 **사이드바 → 하단 제어반**으로 전환
이게 통일성의 8할입니다. 프렛보드를 위 전체 폭으로 펴고, 점수·훈련시작·다시듣기·난이도를 아래 제어반 한 줄로 내립니다. `SafeAreaView`도 `safe-area-context` + `insets` 프레임 방식으로 바꿉니다.

### 3. 내 추천

**추천 A — 색은 통일하지 말고, 골격·간격·타이포만 통일하세요.**
통일감은 구조에서 나오고, 색이 다르면 "같은 앱의 다른 악기"로 읽힙니다. 기타의 우드톤(`#d4a373`)은 이미 잘 잡혀 있으니 버리기 아깝습니다. 토큰에서 `accent`만 갈아끼우는 형태로 두세요. 게다가 `console_res.svg` / `pan_res.svg` 프레임은 질감상 기타 쪽에 더 잘 어울립니다.

**추천 B — 순서는 ③ → ② → ①**
토큰부터 만들면 "뭐가 공통인지" 모른 채 추상화하게 됩니다. 기타를 먼저 하단 제어반 골격으로 옮겨보면 어떤 조각이 진짜 공통인지 드러나고, 그때 ②→①로 뽑는 게 안전합니다.

**추천 C — ③을 하면서 반응형을 같이 해결하세요.** (규칙 3)
기타는 지금 `sidebar: 170`, `stringName: 75`, `fontSize: 12`가 전부 고정이라 **작은 스마트폰 가로에서 프렛보드가 짓눌리고, 태블릿에서는 여백만 남습니다.** 피아노의 `usableWidth/usableHeight` + `clamp` 패턴을 그대로 가져오면 이 문제가 같이 풀립니다.

### 4. 미리 짚어둘 위험 하나

기타는 가로모드라 **세로 공간이 원래 부족**합니다. 프렛보드 6줄인데 110px 제어반을 아래에 깔면 줄당 높이가 작은 폰에서 위험합니다. → 기타는 처음부터 **컴팩트 제어반(76px)** 쪽을 기본으로 쓰고, 사이드바에 있던 난이도 4개는 제어반 가운데 가로 한 줄로 배치하는 게 맞습니다.

---

어느 범위부터 갈까요? 제 추천대로라면 **③ 기타 골격 전환 + 반응형**을 한 덩어리로 먼저 하는 겁니다. 진행할까요?

## 2. 사용자

네

## 2. Claude

좋습니다. 기타 탭을 **하단 제어반 골격 + 반응형**으로 전환하겠습니다. 오디오 로직은 그대로 두고 레이아웃만 손댑니다.

(작업 수행 — `app/(tabs)/guitar/_layout.tsx` 수정)

### 한 것

**골격 — 사이드바를 없애고 피아노와 같은 세로축으로**

- `SafeAreaView`를 `react-native` → `react-native-safe-area-context`로 교체하고, 피아노와 같은 `midgroundLayer` + `safeAreaFrameStyle` (절대배치 + `insets` 프레임) 구조로 바꿨습니다. 안드로이드 노치가 이제 반영됩니다.
- 왼쪽 사이드바 170px → **하단 제어반**. 배치도 피아노와 동일합니다.
  `[뒤로] [점수·피드백 flex1.2] [난이도 4개 flex2.4] [다시듣기·훈련시작 flex1.6]`
- 제어반 스타일 값은 피아노 `trainingContainer`를 그대로 가져왔습니다 (`paddingVertical:8`, `paddingHorizontal:14`, `borderTopWidth:2`, `borderTopColor:'rgba(255,255,255,0.1)'`, `zIndex/elevation:20`). 배경만 우드톤 `rgba(60,42,33,0.85)`.
- 버튼도 피아노 체계로: `trainingButton`(radius 8) / `difficultyButton`(radius 14) / `repeatButton`. **의미색은 통일**했습니다 — 종료 `#FF3B30`, 다시듣기 `#34C759`, 피드백 `#4CAF50`. **악기색은 유지** — 주 액션·활성 난이도는 우드 `#d4a373` (추천 A).
- 미션 아이콘도 고정 `top:10 right:20` → `insets` 기반으로.
- 로딩 화면도 맨몸 `ActivityIndicator` → 피아노처럼 배경 깔린 전체화면으로.

**반응형 — 고정 px 전부 제거** (규칙 3)

`useWindowDimensions`가 import만 되고 안 쓰이던 걸 실제로 쓰게 했습니다. 피아노 `consoleFit`과 같은 방식(비율 + clamp 상하한):

```
controlBarHeight = clamp(usableHeight * 0.2, 58, 88)   // 피아노 컴팩트 76 근처
stringRowHeight  = (usableHeight - 제어반 - 위아래패딩) / 6
```

여기서 나머지가 파생됩니다.

| 값 | 기존(고정) | 지금 |
|---|---|---|
| 줄 이름 폭 | `75` | `clamp(usableWidth*0.1, 42, 92)` |
| 줄 이름 크기 | `12` | `clamp(rowHeight*0.26, 9, 14)` |
| 프렛 글자 | `12` | `clamp(rowHeight*0.3, 9, 16)` |
| 점수 | `22` | `clamp(barH*0.24, 13, 18)` |
| 난이도 패딩 | `6` | `clamp(barH*0.07,3,6)` / `clamp(usableWidth*0.022,7,14)` |

작은 폰 가로에서는 하한(9pt·42px)까지 줄고, 태블릿에서는 상한까지 커집니다.

**작은 것 하나** — `다시 듣기`의 `playSound(currentNote!)`에서 `!` 단언을 빼고 null이면 그냥 return 하게 했습니다. `currentNote`가 없는 찰나에 눌리면 `createAudioPlayer(undefined)`로 갔습니다.

### 확인

- `npx tsc --noEmit` — 기타 파일 오류 0. 남은 건 기존 `hooks/useSyncGameData.ts(44,51)` 하나뿐입니다.
- `expo lint` — 새로 생긴 경고 없음 (뜨는 건 전부 기존 `activeNotes` 미사용, `catch (e)` 등).

### 남겨둔 것 하나

미션 아이콘(48×48, 우상단)이 **1번줄 맨 오른쪽 프렛(G4) 위에 겹칩니다.** 사이드바 시절에도 있던 문제라 이번엔 손대지 않았습니다. 고치려면 `fretboardArea`에 `paddingRight: 60`을 줘서 6줄을 통째로 왼쪽으로 밀면 됩니다(정렬은 유지, 폭 7% 손해). 할까요?

다음 단계는 추천했던 **② 컴포넌트 추출**입니다 — 이제 피아노 제어반과 기타 제어반이 같은 모양이라 뭘 뽑을지가 눈에 보입니다.

## 3. 사용자

이번 답변 md생성해서 저장해,guitar_수정.md . 컴포넌트 추출해

## 3. Claude

두 가지 하겠습니다 — 답변 md 저장, 그다음 컴포넌트 추출.

(작업 수행)

### 1) `doc/guitar_수정.md` 생성

앞 답변을 문서로 옮겼습니다. 전환 내용 + **왜 그렇게 했는지**(색을 통일하지 않은 이유,
제어반을 110이 아니라 76 쪽으로 잡은 이유)까지 같이 적었습니다.

### 2) 컴포넌트 추출 — ② 층

`components/instrument/` 를 새로 만들고 **피아노·기타 양쪽을 여기에 붙였습니다.**
한쪽만 쓰면 추출한 의미가 없기 때문입니다.

| 파일 | 원본 | 하는 일 |
|---|---|---|
| `InstrumentControlBar.tsx` | 피아노 `trainingContainer` | 하단 제어반 껍데기. 높이·배경만 받고 배치만 책임짐 |
| `InstrumentButton.tsx` | `trainingButton`/`difficultyButton`/`scaleToggleButton` | variant 3종(`action`·`difficulty`·`toggle`)으로 합침 |
| `DifficultyRow.tsx` | `difficultyContainer` | 난이도 가로 한 줄 |
| `ScoreFeedback.tsx` | `infoSection` | 점수·피드백·정답힌트 |
| `useInstrumentMetrics.ts` | 양쪽에 중복돼 있던 인셋 계산 | `usableWidth/Height`, `safeAreaFrameStyle`, `missionIconStyle`, `clamp`/`clampRound` |

토큰은 `constants/instrumentTheme.ts` 로 뺐습니다(①을 조금 당겨왔습니다 — 버튼이 색을
받아야 해서 안 만들 수가 없었습니다). `CONTROL_BAR` 치수 · `RADII` · `SEMANTIC`(의미색) ·
`INSTRUMENT_ACCENT`(악기색) 넷입니다.

**색 정책은 코드로 굳혔습니다.** 의미색(중지 빨강 · 다시듣기 초록 · 피드백 초록)은
`SEMANTIC` 하나를 두 악기가 같이 쓰고, 액센트는 `INSTRUMENT_ACCENT.piano/guitar`로 갈랐습니다.

### 작업 중 잡은 것 둘

1. **피드백 줄 수** — 기타 제어반은 낮아서 1줄로 잘라야 하는데, 피아노에 같은 걸 적용하면
   "난이도를 선택하고 [문제 재생]을 눌러 시작하세요!" 같은 안내가 잘려 뜻이 사라집니다.
   `feedbackLines` prop으로 분리해 기타만 `1`을 넘깁니다.
2. **'문제 재생' 색** — 피아노에서 `currentNote`가 없을 때 버튼 뜻이 '다시 듣기'가 아니라
   '문제 재생'으로 바뀝니다. 뜻이 다르므로 초록이 아니라 액센트색을 쓰게 했습니다
   (기존 인라인 `{ backgroundColor: '#007BFF' }` 하드코딩을 토큰으로).

### 확인

- `npx tsc --noEmit` — 두 화면 + 새 컴포넌트 오류 0. 남은 건 기존 `hooks/useSyncGameData.ts:44`.
- `npx expo lint` — 60 problems (3 errors, 57 warnings)로 **작업 전과 동일**.
  3 errors는 전부 기존 것(기타 `Date.now()` 2건, `orderGame.tsx` 1건)이고,
  `components/instrument/*` 와 `MusicTrainingScreen.tsx`는 경고 0입니다.
- `git diff --stat` — 255 insertions / 274 deletions. 피아노가 특히 많이 줄었습니다.
- 실기기 렌더 확인은 못 했습니다.

다음은 ① 토큰층 마무리입니다 — 지금 `instrumentTheme.ts`에 없는 값들(건반/프렛 색, 오버레이,
미션 아이콘)까지 옮기고, 드럼 탭도 같은 골격으로 넣을지 정하면 됩니다.

## 4. 사용자

이번 답변 누적으로 @doc/guitar_수정.md 에 기록하고 새 창에서 작업할테니 인계문도 출력해

## 4. Claude

(작업 수행)

- `doc/guitar_수정.md` — ② 컴포넌트 추출을 §7~§12로 **누적**. 문서 머리를 "누적 문서"로 고치고
  §6 계획 표의 상태를 갱신했다(③ ✅ / ② ✅ / ① ⚠️ 부분).
- `doc/handoff1.md` — 규칙 2-2대로 **누적**. 머리 문단(커밋 상태) 갱신,
  진행 현황 표에 5줄 추가, 「세션 26 작업 로그」 신설, 주의사항에 디자인 항목 3개 추가,
  「다음 작업」에 6·7·8·9번 추가. 5번 푸시 항목은 취소선 대신 숫자를 정정했다.
- `doc/conversation_26.md` — 이 대화까지 이어 적었다.

인계문 요지를 터미널에도 출력했다. 가장 큰 미확인 항목은 **실기기 렌더 확인**이고,
세션 26 작업은 그 때문에 **일부러 커밋하지 않고 작업 트리에 남겼다.**
