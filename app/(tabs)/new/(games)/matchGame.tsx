import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import MissionProgressIcon from '../../../../components/MissionProgressIcon';
import RiveAnimalGame, { RiveAnimalGameRef } from '../../../../components/RiveAnimalGame';
import WaveRipple from '../../../../components/WaveRipple';
import { ClearContext } from '../../../../context/ClearContext';
import { StarContext } from '../../../../context/StarContext';
import { getMatchGameGridMetrics, LAYOUT } from '../../../../constants/layout';
import { COLORS } from '../../../../constants/colors';
import { SOUNDS_WITH_RIVE } from '../../../../constants/animalSounds';
import { useSyncGameData } from '../../../../hooks/useSyncGameData';
import { useStopAudioOnBlur } from '../../../../hooks/useStopAudioOnBlur';

const GRID = getMatchGameGridMetrics();

function getRandomElements<T>(arr: T[], num: number): T[] {
  const result: T[] = [];
  const seenIndexes = new Set<number>();
  while (result.length < num) {
    const randomIndex = Math.floor(Math.random() * arr.length);
    if (!seenIndexes.has(randomIndex)) {
      result.push(arr[randomIndex]);
      seenIndexes.add(randomIndex);
    }
  }
  return result;
}

const sounds = SOUNDS_WITH_RIVE;

export default function MatchGame() {
  const [playList, setPlayList] = useState<{ sound: AudioPlayer; name: string }[]>([]);
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [disabledButtons, setDisabledButtons] = useState<Set<string>>(new Set());
  const [correctSoundNames, setCorrectSoundNames] = useState<Set<string>>(new Set());
  const [isStartModalVisible, setIsStartModalVisible] = useState(false);
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  
  // 애니메이션 중인 동물 이름 추적.
  // 한 장이 애니메이션하는 동안 다른 장을 누를 수 있으므로 **여러 장이 동시에** 들어간다.
  const [animatingAnimals, setAnimatingAnimals] = useState<Set<string>>(new Set());
  const [errorAnimals, setErrorAnimals] = useState<Set<string>>(new Set());
  /** 위 상태의 동기 사본. state 갱신은 비동기라 같은 카드 연타를 막지 못한다 */
  const animatingRef = useRef<Set<string>>(new Set());

  // 카드별 Rive Ref. 여러 장이 동시에 애니메이션할 수 있어 하나로는 서로 참조를 뺏는다
  const riveRefs = useRef<Record<string, RiveAnimalGameRef | null>>({});
  // 타이머 정리용 Ref
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [madeMistake, setMadeMistake] = useState<boolean>(false);
  // 타이머 내부에서도 최신 실수 여부를 보장하기 위한 Ref (클로저 방지)
  const madeMistakeRef = useRef<boolean>(false);
  const starContext = useContext(StarContext);
  const clearContext = useContext(ClearContext);
  
  // 전송용 데이터
  const { syncData } = useSyncGameData();
  const [gameStartTime, setGameStartTime] = useState<number | null>(null); // 소리 재생이 끝나고 시작한 시간
  const [wrongAttempts, setWrongAttempts] = useState<string[]>([]); // 유저가 잘못 누른 동물들 기록
  /**
   * 위 상태의 동기 사본. 카드를 겹쳐 누를 수 있게 되면서 `handleButtonPress`의 클로저가
   * 옛 렌더의 `wrongAttempts`를 잡을 수 있다. 의료 데이터에 오답이 빠지면 안 되므로
   * 전송 시점에는 이 ref를 쓴다 (`madeMistakeRef`와 같은 이유).
   */
  const wrongAttemptsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      timerRefs.current.forEach(clearTimeout);
      timerRefs.current.length = 0;
    };
  }, []);

  /** 문제음으로 로드된 사운드들. 탭을 떠날 때 멈추려면 state가 아니라 ref로도 들고 있어야 한다 */
  const questionSoundsRef = useRef<{ sound: AudioPlayer; name: string }[]>([]);
  /** 탭을 떠났다는 신호. 문제음 재생 루프가 이걸 보고 빠져나온다 */
  const leftScreenRef = useRef(false);

  /** 로드된 문제음을 전부 멈춘다 (언로드하지 않음 — endGame에서 정리한다) */
  const pauseQuestionSounds = () => {
    for (const soundObj of questionSoundsRef.current) {
      try {
        soundObj.sound.pause();
      } catch (error) { }
    }
  };

  // 🐾 탭(또는 이 게임 화면)을 떠날 때 문제음을 끊는다.
  // 소리 3개가 겹쳐 들리는 것은 훈련 설계이므로 **탭 안 재생 순서·간격(200ms)은 그대로 둔다.**
  // 떠났을 때만 루프가 중간에 빠져나오도록 신호를 준다.
  useStopAudioOnBlur(() => {
    leftScreenRef.current = true;
    pauseQuestionSounds();
  });

  /** 떠난 뒤 남은 재생을 중단하고 시작 전 상태로 되돌린다 */
  const abandonQuestionPlayback = async () => {
    pauseQuestionSounds();
    for (const soundObj of questionSoundsRef.current) {
      try {
        soundObj.sound.remove();
      } catch (error) { }
    }
    questionSoundsRef.current = [];
    setPlayList([]);
    setCorrectSoundNames(new Set());
    setIsGameStarted(false);
    setIsLoading(false);
  };

  const startGame = async () => {
    setIsLoading(true);
    setMadeMistake(false);
    madeMistakeRef.current = false;
    leftScreenRef.current = false;

    setWrongAttempts([]); // 새 게임 시작 시 오답 기록 초기화
    wrongAttemptsRef.current = [];
    
    // 소리 재생이 끝난 후 UI가 바뀔 때 현재 시간 기록
    setIsGameStarted(true);
    setGameStartTime(Date.now())

    try {
      // 오디오 모드는 `AudioManagerProvider`가 앱 시작 시 1회 설정한다(4-B에서 일원화).
      // 여기 있던 `duckOthers` 설정은 앱 전체에 잔류하던 것이라 제거했다.
      const randomSounds = getRandomElements(sounds, 3);
      const soundList: { sound: AudioPlayer; name: string }[] = [];

      for (const soundPath of randomSounds) {
        let retryCount = 0;
        const maxRetries = 2;
        let loadedSound: AudioPlayer | null = null;

        while (retryCount <= maxRetries && !loadedSound) {
          try {
            const sound = createAudioPlayer(soundPath.sound, { updateInterval: 500 });
            loadedSound = sound;
            soundList.push({ sound, name: soundPath.name });
            break;
          } catch (error) {
            retryCount++;
            if (retryCount <= maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
        }
      }

      if (soundList.length === 0) throw new Error('사운드 로드 실패');

      setPlayList(soundList);
      questionSoundsRef.current = soundList;

      // 로드하는 동안 탭을 떠났으면 소리를 내지 않고 접는다
      if (leftScreenRef.current) {
        await abandonQuestionPlayback();
        return;
      }

      const correctNames = [];

      for (let i = 0; i < soundList.length; i++) {
        const soundObj = soundList[i];
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
          try {
            soundObj.sound.play();
            correctNames.push(soundObj.name);
            break;
          } catch (playError) {
            retryCount++;
            if (retryCount <= maxRetries) await new Promise(resolve => setTimeout(resolve, 500)); 
            else correctNames.push(soundObj.name); 
          }
        }
        if (i < soundList.length - 1) await new Promise(resolve => setTimeout(resolve, 200));

        // 재생 도중 탭을 떠났으면 남은 소리는 내지 않는다
        if (leftScreenRef.current) {
          await abandonQuestionPlayback();
          return;
        }
      }

      setCorrectSoundNames(new Set(correctNames));
      await new Promise(resolve => setTimeout(resolve, 500));

      if (leftScreenRef.current) {
        await abandonQuestionPlayback();
        return;
      }

      setIsGameStarted(true);
      setIsStartModalVisible(true);
    } catch (error) {
      setErrorMessage('오디오 로드 중 문제가 생겼어요. 다시 시도해주세요.');
      setIsErrorModalVisible(true);
    } finally {
      setIsLoading(false); 
    }
  };

  const endGame = async () => {
    // 남아있는 타이머 정리 (언마운트/화면 전환 포함 안전)
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current.length = 0;

    for (const soundObj of playList) {
      try {
        if (soundObj.sound.currentStatus.isLoaded) soundObj.sound.remove();
      } catch (error) {}
    }
    questionSoundsRef.current = [];
    setIsGameStarted(false);
    setIsLoading(false);
    setPlayList([]);
    setDisabledButtons(new Set());
    setCorrectSoundNames(new Set());
    setAnimatingAnimals(new Set());
    setErrorAnimals(new Set());
    animatingRef.current = new Set();
    setMadeMistake(false);
    madeMistakeRef.current = false;
  };

  const handleButtonPress = (soundName: string) => {
    // 비활성화됐거나 **이 카드가** 애니메이션 중이면 무시 (같은 카드 연타 방지).
    // 다른 카드는 막지 않는다 — 애니메이션 1.5초 동안 입력이 잠기던 원인이었다.
    if (disabledButtons.has(soundName) || animatingRef.current.has(soundName)) return;

    const isCorrect = correctSoundNames.has(soundName);
    
    // 1. 해당 버튼을 Rive로 전환
    animatingRef.current.add(soundName);
    setAnimatingAnimals(prev => new Set(prev).add(soundName));
    if (!isCorrect) {
      setErrorAnimals(prev => new Set(prev).add(soundName));
      wrongAttemptsRef.current = [...wrongAttemptsRef.current, soundName];
      setWrongAttempts(prev => [...prev, soundName]);
    }

    // 2. 모션 트리거
    // - 오답은 즉시 흔들림을 보여주기 위해 지연을 최소화합니다.
    // - 마운트 타이밍 차이로 ref가 늦게 잡히는 기기 대비 1회 재시도를 둡니다.
    const trigger = () => {
      if (isCorrect) {
        riveRefs.current[soundName]?.triggerCorrect();
      } else {
        riveRefs.current[soundName]?.triggerError();
        madeMistakeRef.current = true;
        setMadeMistake(true);
      }
    };
    // 정답은 안정적으로 120ms, 오답은 UX를 위해 50ms로 즉각 피드백
    const triggerTimer = setTimeout(trigger, isCorrect ? 120 : 50);
    timerRefs.current.push(triggerTimer);

    // 3. 모션이 끝날 즈음 원래 이미지로 복구하고 상태 업데이트
    const resetTimer = setTimeout(() => {
      // 누른 카드만 되돌린다. 그 사이 다른 카드가 애니메이션 중일 수 있다
      animatingRef.current.delete(soundName);
      setAnimatingAnimals(prev => {
        const next = new Set(prev);
        next.delete(soundName);
        return next;
      });
      setErrorAnimals(prev => {
        const next = new Set(prev);
        next.delete(soundName);
        return next;
      });

      if (isCorrect) {
        setDisabledButtons(prev => new Set(prev).add(soundName));
        setCorrectSoundNames(prev => {
          const newSet = new Set(prev);
          newSet.delete(soundName);
          if (newSet.size === 0) {
            // 데이터 전송
            const endTime = Date.now();
            const durationSeconds = gameStartTime ? (endTime - gameStartTime) / 1000 : 0;

            const medicalDataPayload = {
              presented_sounds: playList.map(item => item.name),
              wrong_selections: [...wrongAttemptsRef.current], // 현재까지 쌓인 오답 배열
              error_count: wrongAttemptsRef.current.length,
              completion_time_seconds: parseFloat(durationSeconds.toFixed(2)), // 소수점 2자리
              is_perfect: !madeMistakeRef.current
            };

            console.log("🚀 [의료 데이터 전송] matchGame:", medicalDataPayload);
            syncData('matchGame', medicalDataPayload); // 서버 전송
            
            const successTimer = setTimeout(() => {
              setIsSuccessModalVisible(true);
            }, 300);
            timerRefs.current.push(successTimer);
          }
          return newSet;
        });
      } else {
        // 오답은 Alert 없이 흔들림 + 카드 색상 변화로만 피드백
      }
    }, 1500); // 1.5초 후 초기화
    timerRefs.current.push(resetTimer);
  };

  return (
    <View style={styles.big_container}>
      <View style={styles.backgroundContainer}>
        <Image source={require('../../../../assets/images/38.jpg')} style={styles.backgroundImage} resizeMode="cover" />
      </View>
      
      <MissionProgressIcon
        gameId="matchGame"
        title="소리 맞추기 미션"
        missionText="정답 맞추기"
        clearText="한 번도 틀리지 않고 정답 맞추기"
        progressItems={[{ label: '이번 판 실수 여부', value: madeMistake ? '있음' : '없음' }]}
      />
      
      <View style={styles.container}>
        {!isGameStarted ? (
          isLoading ? (
            <View style={styles.loadingContainer}>
              <WaveRipple size={LAYOUT.auditoryWaveAnimationSize} color="#79A1FF" style={styles.waveAnimation} />
              <Text style={styles.loadingText}>소리를 재생하고 있습니다...</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.startButton} onPress={startGame} activeOpacity={0.8}>
              <Text style={styles.startButtonText} numberOfLines={1}>🎮 게임시작</Text>
            </TouchableOpacity>
          )
        ) : (
          <View style={styles.gameButtonsContainer}>
            {sounds.map((soundItem) => {
              const isDisabled = disabledButtons.has(soundItem.name);
              const isAnimating = animatingAnimals.has(soundItem.name);
              const isError = errorAnimals.has(soundItem.name);

              return (
                <TouchableOpacity
                  key={soundItem.name}
                  style={[
                    styles.gameButton,
                    isDisabled && styles.disabledButton,
                    isError && styles.errorButton,
                  ]}
                  onPress={() => handleButtonPress(soundItem.name)}
                  disabled={isDisabled || isAnimating}
                  activeOpacity={0.7}
                >
                  <View style={[styles.buttonContent, isAnimating && styles.buttonContentAnimating]}>
                    {/* 클릭한 동물만 Rive로 렌더링, 나머지는 Image로 렌더링 */}
                    {isAnimating ? (
                      <RiveAnimalGame
                        ref={(node) => {
                          riveRefs.current[soundItem.name] = node;
                        }}
                        style={[styles.buttonRiveAnimating]}
                        initialAnimalIndex={soundItem.riveIndex}
                      />
                    ) : (
                      <Image
                        source={soundItem.image}
                        style={styles.buttonImage}
                        resizeMode="contain"
                      />
                    )}
                    {!isAnimating && (
                      <Text style={[styles.gameButtonText, isDisabled && styles.disabledButtonText]}>
                        {soundItem.name}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={isStartModalVisible}
        onRequestClose={() => setIsStartModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>게임 시작!</Text>
            <Text style={styles.modalText}>등장한 동물 세 마리를 골라 주세요! 🐾</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setIsStartModalVisible(false);
                setGameStartTime(Date.now());}
              }
            >
              <Text style={styles.modalButtonText}>시작하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={isErrorModalVisible}
        onRequestClose={() => setIsErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚠️ 오류 발생</Text>
            <Text style={styles.modalText}>
              {errorMessage ?? '오류가 발생했어요. 잠시 후 다시 시도해주세요.'}
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setIsErrorModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={isSuccessModalVisible}
        onRequestClose={() => setIsSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🎉 축하합니다!</Text>
            <Text style={styles.modalText}>모든 동물을 맞추셨어요! 🌟</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setIsSuccessModalVisible(false);
                starContext?.addStar('matchGame');
                if (!madeMistakeRef.current) {
                  clearContext?.markAsCleared('matchGame');
                }
                endGame();
              }}
            >
              <Text style={styles.modalButtonText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  big_container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backgroundContainer: { position: 'absolute', left: 0, top: 0, width: LAYOUT.screenWidth, height: LAYOUT.screenHeight },
  backgroundImage: { width: '100%', height: '100%' },
  container: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10, paddingTop: 16, paddingBottom: 36, width: '96%', maxWidth: 460 },
  startButton: { backgroundColor: COLORS.primary, paddingVertical: LAYOUT.matchGameStartButtonPaddingV, paddingHorizontal: LAYOUT.matchGameStartButtonPaddingH, borderRadius: LAYOUT.matchGameStartButtonBorderRadius, elevation: 4, minWidth: LAYOUT.matchGameStartButtonMinWidth, borderWidth: 0 },
  startButtonText: { color: COLORS.white, fontSize: LAYOUT.buttonTextFontSize, fontWeight: '700', textAlign: 'center', flexShrink: 0, letterSpacing: 0.5 },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: LAYOUT.spacingLG },
  loadingText: { marginTop: LAYOUT.auditoryLoadingTextMarginTop, fontSize: LAYOUT.smallButtonTextFontSize, color: COLORS.textLoading, textAlign: 'center', fontWeight: '500' },
  waveAnimation: { width: LAYOUT.auditoryWaveAnimationSize, height: LAYOUT.auditoryWaveAnimationSize },
  gameButtonsContainer: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: GRID.gap, marginTop: 6 },
  gameButton: {
    backgroundColor: COLORS.background,
    width: GRID.cardSize,
    height: GRID.cardSize,
    borderRadius: LAYOUT.matchGameGameButtonBorderRadius,
    borderWidth: 2,
    borderColor: COLORS.border,
    elevation: 3,
    overflow: 'hidden',
  },
  disabledButton: { backgroundColor: COLORS.backgroundSuccess, borderColor: COLORS.green, borderWidth: 3, opacity: 0.8, elevation: 2 },
  errorButton: {
    backgroundColor: COLORS.backgroundError,
    borderColor: COLORS.errorBorder,
    borderWidth: 2,  // 테스트: 3 → 2
    opacity: 1,      // 테스트: 0.9 → 1
    elevation: 2,
  },
  buttonContent: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: GRID.contentHeight, paddingBottom: 10 },
  buttonContentAnimating: { height: GRID.cardSize, justifyContent: 'flex-end', paddingBottom: 10 },

  buttonImage: { width: Math.round(GRID.mediaSize * 0.92), height: Math.round(GRID.mediaSize * 0.92), marginBottom: 8, flexShrink: 0 },
  buttonRiveAnimating: {
    width: Math.round(GRID.mediaSize * 2.0),
    height: Math.round(GRID.mediaSize * 2.0), 
    marginBottom: -12,
  },
  gameButtonText: { color: COLORS.textPrimary, fontSize: LAYOUT.smallButtonTextFontSize, fontWeight: '600', textAlign: 'center', letterSpacing: 0.3 },
  disabledButtonText: { color: COLORS.successText, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.backgroundWarm,
    padding: LAYOUT.matchGameModalContentPadding,
    borderRadius: LAYOUT.matchGameModalContentBorderRadius,
    alignItems: 'center',
    width: LAYOUT.auditoryPrimaryButtonWidthPercent,
    maxWidth: 320,
    elevation: 5,
  },
  modalTitle: {
    fontSize: LAYOUT.modalTitleFontSize,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
    marginBottom: LAYOUT.matchGameModalTitleMarginBottom,
  },
  modalText: {
    fontSize: LAYOUT.smallButtonTextFontSize,
    color: COLORS.textSlate,
    marginBottom: LAYOUT.matchGameModalTextMarginBottom,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: LAYOUT.matchGameModalButtonPaddingV,
    paddingHorizontal: LAYOUT.matchGameModalButtonPaddingH,
    borderRadius: LAYOUT.matchGameModalButtonBorderRadius,
  },
  modalButtonText: {
    color: COLORS.white,
    fontSize: LAYOUT.smallButtonTextFontSize,
    fontWeight: 'bold',
  },
});