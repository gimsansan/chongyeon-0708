# 기타 탭 — 피아노와 디자인 통일

**누적 문서다. 지우지 않고 아래로 쌓는다.**

목표: 기타(`app/(tabs)/guitar/_layout.tsx`)를 피아노(`screens/MusicTrainingScreen.tsx`)와
같은 디자인 골격으로 통일 + 반응형(규칙 3).
오디오 로직(LRU 캐시 · blur 해제 · 죽은 플레이어 회수)은 **어느 단계에서도 손대지 않았다.**

| 단계 | 내용 | 문서 위치 |
|---|---|---|
| ③ 골격층 | 기타를 하단 제어반 + 반응형으로 전환 | §1 ~ §6 |
| ② 컴포넌트층 | `components/instrument/` 로 공통 조각 추출 | §7 ~ §12 |
| 실기기 확인 | 두 화면 렌더 확인 — **전부 통과** | §13 ~ §14 |

---

# ③ 골격층 — 기타를 하단 제어반 + 반응형으로

대상: `app/(tabs)/guitar/_layout.tsx` (이 파일 하나만 수정)

## 1. 골격 — 사이드바를 없애고 피아노와 같은 세로축으로

- `SafeAreaView`를 `react-native` → `react-native-safe-area-context`로 교체하고,
  피아노와 같은 `midgroundLayer` + `safeAreaFrameStyle`(절대배치 + `insets` 프레임) 구조로 바꿨다.
  **안드로이드 노치가 이제 반영된다.**
- 왼쪽 사이드바 170px → **하단 제어반**. 배치도 피아노와 동일하다.

  ```
  [뒤로] [점수·피드백 flex1.2] [난이도 4개 flex2.4] [다시듣기·훈련시작 flex1.6]
  ```

- 제어반 스타일 값은 피아노 `trainingContainer`를 그대로 가져왔다.
  `paddingVertical:8` · `paddingHorizontal:14` · `borderTopWidth:2` ·
  `borderTopColor:'rgba(255,255,255,0.1)'` · `zIndex/elevation:20`.
  배경만 우드톤 `rgba(60,42,33,0.85)`.
- 버튼도 피아노 체계로: `trainingButton`(radius 8) / `difficultyButton`(radius 14) / `repeatButton`.
  - **의미색은 통일** — 종료 `#FF3B30`, 다시듣기 `#34C759`, 피드백 `#4CAF50`
  - **악기색은 유지** — 주 액션·활성 난이도는 우드 `#d4a373`
- 미션 아이콘도 고정 `top:10 right:20` → `insets` 기반으로.
- 로딩 화면도 맨몸 `ActivityIndicator` → 피아노처럼 배경 깔린 전체화면으로.

### 색을 통일하지 않은 이유

통일감은 **구조·간격·타이포**에서 나온다. 색까지 맞추면 두 악기가 구분되지 않고,
기타의 우드톤은 이미 잘 잡혀 있어 버리기 아깝다.
의미색(성공/실패/중지)만 맞추고 액센트는 악기별로 두는 쪽이 "같은 앱의 다른 악기"로 읽힌다.

---

## 2. 반응형 — 고정 px 전부 제거

`useWindowDimensions`가 import만 되고 안 쓰이던 걸(`_layout.tsx:10`) 실제로 쓰게 했다.
피아노 `consoleFit`과 같은 방식 — **비율로 잡고 clamp로 상·하한을 건다.**

```ts
controlBarHeight = clamp(usableHeight * 0.2, 58, 88)   // 피아노 컴팩트 76 근처
stringRowHeight  = (usableHeight - 제어반 - 위아래패딩) / 6
```

여기서 나머지가 파생된다.

| 값 | 기존(고정) | 지금 |
|---|---|---|
| 줄 이름 폭 | `75` | `clamp(usableWidth*0.1, 42, 92)` |
| 줄 이름 크기 | `12` | `clamp(rowHeight*0.26, 9, 14)` |
| 프렛 글자 | `12` | `clamp(rowHeight*0.3, 9, 16)` |
| 점수 | `22` | `clamp(barH*0.24, 13, 18)` |
| 난이도 패딩 | `6` | `clamp(barH*0.07,3,6)` / `clamp(w*0.022,7,14)` |

작은 폰 가로에서는 하한(9pt·42px)까지 줄고, 태블릿에서는 상한까지 커진다.

### 제어반을 110이 아니라 76 쪽으로 잡은 이유

기타는 가로모드라 **세로 공간이 원래 빠듯하다.** 프렛보드가 6줄인데
피아노의 기본 제어반 높이(110)를 그대로 깔면 작은 폰에서 줄당 높이가 무너진다.
그래서 피아노의 **폴링모드 컴팩트 높이(76)** 를 기준으로 잡았다.

---

## 3. 작은 수정 하나

`다시 듣기`의 `playSound(currentNote!)`에서 `!` 단언을 빼고 null이면 return 하게 했다.
`currentNote`가 없는 찰나에 눌리면 `createAudioPlayer(undefined)`로 갔다.

---

## 4. 확인

- `npx tsc --noEmit` — 기타 파일 오류 0. 남은 건 기존 `hooks/useSyncGameData.ts:44` 하나뿐.
- `expo lint` — 새로 생긴 경고 없음(뜨는 건 전부 기존 `activeNotes` 미사용, `catch (e)` 등).
- **실기기 렌더 확인은 못 했다** — 에뮬레이터/기기 필요.

---

## 5. 남겨둔 것

미션 아이콘(48×48, 우상단)이 **1번줄 맨 오른쪽 프렛(G4) 위에 겹친다.**
사이드바 시절에도 있던 문제라 이번엔 손대지 않았다.
고치려면 `fretboardArea`에 `paddingRight: 60`을 줘서 6줄을 통째로 왼쪽으로 미는 게 제일 깔끔하다
(정렬 유지, 폭 7% 손해).

---

## 6. 전체 계획에서의 위치

디자인 통일은 3층으로 나눠서 간다. 순서는 **③ → ② → ①**.
토큰부터 만들면 "뭐가 공통인지" 모른 채 추상화하게 되기 때문이다.

| 층 | 내용 | 상태 |
|---|---|---|
| ③ 골격층 | 기타를 하단 제어반 + 반응형으로 전환 | ✅ 완료 (§1~§5) · **실기기 확인됨 §14** |
| ② 컴포넌트층 | `components/instrument/` 로 공통 조각 추출 | ✅ 완료 (§7~) · **실기기 확인됨 §14** |
| ① 토큰층 | `constants/instrumentTheme.ts` 로 색·간격 일원화 | ⚠️ **부분** — 버튼이 색을 받아야 해서 §7-2에서 당겨 만들었다. 남은 값은 §12-2 |

---
---

# ② 컴포넌트층 — `components/instrument/` 추출

대상: 새 디렉터리 `components/instrument/` + `constants/instrumentTheme.ts`,
그리고 **피아노·기타 양쪽 재배선.**

한쪽만 붙이면 추출한 의미가 없다. 그래서 기타뿐 아니라
`screens/MusicTrainingScreen.tsx`도 같이 이 컴포넌트를 쓰게 바꿨다.

---

## 7. 만든 것

### 7-1. 컴포넌트

| 파일 | 원본 | 하는 일 |
|---|---|---|
| `InstrumentControlBar.tsx` | 피아노 `styles.trainingContainer` | 하단 제어반 껍데기. 높이·배경·세로패딩만 받고 **배치만** 책임진다. 안에 뭐가 들어가는지는 화면마다 다르므로 자식은 받기만 한다 |
| `InstrumentButton.tsx` | `trainingButton` · `difficultyButton` · `scaleToggleButton` | variant 3종(`action` · `difficulty` · `toggle`)으로 합쳤다. **색은 넘겨받는다** |
| `DifficultyRow.tsx` | 피아노 `difficultyContainer` | 난이도 단계를 가로 한 줄로. 제네릭 `<T extends string>`이라 피아노 `Difficulty` 유니온과 기타 `string` 둘 다 받는다 |
| `ScoreFeedback.tsx` | 피아노 `infoSection` | 점수 · 피드백 · 정답힌트 |
| `useInstrumentMetrics.ts` | 양쪽에 중복돼 있던 인셋 계산 | `usableWidth/Height` · `safeAreaFrameStyle` · `missionIconStyle` + `clamp` / `clampRound` |
| `index.ts` | — | 재수출 |

### 7-2. 토큰 (`constants/instrumentTheme.ts`)

①을 조금 당겨왔다. **버튼이 색을 받아야 해서 안 만들 수가 없었다.**

| 이름 | 내용 |
|---|---|
| `CONTROL_BAR` | 제어반 치수 — `paddingVertical:8` · `paddingHorizontal:14` · `borderTop*` · `standardHeight:110` · `compactHeight:76` |
| `RADII` | `action:8` · `difficulty:14` · `toggle:6` |
| `SEMANTIC` | **의미색.** `stop:#FF3B30` · `repeat:#34C759` · `feedback:#4CAF50` · `hint:#FF453A` · `score:#fff` |
| `INSTRUMENT_ACCENT` | **악기색.** `piano`(#000 / #007BFF / #555) · `guitar`(#1a120b / #d4a373 / #4f3422) |

### 7-3. 색 정책을 코드로 굳혔다

§1의 「색을 통일하지 않은 이유」가 지금까지는 말뿐이었는데, 이제 타입이 강제한다.

- **의미가 같으면 색도 같다** → `SEMANTIC` 하나를 두 악기가 공유한다.
  이걸 악기별로 갈라두면 "빨강 = 중지"라는 학습이 화면마다 깨진다.
- **악기가 다르면 액센트가 다르다** → `INSTRUMENT_ACCENT.piano / .guitar`.

---

## 8. 재배선

### 8-1. 기타 (`app/(tabs)/guitar/_layout.tsx`)

- 인셋 계산 손코딩 → `useInstrumentMetrics()`
- `Math.round(clamp(...))` 반복 → `clampRound(...)`
- 제어반 `<View style={styles.controlBar}>` → `<InstrumentControlBar>`
- 점수·피드백 블록 → `<ScoreFeedback feedbackLines={1}>`
- 난이도 4개 `map` → `<DifficultyRow>`
- 다시듣기 · 훈련시작/종료 `TouchableOpacity` → `<InstrumentButton>`
- 하드코딩 색 → `GUITAR.*` / `SEMANTIC.*`
- 스타일시트에서 12개 항목 삭제. 남은 건 프렛보드 + 제어반 3구역 폭 배분뿐이다

### 8-2. 피아노 (`screens/MusicTrainingScreen.tsx`)

- `useWindowDimensions` + `useSafeAreaInsets` + `safeAreaFrameStyle` 손코딩 → `useInstrumentMetrics()`
- `trainingContainer` / `fallingTrainingContainer` → `<InstrumentControlBar>` (`paddingVertical`만 분기)
- `bottomPanelHeight`의 매직넘버 `76 : 110` → `CONTROL_BAR.compactHeight : .standardHeight`
- `infoSection` 블록 → `<ScoreFeedback>`
- 난이도 → `<DifficultyRow>`
- 콘솔 안 스케일·템포 토글 4개 → `<InstrumentButton variant="toggle">`
- 콘솔 액션 2개(연주 시작 · 훈련 모드), 훈련 종료, 다시 듣기 → `<InstrumentButton>`
- 스타일시트에서 15개 항목 삭제

**`git diff --stat` — 255 insertions / 274 deletions. 피아노에서만 304줄이 빠졌다.**

---

## 9. 작업 중 잡은 것 둘

### 9-1. 피드백 줄 수 — 공통화하면 안 되는 값이었다

기타 제어반은 낮아서(58~88px) 피드백을 **1줄로 잘라야** 한다.
그런데 같은 걸 피아노에 적용하면

```
"난이도를 선택하고 [문제 재생]을 눌러 시작하세요!"
"난이도가 3단계로 변경되었습니다. [문제 재생]을 누르세요."
```

이런 안내가 잘려 **뜻이 사라진다.** `ScoreFeedback`에 `feedbackLines` prop을 두고
기타만 `1`을 넘긴다. 기본값은 제한 없음(피아노).

> 공통 컴포넌트를 만들 때 **한쪽 화면의 사정을 기본값으로 굳히면 다른 쪽이 조용히 망가진다.**
> 이 건은 피아노 문구를 실제로 읽어봤기 때문에 걸렸다.

### 9-2. '문제 재생' 색

피아노에서 `currentNote`가 없을 때 버튼 뜻이 '다시 듣기'가 아니라 **'문제 재생'** 으로 바뀐다.
뜻이 다르니 초록(`SEMANTIC.repeat`)이 아니라 액센트색을 쓰는 게 맞다.
기존 인라인 하드코딩 `{ backgroundColor: '#007BFF' }` 을 `PIANO.accent` 로 바꿨다.

---

## 10. 확인

- `npx tsc --noEmit` — 두 화면 + 새 컴포넌트 오류 **0**.
  남은 건 기존 `hooks/useSyncGameData.ts:44` 하나뿐이다(이번 작업과 무관).
- `npx expo lint` — **60 problems (3 errors, 57 warnings)로 작업 전과 동일.**
  3 errors는 전부 기존 것 — 기타 `Date.now()` 2건, `orderGame.tsx` 1건.
  `components/instrument/*` 와 `MusicTrainingScreen.tsx`는 **문제 0**.
- ~~**실기기 렌더 확인은 못 했다**~~ — §11에 확인 항목을 적어 뒀다.
  → **완료. 전부 통과 (2026-09-02). §13~§14 참조.**

---

## 11. 다음 사람이 실기기에서 볼 것

두 화면 다 스타일을 크게 들어냈으므로 **눈으로 확인이 필요하다.**

> **이 목록은 §13에서 실제 라벨까지 붙여 다시 적었고, §14에서 전부 통과했다.**

**피아노**
1. 자유 연주 화면 — 점수·피드백 간격, 난이도 5개 줄, 콘솔 안 토글 4개 + 버튼 2개
2. 곡 고르기(좌우 스와이프) 후 **연주 시작** → 제어반이 76px 컴팩트로 줄어드는지
3. 훈련 모드 → **훈련 종료(빨강)** · **다시 듣기(초록)** / 문제 재생(파랑)
4. 긴 안내 문구(`난이도가 …로 변경되었습니다.`)가 **잘리지 않고 줄바꿈되는지** ← 9-1

**기타**
5. 프렛보드 6줄이 화면을 꽉 채우는지 (작은 폰 · 태블릿 둘 다)
6. 제어반 — 점수·피드백 1줄, 난이도 4개, 훈련시작/종료 + 다시듣기
7. 훈련 중 난이도가 흐려지며 안 눌리는지

---

## 12. 남은 일

### 12-1. 미션 아이콘이 프렛에 겹친다 (§5에서 이어짐)

미션 아이콘(48×48, 우상단)이 **1번줄 맨 오른쪽 프렛(G4) 위에 겹친다.**
사이드바 시절에도 있던 문제라 두 단계 모두 손대지 않았다.
`fretboardArea`에 `paddingRight: 60`을 줘서 6줄을 통째로 왼쪽으로 미는 게 제일 깔끔하다
(정렬 유지, 폭 7% 손해). ~~**사용자 판단 대기 중.**~~
→ **해소: 고치지 않는다.** 실기기에서 G4가 정상적으로 눌린다 — §14-1.

### 12-2. ① 토큰층 마무리

`instrumentTheme.ts`에 아직 없는 값들:

| 값 | 지금 어디에 |
|---|---|
| 건반 색 (`whiteKey` · `blackKey` · 라벨) | `MusicTrainingScreen.tsx` 스타일시트 |
| 프렛 색 (`fret` · `fretDisabled` · `stringLine`) | `guitar/_layout.tsx` 스타일시트 |
| 오버레이 (`missionOverlay` · `previewOverlay`, 시안 `#00e5ff`) | `MusicTrainingScreen.tsx` |
| 미션 아이콘 위치·색 | `MissionProgressIcon.tsx` |

### 12-3. 드럼 탭도 같은 골격으로 넣을지

`app/(tabs)/drum/`은 아직 이 체계 밖이다. **넣을지 말지가 먼저 결정돼야 한다** —
드럼은 세로 화면이라(가로 라우트 목록 `LANDSCAPE_ROUTES = ['/activity', '/guitar']`에 없다)
하단 제어반 골격이 그대로 맞지 않을 수 있다.

---
---

# 실기기 확인 (세션 27 · 2026-09-02)

## 13. 확인 목록 — §11을 실제 렌더 라벨까지 대조해 다시 적은 것

§11은 "무엇을 볼지"만 적혀 있어서, 코드를 다시 읽어 **화면에 실제로 뜨는 라벨과 조건**까지
붙였다. 아래가 사용자에게 건넨 목록 그대로다.

> 보내기 전 `npx tsc --noEmit` 재확인 — 남은 에러는 기존 `hooks/useSyncGameData.ts:44` 하나뿐.

### 🎹 피아노 (`activity` 탭 · 가로)

**1. 자유 연주 화면 — 제어반 높이 110**
- 왼쪽: 점수 + 피드백 (여러 줄 허용)
- 가운데: 난이도 5개
- 오른쪽: 콘솔 창 안에 **토글 4개**(`penta5`/`white8` 한 줄, `normal`/`slow` 한 줄)
  + **버튼 2개**(`연주 시작` · `훈련 모드`)
- 콘솔 프레임(SVG) 안에 내용이 넘치거나 잘리지 않는가

**2. 곡 고르고 `연주 시작` → 낙하모드**
- 제어반이 **110 → 76으로 줄어드는가** (`MusicTrainingScreen.tsx:1072-1074`)
- 줄어들면서 건반 높이가 늘어나는가 (`fallingWhiteKeyHeight`)
- 콘솔이 사라지는가

**3. `훈련 모드`**
- `훈련 종료` = **빨강**
- 옆 버튼이 문맥에 따라 바뀌는가 — 낼 음이 있으면 `다시 듣기`(**초록**),
  없으면 `문제 재생`(**파랑**) ← §9-2

**4. 🔴 긴 안내 문구**
- 잘리지 않고 **줄바꿈**되는가. 피아노는 `feedbackLines`를 안 넘긴다(무제한).
  여기가 1줄로 잘리면 공통 컴포넌트 기본값이 잘못 굳은 것이다 ← §9-1

### 🎸 기타 (`guitar` 탭 · 가로)

**5. 🔴 프렛보드 — 작은 폰 · 태블릿 둘 다** (규칙 3)
- 6줄이 화면을 꽉 채우는가, 아래가 잘리거나 위가 비지 않는가

**6. 제어반 (높이 58~88)**
- `[뒤로] [점수·피드백 1줄] [난이도 4개] [다시 듣기 / 훈련 시작]`
- 훈련 중이 **아닐** 때는 `다시 듣기`가 안 보이고 `훈련 시작` 하나만
- 훈련 중에는 `다시 듣기`(초록) + `훈련 종료`(빨강)

**7. 훈련 중 난이도** — 4개가 흐려지며 눌리지 않는가

**8. 안드로이드 노치** (이번에 처음 반영됨)
- 가로에서 노치/펀치홀에 프렛보드 왼쪽이 가려지지 않는가

---

## 14. 결과 — **전부 통과**

사용자가 실기기에서 확인했다 (2026-09-02).

| 대상 | 결과 |
|---|---|
| 🎹 피아노 탭 | **문제 없음** |
| 🎸 기타 탭 | **문제 없음** |
| 📌 미션 아이콘 G4 (§12-1) | **눌러짐 — 터치 안 막힘** |

§6 표의 ③ 골격층 · ② 컴포넌트층이 이로써 **코드 완료 + 실기기 확인**까지 끝났다.

### 14-1. §12-1 미션 아이콘 — **고치지 않는다**

겹쳐 보이지만 **G4 프렛이 정상적으로 눌린다.** 아이콘이 터치를 가로채지 않는다.

그래서 §12-1이 제안한 `fretboardArea`에 `paddingRight: 60`은 **넣지 않는다.**
넣었다면 **프렛보드 폭 약 7%를 아무 대가 없이 잃었을 것이다.**

> 겹침을 "터치가 막힌다"로 단정하고 고쳤으면 손해만 봤다.
> 시각적 겹침과 터치 차단은 **다른 문제**이고, 눌러보기 전에는 알 수 없었다.

시각적으로 거슬린다는 판단이 나중에 나오면 그때 위 방법을 쓰면 된다.
**첫 줄에만 패딩을 주면 1번줄이 나머지 5줄과 어긋나므로 그렇게 하지 말 것.**

### 14-2. 확인 중 발견 — `consoleInnerHeight`의 매직넘버

`screens/MusicTrainingScreen.tsx:1078`

```ts
const consoleInnerHeight = 110 - 16;
```

`110`은 `CONTROL_BAR.standardHeight`와 같은 값인데 **토큰을 안 쓰고 숫자로 박혀 있다.**
지금은 값이 같아 아무 문제 없지만, 토큰을 바꾸면 **제어반만 따라 움직이고 콘솔은 안 따라온다.**
§12-2(① 토큰층 마무리) 할 때 함께 정리한다.
