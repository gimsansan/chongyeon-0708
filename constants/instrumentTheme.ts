/**
 * 악기 화면(피아노 · 기타)이 공유하는 디자인 토큰.
 *
 * 통일감은 **색이 아니라 구조·간격·타이포**에서 나온다. 그래서 여기 모으는 건
 * 두 화면이 실제로 같아야 하는 값들(제어반 치수, 라운드, 의미색)이고,
 * 악기색은 `INSTRUMENT_ACCENT`로 갈라둔다 — 두 악기가 구분은 돼야 하기 때문이다.
 *
 * 쓰는 곳: `components/instrument/*`, `screens/MusicTrainingScreen.tsx`,
 * `app/(tabs)/guitar/_layout.tsx`
 */

/** 하단 제어반. 값은 피아노 `trainingContainer`가 원본이다 */
export const CONTROL_BAR = {
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderTopWidth: 2,
  borderTopColor: 'rgba(255, 255, 255, 0.1)',
  /** 기본 높이 */
  standardHeight: 110,
  /** 폴링노트처럼 위쪽 공간이 급할 때. 기타는 가로모드라 이쪽을 기준으로 쓴다 */
  compactHeight: 76,
} as const;

export const RADII = {
  action: 8,
  difficulty: 14,
  toggle: 6,
} as const;

/**
 * 의미색 — **악기가 달라도 뜻이 같으면 같은 색이다.**
 * 이걸 악기별로 갈라두면 "빨강 = 중지"라는 학습이 화면마다 깨진다.
 */
export const SEMANTIC = {
  /** 중지 · 훈련 종료 */
  stop: '#FF3B30',
  /** 다시 듣기 */
  repeat: '#34C759',
  /** 피드백 문구 */
  feedback: '#4CAF50',
  /** 정답 힌트(디버그) */
  hint: '#FF453A',
  /** 점수 */
  score: '#ffffff',
} as const;

/** 악기별 액센트 — 구조는 같고 **이것만** 다르다 */
export const INSTRUMENT_ACCENT = {
  piano: {
    screen: '#000000',
    bar: 'rgba(34, 34, 34, 0.85)',
    accent: '#007BFF',
    idle: '#555555',
  },
  guitar: {
    screen: '#1a120b',
    bar: 'rgba(60, 42, 33, 0.85)',
    accent: '#d4a373',
    idle: '#4f3422',
  },
} as const;

export type InstrumentId = keyof typeof INSTRUMENT_ACCENT;
