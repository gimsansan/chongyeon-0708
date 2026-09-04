import { Text, View, StyleSheet, TouchableOpacity, Image, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from 'expo-router';
import React, { useState } from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { WordGame } from '../../../components/game/WordGame';
import DrumGameOverScreen from '../../../screens/DrumGameOverScreen';
import { WordDifficultyType } from '../../../constants/wordSounds';
import { LAYOUT } from '../../../constants/layout';
import { COLORS } from '../../../constants/colors';

export default function Index() {
  const insets = useSafeAreaInsets();

  // 상태 관리
  const [currentDifficulty, setCurrentDifficulty] = useState<WordDifficultyType>('easy');
  const [isGameOver, setIsGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalMaxScore, setFinalMaxScore] = useState(0);

  // 애니메이션 값들
  const easyScale = useSharedValue(1);
  const normalScale = useSharedValue(1);

  // 탭이 포커스될 때마다 상태 리셋
  useFocusEffect(
    React.useCallback(() => {
      // 탭에 들어올 때 (포커스 얻음)
      console.log('📚 Learn 탭 포커스 얻음');

      return () => {
        // 탭을 떠날 때 (포커스 잃음) - 모든 오디오 정리
        console.log('📚 Learn 탭 포커스 잃음 - 오디오 정리');
        setIsGameOver(false);
        setFinalScore(0);
        setFinalMaxScore(0);
        setCurrentDifficulty('easy');
        easyScale.value = withSpring(1);
        normalScale.value = withSpring(1);
      };
    }, [])
  );



  // 난이도 선택
  const handleDifficultyPress = (difficulty: WordDifficultyType) => {
    setCurrentDifficulty(difficulty);
    easyScale.value = withSpring(difficulty === 'easy' ? 1.1 : 1);
    normalScale.value = withSpring(difficulty === 'normal' ? 1.1 : 1);
    handleRestartGame();
  };

  // 게임 완료
  const handleGameComplete = (score: number, maxScore: number) => {
    setFinalScore(score);
    setFinalMaxScore(maxScore);
    setIsGameOver(true);
  };

  // 게임 재시작
  const handleRestartGame = () => {
    setIsGameOver(false);
    setFinalScore(0);
    setFinalMaxScore(0);
  };

  // 홈으로 이동
  const handleGoHome = () => {
    setIsGameOver(false);
    easyScale.value = withSpring(1);
    normalScale.value = withSpring(1);
  };

  // 애니메이션 스타일
  const easyAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: easyScale.value }],
  }));

  const normalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: normalScale.value }],
  }));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* 전체 화면 배경 (drum과 동일한 영역) */}
        <View style={[StyleSheet.absoluteFill, styles.backgroundImageWrapper]}>
          <Image
            source={require('../../../assets/images/class_s.webp')}
            style={{ width: LAYOUT.screenWidth, height: LAYOUT.screenHeight }}
            resizeMode="contain"
          />
        </View>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backgroundOverlay]} />
        <View
          style={[
            styles.contentWrapper,
            { paddingTop: insets.top, paddingBottom: insets.bottom + LAYOUT.tabBarHeight },
          ]}
        >
          <View style={styles.contentInner}>
            <View style={styles.section}>
              {/* 타이틀은 카드 밖 상단에 배치.
                  배경 이미지 위에 글자가 바로 얹히므로 옅은 흰 pill로 받친다 */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitlePill}>
                  <Text style={styles.sectionTitle}>🎧 소리 구별 퀴즈</Text>
                </View>
              </View>

              {/* 난이도 선택 + 게임을 담는 영역.
                  배경 이미지를 살리려고 배경색은 주지 않는다 — 카드가 아니다 */}
              <View style={styles.gameSection}>
                {!isGameOver && (
                  <View style={styles.difficultyContainer}>

                    <View style={styles.difficultyButtons}>
                      <Animated.View style={easyAnimatedStyle}>
                        <TouchableOpacity
                          style={[
                            styles.difficultyButton,
                            currentDifficulty === 'easy' && styles.difficultyButtonActive,
                          ]}
                          onPress={() => handleDifficultyPress('easy')}
                          accessibilityRole="button"
                          accessibilityLabel="연습 난이도"
                          accessibilityState={{ selected: currentDifficulty === 'easy' }}
                        >
                          <Image
                            source={require('../../../assets/images/hoshi1.webp')}
                            style={styles.starIcon}
                            resizeMode="contain"
                          />
                          <Text
                            style={[
                              styles.difficultyName,
                              currentDifficulty === 'easy' && styles.difficultyNameActive,
                            ]}
                          >
                            연습
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>

                      <Animated.View style={normalAnimatedStyle}>
                        <TouchableOpacity
                          style={[
                            styles.difficultyButton,
                            currentDifficulty === 'normal' && styles.difficultyButtonActive,
                          ]}
                          onPress={() => handleDifficultyPress('normal')}
                          accessibilityRole="button"
                          accessibilityLabel="도전 난이도"
                          accessibilityState={{ selected: currentDifficulty === 'normal' }}
                        >
                          <View style={styles.starsRowContainer}>
                            <View style={styles.starCellFirst}>
                              <Image
                                source={require('../../../assets/images/hoshi2.webp')}
                                style={styles.multiStarIcon}
                                resizeMode="contain"
                              />
                            </View>
                            <View style={styles.starCellSecond}>
                              <Image
                                source={require('../../../assets/images/hoshi2.webp')}
                                style={styles.multiStarIcon}
                                resizeMode="contain"
                              />
                            </View>
                            <View style={styles.starCellThird}>
                              <Image
                                source={require('../../../assets/images/hoshi2.webp')}
                                style={styles.multiStarIcon}
                                resizeMode="contain"
                              />
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.difficultyName,
                              currentDifficulty === 'normal' && styles.difficultyNameActive,
                            ]}
                          >
                            도전
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>
                    </View>
                  </View>
                )}

                <View style={styles.gameContentInner}>
                  {!isGameOver && (
                    <WordGame
                      difficulty={currentDifficulty}
                      onGameComplete={handleGameComplete}
                    />
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* 게임 종료 오버레이 — 드럼(`drum/index.tsx`)과 같은 방식.
              결과를 페이지 안에 끼워 넣지 않고 검은 스크림 위에 띄운다.
              WordGame은 위에서 언마운트해 오디오·타이머가 뒤에 남지 않게 한다.

              조건부 View + zIndex였을 때는 뒤로가기가 이 창이 아니라 **탭을 나갔다.**
              뒤로가기는 「나가기」와 같은 길로 보낸다 (냉장고 세션 47 · 피아노 49 ·
              드럼 50과 같은 처방 — 드럼은 이 컴포넌트를 함께 쓰면서 먼저 고쳤다).
              Modal 안에서는 절대배치가 아니라 flex로 채운다. */}
          <Modal
            visible={isGameOver}
            transparent
            statusBarTranslucent
            animationType="fade"
            onRequestClose={handleGoHome}
          >
            <View style={styles.gameOverOverlay}>
              <DrumGameOverScreen
                score={finalScore}
                maxScore={finalMaxScore}
                onRestart={handleRestartGame}
                onGoHome={handleGoHome}
              />
            </View>
          </Modal>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSoft,
  },
  backgroundImageWrapper: {
    zIndex: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundOverlay: {
    zIndex: 0,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  contentWrapper: {
    flex: 1,
    zIndex: 1,
  },
  contentInner: {
    flex: 1,
    paddingBottom: LAYOUT.spacingSM,
  },
  section: {
    flex: 1,
    marginHorizontal: LAYOUT.learnSectionMarginH,
    marginTop: LAYOUT.learnSectionMarginTop,
  },
  sectionHeader: {
    marginBottom: LAYOUT.spacingMD,
    alignItems: 'center',
  },
  /**
   * 제목 받침. 제목은 카드 밖, 배경 이미지 바로 위에 놓여서 이미지에 따라 대비가 흔들린다.
   * 그림자는 elevation으로만 낸다 (규칙 4 — 안드로이드 전용 앱).
   */
  sectionTitlePill: {
    paddingHorizontal: LAYOUT.spacingMD,
    paddingVertical: LAYOUT.spacingSM,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceOnImage,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: LAYOUT.learnSectionTitleFontSize,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  gameSection: {
    flex: 1,
    padding: LAYOUT.learnGameSectionPadding,
  },
  difficultyContainer: {
    marginBottom: LAYOUT.learnDifficultyContainerMarginBottom,
  },
  difficultyButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: LAYOUT.learnDifficultyButtonsGap,
  },
  difficultyButton: {
    backgroundColor: COLORS.white,
    borderRadius: LAYOUT.learnDifficultyButtonBorderRadius,
    padding: LAYOUT.learnDifficultyButtonPadding,
    width: LAYOUT.learnDifficultyButtonSize,
    height: LAYOUT.learnDifficultyButtonSize,
    alignItems: 'center',
    justifyContent: 'center',
    // 흰 버튼이 밝은 배경(이미지 + 흰 오버레이 22%) 위에 놓인다. 경계가 서게
    // elevation과 옅은 테두리를 함께 준다 — 결과 화면 카드와 같은 처리 (규칙 4)
    borderWidth: 2,
    borderColor: COLORS.border,
    elevation: 3,
  },
  /**
   * 선택된 난이도. 전에는 테두리 색과 거의 흰색인 배경(#F9FFF9)뿐이라 구분이 약했다.
   * 배경을 한 단계 올리고 떠오르게 해서, 색 하나에만 기대지 않게 한다.
   */
  difficultyButtonActive: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.backgroundSuccess,
    elevation: 6,
  },
  starIcon: {
    width: LAYOUT.learnStarIconSize,
    height: LAYOUT.learnStarIconSize,
    marginBottom: LAYOUT.spacingSM,
  },
  starsRowContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: '100%',
    height: LAYOUT.learnStarsRowContainerHeight,
    marginBottom: LAYOUT.spacingXS,
  },
  starCellFirst: {
    marginTop: LAYOUT.spacingSM,
    marginHorizontal: LAYOUT.spacingXS,
  },
  starCellSecond: {
    marginHorizontal: LAYOUT.spacingXS,
  },
  starCellThird: {
    marginTop: 0,
    marginHorizontal: LAYOUT.spacingXS,
  },
  multiStarIcon: {
    width: LAYOUT.learnMultiStarIconWidth,
    height: LAYOUT.learnMultiStarIconHeight,
  },
  difficultyName: {
    fontSize: LAYOUT.learnDifficultyNameFontSize,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  /** 선택 표시를 글자에도 준다. 흰 배경 위 초록 글자는 successOnWhite다 (브랜드 초록은 2.2:1) */
  difficultyNameActive: {
    color: COLORS.successOnWhite,
  },
  gameContentInner: {
    flex: 1,
    justifyContent: 'flex-start',
    marginTop: LAYOUT.learnGameContentMarginTop,
  },
  /**
   * 게임 종료 오버레이 — 드럼(`drum/index.tsx`의 gameOverOverlay)과 같은 값.
   * Modal 안이라 절대배치·zIndex가 필요 없다 — 판 전체를 flex로 채운다.
   */
  gameOverOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
