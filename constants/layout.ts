import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** 세로 전용 앱 기준, 600px 이상을 태블릿으로 구분 */
const isTablet = SCREEN_WIDTH >= 600;

/**
 * Learn 탭 난이도 버튼(연습·도전) 치수.
 *
 * 140/160 **고정**이던 값이다. 버튼 두 개가 쓸 수 있는 폭은
 * 「화면폭 − 섹션 좌우 마진 − gameSection 좌우 패딩 − 버튼 사이 gap」인데,
 * 360dp 기기에서 이 값이 255라 「140×2 + 15」가 40px 넘쳐 안쪽 여백을 잠식했다.
 * 그래서 **폭에서 역산한 상한**을 함께 건다.
 *
 * 폰 상한은 140 그대로다 — 390dp 이상에서는 지금 화면이 바뀌지 않는다.
 * 좁은 기기에서만 줄고, 태블릿에서만 커진다.
 */
const LEARN_SECTION_MARGIN_H = 20;
const LEARN_GAME_SECTION_PADDING = isTablet ? 30 : 25;
const LEARN_DIFFICULTY_BUTTONS_GAP = 15;
const LEARN_DIFFICULTY_ROW_WIDTH =
  SCREEN_WIDTH - LEARN_SECTION_MARGIN_H * 2 - LEARN_GAME_SECTION_PADDING * 2 - LEARN_DIFFICULTY_BUTTONS_GAP;
const LEARN_DIFFICULTY_BUTTON_SIZE = Math.max(
  96,
  Math.min(isTablet ? 180 : 140, Math.floor(LEARN_DIFFICULTY_ROW_WIDTH / 2))
);

/**
 * 버튼 **안**의 치수는 버튼 크기를 따라간다 — 버튼만 줄면 별·이름이 넘친다.
 * 인자는 버튼이 140(기존 폰 값)일 때의 치수이고, 지금 버튼 크기로 환산해 돌려준다.
 */
const LEARN_BUTTON_REFERENCE_SIZE = 140;
const scaleFromPhoneButton = (valueAt140: number) =>
  Math.round(LEARN_DIFFICULTY_BUTTON_SIZE * (valueAt140 / LEARN_BUTTON_REFERENCE_SIZE));

/**
 * 학습 카드(flashcards) 세로 배치.
 *
 * 카드 높이는 `cardStackHeight`(= min(400, 화면높이 × 0.4))로 반응형인데,
 * 카드를 **밀어내는** 값만 `cardStackMarginTop: 150` + `topCard.marginTop: 70` = **220 고정**이었다.
 * 640dp 높이 폰에서 화면의 34%를 무조건 먹어 카드 하단이 하단 네비 밑으로 들어갔다.
 * (868dp 기기에서는 여유가 있어 드러나지 않는다 — learn 난이도 버튼과 같은 구조의 문제다)
 *
 * 높이 비례로 두되 **상한을 지금 값(220)에 맞춘다** — 868dp에서는 150/70 그대로다.
 * 둘의 비(150 : 70)도 유지한다. 역할이 다르기 때문이다:
 * `cardStackMarginTop`은 흐름 안에서 자리를 차지하고(스크롤 길이에 반영),
 * `topCardMarginTop`은 절대배치된 카드만 그만큼 더 내린다(자리를 차지하지 않는다).
 */
const FLASHCARD_CARD_TOP_TOTAL = Math.round(
  Math.max(120, Math.min(220, SCREEN_HEIGHT * 0.2535))
);
const FLASHCARD_CARD_STACK_MARGIN_TOP = Math.round(FLASHCARD_CARD_TOP_TOTAL * (150 / 220));
const FLASHCARD_TOP_CARD_MARGIN_TOP = FLASHCARD_CARD_TOP_TOTAL - FLASHCARD_CARD_STACK_MARGIN_TOP;

/** UI 레이아웃 상수 (반응형·동적 상수) */
export const LAYOUT = {
  /** 화면 크기 */
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,

  /** 태블릿 여부 (세로 기준 600px 이상) */
  isTablet,

  /** 카드 스택 */
  cardStackHeight: Math.min(isTablet ? 560 : 400, SCREEN_HEIGHT * 0.4),
  cardStackMinHeight: Math.min(isTablet ? 560 : 400, SCREEN_HEIGHT * 0.4),

  /** 카드 양쪽 여백. left/right 각 10% → 카드 폭은 화면의 80%다 */
  cardWidthInsetPercent: '10%' as const,

  /** 진행도 바 */
  progressLineWidthPercent: '90%',
  progressMarkerSize: isTablet ? 44 : 32,
  progressMarkerIconSize: isTablet ? 48 : 36,
  progressMarkerMarginLeft: -1,
  progressMarkerMarginTop: isTablet ? -36 : -30,
  progressTickSize: isTablet ? 12 : 10,
  progressLineWrapperHeight: isTablet ? 24 : 20,
  progressLineHeight: isTablet ? 4 : 3,
  progressLineBorderRadius: 2,

  /** 간격 (Spacing) */
  spacingXS: isTablet ? 6 : 4,
  spacingSM: isTablet ? 10 : 8,
  spacingMD: isTablet ? 20 : 16,
  spacingLG: isTablet ? 30 : 24,


  /** 섹션·컨테이너 */
  sectionMarginH: 15,
  sectionMarginV: 10,
  cardStackMarginTop: FLASHCARD_CARD_STACK_MARGIN_TOP,
  /** 카드(절대배치)를 스택 안에서 더 내리는 양. 위 상수 주석 참고 */
  flashcardsTopCardMarginTop: FLASHCARD_TOP_CARD_MARGIN_TOP,
  /**
   * 진행도 바의 세로 위치(섹션 기준). 화면 높이 비례이던 값에 **상한만** 걸었다 —
   * 태블릿(1280dp)에서 256까지 내려가 카드와 붙었다. 868dp 폰에서는 174로 종전과 같다.
   */
  flashcardsProgressTop: Math.round(Math.min(isTablet ? 190 : 176, SCREEN_HEIGHT * 0.2)),
  scrollPaddingBottom: 30,

  /** WordFlashcard */
  waveformWidth: Math.min(isTablet ? 400 : 280, SCREEN_WIDTH * 0.75),
  waveformHeight: 60,
  wordCardMinWidth: 120,
  vsSpacerMinWidth: 44,
  containerPaddingV: 20,
  containerPaddingH: 16,
  wordCardPadding: 20,
  wordTextFontSize: isTablet ? 40 : 32,
  wordTextMarginBottom: 15,
  wordCardBorderRadius: 15,
  wordCardElevation: 2,
  playAllButtonPaddingH: 24,
  playAllButtonPaddingV: 14,
  playAllButtonMarginBottom: 16,
  playAllButtonFontSize: 16,
  playAllButtonBorderRadius: 28,
  playAllButtonElevation: 4,
  wordsRowMarginBottom: 10,
  wordColumnContainerGap: 10,
  playButtonPadding: 10,
  vsPaddingH: 15,
  vsPaddingV: 8,
  vsFontSize: 16,
  vsBorderRadius: 20,
  waveformContainerHeight: Math.min(52, Math.max(32, Math.round(SCREEN_HEIGHT * 0.045))),
  waveformContainerPaddingV: 10,
  waveformContainerElevation: 2,

  /** 진행도 텍스트 */
  progressTextFontSize: isTablet ? 22 : 18,
  progressTextMarginTop: isTablet ? 8 : 6,

  /** 공통 텍스트 (index 등) */
  sectionTitleFontSize: isTablet ? 30 : 24,
  sectionSubtitleFontSize: isTablet ? 20 : 16,
  completedBadgeTextFontSize: isTablet ? 22 : 16,
  totalCountFontSize: isTablet ? 17 : 14,
  hintTextFontSize: isTablet ? 17 : 14,
  completedTitleFontSize: isTablet ? 22 : 18,
  completionTextFontSize: isTablet ? 30 : 24,
  completionSubTextFontSize: isTablet ? 20 : 16,
  buttonTextFontSize: isTablet ? 18 : 16,
  smallButtonTextFontSize: isTablet ? 15 : 12,


  /** 모달 닫기, 헤더 작은 아이콘(snow/arrow-undo), 네비 화살표 */
  modalCloseIconSize: isTablet ? 24 : 22,
  headerSmallIconSize: isTablet ? 20 : 18,
  navArrowIconSize: isTablet ? 32 : 28,
  /** refri-test 아이콘 */
  refriReplayIconSize: isTablet ? 24 : 20,
  refriVolumeIconSize: isTablet ? 30 : 26,

  /** 카드·버튼 공통 (index 등) */
  cardBorderRadius: Math.min(isTablet ? 32 : 24, Math.round(SCREEN_WIDTH * 0.04)),
  topCardBackgroundBorderRadius: 25,
  /** 헤더 좌/우 버튼 대칭 (냉장고, 완료 배지) */
  headerSideButtonMinWidth: Math.min(isTablet ? 120 : 88, Math.round(SCREEN_WIDTH * 0.22)),
  headerSideButtonPaddingH: 12,
  headerSideButtonPaddingV: 8,
  headerSideButtonBorderRadius: 8,
  navArrowButtonSize: isTablet ? 60 : 48,
  navArrowButtonBorderRadius: isTablet ? 30 : 24,
  navArrowButtonElevation: 3,
  completeButtonBorderRadius: 28,
  completeButtonPaddingV: 14,
  completeButtonElevation: 4,

  /** Drum 탭 — 고정 헤더 텍스트 */
  drumHeaderTextFontSize: isTablet ? 18 : 16,

  /** Drum 탭 — 문제 수 세그먼티드 컨트롤 (비율 90%, 폰 최대 420 / 태블릿 최대 520) */
  questionSelectorWidth: Math.min(Math.round(SCREEN_WIDTH * 0.9), isTablet ? 520 : 420),
  /** 세그먼트 한 칸 높이. 트랙 높이는 여기에 상하 패딩이 더해진 값 */
  questionSelectorItemHeight: isTablet ? 44 : 36,
  questionSelectorFontSize: isTablet ? 16 : 14,

  /** 모달 */
  modalHeaderPaddingV: 16,
  modalHeaderPaddingH: isTablet ? 24 : 20,
  modalContentBorderRadius: 24,
  modalTitleFontSize: isTablet ? 22 : 18,
  modalCloseBtnSize: isTablet ? 40 : 36,
  modalBodyPaddingH: isTablet ? 20 : 16,
  modalBodyPaddingV: 16,
  modalBodyPaddingBottom: 24,
  completedCardItemPadding: 14,
  completedCardItemBorderRadius: 16,
  completedCardItemElevation: 2,
  completedCardTextFontSize: isTablet ? 22 : 18,
  completionRestartButtonBorderRadius: 25,
  completionRestartButtonMarginTop: 24,
  completionRestartButtonMarginBottom: 36,
  completionRestartButtonPaddingH: isTablet ? 32 : 28,
  completedSectionPadding: isTablet ? 24 : 20,
  completedSectionBorderRadius: isTablet ? 18 : 15,
  completedSectionMarginTop: isTablet ? 24 : 20,
  headerTopRowMarginBottom: isTablet ? 20 : 15,
  bottomNavPaddingV: isTablet ? 24 : 20,
  bottomNavPaddingH: isTablet ? 24 : 20,
  bottomNavGap: isTablet ? 48 : 40,

  /** 스와이프·드롭존 */
  dropZoneThresholdRatio: 0.4,
  get dropZoneThreshold() {
    return SCREEN_HEIGHT * this.dropZoneThresholdRatio;
  },

  /** Refri (refri-test) — 냉장고 퀴즈 */
  refriRiveWidth: isTablet ? 800 : 600,
  refriRiveHeight: isTablet ? 667 : 500,
  refriSceneHeightRatio: 0.4,
  refriCratesBottomRatio: 0.15,
  refriCratesPaddingLeftRatio: 0.075,
  refriCratesPaddingBottomRatio: 0.012,
  refriCrateWrapperMarginBottomRatio: -0.053,
  refriCrateWrapperTopRatio: -0.077,
  refriCrateBoxSizeRatio: 0.2,
  refriTrayMinHeightRatio: 0.24,
  refriTrayPaddingTop: 20,
  refriTrayPaddingBottom: 88,
  refriTrayPaddingH: 16,
  refriTrayGap: 12,
  refriTrayBorderRadius: 30,
  refriFloatingReplaySize: isTablet ? 64 : 52,
  refriFloatingReplayElevation: 4,
  refriControlSectionPaddingH: 24,
  refriControlBtnMinWidth: 160,
  refriStartBtnWidth: isTablet ? 240 : 200,
  refriStartBtnHeight: isTablet ? 72 : 60,
  refriControlRowGap: 10,
  refriControlRowMaxWidth: Math.min(isTablet ? 480 : 320, SCREEN_WIDTH - 32),
  refriControlBtnPaddingV: 14,
  refriControlBtnBorderRadius: 28,
  refriControlBtnGap: 6,
  refriGaugeSectionPaddingV: 8,
  refriGaugeSectionPaddingH: 16,
  /** 게이지 하단 ~ 냉장고 영역 상단 사이 거리 (수치 조정은 여기서) */
  refriGaugeToFridgeGap: 20,

  refriStatusBadgeBorderRadius: 20,
  refriStatusBadgeTop: isTablet ? 60 : 53,
  refriContainerMarginTop: isTablet ? -24 : -20,
  refriGaugeTrackHeight: 14,
  refriGaugeTrackBorderRadius: 12,
  refriGaugeContainerWidthPercent: '90%' as const,
  /** 게이지 섹션 고정 높이 — 게이지만 단독 이동, Rive 위치 유지 */
  refriGaugeSectionHeight: isTablet ? 80 : 60,
  refriGaugeMilestoneSize: isTablet ? 3 : 2,
  refriAnswerCardBorderRadius: Math.min(isTablet ? 14 : 10, Math.round(SCREEN_WIDTH * 0.025)),
  refriAnswerCardPadding: 6,
  refriAnswerCardElevation: 3,
  refriAnswerInnerMinHeight: Math.min(isTablet ? 120 : 90, SCREEN_HEIGHT * 0.12),
  refriAnswerImageSize: Math.min(isTablet ? 64 : 48, Math.round(SCREEN_WIDTH * 0.12)),
  refriAnswerLabelMarginTop: 6,
  refriAnswerLabelFontSize: Math.min(isTablet ? 18 : 15, Math.round(SCREEN_WIDTH * 0.038)),
  refriAnswerCardWidth: Math.floor(SCREEN_WIDTH / 3) - 24,
  refriCompleteBoxBorderRadius: 24,
  refriCompleteBoxPadding: 32,
  refriCompleteBoxMinWidth: Math.min(isTablet ? 400 : 280, SCREEN_WIDTH - 40),
  refriCompleteBoxElevation: 10,
  refriCompleteEmojiFontSize: Math.min(isTablet ? 120 : 64, Math.round(SCREEN_WIDTH * 0.2)),
  refriCompleteTitleFontSize: Math.min(isTablet ? 36 : 28, Math.round(SCREEN_WIDTH * 0.07)),
  refriCompleteSubtitleFontSize: 16,
  refriCompleteStatsFontSize: 18,
  refriCompleteButtonPaddingH: 24,
  refriCompleteButtonGap: 8,
  refriBottomInsetOffset: 20,
  refriZIndexAnswers: 150,
  refriZIndexFloatingReplay: 160,
  refriZIndexControlSection: 200,
  refriZIndexCompleteOverlay: 1000,

  /** Learn 탭 — 소리 구별 퀴즈 */
  tabBarHeight: 64,
  /** Flashcards 하단 네비 미세 위치 보정값 (안드로이드 기준) */
  flashcardsBottomOffset: isTablet ? 26 : 40,
  learnSectionMarginH: LEARN_SECTION_MARGIN_H,
  learnSectionMarginTop: 10,
  learnSectionTitleFontSize: isTablet ? 28 : 24,
  learnDifficultyButtonSize: LEARN_DIFFICULTY_BUTTON_SIZE,
  learnDifficultyButtonBorderRadius: 20,
  learnDifficultyButtonPadding: scaleFromPhoneButton(20),
  learnDifficultyButtonsGap: LEARN_DIFFICULTY_BUTTONS_GAP,
  learnDifficultyContainerMarginBottom: 30,
  learnGameSectionPadding: LEARN_GAME_SECTION_PADDING,
  /** 게임 영역을 아래로 미는 값. 세로가 짧은 기기에서 선택지·다시 듣기가 밀려나지 않게
   *  높이 비례로 둔다. 상한 50은 기존 고정값이라 보통 폰에서는 그대로다 */
  learnGameContentMarginTop: Math.round(Math.max(24, Math.min(50, SCREEN_HEIGHT * 0.06))),
  learnStarIconSize: scaleFromPhoneButton(60),
  learnMultiStarIconWidth: scaleFromPhoneButton(32),
  learnMultiStarIconHeight: scaleFromPhoneButton(44),
  learnStarsRowContainerHeight: scaleFromPhoneButton(55),
  learnDifficultyNameFontSize: scaleFromPhoneButton(18),

  /** OrderGame — 소리 순서 맞추기 */
  orderGameCardSize: Math.min(isTablet ? 120 : 100, Math.round(SCREEN_WIDTH * 0.22)),
  orderGameImageSize: Math.round(Math.min(isTablet ? 120 : 100, Math.round(SCREEN_WIDTH * 0.22)) * 0.8),
  orderGameDropZoneMargin: isTablet ? 12 : 10,
  orderGameDropZoneHeight: 120,
  orderGameImagesContainerPadding: 10,
  orderGameImagesContainerMarginBottom: 20,
  orderGameStartButtonMinWidth: 200,
  orderGameStartButtonBorderRadius: 15,
  orderGameSubmitButtonMarginTop: 20,

  /** MatchGame(소리 맞추기) — 카드 게임 */
  matchGameStartButtonPaddingV: 18,
  matchGameStartButtonPaddingH: 48,
  matchGameStartButtonMinWidth: 220,
  matchGameStartButtonBorderRadius: 16,
  matchGameGameButtonBorderRadius: 16,
  matchGameModalContentPadding: 24,
  matchGameModalContentBorderRadius: 20,
  matchGameModalTitleMarginBottom: 10,
  matchGameModalTextMarginBottom: 20,
  matchGameModalButtonPaddingV: 12,
  matchGameModalButtonPaddingH: 24,
  matchGameModalButtonBorderRadius: 12,

  /** New 탭 — 게임 선택 화면 */
  newTabSectionHeaderPadding: isTablet ? 24 : 20,
  newTabSectionHeaderBorderRadius: 15,
  newTabSectionHeaderMarginBottom: 15,
  newTabSectionTitleMarginBottom: 8,
  newTabGameGridPadding: 15,
  newTabGameGridGap: 12,
  newTabGameCardBorderRadius: 15,
  newTabGameCardPadding: 15,
  newTabIconSize: isTablet ? 80 : 70,
  newTabIconBorderRadius: 35,
  newTabGameEmojiFontSize: isTablet ? 40 : 36,
  newTabScrollPaddingBottom: 30,
  newTabStarBadgeSize: 16,
  newTabStarBadgeTop: 8,
  newTabStarBadgeRight: 8,
  newTabClearedBadgeBottom: 8,
  newTabClearedBadgePaddingH: 10,
  newTabClearedBadgePaddingV: 4,
  newTabClearedBadgeBorderRadius: 10,

  /** MatchGameAI / MatchGamePG — 청능 훈련 (Q-Learning, Policy Gradient) */
  auditoryWaveAnimationSize: isTablet ? 240 : 200,
  auditoryLoadingTextMarginTop: 20,
  auditoryGameButtonMinWidth: isTablet ? 120 : 100,
  auditoryGameButtonMargin: 6,
  auditoryStatsCardBorderRadius: 12,
  auditoryStatsCardPadding: 16,
  auditoryStatsCardMarginBottom: 12,
  auditoryOverallStatsValueFontSize: isTablet ? 52 : 48,
  auditoryProgressBarHeight: 8,
  auditoryProgressBarBorderRadius: 4,
  auditoryPrimaryButtonWidthPercent: '80%' as const,
  auditoryStatsBackButtonWidthPercent: '40%' as const,
} as const;

export type WordGameMetrics = {
  contentTopPadding: number;
  contentBottomPadding: number;
  contentMinHeight: number;
  choiceVerticalPadding: number;
  choiceTextSize: number;
  replayOffsetY: number;
  startOffsetY: number;
};

/**
 * WordGame(소리 구별 퀴즈) 반응형 메트릭.
 * width/height를 직접 받아 기기별 차이를 반영합니다.
 */
export function getWordGameMetrics(width: number, height: number): WordGameMetrics {
  const isTabletWidth = width >= 600;

  const contentTopPadding = Math.round(
    Math.max(isTabletWidth ? 52 : 44, Math.min(isTabletWidth ? 84 : 72, height * 0.09))
  );
  // 하단 위치를 더 내리기 위해 bottom padding 상한/하한을 낮게 유지
  const contentBottomPadding = Math.round(
    Math.max(0, Math.min(isTabletWidth ? 10 : 8, height * 0.008))
  );
  const contentMinHeight = Math.round(
    Math.max(isTabletWidth ? 320 : 300, Math.min(isTabletWidth ? 440 : 380, height * 0.42))
  );
  const choiceVerticalPadding = Math.round(
    Math.max(isTabletWidth ? 22 : 20, Math.min(isTabletWidth ? 34 : 30, height * 0.035))
  );
  const choiceTextSize = Math.round(
    Math.max(isTabletWidth ? 26 : 24, Math.min(isTabletWidth ? 34 : 30, width * 0.075))
  );
  const replayOffsetY = Math.round(
    Math.max(isTabletWidth ? 6 : 4, Math.min(isTabletWidth ? 14 : 10, height * 0.012))
  );
  // 「시작하기」를 바닥에서 살짝 띄우는 양. 아래 여백(contentBottomPadding)이 8px뿐이라
  // 버튼이 화면 끝에 붙어 보였다. 고정 px로 올리면 세로가 짧은 기기에서 과해지므로 높이 비례로 둔다.
  const startOffsetY = Math.round(
    Math.max(12, Math.min(isTabletWidth ? 28 : 22, height * 0.022))
  );

  return {
    contentTopPadding,
    contentBottomPadding,
    contentMinHeight,
    choiceVerticalPadding,
    choiceTextSize,
    replayOffsetY,
    startOffsetY,
  };
}

type MatchGameGridMetrics = {
  columns: number;
  gap: number;
  cardSize: number;
  mediaSize: number;
  contentHeight: number;
};
/**
 * MatchGame(소리 맞추기) 카드 그리드 메트릭.
 * 세로 뷰 전용(orientation 고정) 기준으로 screenWidth/isTablet만 사용합니다.
 */
export function getMatchGameGridMetrics(): MatchGameGridMetrics {
  const columns = 3;
  const gap = LAYOUT.isTablet ? 10 : 4;

  // matchGame.tsx container 스타일과 맞춤 (width: '96%', maxWidth: 460, paddingHorizontal: 10)
  const containerWidth = Math.min(Math.round(LAYOUT.screenWidth * 0.96), 460);
  const containerHPadding = 10;

  const usableWidth = containerWidth - containerHPadding * 2;
  // 작은 폰에서도 3열이 유지되도록 최소 크기를 낮춤
  const cardSize = Math.max(72, Math.floor((usableWidth - gap * (columns - 1)) / columns));

  // 카드 내부(이미지/Rive)는 카드 크기에 비례하도록 고정
  const mediaSize = Math.round(cardSize * (LAYOUT.isTablet ? 0.62 : 0.58));
  // 텍스트 영역을 제외한 컨텐츠 높이(카드 흔들림 방지용 고정)
  const contentHeight = Math.round(cardSize * 0.82);

  return { columns, gap, cardSize, mediaSize, contentHeight };
}


