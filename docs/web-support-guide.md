# Web 대응 가이드 (rive-react-native 플랫폼 분리)

> 작성일: 2026-07-07
> 대상 프로젝트: `D:\hr` (Expo SDK 57 / React Native 0.86, Android 우선 개발)
>
> 목적: 현재는 Android(모바일)만 테스트하지만, 나중에 Web도 돌릴 수 있는 상황이 왔을 때
> 참고하여 대처하기 위한 문서.

---

## 1. 배경 (무슨 문제였나)

Metro 시작 시 아래 에러가 반복 발생했음:

```text
Metro error: (0 , _reactNative.requireNativeComponent) is not a function

Code: index.tsx
> 19 | import Rive from 'rive-react-native';
```

- 이 에러는 **Android 번들이 아니라 Web 번들(SSR 라우트 렌더링)** 에서 발생한 것.
- 원인: `app.json`의 `"web": { "output": "static" }` 설정 때문에 Metro 시작 시마다
  SSR 라우트 스캔이 돌았고, 그 과정에서 web에서 동작하지 않는 `rive-react-native`가
  정적 import되어 번들이 깨짐.
- `rive-react-native`는 네이티브 전용 모듈이라 web/SSR 환경에서는 import 자체가 실패함.

## 2. 기본 방침: 패키지는 지우지 말 것

Web 가능성을 남기려면 **패키지는 지우지 말고** 아래만 조치:

1. `app.json` — `"output": "static"` 한 줄만 삭제 (web 섹션은 유지).
   → SSR 라우트 스캔이 안 돌아서 에러가 사라짐. **(2026-07-07 적용 완료)**
2. `react-native-web`, `react-dom` — `package.json`에서 삭제하지 말고 유지.
3. `rive-react-native` import를 플랫폼 분리로 감싸기 (아래 3단계).
   → 나중에 web 실행 시 번들이 안 깨짐.

## 3. 플랫폼 분리 3단계

### 1단계: `components/rive/index.native.ts` 생성 (진짜 모듈 재수출)

```ts
export { default, Fit } from 'rive-react-native';
export type { RiveRef } from 'rive-react-native';
```

### 2단계: `components/rive/index.web.tsx` 생성 (빈 스텁)

```tsx
import React from 'react';
import { View } from 'react-native';

export const Fit: any = {};
export type RiveRef = any;

export default function Rive(props: { style?: any }) {
  return <View style={props.style} />;
}
```

> Metro가 Android에서는 `.native.ts`, web에서는 `.web.tsx`를 자동으로 골라 사용함.

### 3단계: 아래 5개 파일의 import 경로 교체

| 파일 | 현재 (줄) | 변경 후 |
|---|---|---|
| `app/(tabs)/activity/index.tsx` | 19줄 | `import Rive from '../../../components/rive';` |
| `app/(tabs)/drum/index.tsx` | 12줄 | `import Rive, { Fit } from '../../../components/rive';` |
| `app/(tabs)/refri-test/index.tsx` | 21줄 | `import Rive from '../../../components/rive';` |
| `screens/DrumGameOverScreen.tsx` | 4줄 | `import Rive from '../components/rive';` |
| `components/RiveAnimalGame.tsx` | 3줄 | `import Rive, { Fit, RiveRef } from './rive';` |

## 4. 모바일 테스트만 할 때 (현재 시점)

`"output": "static"`을 이미 제거했다면 **플랫폼 분리를 안 해도 됨.**
에러는 web 정적 렌더링(SSR) 때만 발생했고, 이제 그 과정 자체가 안 돌기 때문.

바로 진행할 순서:

```powershell
cd D:\hr
npx expo start --dev-client -c
```

→ 폰에서 앱 실행 → Metro 터미널에 `Android Bundled ...` 라인이 뜨는지 확인.

- 라인이 뜨면: 번들 정상.
- 안 뜨면: 폰-Metro 연결 문제 (Metro가 켜져 있는 상태인지 먼저 확인).

## 5. 주의: 3단계 적용 범위 (절반만 해결됨)

3단계를 적용하면 web 대응이 "완전히" 되는 것은 아님. 정확히는 절반만 맞음.

### 되는 것

- `rive-react-native` 때문에 web 번들이 깨지는 문제는 3단계로 해결됨. 번들은 통과함.

### 안 되는 것 (web에서 "정상 동작"까지는 보장 안 됨)

- Rive 애니메이션 자리는 web에서 **빈 View**로 나옴 (스텁이니까).
- `@shopify/react-native-skia` (`components/game/Waveform.tsx`)는
  web에서 CanvasKit 별도 설정 필요.
- `expo-audio`, `expo-haptics`, `expo-screen-orientation` 등도
  web 동작은 따로 검증 필요.

### 결론

3단계는 **"web 번들이 안 깨지게 하는" 조치**이고,
web에서 실제 기능이 다 돌아가려면 추가 작업(스텁을 실제 web 구현으로 교체,
Skia CanvasKit 설정, 오디오/햅틱/화면회전 web 검증)이 필요함.
