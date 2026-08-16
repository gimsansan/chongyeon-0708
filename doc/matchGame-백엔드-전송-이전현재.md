# 공용 분리와 백엔드 전송 — 이전 vs 현재

걱정: `StatsScreen`을 공용으로 빼면서 이름이 `MatchGameStatsScreen` 등으로 바뀌면, 백엔드가 값을 못 받는다.

결론: **화면 함수 이름만 바뀌었고, 서버로 가는 이름과 값은 그대로다.**

---

## 1. 두 층이 다르다

| | 화면 (바뀜) | 전송 (안 바뀜) |
|---|---|---|
| 무엇인가 | React 컴포넌트 이름 | JSON 키 + gameId |
| 누가 보나 | 앱 UI만 | 백엔드 |
| 예 | `StatsScreen` → `MatchGameStatsScreen` | `score`, `userStats`, `'matchGameAI'` |

서버는 컴포넌트 이름을 모른다. `syncData(gameId, payload)`의 **문자열**만 본다.

```
[게임 파일]                         [공용 화면]              [서버]
state.score ──┬── 칩에 "20점" 표시   MatchGameStatusChips    (해당 없음)
              └── payload.score=20  ─────────────────────►  키 이름 "score"
```

---

## 2. 이전 — 화면이 게임 파일 안에 있음

사용자가 제공한 예전 `matchGameAI.tsx` 기준.

**통계 화면**은 파일 안 함수 `StatsScreen`이었다.

```tsx
const StatsScreen = memo(({ stats, onGoHome }: { stats: UserStats, onGoHome: () => void }) => {
    // userStats를 그려서 보여 주기만 함
});
```

**듣기 화면**도 같은 파일 안에 인라인으로 있었다.

```tsx
case 'STATS': return <StatsScreen stats={state.userStats} onGoHome={() => navigate('HOME')} />;
case 'LISTENING':
    return (
        <View>
            <WaveRipple ... />
            <Text>소리를 재생하고 있습니다...</Text>
        </View>
    );
```

**전송**은 그와 별도 `useEffect`였다. 화면 함수와 무관하다.

```tsx
const medicalDataPayload = {
    difficulty: state.playedDifficulty,
    score: state.score,
    roundResult: state.roundResult,
    userStats: state.userStats,
    wrong_selections: state.roundWrongAttempts,
    error_count: state.roundWrongAttempts.length,
    completion_time_seconds: parseFloat(durationSeconds.toFixed(2)),
};
syncData('matchGameAI', medicalDataPayload);
```

PG도 같은 키이고, gameId만 `'matchGamePG'`였다.

---

## 3. 현재 — 화면만 공용 파일로 이동

**가져온 이름만 바뀜** (`matchGameAI.tsx` / `matchGamePG.tsx` 둘 다)

```tsx
import {
  MatchGameListeningScreen,
  MatchGameStatsScreen,
  MatchGameStatusChips,
} from '../../../../components/game/MatchGameShared';
```

**호출만 이름이 바뀜.** 넘기는 값은 예전과 같다.

```tsx
case 'STATS': return <MatchGameStatsScreen stats={state.userStats} onGoHome={() => navigate('HOME')} />;
case 'LISTENING': return <MatchGameListeningScreen />;
```

| 이전 | 현재 | 하는 일 |
|---|---|---|
| `StatsScreen` | `MatchGameStatsScreen` | `userStats`를 화면에 그림 |
| LISTENING 인라인 | `MatchGameListeningScreen` | 재생 중 안내 |
| 상태 줄 텍스트 | `MatchGameStatusChips` | `state.score` 등을 그림 |

`MatchGameStatsScreen`은 `stats`를 **표시만** 한다. payload를 만들지 않는다.

**전송 코드는 같은 파일, 같은 키, 같은 gameId**

현재 AI (`matchGameAI.tsx`):

```ts
const medicalDataPayload = {
    difficulty: state.playedDifficulty,
    score: state.score,
    roundResult: state.roundResult,
    userStats: state.userStats,
    wrong_selections: state.roundWrongAttempts,
    error_count: state.roundWrongAttempts.length,
    completion_time_seconds: parseFloat(durationSeconds.toFixed(2)),
};
syncData('matchGameAI', medicalDataPayload);
```

현재 PG (`matchGamePG.tsx`): 키 동일, `syncData('matchGamePG', medicalDataPayload)`.

---

## 4. 이전 vs 현재 대조

| 항목 | 이전 | 현재 | 백엔드 영향 |
|---|---|---|---|
| 통계 화면 함수명 | `StatsScreen` | `MatchGameStatsScreen` | 없음 |
| 듣기 화면 | 파일 안 인라인 | `MatchGameListeningScreen` | 없음 |
| `gameId` | `'matchGameAI'` / `'matchGamePG'` | 같음 | 없음 |
| payload 키 | 위 7개 | 같음 | 없음 |
| 값의 출처 | `state.score`, `state.userStats` … | 같음 | 없음 |
| 점수·통계 계산 | reducer `SELECT_ANSWER` | 같음 | 없음 |
| 로컬 저장 키 | `@AuditoryTrainingApp:gameState` / `...PG:gameState` | 같음 | 없음 |

바뀐 것: 화면을 어디에 두느냐, 함수를 뭐라고 부르느냐.  
안 바뀐 것: 무엇을 모아서 어떤 이름으로 보내느냐.

---

## 5. 참고 — 지금은 서버로 실제로 안 나감

`hooks/useSyncGameData.ts` 맨 앞에 `return;`이 있다. 공용 분리 이전부터 있던 동작이다.

전송을 다시 켜도, 보내는 **키와 gameId는 예전과 같으므로** 백엔드 계약은 그대로다.
