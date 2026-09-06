# 만점 콘페티 재적용 과정

GitHub에서 다시 클론·설치한 뒤에, 세션 49~50에서 넣었던 콘페티를 같은 순서로 되살릴 때 쓴다.

쓰는 화면은 드럼·learn 공용 `screens/DrumGameOverScreen.tsx`다. 만점(`score === maxScore`)일 때만 뜬다. 결과 메시지 「완벽해요!」가 아니면 콘페티는 안 나온다.

`confetti.riv`는 `android/app/src/main/res/raw/`에 둔다. Metro 새로고침만으로는 안 들어간다. 파일 넣고 앱을 **네이티브로 다시 빌드**해야 한다.

---

## 1. Rive 파일 만들기 (세션 49)

게이지 파일(`gauge.rev` / `pro_box33`)은 건드리지 않는다. **Confetti 아트보드만** 새로 만든다.

- 아트보드 이름: `Confetti`
- 스테이트 머신: `State Machine 1`
- 타임라인: `Burst` — 위에서 아래로 떨어지는 키프레임

보낸 위치:

```
android/app/src/main/res/raw/confetti.riv
```

코드에서 `resourceName="confetti"`로 이 파일을 찾는다. 확장자 `.riv`는 적지 않는다.

이미 만들어 둔 `confetti.riv`가 있으면 이 단계 대신 그 파일을 같은 경로에 복사하면 된다.

---

## 2. 결과 화면에 연결 (세션 49)

`screens/DrumGameOverScreen.tsx`에서 만점일 때만 Rive를 깐다.

처음에 콘페티를 카드 **뒤에** 두면 드럼에서 안 보인다. 드럼·learn 오버레이가 `alignItems: 'center'`라 이 화면 높이가 카드만큼으로 줄고, 조각이 흰 카드에 묻힌다. 그래서 아래 3으로 고친다.

---

## 3. 화면에 보이게 고치기 (세션 50)

파일: `screens/DrumGameOverScreen.tsx`

1. 바깥 컨테이너를 `flex: 1`이 아니라 `StyleSheet.absoluteFill`로 채운다. 높이가 카드만큼으로 줄어 콘페티가 그 상자 안에 갇히지 않게 한다.
2. 콘페티를 카드·버튼 **앞**에 올린다. `zIndex: 2`, `elevation: 8` (카드는 `elevation: 4`). 터치는 `pointerEvents="none"`이라 버튼은 그대로 눌린다.

핵심 코드:

```tsx
const PerfectConfetti = React.memo(function PerfectConfetti() {
  return (
    <View style={styles.confettiOverlay} pointerEvents="none" importantForAccessibility="no">
      <Rive
        resourceName="confetti"
        artboardName="Confetti"
        stateMachineName="State Machine 1"
        autoplay
        fit={Fit.Cover}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});
```

렌더 맨 아래(카드·버튼 다음):

```tsx
{isPerfect && <PerfectConfetti />}
```

스타일:

```tsx
container: {
  ...StyleSheet.absoluteFill,
  padding: 16,
  justifyContent: "center",
  alignItems: "center",
},
confettiOverlay: {
  ...StyleSheet.absoluteFill,
  zIndex: 2,
  elevation: 8,
},
resultWrapper: {
  width: "100%",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1,
},
```

`PerfectConfetti`로 나눈 이유: 카드 폭 실측(`onLayout`)으로 게이지가 다시 그려져도 콘페티가 처음부터 다시 돌지 않게 하기 위해서다.

---

## 4. 잠깐 뜨고 멈추면 Burst 길이를 고친다 (세션 50)

화면 맨 위에만 잠깐 보이다 멈추면 레이아웃이 아니라 **Rive 재생 길이**다.

`Burst` 키프레임은 이미 120프레임인데, 재생 duration이 **2프레임(0.03초)** 이면 윗부분만 깜빡이고 끝난다.

게이지 아트보드는 그대로 두고 `Burst`만 고친다.

- duration: **120**
- loop: **켠다**

고친 뒤 `android/app/src/main/res/raw/confetti.riv`에 다시 넣는다. 그리고 **네이티브 다시 빌드**.

만점 결과창이 떠 있는 동안 콘페티가 반복된다. 한 번만 떨어지게 하려면 loop를 빼면 된다.

---

## 5. 빌드

`res/raw`라 JS 새로고침만으로는 안 들어간다. 파일을 넣거나 `.riv`를 바꾼 뒤에는 앱을 한 번 다시 빌드한다.

확인할 것:

- 결과 화면에 「완벽해요!」가 나온다 (만점).
- 콘페티가 화면 전체에 떨어지고, 게이지가 끝나도 멈추지 않는다 (loop).
- 「다시 하기」「나가기」가 눌린다 (콘페티는 터치 통과).
