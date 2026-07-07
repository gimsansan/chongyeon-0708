import React, {  useEffect, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useWordGameLogic } from '../../hooks/useWordGameLogic';
import { useWordAudioPlayer } from '../../hooks/useWordAudioPlayer';
import { WordDifficultyType } from '../../constants/wordSounds';
import { getWordGameMetrics } from '../../constants/layout';

interface AnimatedTapButtonProps {
  readonly onPress: () => void;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: React.ReactNode;
  readonly disabled?: boolean;
  readonly pressedScale?: number;
}

function AnimatedTapButton({
  onPress,
  style,
  children,
  disabled = false,
  pressedScale = 0.97,
}: Readonly<AnimatedTapButtonProps>) {
  const isPressed = useSharedValue(0);

  const tapGesture = Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      isPressed.value = 1;
    })
    .onFinalize(() => {
      isPressed.value = 0;
    })
    .onEnd((_event, success) => {
      if (success && !disabled) {
        runOnJS(onPress)();
      }
    });

  const pressedAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(isPressed.value ? pressedScale : 1, {
          damping: 16,
          stiffness: 220,
          mass: 0.9,
        }),
      },
    ],
    opacity: isPressed.value ? 0.88 : 1,
  }));

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View style={[style, pressedAnimatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

interface WordGameProps {
  readonly difficulty: WordDifficultyType;
  readonly onGameComplete?: (score: number, maxScore: number, percentage: number) => void;
  readonly onAnswerShown?: () => void;
}

export function WordGame({ difficulty = 'easy', onGameComplete, onAnswerShown }: Readonly<WordGameProps>) {
  const { width, height } = useWindowDimensions();
  const metrics = getWordGameMetrics(width, height);
  const gameLogic = useWordGameLogic({ difficulty, onGameComplete });
  const audioPlayer = useWordAudioPlayer();
  const isMountedRef = useRef(true);
  const replayProgressStyle = useAnimatedStyle(() => ({
    width: `${Math.max(6, Math.round(audioPlayer.progress.value * 100))}%`,
  }));

  const {
    currentWordPair,
    correctWord,
    correctSound,
    gameState,
    showFeedback,
    feedbackMessage,
    selectedAnswer,
    isLastAnswerCorrect,
    round,
    handleAnswer,
    resetGame,
    startPlaying,
    setAnswered,
  } = gameLogic;

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      audioPlayer.stopSound();
    };
  }, []);

  // 난이도 변경 시 게임 리셋
  useEffect(() => {
    audioPlayer.stopSound();
    resetGame();
  }, [difficulty, resetGame]);

  // 답안 표시 시 스크롤
  useEffect(() => {
    if (gameState === 'answered' && onAnswerShown) {
      setTimeout(() => {
        onAnswerShown();
      }, 100);
    }
  }, [gameState, onAnswerShown]);

  const handleStartGame = () => {
    if (!currentWordPair || !correctSound) return;

    startPlaying();

    // 음성 즉시 재생
    audioPlayer.playWordSound(
      correctSound,
      currentWordPair[correctWord!],
      () => {
        if (isMountedRef.current) {
          setAnswered();
        }
      }
    );
  };

  const handleChoicePress = (word: string) => {
    if (gameState === 'answered') {
      handleAnswer(word);
    }
  };

  const handleReplaySound = () => {
    if (gameState === 'answered' && correctSound && currentWordPair && correctWord) {
      audioPlayer.playWordSound(correctSound, currentWordPair[correctWord]);
    }
  };

  const getChoiceFeedbackStyle = (word: string): ViewStyle[] => {
    if (!selectedAnswer || !correctWord || !currentWordPair) {
      return [];
    }

    const correctWordText = currentWordPair[correctWord];
    const feedbackStyles: ViewStyle[] = [];

    if (word === correctWordText) {
      feedbackStyles.push(styles.choiceButtonCorrect);
    }

    if (selectedAnswer === word && isLastAnswerCorrect === false) {
      feedbackStyles.push(styles.choiceButtonWrong);
    }

    if (selectedAnswer !== word && word !== correctWordText) {
      feedbackStyles.push(styles.choiceButtonDimmed);
    }

    return feedbackStyles;
  };

  if (!currentWordPair) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>게임을 준비하는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 게임 상태에 따른 UI */}
      <View style={styles.gameContentArea}>
        {gameState === 'ready' && (
          <View
            style={[
              styles.readyContainer,
              {
                paddingTop: metrics.contentTopPadding,
                paddingBottom: metrics.contentBottomPadding,
                minHeight: metrics.contentMinHeight,
              },
            ]}
          >
            <Text style={styles.readyTitle}>준비되셨나요?</Text>

            <View style={styles.readyActionWrapper}>
              <AnimatedTapButton
                onPress={handleStartGame}
                style={styles.startButton}
              >
                <Ionicons name="play" size={24} color="white" />
                <Text style={styles.startButtonText}>{round === 1 ? '시작하기' : '계속하기'}</Text>
              </AnimatedTapButton>
            </View>
          </View>
        )}

        {gameState === 'playing' && (
          <View style={styles.playingContainer}>
            <Ionicons name="volume-high" size={80} color="#706c6c" />
            <Text style={styles.playingText}>듣는 중...</Text>
     
          </View>
        )}

        {/* answered 또는 waitingForNextRound: 퀴즈 화면 유지, 선택지 위치는 고정, 피드백은 오버레이로 표시 */}
        {(gameState === 'answered' || gameState === 'waitingForNextRound') && (
          <View
            style={[
              styles.answeredContainer,
              {
                paddingTop: metrics.contentTopPadding,
                paddingBottom: metrics.contentBottomPadding,
                minHeight: metrics.contentMinHeight,
              },
            ]}
          >
            {showFeedback && (
              <View style={styles.feedbackFloating}>
                <Text style={styles.feedbackText}>{feedbackMessage}</Text>
              </View>
            )}

            <View style={styles.choicesContainer}>
              <AnimatedTapButton
                style={[
                  styles.choiceButton,
                  { paddingVertical: metrics.choiceVerticalPadding },
                  ...getChoiceFeedbackStyle(currentWordPair.word1),
                ]}
                onPress={() => handleChoicePress(currentWordPair.word1)}
                disabled={gameState !== 'answered'}
                pressedScale={0.96}
              >
                <Text style={[styles.choiceText, { fontSize: metrics.choiceTextSize }]}>{currentWordPair.word1}</Text>
              </AnimatedTapButton>

              <AnimatedTapButton
                style={[
                  styles.choiceButton,
                  { paddingVertical: metrics.choiceVerticalPadding },
                  ...getChoiceFeedbackStyle(currentWordPair.word2),
                ]}
                onPress={() => handleChoicePress(currentWordPair.word2)}
                disabled={gameState !== 'answered'}
                pressedScale={0.96}
              >
                <Text style={[styles.choiceText, { fontSize: metrics.choiceTextSize }]}>{currentWordPair.word2}</Text>
              </AnimatedTapButton>
            </View>
            <View
              style={[
                styles.replayWrapper,
                { transform: [{ translateY: metrics.replayOffsetY }] },
              ]}
            >
              <AnimatedTapButton
                onPress={handleReplaySound}
                style={[
                  styles.startButton,
                  audioPlayer.isPlaying && styles.startButtonPlaying,
                ]}
                disabled={gameState !== 'answered'}
              >
                <Ionicons name={audioPlayer.isPlaying ? 'volume-high' : 'refresh'} size={20} color="white" />
                <Text style={styles.startButtonText}>
                  {audioPlayer.isPlaying ? '재생 중...' : '다시 듣기'}
                </Text>
              </AnimatedTapButton>
              {audioPlayer.isPlaying && (
                <View style={styles.playingIndicatorTrack}>
                  <Animated.View style={[styles.playingIndicatorFill, replayProgressStyle]} />
                </View>
              )}
            </View>
          </View>
        )}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',

  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  gameContentArea: {
    width: '100%',
    minHeight: 400,  // 최소 높이 증가로 레이아웃 안정화
    justifyContent: 'center',
    alignItems: 'center',
  },
  readyContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  readyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 0,
  },
  readyActionWrapper: {
    marginTop: 'auto',
    marginBottom: 0,
  },


  volumeHint: {
    fontSize: 14,
    color: '#F57C00',
    fontWeight: '600',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7cbd7e',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    gap: 10,
  },
  startButtonPlaying: {
    backgroundColor: '#4da8de',
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  playingContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start', // center → flex-start
    paddingTop: 20,               // 필요에 따라 10~40 조절
    minHeight: 300,
  },
  playingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 20,
  },

  answeredContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  choicesContainer: {
    width: '100%',
    flexDirection: 'row',
    gap: 15,
  },
  replayWrapper: {
    marginTop: 'auto',
    marginBottom: 0,
    alignItems: 'center',
  },
  playingIndicatorTrack: {
    marginTop: 8,
    width: 148,
    height: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.45)',
    overflow: 'hidden',
  },
  playingIndicatorFill: {
    height: '100%',
    backgroundColor: '#2E7D32',
  },
  choiceButton: {
    flex: 1,
    backgroundColor: '#52abf2',
    paddingHorizontal: 30,
    borderRadius: 18,
    alignItems: 'center',
    elevation: 3,
  },
  choiceButtonCorrect: {
    backgroundColor: '#4CAF50',
  },
  choiceButtonWrong: {
    backgroundColor: '#E53935',
  },
  choiceButtonDimmed: {
    opacity: 0.75,
  },
  choiceText: {
    color: 'white',
    fontWeight: 'bold',
  },
  feedbackFloating: {
    position: 'absolute',
    top: -75,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  feedbackText: {
    fontSize: 56,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 24,
  
  },
});

export default WordGame;

