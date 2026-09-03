# 실측 레이아웃 — `onLayout`으로 "제 높이만큼" 옮기기

드럼 탭 악기명 레이블을 **자기 높이만큼 아래로** 내리면서 쓴 방법을 정리한다.
`app/(tabs)/drum/index.tsx`의 아래 코드가 대상이다.

```tsx
// 위치: 헤더 실측 높이 + 화면 비례 간격 + 칩 실측 높이
<View
  style={[
    styles.instrumentLabelFixed,
    { top: headerHeight + instrumentLabelGap + instrumentLabelHeight },
  ]}
  pointerEvents="none"
>
  <View
    style={styles.currentInstrumentDisplay}
    onLayout={(event) => {
      const measured = Math.round(event.nativeEvent.layout.height);
      setInstrumentLabelHeight((prev) => (prev === measured ? prev : measured));
    }}
  >
    <Text style={styles.currentInstrumentText}>
      {DRUM_INSTRUMENTS[labelInstrument].name}
    </Text>
  </View>
</View>
```

---

## 0. 요구사항이 왜 까다로운가

요구는 한 줄이다 — **"레이블을 제 높이만큼 아래로."**

그런데 "제 높이"가 몇 px인지 **코드를 쓰는 시점에는 아무도 모른다.**

스타일에는 `minHeight: 50`이 있지만 이건 **높이가 아니라 하한**이다.
칩의 실제 높이는 `paddingVertical 8 × 2 + 글자 줄높이 22 + 테두리 2 × 2 = 42`이고,
42 < 50이라 평소에는 `minHeight`가 이겨서 **50이 된다.**

하지만 사용자가 기기 설정에서 **글꼴을 크게** 해두면 글자 줄이 커져 42를 넘고,
칩 높이는 50보다 커진다. 그 순간 `+ 50`은 "제 높이만큼"이 아니게 된다.

> 정리: **하드코딩한 50은 "대부분의 기기에서 우연히 맞는 값"이다.**
> 요구사항이 "제 높이만큼"이면, 높이를 **실제로 재야** 한다.

---

## 1. 개념 — 렌더하는 순간에는 크기를 모른다

React Native에서 컴포넌트가 JSX를 반환하는 시점에는 아직 **아무 크기도 정해지지 않았다.**
크기는 그 뒤 레이아웃 엔진(Yoga)이 `flex`, `padding`, 글자 크기 따위를 모두 계산해서 확정한다.

```
① 렌더 (JSX 반환)  →  ② Yoga가 크기·위치 계산  →  ③ 화면에 그림
                                    ↑
                          여기서야 "높이 50"이 정해진다
```

그래서 **렌더 함수 안에서는 자기 높이를 읽을 방법이 없다.** 아직 존재하지 않으니까.
계산이 끝난 뒤에 결과를 **알려주는** 통로가 필요하고, 그게 `onLayout`이다.

---

## 2. 문법 — `onLayout` 이벤트

모든 RN 코어 컴포넌트(`View`, `Text`, `Image` …)가 받는 prop이다.
Yoga 계산이 끝나 크기가 정해지면(그리고 이후 바뀔 때마다) 호출된다.

```tsx
onLayout={(event) => {
  const { x, y, width, height } = event.nativeEvent.layout;
}}
```

| 필드 | 뜻 |
|---|---|
| `width` / `height` | 그 뷰의 최종 크기 |
| `x` / `y` | **부모 기준** 좌표 (화면 좌표가 아니다) |

단위는 px이 아니라 **dp**다. 스타일에 쓰는 숫자와 같은 단위라 그대로 더해 쓸 수 있다.

핵심 성질 두 가지:

- **한 박자 늦다.** 첫 렌더가 끝난 뒤에야 값이 온다.
- **크기가 바뀌면 또 온다.** 회전, 글꼴 배율 변경, 글자 길이 변화 등.

두 번째 성질 덕분에 이 방식은 자동으로 반응형이 된다 — 화면이 돌아가면 다시 재서 다시 맞춘다.

---

## 3. 개념 — 잰 값은 **상태(state)** 여야 한다

측정값을 화면에 반영하려면 **다시 그려야** 한다. 다시 그리게 만드는 것은 상태뿐이다.

```tsx
const [instrumentLabelHeight, setInstrumentLabelHeight] =
  useState(INSTRUMENT_LABEL_MIN_HEIGHT);
```

`useRef`에 담으면 값은 남지만 화면이 갱신되지 않는다. 그래서 `useState`다.

이 파일 안에서 **상태로 둘 것과 그냥 계산할 것**의 구분이 잘 드러난다:

| 값 | 어떻게 아나 | 형태 |
|---|---|---|
| `instrumentLabelGap` | 화면 높이로 **계산**된다 (`windowHeight * 0.02`, 8~24 클램프) | 그냥 변수 |
| `headerHeight` | **재야** 안다 | `useState` + `onLayout` |
| `instrumentLabelHeight` | **재야** 안다 | `useState` + `onLayout` |

> 기준: **계산으로 나오면 파생값, 재야 알면 상태.**
> 계산으로 낼 수 있는 것을 굳이 재면 코드만 복잡해지고 한 프레임 느려진다.

---

## 4. 패턴 — measure-then-render, 그리고 초기값이 중요한 이유

측정이 한 박자 늦으므로 화면은 이렇게 두 번 그려진다.

```
1프레임:  초기값으로 그림   →  onLayout이 실측을 알림  →  setState
2프레임:  실측값으로 다시 그림
```

**초기값이 실제와 많이 다르면 그 차이가 눈에 "튐"으로 보인다.**
레이블이 엉뚱한 데 떴다가 툭 하고 제자리로 옮겨가는 식이다.

그래서 초기값을 평소 높이와 같은 값으로 두었다.

```ts
const INSTRUMENT_LABEL_MIN_HEIGHT = 50;
```

평소에는 실측도 50이라 **1프레임과 2프레임이 같은 그림**이 되어 튐이 없고,
글꼴이 커진 기기에서만 2프레임에서 조용히 보정된다.

---

## 5. 문법 — 함수형 업데이트 (updater function)

`setState`에는 **값** 대신 **함수**를 넘길 수 있다.

```tsx
setInstrumentLabelHeight(measured);                                  // 값
setInstrumentLabelHeight((prev) => (prev === measured ? prev : measured)); // 함수
```

함수를 넘기면 React가 **현재 값을 인자로 넣어** 호출하고, 반환값을 새 상태로 삼는다.
여기서 함수 꼴을 쓴 이유는 **이전 값과 비교해야** 하기 때문이다.

바깥에서 `instrumentLabelHeight`를 직접 읽어 비교할 수도 있지만,
그러면 이 콜백이 그 변수를 **클로저로 붙잡게** 되어 오래된 값을 볼 여지가 생긴다.
함수 꼴은 React가 항상 최신 값을 건네주므로 그런 걱정이 없다.

---

## 6. 되먹임 고리 — 이 패턴의 진짜 함정

`onLayout` → `setState` → 리렌더 → `onLayout` → … 은 **원리상 고리**다.
이게 끝없이 돌면 앱이 멈춘다. 끊는 장치가 세 개 겹쳐 있다.

### (1) React의 자동 중단 (bail-out)

React는 새 상태가 **이전 상태와 같으면**(`Object.is` 기준) 자식을 다시 그리지 않고 멈춘다.
그래서 매번 같은 `50`이 들어오는 한 고리는 저절로 끊긴다.

> 사실 관계를 분명히 해두자. **명시적 비교가 없어도 무한 루프가 나지는 않는다.**
> 이 파일의 `setHeaderHeight(event.nativeEvent.layout.height)`(363행)가 비교 없이도
> 잘 도는 이유가 이것이다.

### (2) `Math.round` — 서브픽셀 진동 죽이기

문제는 값이 **아주 조금씩** 다르게 올 때다.
기기 픽셀 밀도에 따라 실측이 `49.99998` → `50.00002`처럼 소수점 끝자리만 흔들릴 수 있다.
이건 `Object.is` 기준으로 **매번 다른 값**이라 자동 중단이 걸리지 않는다.
→ 리렌더 → 또 측정 → 또 미세하게 다름 → … 진짜 고리가 돈다.

```tsx
const measured = Math.round(event.nativeEvent.layout.height);
```

반올림해서 정수로 눌러버리면 이 진동이 사라진다. **이게 실질적인 방어선이다.**

### (3) 명시적 비교 — 의도를 코드에 남기기

```tsx
setInstrumentLabelHeight((prev) => (prev === measured ? prev : measured));
```

React의 자동 중단에 기대도 동작은 하지만, 그건 **라이브러리 내부 동작에 의존**하는 것이다.
호출부에 비교를 적어두면 "같으면 갱신하지 않는다"가 **코드에 드러난다.**
나중에 읽는 사람이 되먹임 고리를 의식하게 되고, 자동 중단 규칙이 바뀌어도 안전하다.

---

## 7. 개념 — 단일 진실 공급원 (single source of truth)

`50`이라는 숫자가 **두 곳**에서 필요하다.

- `useState`의 초기값
- 스타일의 `minHeight`

둘이 어긋나면 첫 프레임이 튄다. 그래서 상수 하나를 만들어 양쪽이 **같은 것을 보게** 했다.

```ts
const INSTRUMENT_LABEL_MIN_HEIGHT = 50;

const [instrumentLabelHeight, setInstrumentLabelHeight] =
  useState(INSTRUMENT_LABEL_MIN_HEIGHT);

currentInstrumentDisplay: {
  minHeight: INSTRUMENT_LABEL_MIN_HEIGHT,
  ...
}
```

이제 칩을 60으로 키우고 싶으면 **한 줄만** 고치면 된다.
한쪽만 고쳐서 둘이 벌어지는 사고가 구조적으로 막힌다.

---

## 8. 개념 — 절대 배치에서 세 항을 더하기

```tsx
top: headerHeight + instrumentLabelGap + instrumentLabelHeight
```

`styles.instrumentLabelFixed`가 `position: 'absolute'`라 `top`이 곧 세로 위치다.
그 값이 성격이 다른 세 항의 합이다.

| 항 | 성격 | 왜 이 형태인가 |
|---|---|---|
| `headerHeight` | **실측** | 헤더는 상단 인셋 포함이라 기기마다 다르다. 노치 유무까지 자동 반영 |
| `instrumentLabelGap` | **비례 + 클램프** | `windowHeight * 0.02`를 8~24로 묶음. 작은 폰에서 답답하지 않고 태블릿에서 붕 뜨지 않게 |
| `instrumentLabelHeight` | **실측** | 이번에 더한 항. "제 높이만큼 아래로"가 그대로 식이 됨 |

세 항 모두 **고정 px이 하나도 없다.** 기기가 바뀌면 세 항이 각자 알아서 바뀐다.
`CLAUDE.md` 규칙 3(반응형)이 요구하는 형태다.

`instrumentLabelGap`의 **클램프**(`Math.min(24, Math.max(8, ...))`)도 기억해둘 만하다.
순수 비례만 쓰면 아주 작은 폰에서 4px, 큰 태블릿에서 40px처럼 극단으로 간다.
비례로 잡되 양 끝을 묶는 것이 실전에서 안전하다.

---

## 9. 개념 — `pointerEvents`

레이블이 아래로 내려오면서 드럼 세트 영역과 **겹칠 수** 있다.
겹치면 그 위를 눌렀을 때 드럼이 아니라 레이블이 터치를 먹는다.

```tsx
pointerEvents="none"
```

이 한 줄이 **"보이기는 하되 터치는 통과시켜라"** 는 뜻이다.

| 값 | 뜻 |
|---|---|
| `auto` | 기본. 자기도 자식도 터치를 받는다 |
| `none` | 자기도 자식도 터치를 받지 않는다. **완전히 통과** |
| `box-none` | 자기는 안 받고 **자식은 받는다**. 오버레이 컨테이너에 쓴다 |
| `box-only` | 자기는 받고 자식은 못 받는다 |

같은 파일의 드럼 캐릭터·버튼 오버레이(`drumOverlayFixed`)는 `box-none`을 쓴다.
컨테이너는 화면을 덮되 안의 버튼은 눌려야 하기 때문이다. 목적에 따라 골라 쓰면 된다.

---

## 10. 한눈 요약

| # | 개념 / 문법 | 한 줄 |
|---|---|---|
| 1 | 렌더 시점엔 크기 미확정 | 크기는 Yoga 계산 뒤에 정해진다 |
| 2 | `onLayout` | 계산 끝난 크기를 알려주는 콜백. `event.nativeEvent.layout` |
| 3 | 측정값은 `useState` | 화면을 다시 그려야 하므로 `useRef`로는 안 된다 |
| 4 | measure-then-render | 한 박자 늦다. **초기값을 실제와 맞춰야** 안 튄다 |
| 5 | 함수형 업데이트 | `setX(prev => …)`. 클로저 문제 없이 이전 값과 비교 |
| 6 | 되먹임 고리 차단 | `Math.round`가 서브픽셀 진동을 죽이고, 명시적 비교가 의도를 남긴다 |
| 7 | 단일 진실 공급원 | 상수 하나를 초기값과 `minHeight`가 함께 본다 |
| 8 | 절대 배치 항 합산 | 실측 + 비례클램프 + 실측. 고정 px 없음 |
| 9 | `pointerEvents` | `none`은 통과, `box-none`은 자식만 받음 |

---

## 11. 이 패턴을 쓸 자리와 쓰지 말 자리

**쓸 자리** — 어떤 요소의 위치·크기가 **다른 요소의 실제 크기**에 달려 있고,
그 크기를 미리 계산할 수 없을 때.

이 저장소에 이미 같은 패턴이 여럿 있다.

- `헤더 높이` → 설정 드롭다운의 `top` (`index.tsx` 363행)
- `트랙 폭` → 문제 수 선택기의 눈금 계산 (1013행)
- `컨테이너 폭` → 드럼 가로 스크롤의 페이지 폭 (1172·1187행)

**쓰지 말 자리** — `flex`, `alignItems`, `gap`처럼 **레이아웃 규칙만으로 풀리는** 경우.
그런 데까지 측정을 쓰면 상태와 리렌더만 늘고 한 프레임 느려진다.

> 판단 기준: **"부모가 자식 크기를 몰라도 배치가 되는가?"**
> 된다면 레이아웃 규칙으로 풀고, 안 된다면 그때 잰다.

---

## 12. 주의사항

- **`onLayout`은 자주 불린다.** 회전, 글꼴 배율 변경, 글자 길이 변화마다 온다.
  콜백 안에서 무거운 일을 하지 말 것.
- **`x` / `y`는 부모 기준**이다. 화면 절대 좌표가 필요하면 `measureInWindow`를 써야 한다.
- **조건부 렌더 중인 요소는 안 재진다.** 이 레이블도 악기를 고르기 전에는 렌더되지 않아
  `onLayout`이 오지 않는다. 그래서 초기값이 반드시 쓸 만한 값이어야 한다.
- **측정 → 그 결과가 다시 크기를 바꾸는 구조는 만들지 말 것.**
  잰 높이로 자기 높이를 바꾸면 진짜 무한 루프가 된다. 여기서는 잰 값이 `top`에만
  쓰이고 칩 높이에는 영향을 주지 않아 고리가 닫히지 않는다.
