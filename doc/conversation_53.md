# 세션 53 대화 기록

## 1. 사용자

@doc/handoff9.md  인계문 이어서

## 1. Claude

인계문과 이력을 확인했습니다. 코드 상태도 일치합니다 — `app/(tabs)/_layout.tsx`는 212줄 그대로이고, 마지막 커밋 `fa6cb4a`(피아노 하단 테두리)는 점검 이력의 `?`와 맞아 **기계로 걸러낼 수 없는 상태**입니다.

**할 일**: 열려 있는 항목은 1번(아직 다 안 훑은 화면) 하나뿐이고, 다음 차례는 **`app/(tabs)/_layout.tsx` 전수 점검**입니다. 여기를 봐야 0-2절의 탭바 인셋 세 줄(냉장고 47 · 드럼 50 · learn 52)이 함께 판정됩니다. 시작하겠습니다.

## 2. Claude

0절·0-2절을 먼저 읽었고, 점검 커밋이 `?`라 전수로 훑었습니다. 근거는 `node_modules`의 `bottom-tabs 7.8.4` 소스까지 따라갔습니다.

## `app/(tabs)/_layout.tsx` (탭 골격) 점검 — 14건

| # | 갈래 | 자리 | 무엇이 / 어떻게 되는가 |
|---|---|---|---|
| 1 | 🔧 | `_layout.tsx:77-87` | **`lockAsync`가 취소되지 않는다.** effect에 cleanup이 없어 탭을 빠르게 옮기면 이전 `pathname`의 잠금이 나중에 끝나 이길 수 있다. 세션 26에 화면별 경합을 **이 파일 한 곳으로 모았는데 파일 안에 같은 모양이 남았다** |
| 2 | 🔧 | `_layout.tsx:86` | `.catch(() => { })`가 방향 잠금 실패를 통째로 삼킨다. 실패하면 가로 화면(피아노·기타)이 세로로 남는데 아무 데도 안 남는다 |
| 3 | 🔧 | `_layout.tsx:23-36, 44` | 튐 애니메이션이 **`onPressOut`에만** 걸려 눌렀다 밖으로 끌어 취소한 누름에도 튄다. `Animated.sequence(...).start()`를 담는 곳도 없어 **연타하면 이전 시퀀스가 안 끊기고 겹친다** (`stopAnimation()` 없음) |
| 4 | ❓ | `_layout.tsx:28, 32` | `Animated.spring`의 `speed: 200` — 기본값은 12다. 근거를 모른다 (손으로 맞춘 값일 수 있다) |
| 5 | 🔧 | `_layout.tsx:102` | 비활성 아이콘 `textLight`(#999) on `background`(#fff) = **2.85:1**. 아이콘 기준 3:1 미달. 활성 `textPrimary`(#333)는 12.6:1로 통과 |
| 6 | 🔧 | `_layout.tsx:101-102` | **현재 탭 표시가 아이콘 색 하나뿐이다.** 라벨이 일곱 다 `() => null`이고 크기·굵기·배경 차이도 없어 **색에만 의존**한다 |
| 7 | 🔧 | `_layout.tsx:111-196` | **탭 7개 전부 토크백이 읽을 것이 없다.** `tabBarAccessibilityLabel`을 안 주는데 `BottomTabBar.js:292`의 문자열 폴백은 `Platform.OS === 'ios'` 조건이라 **안드로이드에선 `undefined`**다. 자식은 아이콘 글리프 `<Text>`뿐(`createIconSet.js:79`). `role='tab'`·`aria-selected`는 넘어온다 |
| 8 | 🔧 | `_layout.tsx:111-196` | 탭이 7개인데 폭만 나뉜다 — **320dp에서 탭 하나가 45.7dp로 최소 터치 48dp 미만**이다 (411dp 실기기는 58.7dp) |
| 9 | 🔧 | `_layout.tsx:49` | `android_ripple={{ borderless: false, radius: 0 }}`가 라이브러리의 `{ borderless: true }`를 덮는다. **반경 0이면 리플이 안 보여** 누르는 동안 시각 반응이 없고, 피드백은 뗀 뒤의 튐뿐이다 |
| 10 | ❓ | `_layout.tsx:97` | `backBehavior="history"` (기본은 `firstRoute`). 탭을 옮긴 만큼 뒤로가기를 눌러야 앱이 닫힌다 |
| 11 | 🔧 | `_layout.tsx:38` | 거르는 다섯 중 **`pressColor`·`ref`는 `bottom-tabs`가 넘기지도 않는다** (`BottomTabItem.js:127-152`). 죽은 필터다 |
| 12 | 🔧 | `_layout.tsx:15-20, 38` | `({ ... }: any)` + `restProps as any` — 타입이 통째로 꺼져 있어 11번 같은 게 안 보인다 |
| 13 | 🔧 | `_layout.tsx:103-107, 131-134, 136-151` | 설명 주석 덩어리 셋이 **JSX 속성 사이**에 있다. `flashcards` 탭만 주석 16줄이라 나머지 여섯과 모양이 다르다 (앱 뿌리 51의 「주석 사본」과 달리 **대체된 코드는 아니다**) |
| 14 | 🔧 | `_layout.tsx:100, 207, 116~193` | 치수가 전부 리터럴 — `height: 64` · `paddingBottom: 4` · `paddingTop: 8` · 아이콘 `size={24}` 7개. `LAYOUT.isTablet`·`spacing*`이 있는데 안 써서 **태블릿에서 탭바가 안 커진다** (규칙 3) |

**표에 안 넣은 것** — 6절(`shadow*`·`Platform.OS === 'ios'`) 0건 · 인셋 이중가산 없음(라이브러리가 `[{height, paddingBottom: insets.bottom}, tabBarStyle]` 순이라 우리 값이 이긴다) · 화면 방향 소유자 단일화와 `activity`·`guitar`의 `tabBarStyle: display:'none'`은 0절.

**0-2절 세 줄 판정** (다시 묻지 않는 줄이라 표 밖에 적는다): `BottomTabBar.js:248`이 `position: isTabBarHidden ? 'absolute' : undefined`라 **탭바가 보일 때는 절대배치가 아님을 소스로 확정**했다 — 냉장고(47)·드럼(50)·learn(52)이 `insets.bottom`을 또 더하는 것은 **중복이 맞다.** 다만 냉장고·드럼은 「빼면 버튼이 탭바에 붙어 보이나」가 남아 📱 그대로고, learn(탭바 높이 64까지 더함)은 🔧 그대로다.

고를 것을 한 줄로 알려주세요 (예: `1, 3, 7 고침 / 나머지 나중에`).

## 2. 사용자

1, 2, 3, 7 ,13 고침 / 4, 10 그대로 / 나머지 나중에

## 3. Claude

코드를 고칩니다 — 1, 2, 3, 7, 13번.

타입체크는 기존 1건(`useSyncGameData` — 0절)만 남고 통과했습니다. 규칙 5대로 한 번 더 훑었습니다.

**재점검 2건** (고치지 않고 0-2절로 보냅니다):
- 🔧 접근성 이름에 **위치가 없다** — iOS 폴백이 주던 `「…, tab, 3 of 7」`의 순번 정보는 우리가 준 이름에 없다. `aria-selected`로 「선택됨」만 읽힌다
- 📱 `useNativeDriver: true`인 값에 `stopAnimation()` + `setValue(1)`을 걸었다 — 네이티브 배율이 즉시 1로 돌아오는지는 실기기라야 안다

코드를 커밋합니다.
