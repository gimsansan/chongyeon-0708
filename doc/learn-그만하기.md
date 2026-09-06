# learn 「그만하기」

**미구현.** 이 파일이 설계 원문이다. 인계문에는 아직 없다.
구현은 사용자가 시킨 뒤에만 한다.

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
6. 결과창에 `onGoHome`은 **여전히 안 넘긴다** (세션 52). 「다시 하기」만.

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
| `ready` · `playing` (이 라운드는 아직 안 채점) | `round - 1` |
| `answered` · `waitingForNextRound` (이 라운드는 채점됨) | `round` |

점수는 `scoreRef.current` 그대로. 채점 안 된 라운드는 더하지 않는다.

정상 종료(마지막 라운드 타이머)는 지금처럼 `maxRounds`를 넘긴다. 조기 종료만 푼 수를 쓴다.

부모가 `isGameOver`를 켜면 `WordGame`이 언마운트된다. 오디오·타이머가 뒤에 남지 않는다
(`learn/index.tsx` 주석). 조기 종료도 이 길을 탄다.

---

## 하지 않는 것

- 확인창
- `onGoHome` (넘기면 「나가기」가 그려지고 하는 일은 「다시 하기」와 같다)
- 준비 화면으로만 되돌리기
- 같은 모드를 다시 눌러 리셋하기 — 이번 범위가 아니다. 그만하기가 그 자리를 대신한다
- 결과 모달 UI 변경. 이미 있는 `DrumGameOverScreen` + 「다시 하기」만 쓴다

---

## 반응형

난이도 버튼과 붙지 않게 줄 아래에 둔다. 작은 폰에서도 연습·도전과 간격이 남게 한다.
오른쪽 끝 텍스트로 둘 때도 난이도 터치 영역과 겹치지 않게 한다.

---

## 손대는 파일

| 파일 | 무엇을 |
|---|---|
| `app/(tabs)/learn/index.tsx` | 난이도 줄 아래 버튼. `round`/`gameState`를 받아 숨김 |
| `components/game/WordGame.tsx` | 부모에 상태 알림. 그만하기 때 `stopSound` |
| `hooks/useWordGameLogic.ts` | 조기 종료 함수. 타이머 취소 + `onGameComplete(score, 푼 수, …)` |

네이티브 재빌드는 필요 없다.
