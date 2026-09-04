# 대화 기록 49 (세션 49)

## 1. 사용자

@screens/MusicTrainingScreen.tsx   세션 48 최종 상태

  - HEAD 3ddfd6d, 작업 트리 깨끗
  - 커밋 다섯 — 코드 1(a57c217) · 문서 4
  - 열린 항목은 여전히 하나: 🧭 다음 점검은 🎹 피아노(/점검
    screens/MusicTrainingScreen.tsx)
  - 푸시는 사용자 몫 (세션 41~48 쌓여 있음)
  - 다음 창에서 만들 대화 기록은 conversation_49.md @doc/handoff6.md  머리 읽어

## 2. Claude

**인계문 6 머리만 읽었다.** (세션 48 작업 로그·주의사항 전부는 열지 않았다.)

### 현황
- HEAD **`3ddfd6d`**, 작업 트리 깨끗 — 인계문이 말하는 상태와 일치한다.
- `origin/main`보다 앞서 있고 **푸시는 사용자 몫**이다.
- `doc/conversation_49.md`를 **먼저 만들어 뒀다** (48이 원문 없이 날아간 재발 방지 — 규칙 2-1).

### 진행 현황
| 항목 | 상태 |
|---|---|
| 🧭 한 번도 점검 안 한 화면 | ⏳ **열려 있다 — 유일** |
| 🔎 0-2절 보류 | ⏸️ 다시 묻지 않는다 |
| 🎮 게임 / 🧊 냉장고 / 🎸 기타 | ✅ 끝 (43~46 · 47 · 48) |
| 📐 작은 폰·태블릿 | ⏸️ 기기 없음 |
| ⚠️ `Source error` | ❌ 릴리스 빌드 대기 |
| 🚀 푸시 | ⏳ 사용자 |

### 남은 일 — 하나뿐
**🎹 피아노 전수 점검.** `screens/MusicTrainingScreen.tsx`(1,799줄, 단일 파일 최대) 외 묶음 2,773줄.
`components/instrument/` 여섯은 세션 48에 이미 전수(`a57c217`)라 **다시 훑지 않고**
`git diff --name-only a57c217 HEAD -- components/instrument`로 먼저 판정한다.
0-2절의 「[피아노 경로]」 줄과 `InstrumentButton` 접근성·색 리터럴이 여기서 함께 풀린다.

`/점검 screens/MusicTrainingScreen.tsx`로 시작하면 된다 — 시작할까?

## 3. 사용자

/점검 screens/MusicTrainingScreen.tsx

## 4. Claude

## 🎹 피아노 점검 — 33건

**범위** `screens/MusicTrainingScreen.tsx`(1799) · `FallingNoteTrack`(347) · `FallingResultOverlays`(227) · `MiniKeyboardMap`(191) · `ParticleVisualizer`(178) · `LandscapeBackButton`(44) · `RippleLayer`(31) · `app/(tabs)/activity/` 둘(10) · `screens/musicTrainingHelpers.ts` — **2,827줄**
`components/instrument/` 여섯과 `MissionProgressIcon`은 `a57c217`·`4f3bf11` 이후 **diff가 비어** 건너뛰었다.

(표 37줄 — 원문은 `doc/점검표.md` 0-2절과 `doc/점검-이력.md` 세션 49 노트가 갖는다.
번호 1~5는 동작, 6~13은 죽은 것·구조, 14~18은 기준이 틀린 값, 19~20은 RN 골격,
21~25는 접근성, 26~29는 대비, 30~31은 색 토큰, 32는 주석, 33~34는 ❓,
35~37은 반응형이다.)

> **통과** — 6절 `shadow*`·`Platform.OS === 'ios'` **0건**. 세션 48 기타 1번(못 누르는 음 출제)은 **피아노에는 없다** — 4·5단계 뷰포트 두 자리(0·14)의 합집합이 백건 30 · 흑건 22를 **전부 덮는다.** 낙하 모드 팔레트(`PENTA5`·`WHITE8`)도 전부 백건이라 레인과 건반이 어긋나지 않는다.
> **0절·0-2절에 이미 있어 올리지 않은 것** — `SHOW_ANSWER_HINT`·초기화 버튼(테스트 스위치) · `CACHE_LIMIT = 12` · 탭 이탈 시 `remove()` · 화면 방향 소유자 · `useSyncGameData`의 `return;` · `InstrumentButton`/`ScoreFeedback`/`MissionProgressIcon` 관련 줄 전부.

번호로 골라 주면 그것만 고친다.

## 5. 사용자

1 2 3 4 5와 19는 리플레이·결과만이면 됩니다

## 6. Claude

여섯 다 고쳤다. 코드 `8fe2c23` · 문서 `13e22da`.

### 고친 것

| | 무엇이었나 | 어떻게 |
|---|---|---|
| **1** | 새 문제를 낼 때 응답시간 기준을 안 찍었다 — 첫 오답 전까진 **0초**, 그 뒤로는 **그 오답 시각**이 다음 문제들의 기준으로 남았다 | 출제 자리에서 **동기로** 찍는다. `.then()`에서 다시 찍지 않는다 — 기타가 그 자리에서 재점검에 걸렸다 |
| **2** | 정답 뒤 타이머 둘이 아무 데도 안 담겨, 종료·난이도 변경 뒤에 **문제음이 났다** | `trainingTimersRef`. **터진 타이머는 자기 id를 스스로 뺀다** — 47·48이 둘 다 「한 판 동안 안 비운다」로 걸린 자리다 |
| **3** | 정답 뒤 1초 동안 같은 건반이 계속 정답이라 **한 문제 연타로 클리어**됐다 | `isScoringLockedRef` — 소리는 그대로, **채점만** 막는다 |
| **4** | 정답 처리가 `score + 1` · `{...progress}`로 렌더 클로저를 읽었다 | `applyScore`/`applyProgress` — 사본을 두되 **쓰는 자리를 둘로 좁혔다.** deps에서 `score`·`progress`가 빠져 건반 리렌더도 줄었다 |
| **5** | `addStar`·`markAsCleared`가 조건을 넘긴 뒤 정답마다 다시 불렸다 | 부르는 쪽에서 한 번만 부른다 |
| **19** | 낙하 리플레이·결과가 뒤로가기로 안 닫혔다 | 둘 다 `Modal`. 결과는 「확인」과 같은 길, 리플레이는 새 `onDismiss`. **`missionOverlay`·`previewOverlay`는 안 골랐으니 그대로** |

### 정정 — 5번은 내가 과장했다

「조건을 넘긴 뒤 정답마다 다시 부른다」는 맞지만 **`StarContext.addStar`·`ClearContext.markAsCleared`가 안에서 이미 막고 있어 실제 동작은 전과 같았다.** 호출부만 보고 영향을 적었다. 고친 것은 남겼다 — 뜻이 부르는 쪽에 드러나는 편이 낫다.

`tsc` 깨끗하다 (`useSyncGameData.ts:44` 하나뿐, 0절).

### 재점검 6건 — 여섯 다 이번 수정이 들인 것

`score`·`progress` 이중 보유 · 빗장 풀기가 **여섯 자리**로 흩어졌다 · `questionStartTime`이 여전히 state다 · `Modal` 안에 `absolute`+`zIndex`가 남았다 · `dismiss…`와 `close…`가 두 줄 겹친다 · 가로 `statusBarTranslucent`(📱). **규칙 5대로 고치지 않고 0-2절로 보냈다.**

> 그중 둘은 **앞 세션 0-2절에 이미 있는 줄과 같은 모양**이다 — 기타의 `progress` 이중 보유, 냉장고의 `Modal` 안 `absolute`. 미룬 항목이 다음 화면에서 다시 만들어진다.

### 문서

0-2절 **+38** · 이력 표에서 아홉 파일이 전수로. **`app/(tabs)/activity/` 둘을 「앱 골격」에서 피아노 묶음으로 옮겼다** — `index.tsx`가 `<MusicTrainingScreen />` 한 줄이다. 터치 실측 넷 정정(합 157 → 142). **전수가 줄 기준 69%**가 됐다.

**다음 후보 1번이 `components/game/InteractiveDrumSet.tsx`(885)로 넘어갔다** — 악기 묶음이 끝나 남은 것은 드럼과 골격뿐이다.

## 7. 사용자

handoff7 에  인계문 작성해

## 8. Claude

`doc/handoff7.md`를 만들었다. **가리키는 곳 넷도 함께 옮겼다** — 파일만 만들면 다음 세션이 여전히 handoff6을 읽는다.

| 파일 | 무엇을 |
|---|---|
| **`doc/handoff7.md`** | 새로 만들었다 (세션 49~) |
| `CLAUDE.md` 2-2 · 2-3 · 2-4 | 「현재 인계문」을 handoff6 → **handoff7**. 구 파일 목록 일곱 → **여덟** |
| `doc/handoff6.md` 머리 | **아카이브(세션 47~48)로 표시**하고 handoff7을 가리키게 했다 |
| `doc/점검-이력.md` | 「근거 원문은 그때의 인계문에」 줄에 **세션 49~ handoff7** |
| `doc/점검표.md` 7절 | 「기기가 생기면 볼 것」의 주인을 **handoff7**로 (42~48치는 handoff6에 남는다) |

**머리에서 바로 답이 나오게 했다** — 열린 항목이 하나뿐이다: **안 본 화면들, 다음은 🥁 드럼**(`InteractiveDrumSet` 885). 악기 묶음이 세션 49로 끝나 남은 것은 드럼과 앱 골격뿐이고, 안 본 13개 파일의 터치 16개 중 7개가 드럼 두 파일에 있다.

**세션 49 주의사항 일곱**을 남겼다. 그중 셋이 이번에 새로 배운 것이다.

- **짝은 같은 세션에 함께 연다.** 기타(48)에서 고친 넷이 피아노에 그대로 있었다 — 세션 44의 「쌍둥이는 나란히」와 같은 말인데 **그때는 파일 이름이 닮아서 알았고 이번엔 안 닮아서 놓쳤다.** 닮은 것은 이름이 아니라 골격이다.
- **호출부만 보고 영향을 적지 말 것** (5번 정정).
- **0건도 결과다** — 기타 1번을 피아노에서 세었더니 0이었다. 적어두지 않으면 다음 세션이 다시 센다.
- 그리고 **점검 커밋이 처음으로 실제 일을 했다** — `components/instrument/` diff가 비어 418줄을 건너뛰었다. 세션 41에 그 칸을 만든 이유가 이것이다.

자주 걸린 것 목록은 다섯 → **일곱**이 됐다. 「**탭바가 숨겨진 화면은 인셋을 직접 다룬다**」(피아노·기타는 `tabBarStyle: {display:'none'}`이라 냉장고와 반대다)와 「**렌더에서 안 읽는 값은 ref**」(47·48·49 세 번 같은 처방)가 새로 들어갔다.

**옮기지 않은 것** — 세션 43~48 주의사항 원문과 flashcards 이름표. handoff7은 색인만 갖는다. 다 옮기면 시작부터 600줄이 되어 「머리 읽어」가 안 된다.

커밋 `c340fb9`. 세션 49는 **코드 하나 · 문서 넷**이고 푸시는 그대로 사용자 몫이다.
