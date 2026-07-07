# 디버깅 회고: "splash에서 멈춤" 문제의 진짜 원인

> 작성일: 2026-07-07
> 프로젝트: `D:\hr` (Expo SDK 57 / RN 0.86, Android 실기기 Wi-Fi 디버깅)
> 관련 문서: `docs/web-support-guide.md`

---

## 1. 요약 (TL;DR)

- **증상**: 폰에서 앱 실행 시 splash 이미지에서 넘어가지 않음.
- **처음 의심한 원인**: `rive-react-native`의 web import가 Metro 번들을 깨뜨린다 → **틀림**
- **진짜 원인**:
  1. 앱을 실행한 시점에 **Metro가 꺼져 있었음** (앱이 APK 내장 번들을 찾다가 크래시)
  2. Metro가 켜져 있을 때도 **첫 번들 빌드+전송에 13초**가 걸렸는데, 그 사이 앱이 종료됨
- **해결**: Metro를 켜둔 상태 유지 + 앱 실행 + splash에서 기다리기. 이게 전부였음.

---

## 2. 타임라인 (로그 근거)

### 13:57 — 첫 크래시 (Metro 꺼진 상태에서 앱 실행)

```text
FATAL EXCEPTION: main
Process: com.vlondy.threadsclone
java.lang.RuntimeException: Unable to load script.
Make sure you're running Metro or that your bundle 'index.android.bundle'
is packaged correctly for release.
  at com.facebook.react.runtime.ReactInstance.loadJSBundleFromAssets(Native Method)
```

- `loadJSBundleFromAssets` = 앱이 Metro에 연결하지 못해서 **APK 안에 내장된 번들**을
  찾으려 했다는 뜻. debug 빌드에는 내장 번들이 없으므로 크래시.
- 즉, 이 시점의 실패는 코드 문제가 아니라 **Metro 서버가 안 떠 있었던 것**.

### Metro 터미널의 반복 에러 (혼란의 근원)

```text
Metro error: (0 , _reactNative.requireNativeComponent) is not a function

Code: index.tsx
> 19 | import Rive from 'rive-react-native';
```

- 이 에러는 `Android Bundled`가 아니라 **`Web Bundled` / SSR 렌더링 로그**에서 발생.
- 원인: `app.json`의 `"web": { "output": "static" }` 때문에 Metro 시작 시마다
  web 정적 렌더링(SSR)이 모든 라우트를 web 환경에서 import → 네이티브 전용
  `rive-react-native`가 web에서 깨짐.
- **Android 번들과는 완전히 무관**했지만, 터미널에 크게 찍혀서 원인처럼 보였음.

### 14:45:23 — 앱이 "멈춘 게" 아니라 "죽은 것"

```text
ActivityManager: Killing 2066:com.vlondy.threadsclone (adj 900):
  remove task: recent-task-trimmed
```

- 첫 번들 빌드+전송 13초 동안 splash가 유지됐고, 그 사이 태스크가 제거되어 종료됨.
- 사용자가 최근 앱 목록에서 스와이프했거나, 시스템(Samsung)이 태스크를 자동 정리한 것.
- 어느 쪽이든 **앱 자체 크래시는 아니었음**.

### 14:46 — 정상 동작 확인

```text
› Opening on Android... on SC_01M
Android Bundled 13129ms index.ts (2464 modules)
```

- Metro 켜둔 상태에서 앱 실행 + 기다림 → 번들 정상 전달 → 첫 화면 진입 성공.
- 이후 캐시가 생겨 다음 실행부터는 훨씬 빨라짐.

---

## 3. 잘못 짚었던 가설들 (오답 노트)

| 가설 | 검증 결과 |
|---|---|
| rive web import가 번들을 깨서 앱이 안 뜬다 | 틀림. web 번들 전용 에러, Android와 무관 |
| `.riv` 리소스 누락/이름 불일치 | 틀림. `res/raw/`에 7개 전부 존재, `resourceName` 모두 일치 |
| `_layout.tsx`의 splash `onLoadEnd` 로직 버그 | 무관. JS가 그 지점까지 도달하지도 못한 상황 |
| 미사용 패키지가 원인 | 틀림. 삭제는 정리였을 뿐, 원인 제거가 아님 |

---

## 4. 실제로 도움이 된 조치

1. **`app.json`에서 `"output": "static"` (web 섹션) 삭제**
   → SSR 스캔이 멈춰서 가짜 에러가 사라짐. 진짜 원인을 볼 수 있게 됨.
2. **`adb logcat -b crash -d` 확인**
   → "Unable to load script" 크래시 발견 = Metro 미연결이 원인임을 확정.
3. **`adb logcat`에서 `ActivityManager: Killing ...` 발견**
   → 멈춘 게 아니라 태스크 제거로 죽었음을 확인.
4. **Metro 켜둔 상태 유지 + 기다리기**
   → 문제 해결의 본체.

---

## 5. 교훈 (다음에 같은 상황이 오면)

1. **에러 로그가 화려해도 끌려가지 말 것.**
   먼저 물어볼 것: "이 에러가 **어느 플랫폼 번들**에서 난 것인가?"
   - `Web Bundled ...` 줄 아래의 에러 → web 전용, Android와 무관할 수 있음
   - `Android Bundled ...` 줄이 떴는가? → 떴으면 번들은 정상 전달된 것
2. **앱이 "멈췄다"고 보이면 logcat부터.**
   ```powershell
   adb logcat -b crash -d          # 크래시가 있었는지
   adb shell pidof com.vlondy.threadsclone   # 프로세스가 살아있는지
   adb logcat -d | findstr "vlondy"          # 앱이 뭘 하다 죽었는지
   ```
   - 크래시 로그가 있으면 → 그게 진짜 원인
   - `Killing ... remove task` → 죽인 것이지 멈춘 게 아님
   - 프로세스가 살아있는데 화면이 안 바뀜 → 그때가 진짜 JS 로직 문제
3. **debug 빌드는 Metro가 생명줄.**
   앱 실행 전에 Metro 터미널이 살아있는지 확인. `› Stopped server`가 마지막 줄이면 꺼진 것.
4. **첫 번들은 느리다.**
   `-c`(캐시 클리어) 후 첫 실행은 10초 이상 걸릴 수 있음. splash에서 20~30초는 기다릴 것.

---

## 6. 쉬운 설명 (비유)

이 상황을 식당에 비유하면 이렇습니다.

**등장인물**
- 손님 = 폰의 앱
- 주방 = Metro 서버 (JS 번들을 만들어 주는 곳)
- 음식 = JS 번들
- 식당 입구의 "준비중" 팻말 = splash 화면

**13:57에 벌어진 일**: 손님(앱)이 식당에 갔는데 **주방(Metro)이 문을 닫은 상태**였습니다.
손님은 "그럼 포장된 도시락(APK 내장 번들)이라도 없나?" 하고 찾았는데, debug 빌드에는
도시락이 들어있지 않아서 그냥 쓰러져 버렸습니다(크래시).

**그동안 터미널의 rive 에러**: 식당 옆에 "웹 배달 전용 창구(Web SSR)"가 하나 있었는데,
그 창구가 열릴 때마다 "이 메뉴(rive)는 배달이 안 돼요!"라고 크게 소리를 질렀습니다.
홀 영업(Android)과는 전혀 상관없는 소리였지만, 소리가 너무 커서 다들
"저것 때문에 식당이 안 되는구나"라고 착각했습니다.
→ `"output": "static"` 삭제 = 그 배달 창구를 닫아버린 것. 소리가 사라지니
비로소 진짜 문제가 보이기 시작했습니다.

**14:45에 벌어진 일**: 이번엔 주방이 열려 있었습니다. 주방장이 첫 주문이라
재료 손질부터 시작해서 **요리에 13초**가 걸렸습니다. 그동안 손님은 입구의
"준비중" 팻말(splash)만 보고 있었는데, 요리가 나오기 직전에 자리를 떠버렸습니다
(태스크 제거로 앱 종료). 음식은 완성됐지만 먹을 사람이 없었던 거죠.

**14:46 해결**: 주방 열어두고(Metro 유지), 손님이 자리에 앉아서(앱 실행),
음식이 나올 때까지 기다리니(20~30초) 정상적으로 식사(첫 화면 진입)를 했습니다.
게다가 한 번 만든 요리는 레시피가 캐시로 남아서, 다음부터는 훨씬 빨리 나옵니다.

**교훈을 비유로**: 식당이 안 된다고 느껴질 때, 가장 크게 들리는 소리(화려한 에러 로그)를
쫓지 말고, 먼저 두 가지를 확인하세요 —
"주방이 열려 있나?"(Metro 실행 여부)와
"손님이 지금 뭘 하다 나갔나?"(logcat의 앱 프로세스 기록).
