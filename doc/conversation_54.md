# 세션 54 대화 기록

## 1. 사용자

@doc/handoff9.md 인계문 이어서

## 1. Claude

인계문과 이력을 확인했습니다. 작업 트리는 깨끗하고 `c40fba9`(세션 53 인계문 누적)에 있습니다.

**열려 있는 항목은 1번(아직 다 안 훑은 화면) 하나뿐**이고, 다음 차례는 **`WordFlashcard`(346) + `Waveform`(140) 전수 점검**입니다. 두 파일 다 `dcbe37b` 이후로 안 바뀌었지만, 그때 범위가 **「부분」(치수·재생 강조)**이라 건너뛰기 판정에 걸리지 않습니다 — 전수는 아직 한 번도 안 했습니다.

`import`를 따라가니 묶음에 **`components/game/waveformData.ts`**가 하나 더 있습니다(이력 표에 없는 파일). `useWordAudioPlayer`(246)는 세션 52에 0건으로 봤습니다.

시작하겠습니다.

## 2. Claude

0절·0-2절을 먼저 읽었고, `dcbe37b` 이후 두 파일이 안 바뀌었지만 그때 범위가 **「부분」**이라 전수로 훑었습니다. 근거는 `@react-navigation/core`·`react-native-reanimated` 소스까지 따라갔습니다.

## `WordFlashcard` + `Waveform` (단어 카드 안) 점검 — 17건

| # | 갈래 | 자리 | 무엇이 / 어떻게 되는가 |
|---|---|---|---|
| 1 | 🔧 | `WordFlashcard.tsx:17,149,154,201` | **`minimal` prop을 아무도 안 넘긴다.** 유일한 사용처(`flashcards/index.tsx:696`)가 `wordPair`만 준다 — 늘 `false`다. `vsContainerSpacer` 스타일 · `LAYOUT.vsSpacerMinWidth` · 세 군데 분기가 통째로 죽었다 |
| 2 | 🔧 | `Waveform.tsx:21,45,49,53-62` | **`isPlaying` prop과 `fallbackProgress`·그 `useEffect`가 죽었다.** 유일한 호출자가 늘 `progress`를 넘기므로 `if (progressProp) return;`에서 매번 되돌아간다 — 3초 withTiming 폴백은 한 번도 안 돈다 |
| 3 | 🔧 | `WordFlashcard.tsx:186-197` | **Canvas가 담는 상자보다 크다.** `waveformHeight`(411dp 기준 **60**) vs `waveformContainerHeight`(**39**) − `paddingVertical` 10×2 = **19**. 두 토큰이 서로 다른 기준값(60·39)에서 나와 배율이 어긋난다 — 320dp에서도 39 vs 26이다 |
| 4 | 🔧 | `WordFlashcard.tsx:46-50` | **`useEffect([wordPair])`가 죽었다.** 부모가 `key={currentPair.id}`로 remount시키므로(그 파일 16번 줄 주석이 그렇게 적고 있다) `wordPair`는 마운트된 인스턴스에서 바뀌지 않는다 |
| 5 | 🔧 | `WordFlashcard.tsx:32` | `getImmutableWaveformData(...)`를 **렌더마다** 부른다. 새 배열이라 `Waveform`의 `useDerivedValue` deps `[data,…]`가 매번 바뀌어 **mapper가 렌더마다 `stopMapper`→`startMapper`** 된다 (`useDerivedValue.ts:72-80`). 0-2절 `getRandomElements`·`CRATE_IMAGE`·`DRUM_POSITIONS`와 같은 갈래 |
| 6 | 🔧 | `Waveform.tsx:99` | `if (index <= visibleBars)` — `visibleBars`는 `floor(length × progress)`라 **진행도 0에서도 0번 막대가 이미 그려진다.** `<`여야 진행도와 막대 수가 맞는다 |
| 7 | 🔧 | `WordFlashcard.tsx:239,263` | 「전체 듣기」 흰 글자 on `COLORS.success` **2.23:1**. 13~18px bold라 4.5 기준. `refri-test`(47)·`DrumGameOverScreen`(50)·`WordGame`(52)과 **같은 토큰** — 계산으로 끝났다 |
| 8 | 🔧 | `WordFlashcard.tsx:316,324` | `vsText` 흰 글자 on `WAVEFORM_GRADIENT.start`(#FF9800) **2.16:1**. 16px bold라 4.5 기준. 드럼 `#FF9800` 줄(50)과 같은 색 — 계산으로 끝났다 |
| 9 | 🔧 | `WordFlashcard.tsx:142,176` | 평상시 스피커 아이콘 `COLORS.success` on 흰 카드 **2.23:1**. 아이콘 3:1 미달. 재생 중(`successOnWhite` on `backgroundSuccess` **3.29:1**)은 통과한다 — 계산으로 끝났다 |
| 10 | 🔧 | `WordFlashcard.tsx:293-300` | **「지금 울리는 카드」 표시가 테두리인데 그 테두리가 2.11:1**이다 (`success` on `backgroundSuccess`, 비텍스트 3:1 미달). 평소 테두리는 `transparent`라 이 색이 유일한 신호다 — 계산으로 끝났다 |
| 11 | 🔧 | `WordFlashcard.tsx:256-267` | `playAllButtonDisabled`가 **2절이 정해 둔 답**(`grayLight` 배경 + `textSecondary` + `elevation:0`) 그대로인데 그 조합이 **4.35:1**이다. 13~18px bold라 4.5에 0.15 모자란다 — 정해진 답 자체를 다시 봐야 한다 |
| 12 | 🔧 | `constants/layout.ts:183,206,209` | **죽은 LAYOUT 토큰 셋** — `wordCardElevation`(2) · `vsBorderRadius`(20) · `waveformContainerElevation`(2). 정작 코드는 리터럴 `elevation: 4`(290) · `8`(300) · `borderRadius: 24`(317)를 쓴다. 0-2절 `refri*` 토큰 6개(47)와 같은 갈래 |
| 13 | 🔧 | `WordFlashcard.tsx:186-197` · `Waveform.tsx:126` | 파형은 장식인데 `importantForAccessibility="no"`가 없다. 토크백 초점이 빈 Canvas에 따로 간다 |
| 14 | 🔧 | `WordFlashcard.tsx:203-219` | 재생 시작·끝에 `accessibilityLiveRegion`이 없다. 「전체 듣기」→「재생 중...」으로 라벨이 바뀌어도 초점이 그 버튼에 없으면 안 읽힌다. 게임 두 파일 `statusText` 줄과 같은 갈래 |
| 15 | 🔧 | `WordFlashcard.tsx:274-279` · `331-340` · `343` | 죽은 선언 셋 — `wordsRow`의 `justifyContent:'space-around'`(내용 폭이라 효과 없음) · `waveformContainer`의 `borderWidth:0`·`backgroundColor:'transparent'`(기본값) · `export default WordFlashcard`(아무도 default로 안 받는다) |
| 16 | 🔧 | `WordFlashcard.tsx:14-16` · `Waveform.tsx:26-42,64-97,113-122` | 학습용·중복 주석. `minimal` 한 prop에 설명 3줄(**`better name? showMinimal/compact/summary/backFace?`** 라는 질문이 코드에 남아 있다) · `Waveform`은 **140줄 중 61줄이 주석**이고 `progress` prop 하나에 설명 블록이 3개다. 세션 53에 탭 골격에서 걷어낸 갈래 |
| 17 | 🔧 | `constants/layout.ts:205` | `vsFontSize: 16`만 **스케일을 안 탄다.** 같은 묶음의 글자·아이콘은 전부 `scaleInCardH`인데 VS만 고정이라 태블릿에서 안 커진다 (규칙 3). `FLASHCARD_VS_WIDTH`의 「'VS' 글자폭 20px 어림」도 이 16에 묶여 있다 |

**표에 안 넣은 것** — 0절 2줄(「전체 듣기」가 카드 아래·초록 테두리 2px / `audioPlayer.progress`는 `Waveform`이 쓴다)은 다시 안 올렸다. **동작 6종은 0건**이다 — `playAllTimerRef`는 `useFocusEffect` 클린업이 **언마운트에서도 돈다**(`@react-navigation/core/src/useFocusEffect.tsx:104-111`)는 것을 소스로 확인했고, 「전체 듣기」 연타는 `playbackIdRef`가 이전 체인을 무효화해 타이머가 겹치지 않는다. 6절 `shadow*`·`Platform.OS` **0건**. 세로 치수는 320×569 / 320×640 / 411×868 / 800×1280 넷 다 들어간다(세션 37~39의 `scaleInCard*` 작업이 덮었다). 터치 3개는 `Role`·`Label`·`State`가 다 있다. `useWordAudioPlayer`는 세션 52에 0건이고 그 뒤 안 바뀌어 걸러냈다.

번호만 골라 주세요.

## 2. 사용자

3, 5, 6, 16, 1, 2

## 3. Claude

선택 여섯을 고칩니다.

코드 `563541a`. 이제 문서 셋을 갱신합니다.

한 번 더 훑었습니다 (규칙 5). 나온 것은 고치지 않고 0-2절로 보냅니다.

