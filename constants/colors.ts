/**
 * 앱 공통 색상 상수
 * LAYOUT_APPLY_REPORT 권장사항 반영
 */
export const COLORS = {
  /** 기본 텍스트 */
  textPrimary: '#333',
  textSecondary: '#666',
  textMuted: '#555',
  textLight: '#999',
  textSlate: '#4b5563',
  textPlaceholder: '#aaa',
  textLoading: '#64748b',

  /** 배경 */
  background: '#ffffff',
  backgroundGray: '#f5f5f5',
  backgroundLight: '#f0f0f0',
  backgroundWarm: '#fffbeb',
  backgroundSuccess: '#ecfdf5',
  backgroundError: '#fef2f2',
  backgroundWarning: '#fef3c7',
  backgroundStar: '#FFF9E6',

  /** 액센트 / 버튼 */
  primary: '#f59e0b',
  primaryDark: '#d97706',
  blue: '#4A90E2',
  green: '#10b981',
  greenBright: '#50C878',
  success: '#7cbd7e',
  purple: '#9C27B0',

  /** 상태 */
  successLight: '#C8E6C9',
  successText: '#065f46',
  error: '#F44336',
  errorLight: '#FFCDD2',
  errorBorder: '#fca5a5',

  /** 테두리 */
  border: '#e2e8f0',
  borderGray: '#BDBDBD',

  /** 강조 */
  gold: '#FFD700',
  white: '#ffffff',

  /** 오버레이 */
  overlay: 'rgba(0, 0, 0, 0.4)',

  /** 기타 */
  activityIndicator: '#007bff',
  orange: '#FF8c42',
  successGreen: '#28A745',
  shadow: '#000',
  grayLight: '#E0E0E0',
  blueLight: '#E3F2FD',

  /** 등급 (matchGameAI, matchGamePG) */
  gradeUntried: '#999',
  gradePerfect: '#FF6B6B',
  gradeExcellent: '#4ECDC4',
  gradeNormal: '#95E1D3',
  gradePractice: '#FFE66D',
} as const;

/** 파형 Skia LinearGradient — 좌→우: 주황 → 연한 주황 → 초록 */
export const WAVEFORM_GRADIENT = {
  start: '#FF9800',
  middle: '#FFB74D',
  end: '#81C784',
  positions: [0, 0.5, 1] ,
} as const;
