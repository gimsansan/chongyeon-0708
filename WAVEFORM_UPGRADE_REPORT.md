# Waveform 업그레이드 보고서

## 적용 일자
2025-03-12

---

## 1. 적용 내용 요약

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| **진행도** | 3초 고정 애니메이션 (실제 오디오와 무관) | expo-av `positionMillis/durationMillis` 기반 실제 재생 진행도 동기화 |
| **업데이트 주기** | - | `progressUpdateIntervalMillis: 100` (100ms) |
| **UI** | 단색 (#FF9800) | 좌→우 그라데이션 (주황 → 연한주황 → 초록) |
| **애니메이션** | `Easing.linear` | `Easing.out(Easing.cubic)` (폴백 모드 시) |

---

## 2. 수정된 파일

### 2.1 `hooks/useWordAudioPlayer.ts`
- `useSharedValue`로 `progress` 추가 (0~1)
- `setProgressUpdateIntervalAsync(100)` 호출
- `setOnPlaybackStatusUpdate`에서 `positionMillis`, `durationMillis`로 progress 갱신
- 재생 완료/에러/정지 시 `progress.value = 1` 또는 `0`
- 반환값에 `progress` 추가

### 2.2 `components/game/Waveform.tsx`
- `progress?: SharedValue<number>` prop 추가 (선택)
- `progress` 제공 시: 실제 오디오 진행도 사용
- `progress` 미제공 시: 기존 3초 폴백 애니메이션 유지 (하위 호환)
- `LinearGradient` 적용: `vec(0, height/2)` → `vec(width, height/2)`
- 색상: `[color, '#FFB74D', '#81C784']`, positions `[0, 0.5, 1]`
- early return을 hooks 이후로 이동 (React Hooks 규칙 준수)

### 2.3 `components/game/WordFlashcard.tsx`
- `Waveform`에 `progress={audioPlayer.progress}` 전달

---

## 3. 성능 영향

| 항목 | 방식 | 영향 |
|------|------|------|
| 진행도 갱신 | SharedValue 직접 갱신 | React 리렌더 없음, UI 스레드 애니메이션 |
| 콜백 빈도 | 100ms 간격 | 초당 10회, 부담 낮음 |
| 그라데이션 | Skia LinearGradient | Path fill에 스타일 추가 수준, 영향 미미 |

---

## 4. 사용자 경험 변화

- **변경 전**: 재생 중 파형이 항상 3초에 맞춰 채워짐 (실제 소리 길이와 무관)
- **변경 후**: 실제 재생 위치에 맞춰 파형이 채워짐 (짧은 소리는 빠르게, 긴 소리는 천천히)

---

## 5. 참고

- `progress` prop 미제공 시 기존 동작 유지 (폴백)
- `전체 듣기` 모드에서는 Waveform 미표시 (기존과 동일)
