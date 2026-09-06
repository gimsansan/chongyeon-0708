# learn 「그만하기」

**구현됨 (세션 60~61).** 이 파일은 설계 원문이고, **아래는 그때 정한 것**이다.
지금 코드가 무엇인지는 다음을 본다 —

| 무엇 | 어디 |
|---|---|
| 버튼 — 액션줄 오른쪽, `canQuit`일 때만 그린다 | `app/(tabs)/learn/index.tsx`의 `{canQuit && (` 블록 |
| 누르면 하는 일 — 확인창 없이 지금 점수로 | 같은 파일 `handleQuitGame` |
| 오디오를 끊고 훅(`endGameEarly`)으로 넘기는 곳 | `components/game/WordGame.tsx`의 `quit:` (`:213`) |

> **줄 번호를 적지 않은 이유**: `learn/index.tsx`는 아직 커밋되지 않은 편집이 얹혀 있어
> 번호가 곧 어긋난다. **이름으로 찾는다.**

**줄에 어떻게 놓는지**는 여기가 아니라 [`doc/learn-액션줄.md`](./learn-액션줄.md)가 갖는다.
경위는 인계문 [`doc/handoff11.md`](./handoff11.md) 「세션 60·61」에 있다.

---

## 문제

연습(5)·도전(10)에 그만하기가 없다. 끝나는 길은 셋뿐이다.

1. 끝까지 푼다
2. 반대 모드로 바꾼다 (`difficulty`가 바뀌면 `WordGame`이 `resetGame`)
3. 탭을 나간다 (`useFocusEffect`가 부모 상태만 비움)

같은 모드를 다시 눌러도 `WordGame`은 안 리셋된다.
`handleDifficultyPress`가 `handleRestartGame()`을 부르지만, 그건 결과 모달 깃발만 내린다.
`WordGame`의 리셋은 `difficulty`가 바뀔 때만 돈다 (`WordGame.tsx`의 `useEffect`).

「듣는 중...」(`playing`)에는 버튼이 없다. 탭을 나가면 `useStopAudioOnBlur`가 소리를 끊고
선택지로 넘기지만, **같은 탭 안에서 접는 길은 없다.**

---

## 정한 방향

1. **자리**는 난이도 줄 옆이 아니라 **그 아래**(또는 오른쪽 끝 텍스트).
   연습·도전과 붙이면 오탭이다.
2. **동작**은 지금 점수 그대로 **결과 모달**.
   준비 화면으로만 되돌리지 않는다.
3. **접는 길은 하나다.** 소리 정지 + `nextRoundTimer` 취소 + 결과.
   `playing`(듣는 중)에도 버튼이 보여야 한다.
4. `round === 1`이고 `ready`이면 **숨긴다.** 「계속하기」부터 보인다.
5. **확인창 없음.**
6. 결과창에 `onGoHome`은 **여전히 안 넘긴다** (세션 52). 「나가기」를 다시 그리지 않는다.
7. learn 결과 버튼 글자는 **「확인」**이다. 드럼은 「다시 하기」 그대로.

라벨: 「그만하기」 / `accessibilityRole="button"` / `accessibilityLabel="퀴즈 그만하기"`.

---

## 넣는 곳

버튼은 `app/(tabs)/learn/index.tsx`의 난이도 줄 **아래**에 둔다.
`WordGame` 안의 `playing` 뷰에 넣지 않는다 — 그 뷰는 아이콘과 「듣는 중...」뿐이라,
여기에 넣으면 상태마다 버튼을 복제하게 된다.

보이려면 `round`와 `gameState`가 필요하다. 둘 다 `WordGame` / `useWordGameLogic` 안에 있다.
부모가 모르므로 `WordGame`이 알려 줘야 한다 (콜백 또는 같은 뜻의 prop).
`score`는 화면에 없고 `scoreRef`에만 있다. 그릴 필요 없다.

숨김: `round === 1 && gameState === 'ready'`.
그 외(`playing` · `answered` · `waitingForNextRound` · 2라운드 이후 `ready`)는 보인다.
결과 모달이 떠 있으면(`isGameOver`) 난이도 줄과 함께 이미 안 그린다.

---

## 접는 길

`useWordGameLogic`에 조기 종료 한 함수를 둔다. 정상 종료와 **같은** `onGameComplete`로 나간다.

1. `clearNextRoundTimer()` — `waitingForNextRound`의 600ms가 뒤에 도착하면
   다음 문제나 결과 모달이 **한 번 더** 뜬다
2. `audioPlayer.stopSound()` — `playing`에서 끊지 않으면 소리가 남는다
3. `onGameComplete(scoreRef.current, answeredCount, percentage)`

`handleGameComplete`는 세 번째 인자를 버린다. 시그니처는
`(score, maxScore, percentage)`이고, 결과 모달은 `score` / `maxScore`만 그린다.

**`maxScore`에 `maxRounds`(5 또는 10)를 넣지 않는다.** 푼 수를 넣는다.
3문제에서 그만두면 `3/3`이지 `3/5`가 아니다.

푼 수:

| 지금 | 푼 수 |
|---|---|
| `ready` · `playing` · `answered` (이 라운드는 아직 안 채점) | `round - 1` |
| `waitingForNextRound` (고르고 피드백이 떠 있다 — 채점됨) | `round` |

점수는 `scoreRef.current` 그대로. 채점 안 된 라운드는 더하지 않는다.

정상 종료(마지막 라운드 타이머)는 지금처럼 `maxRounds`를 넘긴다. 조기 종료만 푼 수를 쓴다.

부모가 `isGameOver`를 켜면 `WordGame`이 언마운트된다. 오디오·타이머가 뒤에 남지 않는다
(`learn/index.tsx` 주석). 조기 종료도 이 길을 탄다.

---

## 결과 버튼 — learn만 「확인」

이름만 바꾼다. 동작은 지금과 같다.

「다시 하기」를 눌러도 게임이 바로 시작하지 않는다. 모달이 닫히고 `WordGame`이 다시 마운트돼
**「시작하기」**로 돌아간다. 안 누르면 그만이다. 선택권은 이미 있는데, 버튼 이름이 강제처럼 읽힌다.

「확인」이면 뜻을 맞춘다. 결과를 봤고, 닫는다. 그다음 시작은 「시작하기」가 맡는다.

드럼은 그대로 둔다. 그쪽은 연주 모드로 돌아가는 「나가기」가 있어서 「다시 하기」가 맞다.
공용 `DrumGameOverScreen`이라 **learn만 라벨을 바꾸는 prop**이 필요하다.

「나가기」를 다시 그리지는 않는다. 세션 52에 정한 대로, 접고 갈 화면이 없어서
하는 일이 「다시 하기」와 같다.

그만하기를 넣을 때도 「확인」이 더 맞다. 중간에 접어 놓고 「다시 하기」가 뜨면 말이 안 된다.

---

## 하지 않는 것

- 확인창
- `onGoHome` (넘기면 「나가기」가 그려지고 하는 일은 「다시 하기」와 같다)
- 준비 화면으로만 되돌리기
- 같은 모드를 다시 눌러 리셋하기 — 이번 범위가 아니다. 그만하기가 그 자리를 대신한다
- 드럼 결과 버튼 문구를 바꾸기. learn만 「확인」이다
- 결과 모달 뼈대를 새로 만들기. 이미 있는 `DrumGameOverScreen`에 라벨 prop만 더한다

---

## 반응형

난이도 버튼과 붙지 않게 줄 아래에 둔다. 작은 폰에서도 연습·도전과 간격이 남게 한다.
오른쪽 끝 텍스트로 둘 때도 난이도 터치 영역과 겹치지 않게 한다.

---

## 손대는 파일

| 파일 | 무엇을 |
|---|---|
| `app/(tabs)/learn/index.tsx` | 난이도 줄 아래 버튼. `round`/`gameState`를 받아 숨김. 결과에 확인 라벨 |
| `components/game/WordGame.tsx` | 부모에 상태 알림. 그만하기 때 `stopSound` |
| `hooks/useWordGameLogic.ts` | 조기 종료 함수. 타이머 취소 + `onGameComplete(score, 푼 수, …)` |
| `screens/DrumGameOverScreen.tsx` | learn만 쓰는 주 버튼 라벨 prop. 기본값은 「다시 하기」(드럼) |

네이티브 재빌드는 필요 없다.
