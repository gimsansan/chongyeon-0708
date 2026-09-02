# 대화 기록 — 세션 28 (2026-09-02)

## 1. 사용자

@doc/handoff.md 인계문 이어서

## 2. Claude

State matches the handoff. 남은 코드 작업은 8번(① 토큰층 마무리) 하나입니다. 시작 전에 정리합니다.

**할 것**
1. `constants/instrumentTheme.ts` — `INSTRUMENT_ACCENT.piano`에 `keys`(건반 색)와 `highlight`(오버레이 시안 `#00e5ff`), `INSTRUMENT_ACCENT.guitar`에 `fretboard`(프렛·줄 색)를 **악기색으로 중첩** 추가
2. `MusicTrainingScreen.tsx:1078`의 `110 - 16` → `CONTROL_BAR.standardHeight - CONTROL_BAR.paddingVertical * 2` (8×2=16, 값 동일)
3. 두 화면 스타일시트의 하드코딩 색을 토큰 참조로 교체 — **값은 한 글자도 바꾸지 않음**

**빼는 것 (근거 있음)**
- **미션 아이콘 색**: `MissionProgressIcon.tsx`는 피아노·기타 말고도 게임 화면 4개(`matchGame`·`orderGame`·`matchGameAI`·`matchGamePG`)가 같이 쓴다. 세션 27에서 `instrumentTheme`은 **두 화면 전용**으로 못 박았으므로 여기 색을 올리면 그 결정을 깬다. 위치(`missionIconStyle`)는 이미 `useInstrumentMetrics`가 들고 있어 끝난 상태다.
- 오버레이 시안은 기타에 대응물이 없으므로 공통이 아니라 **피아노 안**에 둔다 (인계문 지침대로).

시작합니다.

## 3. Claude

① 토큰층 마무리(인계문 8번) 코드 작업을 끝냈습니다. **커밋은 안 했습니다** — 색 대조를 실기기에서 한 번 봐야 한다고 인계문에 적혀 있어서, 세션 26 때처럼 확인 전까지 두었습니다.

**바꾼 파일 3개**

| 파일 | 내용 |
|---|---|
| `constants/instrumentTheme.ts` | `INSTRUMENT_ACCENT.piano`에 `keys`(9색)·`highlight`, `.guitar`에 `fretboard`(7색) 추가 |
| `screens/MusicTrainingScreen.tsx` | 건반·오버레이·옥타브 버튼 색 15곳 토큰 참조로, `110 - 16` 매직넘버 제거 |
| `app/(tabs)/guitar/_layout.tsx` | 프렛·현·라벨 색 6줄 토큰 참조로 |

**값은 하나도 안 바뀌었습니다.** 옮긴 색을 전부 원본과 1:1 대조했고, `consoleInnerHeight`도 `110 − 8×2 = 94`로 이전과 같은 수입니다. 남은 하드코딩 색은 grep으로 0건 확인했습니다.

덤으로 잡은 것: `guitar/_layout.tsx`의 `stringName` 색 `#d4a373`이 이미 있던 `GUITAR.accent`와 같은 값이라 중복이었습니다. 토큰으로 합쳤습니다.

**인계문 표에서 하나 뺐습니다 — 미션 아이콘 색.** `MissionProgressIcon.tsx`는 피아노·기타 외에 게임 화면 4개가 같이 쓰는 공용 컴포넌트입니다. 세션 27에서 `instrumentTheme`을 "피아노·기타 두 화면 전용"으로 결정했으니, 여기 색을 그리로 올리면 그 결정과 충돌합니다. 위치는 이미 `useInstrumentMetrics.missionIconStyle`이 들고 있어 끝난 상태고요.

**읽다 발견한 것 (고치지 않음)**: `MusicTrainingScreen.tsx:1755·1793`의 `bottom: 96`. 주석은 "하단 제어반(96px)"이라는데 `CONTROL_BAR`는 표준 110 / 컴팩트 76이라 **어느 쪽과도 안 맞습니다.** 표준 모드면 제어반 위 14px가 오버레이 밖에 남고, 컴팩트 모드면 피아노 영역 20px가 안 덮입니다. 숫자를 바꾸면 화면이 실제로 달라지니 순수 리팩터링 범위 밖이라 그대로 뒀습니다.

검증: `npx tsc --noEmit` → 기존 에러 1건(`hooks/useSyncGameData.ts:44`)만. 통과 기준 그대로입니다.

실기기에서 피아노·기타 두 탭 색이 이전과 같은지 봐주시면, 통과 후 커밋하겠습니다.

## 4. 사용자

문제 없음 커밋해

## 5. Claude

확인 감사합니다. 세션 27 규칙대로 **코드와 문서를 나눠** 커밋했습니다.
