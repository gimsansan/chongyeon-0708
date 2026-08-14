# 사운드 재생 코드 리뷰

작성일: 2026-08-14
대상: 드럼 / 피아노 / 기타 / 단어 / 동물게임 / 냉장고 탭의 오디오 재생 경로 전반
환경: `expo-audio ~57.0.0` (expo-av 의존성 없음), React Native 0.86

---

## 요약

사운드 경로가 **4가지 서로 다른 방식**으로 구현되어 있고, 품질 편차가 큽니다.

| 경로 | 방식 | 평가 |
|---|---|---|
| 피아노 `MusicTrainingScreen`, 기타 `guitar/_layout` | expo-audio 직접 + LRU 캐시 + 폴리포니 | 잘 됨 |
| 드럼 `context/AudioManager` | 탭마다 플레이어 생성/파괴 + 직렬 큐 | **가장 문제** |
| 단어 `useWordAudioPlayer` | 재생마다 새 플레이어 + 오디오모드 재설정 | 개선 필요 |
| 동물게임 `GameAudioManager` / `matchGame` / `orderGame` | 프리로드(해제 없음) / 자체 로드 이중화 | 중복 + 순차재생 버그 |

**피아노·기타는 잘 짜여 있고, 드럼이 그 반대 패턴이라 가장 손해를 보고 있습니다.**

우선순위:

1. 드럼 플레이어 풀 도입
2. 동물게임 순차 재생 수정
3. 단어 오디오모드 / 캐시
4. 오디오 세션 일원화

---

## 1. 드럼: 타격마다 플레이어를 새로 만들고 큐로 직렬화 (최우선)

`context/AudioManager.tsx:50-103` — 드럼을 한 번 칠 때마다:

- `createAudioPlayer` (네이티브 디코더 할당) → 재생 → 1.5초 뒤 `remove()`
- `playSingleSound:53-57` 같은 키가 재생 중이면 **이전 사운드를 unload** → 스네어 연타 시 앞 소리가 잘림
- `processQueue:106-119` `isProcessingRef`로 직렬화 + 50ms 간격 → 두 번째 타격은 첫 번째의 `createAsync`가 끝나고 50ms 뒤에야 시작. 드럼롤이 불가능하고 안드로이드에서 체감 지연이 붙음

드럼 샘플은 5개 전부 0.5초, 합쳐서 540KB입니다 (`constants/drumSounds.ts`).

| 파일 | 길이 | 샘플레이트 |
|---|---|---|
| `Kick.wav` | 0.5s | 48000 Hz |
| `Snare_15.wav` | 0.5s | 44100 Hz |
| `HiHatOpen_15.wav` | 0.5s | 44100 Hz |
| `Crash_15.wav` | 0.5s | 44100 Hz |
| `Tom_20.wav` | 0.5s | 44100 Hz |

**전부 상주시키고 `seekTo(0)+play`만 하면 되는 케이스**인데 정반대로 하고 있습니다.
피아노(`screens/MusicTrainingScreen.tsx:667-703`)와 기타(`app/(tabs)/guitar/_layout.tsx:116-145`)가
이미 올바른 패턴을 갖고 있으니 그대로 옮기면 됩니다. 드럼은 5개뿐이라 LRU도 불필요합니다.

```ts
// 앱 시작 시 1회
const pool = Object.fromEntries(
  Object.entries(DRUM_INSTRUMENTS).map(([k, v]) => [k, createAudioPlayer(v.sound)])
);

// 타격 시 (동기, 큐 없음)
const p = pool[inst];
if (p.playing) {
  const t = createAudioPlayer(src);   // 폴리포니 오버플로
  t.play();
  setTimeout(() => t.remove(), 1000);
} else {
  p.seekTo(0);
  p.play();
}
```

큐 / 콜백 / 1.5초 백업타이머는 전부 사라집니다.
`app/(tabs)/drum/index.tsx:260`의 `playSoundWithCallback`은 콜백이 `() => {}` (빈 함수)라 애초에 필요 없습니다.

**영향 파일**: `context/AudioManager.tsx`, `components/game/InteractiveDrumSet.tsx:361,364`, `app/(tabs)/drum/index.tsx:260,477`

---

## 2. `useWordAudioPlayer`: 매 재생마다 오디오 세션 재설정

- `hooks/useWordAudioPlayer.ts:72-76` — 단어를 재생할 때마다 `setAudioModeAsync`를 호출합니다.
  네이티브 오디오 세션 재구성이라 첫 소리 앞에 그대로 지연이 붙습니다. 앱 시작 시 1회면 충분합니다.
- `:79` 매번 새 플레이어 생성. 단어 파일 36개 / 2.7MB이므로 LRU 8개 정도만 캐시해도 지연이 크게 줄어듭니다.
- `:55` `if (isPlaying)`이 state를 클로저에서 읽습니다. 같은 tick 내 연속 호출에서 stale 값을 봅니다.
  `playbackIdRef`는 있으니 `isPlayingRef`도 같이 두는 게 안전합니다.
- `:58` 정리 후 무조건 50ms sleep — 위 두 개를 고치면 필요 없습니다.
- `:111` 3초 백업 타이머. 지금 단어 파일은 다 짧아서 괜찮지만, `durationMillis` 기반으로 잡는 게 안전합니다.

---

## 3. 동물 게임: `playAsync`가 완료를 안 기다리는데 고정 딜레이로 순차 재생을 가정

> ⚠️ **이 항목은 틀린 진단입니다. (2026-08-14 세션 2에서 확인)**
> 소리가 겹치는 것은 버그가 아니라 **의도된 설계**입니다. 여러 동물 소리가 동시에 들리는 상황에서
> 무엇이 섞여 있었는지 분해해 알아내는 것이 이 게임의 훈련 내용입니다.
> 아래 서술은 스냅샷 보존을 위해 그대로 두며, 이에 근거해 만들었던 수정은 전부 되돌렸습니다.
> 자세한 경위는 문서 하단 "정정 기록"을 보세요.

`services/audioCompat.ts:85-88`의 `playAsync`는 `play()` 후 즉시 리턴합니다.
(expo-av도 동일했으니 마이그레이션 회귀는 아닙니다.) 그런데 호출부가 완료 대기로 착각하고 있습니다.

- `app/(tabs)/new/(games)/matchGame.tsx:130-139` — 재생 사이 **200ms**
- `app/(tabs)/new/(games)/orderGame.tsx:178-199` — 재생 사이 **1300ms**

실제 동물 소리 길이:

| 파일 | 길이 | 파일 | 길이 |
|---|---|---|---|
| `goat.mp3` | 0.99s | `pig.mp3` | 1.99s |
| `duck.mp3` | 1.07s | `monkey.mp3` | 2.21s |
| `dog.mp3` | 1.10s | `cock.mp3` | 2.38s |
| `elephant.mp3` | 1.61s | `lion.mp3` | 2.95s |
| `cat.mp3` | 1.76s | `cow.mp3` | 3.02s |
| `horse.mp3` | 2.18s | `wolf.mp3` | **4.23s** |

matchGame은 3개가 사실상 동시에 겹쳐 나고, "순서 맞추기"인 orderGame조차 wolf/cow/lion에서 다음 소리와 겹칩니다.

`audioCompat`에 `didJustFinish`를 기다리는 `playToEnd()` 헬퍼를 추가해서 대체하는 게 맞습니다.

---

## 4. `GameAudioManager` 중복 및 해제 경로 없음

- `services/GameAudioManager.ts:10` — 싱글턴 Map에 12개 로드 후 **영구 상주**. `unloadAll` 메서드가 없습니다.
- `:22` `if (this.sounds.size > 0) return` 체크가 await 전에만 있어서, 동시 호출 시 두 번 로드됩니다.
  로딩 Promise 자체를 캐시해야 합니다.
- matchGameAI / matchGamePG는 `GameAudioManager`를 쓰고, matchGame / orderGame은 같은 동물 소리를 자체 로드합니다.
  `constants/animalSounds.ts`는 통합했는데 재생 계층은 안 됐습니다. 4개 게임 전부 `GameAudioManager`로 통일할 수 있습니다.

---

## 5. `setAudioModeAsync`가 화면마다 제각각이고 되돌아가지 않음

전역 오디오 세션을 화면별로 다르게 설정하고, 나갈 때 복구하지 않습니다.

| 위치 | 결과 `interruptionMode` |
|---|---|
| `screens/MusicTrainingScreen.tsx:532` | `mixWithOthers` |
| `app/(tabs)/guitar/_layout.tsx:74` | `mixWithOthers` |
| `app/(tabs)/refri-test/index.tsx:300` | `mixWithOthers` |
| `hooks/useWordAudioPlayer.ts:72` | `mixWithOthers` |
| `app/(tabs)/new/(games)/matchGame.tsx:89` | **`duckOthers`** |
| `app/(tabs)/new/(games)/orderGame.tsx:110` | **`duckOthers`** |

동물 게임에 한 번 들어갔다 나오면 앱 전체가 `duckOthers` 상태로 남습니다.
`app/_layout.tsx`에서 1회 설정하고 화면별 호출은 제거하는 게 맞습니다.

---

## 6. 그 외

- `context/AudioManager.tsx:146-153` — `useMemo` deps에 매 렌더 새로 만들어지는 함수들이 들어있어 memo가 무효화됩니다. refs만 쓰므로 `[]`로 충분합니다.
- `context/AudioManager.tsx:41` — `setCurrentTab`이 `async`인데 타입은 `(tab: string) => void`.
  `app/(tabs)/drum/index.tsx:145`에서 `stopAllSounds()` 완료를 기다리지 않고 지나갑니다.
- `context/AudioManager.tsx` 전반 — 재생마다 `console.log`가 4~5줄씩 찍힙니다. 릴리스에서 제거하세요.
- `app/(tabs)/guitar/_layout.tsx:137` — `setTimeout(() => temp.remove(), 3000)`이 try/catch 밖입니다
  (피아노 `MusicTrainingScreen.tsx:691`은 감싸져 있음). 화면을 떠난 뒤 타이머가 터지면 unhandled 예외가 납니다.
  또 이 임시 플레이어들은 unmount 시 정리 대상에 없어서 최대 3초간 남습니다.
- `hooks/useDrumLogic.ts:30-48` — `availableInstruments`가 매 렌더 새 배열이라
  `startNewRound` / `handleAnswer`의 `useCallback`이 전부 무효화됩니다. `useMemo` 필요.
- `services/audioCompat.ts:114` — `setProgressUpdateIntervalAsync`가 no-op입니다.
  호출부가 있으면 조용히 무시되니 확인 후 삭제하세요.

---

## 참고: `audioCompat` 레이어의 위치

`services/audioCompat.ts`는 expo-av → expo-audio 마이그레이션용 호환 셰이딩으로 잘 만들어져 있지만,
지금은 "expo-av 흉내"에 갇혀 있습니다 (`playAsync`가 async인데 안 기다림, `getStatusAsync` / `setProgressUpdateIntervalAsync`가 사실상 no-op).

신규 코드는 피아노·기타처럼 **expo-audio를 직접 쓰는 게 낫고**, 이 레이어는 마이그레이션 잔재로 관리하는 게 맞습니다.




 네, 요약하면 드럼 소리는 칠 때마다 플레이어를 새로 만들고 버리는 구조라는 게
  문제입니다. context/AudioManager.tsx에 문제가 3개 겹쳐 있습니다.

  1. 매 타격마다 생성/파괴 (AudioManager.tsx:50-103)
  스네어를 한 번 칠 때마다 createAudioPlayer로 네이티브 디코더를 새로 할당하고, 1.5초  
  뒤 remove()로 버립니다. 샘플 5개 합쳐 540KB밖에 안 되니 그냥 미리 만들어두고
  재사용하면 되는데, 매번 새로 만드니 터치 → 소리까지 지연이 생깁니다.

  2. 같은 악기 연타 시 앞 소리가 잘림 (:53-57)
  같은 키가 재생 중이면 새로 만들기 전에 이전 사운드를 unload 합니다. 스네어를 따다닥  
  치면 첫 타가 중간에 끊기고 마지막 것만 남습니다. 피아노·기타는 이미 폴리포니
  처리(겹쳐 재생)를 하는데 드럼만 안 되어 있습니다.

  3. 큐로 직렬화 (:106-119)
  재생 요청을 큐에 넣고 isProcessingRef로 한 번에 하나씩만, 그것도 50ms 간격으로       
  처리합니다. 두 번째 타격은 첫 번째의 플레이어 생성이 끝나고 50ms를 더 기다려야       
  시작됩니다. 드럼롤이나 빠른 리듬이 아예 불가능합니다.

  ---
  정리하면 — 드럼이야말로 지연이 가장 치명적인 탭인데, 앱에서 가장 느린 재생 경로를    
  쓰고 있습니다. 피아노(MusicTrainingScreen.tsx:667-703)와
  기타(guitar/_layout.tsx:116-145)에 이미 올바른 패턴(캐시 + 폴리포니)이 있으니 그걸   
  드럼에 옮기면 됩니다. 드럼은 악기가 5개뿐이라 LRU 캐시조차 필요 없고, 전부 상주시키면
  끝입니다.

  고쳐드릴까요?

---

# 정정 기록

본문은 2026-08-14 리뷰 당시 그대로 보존합니다. 이후 틀린 것으로 밝혀진 내용만 여기에 적습니다.

## 2026-08-14 — 3번 항목(동물 게임 순차 재생)은 오진

**무엇을 틀렸나**

`matchGame`(200ms) / `orderGame`(1300ms)의 짧은 재생 간격 때문에 동물 소리가 겹쳐 나는 것을
"`playAsync`가 완료를 안 기다리는데 호출부가 기다린다고 착각한 버그"로 진단했습니다.

**실제**

겹쳐 들리는 것이 **이 게임의 설계 목적**입니다.
여러 소리가 동시에 들리는 상황에서 무슨 소리가 섞여 있었는지 분해해 알아내는 청각 훈련이고,
소리를 하나씩 또박또박 들려주면 훈련 자체가 성립하지 않습니다.

**왜 놓쳤나**

코드만 보고 "간격 200ms < 소리 길이 4.23초 = 겹침 = 버그"로 단정했습니다.
게임의 목적을 확인하지 않았습니다. 파일 안에도 이 의도를 적어둔 곳이 없어서 코드만으로는 알 수 없었지만,
고치기 전에 **"이렇게 겹쳐 들리는 게 맞습니까"라고 한 번 물었어야** 했습니다.

**되돌린 것**

`playToEnd()` 도입(세션 2)은 전부 철회했습니다. 상세는 `handoff.md` 세션 2 로그를 보세요.

**교훈**

동작이 "이상해 보인다"와 "잘못됐다"는 다릅니다. 특히 이 앱은 청각 재활·훈련용이라
일반적인 UX 기준으로 어색해 보이는 동작이 훈련 설계상 의도된 것일 수 있습니다.
재생 타이밍·난이도·반복 횟수처럼 **훈련 내용에 직접 닿는 값은 고치기 전에 목적부터 확인해야 합니다.**