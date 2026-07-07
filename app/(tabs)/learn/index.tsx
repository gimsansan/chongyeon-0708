import { Text, View, StyleSheet, TouchableOpacity, Image } from "react-native";
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
              {/* 타이틀은 카드 밖 상단에 배치 */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🎧 소리 구별 퀴즈</Text>
              </View>

              {/* 모든 콘텐츠를 하나의 흰색 카드(gameSection) 안에 통합 */}
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
                        >
                          <Image
                            source={require('../../../assets/images/hoshi1.webp')}
                            style={styles.starIcon}
                            resizeMode="contain"
                          />
                          <Text style={styles.difficultyName}>연습</Text>
                        </TouchableOpacity>
                      </Animated.View>

                      <Animated.View style={normalAnimatedStyle}>
                        <TouchableOpacity
                          style={[
                            styles.difficultyButton,
                            currentDifficulty === 'normal' && styles.difficultyButtonActive,
                          ]}
                          onPress={() => handleDifficultyPress('normal')}
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
                          <Text style={styles.difficultyName}>도전</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    </View>
                  </View>
                )}

                <View style={styles.gameContentInner}>
                  {isGameOver ? (
                    <DrumGameOverScreen
                      score={finalScore}
                      maxScore={finalMaxScore}
                      onRestart={handleRestartGame}
                      onGoHome={handleGoHome}
                    />
                  ) : (
                    <WordGame
                      difficulty={currentDifficulty}
                      onGameComplete={handleGameComplete}
                
                    />
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
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
  sectionTitle: {
    fontSize: LAYOUT.learnSectionTitleFontSize,
    fontWeight: '800',
    color: '#333',
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
    backgroundColor: '#FFFFFF',
    borderRadius: LAYOUT.learnDifficultyButtonBorderRadius,
    padding: LAYOUT.learnDifficultyButtonPadding,
    width: LAYOUT.learnDifficultyButtonSize,
    height: LAYOUT.learnDifficultyButtonSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F0F0F0',
  },
  difficultyButtonActive: {
    borderColor: '#7cbd7e',
    backgroundColor: '#F9FFF9',
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
    color: '#444',
  },
  gameContentInner: {
    flex: 1,
    justifyContent: 'flex-start',
    marginTop: LAYOUT.learnGameContentMarginTop,
  },
});
