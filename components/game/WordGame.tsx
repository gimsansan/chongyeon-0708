import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useWordGameLogic, GameState } from '../../hooks/useWordGameLogic';
import { useWordAudioPlayer } from '../../hooks/useWordAudioPlayer';
import { useStopAudioOnBlur } from '../../hooks/useStopAudioOnBlur';
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

/** 「그만하기」는 부모(`learn/index.tsx`)가 그리고, 접는 일은 여기서 한다 */
export interface WordGameRef {
  /** 지금 점수·푼 수로 결과를 낸다. 소리와 다음 문제 타이머를 함께 끊는다 */
  quit: () => void;
}

interface WordGameProps {
  readonly difficulty: WordDifficultyType;
  readonly onGameComplete?: (score: number, maxScore: number, percentage: number) => void;
  readonly onAnswerShown?: () => void;
  /**
   * 라운드·상태 알림. 부모가 「그만하기」를 **언제 그릴지** 정하는 데만 쓴다
   * (`round === 1 && 'ready'`이면 숨긴다 — 아직 「시작하기」다).
   *
   * 버튼을 이 컴포넌트 안에 두지 않는 이유는 상태가 넷이라 **자리마다 복제**되기 때문이다.
   * 설계 원문은 `doc/learn-그만하기.md`.
   *
   * 매 렌더 새로 만들어 넘기면 아래 이펙트가 계속 돈다 — 부모에서 `useCallback`으로 고정한다.
   */
  readonly onProgressChange?: (progress: { round: number; gameState: GameState }) => void;
}

function WordGameInner(
  { difficulty = 'easy', onGameComplete, onAnswerShown, onProgressChange }: Readonly<WordGameProps>,
  ref: React.Ref<WordGameRef>,
) {
  const { width, height } = useWindowDimensions();
  const metrics = getWordGameMetrics(width, height);
  const gameLogic = useWordGameLogic({ difficulty, onGameComplete });
  const audioPlayer = useWordAudioPlayer();
  const isMountedRef = useRef(true);

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
    endGameEarly,
  } = gameLogic;

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      audioPlayer.stopSound();
    };
  }, []);

  // 🎧 탭을 떠날 때 단어 소리를 끊는다.
  // 탭은 언마운트되지 않으므로 위 언마운트 클린업은 탭 전환 때 실행되지 않는다.
  // (`learn/index.tsx`가 블러에서 난이도를 'easy'로 되돌리면 아래 이펙트가 stopSound를 부르지만,
  //  이미 'easy'였으면 값이 그대로라 이펙트가 다시 돌지 않아 소리가 남았다)
  useStopAudioOnBlur(() => {
    audioPlayer.stopSound();

    // 재생을 끊으면 '재생 완료' 콜백(:138)도 오지 않아 gameState가 'playing'에 갇힌다.
    // '듣는 중...' 화면에는 버튼이 없어(:218) 스스로 빠져나올 수 없으므로 선택지 화면으로 넘겨 둔다.
    // 문제·점수·라운드는 그대로이고, 돌아와서 '다시 듣기'로 같은 문제를 다시 들을 수 있다.
    if (gameState === 'playing') {
      setAnswered();
    }
  });

  // 난이도 변경 시 게임 리셋
  useEffect(() => {
    audioPlayer.stopSound();
    resetGame();
  }, [difficulty, resetGame]);

  // 라운드·상태가 바뀔 때마다 부모에게 알린다. 부모는 이것으로 「그만하기」를 그릴지 정한다
  useEffect(() => {
    onProgressChange?.({ round, gameState });
  }, [round, gameState, onProgressChange]);

  /**
   * 「그만하기」. 오디오는 이 컴포넌트가 들고 있으므로 여기서 끊고,
   * 타이머 취소와 결과 통보는 훅(`endGameEarly`)이 한다.
   *
   * 결과가 뜨면 부모가 이 컴포넌트를 언마운트하므로 `gameState`를 따로 되돌리지 않는다.
   * 의존성 배열을 두지 않아 **매 렌더 최신 클로저**로 갱신한다 — `stopSound`가 매 렌더 새 함수다.
   */
  useImperativeHandle(ref, () => ({
    quit: () => {
      audioPlayer.stopSound();
      endGameEarly();
    },
  }));

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
                paddingTop: Math.round(metrics.contentTopPadding * 0.4),
                paddingBottom: metrics.contentBottomPadding,
                minHeight: metrics.contentMinHeight,
              },
            ]}
          >
            <Text style={styles.readyTitle}>준비되셨나요?</Text>

            {/* marginTop: 'auto'로 바닥에 붙는다. marginBottom으로 그만큼 위로 올린다 */}
            <View style={[styles.readyActionWrapper, { marginBottom: metrics.startOffsetY }]}>
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
    // marginBottom은 렌더에서 metrics.startOffsetY로 준다
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

export const WordGame = forwardRef<WordGameRef, WordGameProps>(WordGameInner);

export default WordGame;

