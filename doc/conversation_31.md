# 대화 기록 — 세션 31 (2026-09-02)

## 1. 사용자

@doc/handoff2.md 인계문 이어서

## 1. Claude

인계문(`doc/handoff2.md`)과 현재 상태를 대조했습니다. **인계문과 작업 트리가 어긋나 있습니다.**

### 인계문이 말하는 것

- 「다음 작업」에 **코드로 손댈 것은 없다**. 2번(오버레이 인셋)은 세션 29에서 실기기 확인까지 닫힘, 3번(테스트 스위치)은 남기기로 결정, 4번(`Source error`)은 보류, 1번은 푸시(사용자 몫).
- "작업 트리는 깨끗하다", "origin보다 10커밋 앞".

### 실제 상태

둘 다 인계문에 없습니다.

| 항목 | 상태 |
|---|---|
| `components/game/InteractiveDrumSet.tsx` | **수정됨 · 미커밋** (4+ / 1−) |
| `doc/conversation_30.md` | **미추적** (세션 30 기록, 67줄) |
| origin 대비 | **10이 아니라 13커밋 앞** (세션 29 문서 커밋 3개가 더 쌓임) |

세션 30에서 **드럼 악기명 레이블 위치**를 다뤘고, 그 결과가 커밋되지 않은 채 남아 있습니다 (`InteractiveDrumSet.tsx:785`, 지금 선택하신 줄).

```
container:                paddingTop: 72 · overflow: 'visible' 추가
currentInstrumentDisplay: top: 1 → 0
```

의도는 `top`을 음수로 주면 부모 밖으로 나가 잘리므로(Android `overflow: hidden`), **부모에 여백을 만들고 레이블을 그 안에 두는 것**입니다.

### 눈에 걸리는 것 두 가지

1. **기록과 코드가 다릅니다.** `conversation_30.md`는 `top: 8`로 적혀 있는데 실제 코드는 `top: 0`입니다. 기록 후 한 번 더 만진 것으로 보입니다.
2. **`paddingTop: 72`가 고정값입니다** (규칙 3). 레이블 자체는 `drumSetSize` 비례인데(`width: Math.max(140, drumSetSize * 0.11)`) 확보한 여백만 고정이라, 작은 스마트폰에서는 여백이 과하고 태블릿에서는 모자랄 수 있습니다.

### 제안

세션 30 작업이 **실기기 확인 전 단계**라 판단됩니다. 어느 쪽으로 이을지 정해주세요.

- **(a)** 지금 상태 그대로 기기에서 확인 → 괜찮으면 코드/문서 커밋 + 인계문에 세션 30 로그 추가
- **(b)** 확인 전에 `paddingTop`을 `drumSetSize` 비례로 먼저 바꾸고(규칙 3) 그 다음 확인
- **(c)** 다른 작업

기록 파일은 이 세션이 새 세션이므로 `doc/conversation_31.md`로 새로 만들면 됩니다 (규칙 2-1). 아직 아무것도 고치지 않았습니다.

## 2. 사용자

너가 파악 못한 것은 내가따로 고친것이다. @components/game/InteractiveDrumSet.tsx   아래를 그대로 복붙해서 쓰면 됩니다.

---

드럼 연주 화면에서 **악기명 레이블만** 위로 올려라. 드럼 세트·캐릭터·하단 버튼 위치는 바꾸지 마라.

원인: `InteractiveDrumSet` 안에서 `top`을 0 아래로 내리면 `ScrollView`/`FlatList`에 잘려 배경(`drum_m.webp`)이 보인다. 그래서 레이블을 **ScrollView 밖**으로 빼라.

할 일:
1. `app/(tabs)/drum/index.tsx`에서 `onInstrumentChange={() => {}}`를 실제 상태로 받는다.
2. 헤더 아래, ScrollView **밖**에 악기명 레이블을 그린다. 기존 스타일(`currentInstrumentDisplay` / `currentInstrumentText`)을 유지한다.
3. 표시 조건은 지금과 같다. 악기 한 번 고른 뒤에만 보이고, 퀴즈 중(`isQuizActive`)에는 숨긴다.
4. `components/game/InteractiveDrumSet.tsx` 안의 기존 레이블은 중복이니 제거하거나 `hideCurrentInstrumentLabel`로 항상 숨긴다.
5. `sectionDrum`의 `marginTop`, 드럼 세트 `paddingTop`은 레이블 올리려고 건드리지 마라.

수정 파일: `app/(tabs)/drum/index.tsx`, `components/game/InteractiveDrumSet.tsx`

---

Agent 모드로 바꾸면 이대로 적용할 수 있습니다. 교차검증해봐 이 방법이 좋을 지 판단해

## 2. Claude

코드를 직접 대조했습니다. **방향은 맞습니다.** 다만 그대로 붙이면 버그가 하나 생깁니다.

### 플랜이 맞게 짚은 것

| 주장 | 검증 |
|---|---|
| `onInstrumentChange={() => {}}`가 비어 있다 | ✅ `index.tsx:430` — 실제로 no-op |
| 레이블이 `ScrollView`/`FlatList`에 잘린다 | ✅ 구조가 `ScrollView(414)` → `sectionDrum(422)` → `HorizontalDrumScroller` → `FlatList` 셀(`1102`) → `InteractiveDrumSet`. 음수 `top`은 셀에서 잘림 |
| `top`만 올리는 건 안 된다 | ✅ `horizontalScrollContainer`가 `flex: 1`이지만 부모가 콘텐츠 크기라, `container` 높이가 사실상 드럼 세트 높이다. **`top: 0`이 이미 드럼 세트 꼭대기**라 더 올릴 여지가 없다 |

**결정적인 근거는 이 파일에 이미 같은 패턴이 있다는 것입니다.** 캐릭터·순환 버튼은 이미 ScrollView 밖으로 빼서 `drumOverlayFixed`(`index.tsx:446`, `styles:705`)로 그리고 있습니다. 같은 문제를 같은 방식으로 이미 한 번 푼 화면입니다. 플랜은 그 선례를 따르는 것이라 구조적으로 이질적이지 않습니다.

그리고 **"드럼 세트 위치를 바꾸지 마라"는 조건을 지키면 이 방법밖에 없습니다.** 지금 미커밋 상태인 `paddingTop: 72`는 정확히 그 조건을 어깁니다(드럼이 내려감).

### 플랜이 놓친 것 — 이대로 하면 버그

**1. `InteractiveDrumSet`은 하나가 아니라 넷입니다. (실제 버그)**

`FlatList`가 2·3·4·5악기 페이지 4개를 그리고, **각 페이지가 자기 `currentInstrument` 상태를 따로** 들고 각각 `onInstrumentChange`를 호출합니다(`index.tsx:1109`). 부모에 상태 하나만 두면:

> 2악기 페이지에서 스네어를 고른 뒤 3악기 페이지로 넘긴다 → 그 페이지는 아직 아무것도 안 골랐는데 **레이블엔 "스네어"가 그대로 남습니다.**

`removeClippedSubviews`가 없어 4개가 전부 살아 있으므로, 넘어간 페이지가 상태를 지워주지도 않습니다. 부모에 이미 `currentDrumScrollIndex`가 있으니 **페이지 인덱스를 같이 넘겨 현재 페이지 것만 반영**하면 됩니다.

**2. 이름이 이미 쓰이고 있습니다.**

부모의 `currentInstrument`(`index.tsx:204`)는 **퀴즈 정답 악기**입니다(`267`·`479`줄에서 재생에 씀). 새 상태는 다른 이름이어야 합니다.

**3. `onInstrumentChange`를 인라인으로 넘기면 안 됩니다.**

`InteractiveDrumSet.tsx:106-110`에서 이 prop이 **`useEffect` 의존성**입니다. 지금은 no-op이라 무해하지만 부모 state를 세팅하는 순간 `setState → 리렌더 → 새 함수 → effect 재실행`이 돕니다. `useCallback`으로 감싸야 합니다. `HorizontalDrumScroller`의 중계(`1109`)도 마찬가지입니다.

**4. 표시 조건은 "지금과 같다"가 그대로 되지 않습니다.**

지금 조건은 `currentInstrument && !hideCurrentInstrumentLabel && instrumentLabelVisible`이고, `instrumentLabelVisible`은 자식 로컬 상태입니다. 다만 확인해 보니 이 플래그는 `currentInstrument`와 **항상 같이 켜지고**(`snapToInstrument:349-350`, 마커 `onPress:702-703`), `moveToNeutralPosition`이 `currentInstrument`만 null로 되돌립니다(`532`). 즉 **`currentInstrument !== null` 하나로 대체 가능**합니다. 플래그를 같이 올릴 필요는 없습니다.

**5. 규칙 3(반응형).** 헤더 아래 고정으로 옮기면 레이블이 화면 상단 기준이 되고, 드럼 세트는 `sectionDrum.marginTop: 150` 기준이라 **둘 사이 간격이 기기마다 벌어집니다.** 기존 캐릭터 오버레이가 `fixedButtonBottomOffset`으로 배경 렌더 높이를 계산해 맞춘 이유가 이것입니다. 작은 폰·태블릿 양쪽을 봐야 합니다.

**6. 플랜 4번은 "제거"를 고르는 게 맞습니다.** `hideCurrentInstrumentLabel`을 항상 true로 두면 prop 의미가 "퀴즈 중 숨김"에서 뒤집히고 죽은 코드가 남습니다. `InteractiveDrumSet`은 이 화면에서만 쓰이므로(전수 확인) 제거해도 안전합니다.

### 판단

**채택하되 1·2·3·5를 보완해서.** 플랜 그대로는 페이지 전환 시 레이블이 남는 버그가 확실히 납니다.

지금 미커밋 상태인 `paddingTop: 72` / `top: 0`은 이 작업과 충돌하므로 **되돌리고 시작**해야 합니다.

적용할까요? 그러면 `paddingTop` 되돌리기 → 부모에 페이지 인덱스까지 받는 상태 추가 → 헤더 아래 오버레이 → 자식 레이블 제거 순으로 진행하고, 레이블 세로 위치는 고정 px 대신 헤더 실측 높이(`headerHeight`, 이미 있음) 기준으로 잡겠습니다.

## 3. 사용자

커밋 하고  진행해

## 3. Claude

커밋부터 하고 시작하겠습니다. 세션 27 규칙대로 코드와 문서를 나눕니다.

(커밋 `56c0984` 코드 · `3a872a2` 문서 — 세션 30 작업물)

커밋 완료(`56c0984`, `3a872a2`). 이제 구현합니다. 먼저 자식 컴포넌트에서 레이블을 걷어냅니다.

자식 정리 완료. 이제 부모 쪽 — 스크롤러가 페이지 인덱스를 함께 올려보내게 합니다.

Now 부모 `Index`에 페이지별 악기 상태와 오버레이를 넣습니다.

Now the render — 스크롤러 props 교체와 헤더 아래 오버레이 추가.

Now the styles.

타입체크 통과 — 남은 오류는 인계문에 기록된 기존 항목(`useSyncGameData.ts(44,51)`) 하나뿐입니다. 변경 내용을 확인합니다.

코드 커밋 완료(`2b6c34c`). 이제 이 세션 대화 기록을 새로 만듭니다(규칙 2-1).
