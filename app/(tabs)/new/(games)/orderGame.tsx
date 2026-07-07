import { Audio } from '../../../../services/audioCompat';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MissionProgressIcon from '../../../../components/MissionProgressIcon';
import WaveRipple from '../../../../components/WaveRipple';
import DraggableImage from '../../../../components/game/DraggableImage';
import { ClearContext } from '../../../../context/ClearContext';
import { StarContext } from '../../../../context/StarContext';
import { LAYOUT } from '../../../../constants/layout';
import { COLORS } from '../../../../constants/colors';
import { SOUNDS_WITH_IMAGE } from '../../../../constants/animalSounds';

const sounds = SOUNDS_WITH_IMAGE;

/** [DEBUG] 드롭존 디버깅 - false로 변경하면 로그 비활성화 */
const DEBUG_DROP = false;

export default function OrderGame() {
  const [playList, setPlayList] = useState<{ sound: Audio.Sound; name: string }[]>([]);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [correctSoundNames, setCorrectSoundNames] = useState<(string)[]>([]);
  const [dropZonesLayout, setDropZonesLayout] = useState<any[]>([]);
  const [droppedImages, setDroppedImages] = useState<(string | null)[]>([null, null, null]);
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const [showWaveAnimation, setShowWaveAnimation] = useState(false);
  const [draggingSource, setDraggingSource] = useState<'grid' | number | null>(null);
  const dropZoneRefs = useRef<(View | null)[]>([]);
  const dropZonesLayoutRef = useRef<any[]>([]);

  const starContext = useContext(StarContext);
  const clearContext = useContext(ClearContext);

  const DROP_ZONE_MARGIN = 20;

  const checkDropZone = (x: number, y: number) => {
    const zones = dropZonesLayoutRef.current;
    const m = DROP_ZONE_MARGIN;
    const idx = zones.findIndex((zone) => {
      if (!zone) return false;
      const { x: zoneX, y: zoneY, width, height } = zone;
      return x >= zoneX - m && x <= zoneX + width + m && y >= zoneY - m && y <= zoneY + height + m;
    });
    if (DEBUG_DROP) {
      console.log('[DROP] checkDropZone', { x, y, zones, result: idx });
    }
    return idx;
  };

  /** 드롭존 좌표 측정 (measureInWindow 우선, 0이면 measure fallback) */
  const measureDropZones = useCallback(() => {
    const measureOne = (ref: View | null, i: number): Promise<{ i: number; x: number; y: number; width: number; height: number } | null> =>
      new Promise((resolve) => {
        if (!ref) {
          resolve(null);
          return;
        }
        ref.measureInWindow((x: number, y: number, width: number, height: number) => {
          if (DEBUG_DROP) console.log(`[DROP] measureInWindow zone${i}:`, { x, y, width, height });
          if (x !== 0 || y !== 0) {
            resolve({ i, x, y, width, height });
            return;
          }
          ref.measure((_x: number, _y: number, w: number, h: number, pageX: number, pageY: number) => {
            if (DEBUG_DROP) console.log(`[DROP] measure fallback zone${i}:`, { pageX, pageY, w, h });
            resolve({ i, x: pageX, y: pageY, width: w, height: h });
          });
        });
      });

    const promises = dropZoneRefs.current.map((ref, i) => measureOne(ref, i));
    Promise.all(promises).then((results) => {
      if (DEBUG_DROP) console.log('[DROP] measureDropZones results:', results);
      const newLayouts: any[] = [];
      results.forEach((r) => {
        if (r) newLayouts[r.i] = { x: r.x, y: r.y, width: r.width, height: r.height };
      });
      dropZonesLayoutRef.current = newLayouts;
      setDropZonesLayout(newLayouts);
    });
  }, []);

  /** 게임 시작 시 드롭존 재측정 (레이아웃 안정화 대기) */
  useEffect(() => {
    if (isGameStarted && !showWaveAnimation) {
      const t = setTimeout(() => measureDropZones(), 200);
      return () => clearTimeout(t);
    }
  }, [isGameStarted, showWaveAnimation, measureDropZones]);

  const startGame = async () => {
    setAttemptCount(0);
    setShowWaveAnimation(true);

    try {
      // 오디오 모드 설정 (안정적인 재생을 위해)
      await Audio.setAudioModeAsync({
        staysActiveInBackground: false,
        shouldDuckAndroid: true, 
      });

      // 선택된 3개의 사운드만 로드 (메모리 최적화 + 최대 안정성)
      const randomSounds = getRandomElements(sounds, 3);
      console.log('=== 게임 시작: 사운드 순차적 로드 (최대 안정성) ===');

      // 순차적 로드 (하나씩 안정적으로)
      const soundList: { sound: Audio.Sound; name: string }[] = [];

      for (const soundPath of randomSounds) {
        let retryCount = 0;
        const maxRetries = 2;
        let loadedSound: Audio.Sound | null = null;

        // 각 사운드마다 최대 2번 재시도
        while (retryCount <= maxRetries && !loadedSound) {
          try {
            console.log(`🔄 ${soundPath.name} 로드 시도 (${retryCount + 1}/${maxRetries + 1})`);
            const { sound } = await Audio.Sound.createAsync(soundPath.sound);
            loadedSound = sound;
            soundList.push({ sound, name: soundPath.name });
            console.log(`✅ ${soundPath.name} 로드 완료`);
            break;
          } catch (error) {
            retryCount++;
            console.error(`❌ ${soundPath.name} 로드 실패 (${retryCount}/${maxRetries + 1}):`, error);

            if (retryCount <= maxRetries) {
              console.log(`🔄 ${soundPath.name} 재시도 중...`);
              await new Promise(resolve => setTimeout(resolve, 300)); // 재시도 전 대기
            }
          }
        }

        if (!loadedSound) {
          console.log(`💥 ${soundPath.name} 최종 로드 실패 - 건너뜀`);
        }
      }

      if (soundList.length === 0) {
        throw new Error('모든 사운드 로드에 실패했습니다.');
      }

      console.log(`📊 최종 로드 성공: ${soundList.length}/${randomSounds.length}개`);

      setPlayList(soundList);

      // 🔍 디버깅 로그
      console.log('=== 게임 시작: 선택된 사운드들 ===');
      soundList.forEach((sound, index) => {
        console.log(`${index + 1}번째: ${sound.name}`);
      });

      // 소리 재생 (안정적 순차 재생)
      console.log('=== 소리 재생 시작 ===');
      const correctNames = [];

      for (let i = 0; i < soundList.length; i++) {
        const soundObj = soundList[i];
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
          try {
            console.log(`🔊 ${soundObj.name} 재생 시도 (${retryCount + 1}/${maxRetries + 1})`);
            await soundObj.sound.playAsync();
            correctNames.push(soundObj.name);
            console.log(`✅ ${soundObj.name} 재생 성공`);
            break; // 성공하면 루프 탈출
          } catch (playError) {
            retryCount++;
            console.error(`❌ ${soundObj.name} 재생 실패 (${retryCount}/${maxRetries + 1}):`, playError);

            if (retryCount <= maxRetries) {
              console.log(`🔄 ${soundObj.name} 재시도 중...`);
              await new Promise(resolve => setTimeout(resolve, 500)); // 재시도 전 잠시 대기
            } else {
              console.log(`💥 ${soundObj.name} 최종 실패 - 게임 계속 진행`);
              correctNames.push(soundObj.name); // 실패해도 이름은 추가
            }
          }
        }

        // 각 소리 사이 간격 (마지막 소리 제외)
        if (i < soundList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1300));
        }
      }

      if (correctNames.length === 0) {
        throw new Error('모든 소리 재생에 실패했습니다.');
      }

      setCorrectSoundNames(correctNames);

      console.log('=== 정답 순서 ===');
      correctNames.forEach((name, index) => {
        console.log(`${index + 1}번째 정답: ${name}`);
      });

      // 소리 재생이 완전히 끝난 후 약간의 추가 대기 (사용자 경험 개선)
      console.log('=== 소리 재생 완료 - UI 전환 준비 ===');
      await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 추가 대기

      console.log('=== UI 전환 시작 ===');
      setShowWaveAnimation(false);
      setIsGameStarted(true);

      Alert.alert(
        '🎵 준비 완료!',
        '소리를 듣고 순서를 맞춰보세요! 🔀',
        [
          {
            text: '시작하기',
            style: 'default',
          },
        ],
        {
          cancelable: false,
        }
      );

    } catch (error) {
      console.error('게임 시작 오류:', error);
      setShowWaveAnimation(false);

      Alert.alert(
        '⚠️ 음성 로드 실패',
        '소리를 불러올 수 없어요. 앱을 다시 시작해주세요.',
        [
          {
            text: '확인',
            style: 'default',
          },
        ]
      );
    }
  };

  const submit = () => {
    if (droppedImages.includes(null)) {
      Alert.alert(
        '⚠️ 확인 필요',
        '빈 공간을 모두 채워주세요.',
        [
          {
            text: '확인',
            style: 'default',
          },
        ]
      );
      return;
    }

    const currentAttempt = attemptCount + 1;
    setAttemptCount(currentAttempt);
    
    // 🔍 콘솔로그: 정답 제출 시 비교 결과
    console.log('=== 정답 제출 결과 ===');
    console.log('정답 순서:', correctSoundNames);
    console.log('사용자 답:', droppedImages);
    
    let correct = true;
    for (let i = 0; i < correctSoundNames.length; i++) {
      const isMatch = correctSoundNames[i] === droppedImages[i];
      console.log(`${i + 1}번째: ${correctSoundNames[i]} vs ${droppedImages[i]} → ${isMatch ? '✅ 정답' : '❌ 오답'}`);
      if (correctSoundNames[i] != droppedImages[i]) {
        correct = false;
        break;
      }
    }
    
    console.log(`최종 결과: ${correct ? '🎉 정답!' : '😅 오답!'}`);
    console.log(`시도 횟수: ${currentAttempt}회`);
    console.log('====================');

    if (correct) {
      Alert.alert(
        '🎉 축하합니다!',
        '정답을 맞추셨어요! 정말 대단해요! 🌟',
        [
          {
            text: '확인',
            style: 'default',
          },
        ]
      );

      starContext?.addStar('orderGame');
      if (currentAttempt === 1) {
        clearContext?.markAsCleared('orderGame');
      }
      endGame();
    } else {
      Alert.alert(
        '😅 아쉬워요!',
        '다시 시도해보세요!',
        [
          {
            text: '다시 시도',
            style: 'default',
          },
        ]
      );
    }
  }

  const endGame = async () => {
    for (const soundObj of playList) {
      try {
        const status = await soundObj.sound.getStatusAsync();
        if (status.isLoaded) {
          await soundObj.sound.unloadAsync();
        }
      } catch (error) {
        console.error(`${soundObj.name} 언로드 오류: `, error);
      }
    }

    setIsGameStarted(false);
    setPlayList([]);
    setDroppedImages([null, null, null]);
  };


  const getRandomElements = (arr: any[], num: number): any[] => {
    const result: any[] = [];
    const seenIndexes = new Set<number>();

    while (result.length < num) {
      const randomIndex = Math.floor(Math.random() * arr.length);
      if (!seenIndexes.has(randomIndex)) {
        result.push(arr[randomIndex]);
        seenIndexes.add(randomIndex);
      }
    }
    return result;
  };


  const handleDrop = (
    imageIndex: number,
    targetZoneIndex: number,
    sourceZoneIndex?: number
  ): boolean => {
    if (DEBUG_DROP) {
      console.log('[DROP] handleDrop', { imageIndex, targetZoneIndex, sourceZoneIndex });
    }
    const imageName = sounds[imageIndex].name;
    let consumed = false;

    setDroppedImages((prev) => {
      const newDroppedImages = [...prev];
      if (sourceZoneIndex !== undefined) {
        if (targetZoneIndex === -1) {
          newDroppedImages[sourceZoneIndex] = null;
          consumed = true;
        } else if (sourceZoneIndex === targetZoneIndex) {
          return prev;
        } else {
          const imageThatWasInTarget = newDroppedImages[targetZoneIndex];
          newDroppedImages[targetZoneIndex] = imageName;
          newDroppedImages[sourceZoneIndex] = imageThatWasInTarget;
          consumed = true;
        }
      } else {
        if (targetZoneIndex !== -1) {
          const existingIndex = newDroppedImages.indexOf(imageName);
          if (existingIndex > -1) {
            newDroppedImages[existingIndex] = null;
          }
          newDroppedImages[targetZoneIndex] = imageName;
          consumed = true;
        }
      }
      return newDroppedImages;
    });
    return consumed;
  };

  return (
    <View style={styles.big_container}>
      <View style={styles.container}>
        {/* Wave 애니메이션 */}
        {showWaveAnimation && (
          <View style={styles.waveContainer}>
            <WaveRipple
              size={LAYOUT.auditoryWaveAnimationSize}
              color="#79A1FF"
              style={styles.waveAnimation}
            />
            <Text style={styles.loadingText}>소리를 재생하고 있습니다...</Text>
          </View>
        )}

        {/* 게임 시작 버튼 */}
        {!isGameStarted && !showWaveAnimation && (
          <TouchableOpacity style={styles.startButton} onPress={startGame} activeOpacity={0.8}>
            <Text style={styles.startButtonText} numberOfLines={1}>🎮 게임시작</Text>
          </TouchableOpacity>
        )}

        {/* 게임 진행 중 UI */}
        {isGameStarted && !showWaveAnimation && (
          <ScrollView
            style={{ flexGrow: 1 }}
            contentContainerStyle={{ alignItems: 'center' }}
            onScrollEndDrag={measureDropZones}
            onMomentumScrollEnd={measureDropZones}
          >
            {DEBUG_DROP && (
              <Text style={styles.debugText}>
                zones: {dropZonesLayout.filter(Boolean).length}/3
                {dropZonesLayout[0] && ` [0]x=${Math.round(dropZonesLayout[0].x)} y=${Math.round(dropZonesLayout[0].y)}`}
              </Text>
            )}
            {/* 드래그 가능한 이미지들 */}
            <View style={[styles.imagesContainer, draggingSource === 'grid' && { zIndex: 1000, elevation: 1000 }]}>
              {sounds.map((soundItem, index) => {
                const isDropped = droppedImages.includes(soundItem.name);
                return (
                  <DraggableImage
                    key={`top-${soundItem.name}`}
                    image={soundItem.image}
                    index={index}
                    name={soundItem.name}
                    onDrop={handleDrop}
                    onDragStart={(sourceZoneIndex) => setDraggingSource(sourceZoneIndex ?? 'grid')}
                    onDragEnd={() => setDraggingSource(null)}
                    disabled={isDropped}
                    checkDropZone={checkDropZone}
                    debug={DEBUG_DROP}
                  />
                );
              })}
            </View>

            {/* 드롭 존 */}
            <View style={styles.dropZoneContainer}>
              {Array.from({ length: 3 }, (_, i) => {
                const imageName = droppedImages[i];
                const soundItem = sounds.find((s) => s.name === imageName);
                return (
                  <View
                    key={`zone-${i}`}
                    ref={(el) => {
                      dropZoneRefs.current[i] = el;
                    }}
                    style={styles.dropZone}
                    onLayout={() => {
                      setTimeout(() => measureDropZones(), 100);
                    }}
                    collapsable={false}
                  >
                    <View style={[styles.dropZoneInner, draggingSource === i && { zIndex: 1000, elevation: 1000 }]}>
                      {imageName && soundItem ? (
                        <DraggableImage
                          image={soundItem.image}
                          index={sounds.indexOf(soundItem)}
                          name={soundItem.name}
                          onDrop={handleDrop}
                          onDragStart={(sourceZoneIndex) => setDraggingSource(sourceZoneIndex ?? 'grid')}
                          onDragEnd={() => setDraggingSource(null)}
                          sourceZoneIndex={i}
                          checkDropZone={checkDropZone}
                          debug={DEBUG_DROP}
                        />
                      ) : (
                        <Text style={{ color: COLORS.textPlaceholder }}>놓는곳</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={submit} activeOpacity={0.8}>
              <Text style={styles.submitButtonText}>✅ 정답 제출</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      <MissionProgressIcon
        gameId="orderGame"
        title="소리 순서 미션"
        missionText="정답 맞추기"
        clearText="첫 번째 시도에서 정답 맞추기"
        progressItems={[
          { label: '현재 시도 횟수', value: `${attemptCount}회` }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  big_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWarning,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: LAYOUT.spacingMD,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: LAYOUT.orderGameImagesContainerPadding,
    marginBottom: LAYOUT.orderGameImagesContainerMarginBottom,
  },
  dropZoneContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    height: LAYOUT.orderGameDropZoneHeight,
  },
  dropZone: {
    width: LAYOUT.orderGameCardSize,
    height: LAYOUT.orderGameCardSize,
    backgroundColor: COLORS.backgroundLight,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
    borderStyle: 'dashed',
    margin: LAYOUT.orderGameDropZoneMargin,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropZoneInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveAnimation: {
    width: LAYOUT.auditoryWaveAnimationSize,
    height: LAYOUT.auditoryWaveAnimationSize,
  },
  loadingText: {
    marginTop: LAYOUT.auditoryLoadingTextMarginTop,
    fontSize: LAYOUT.smallButtonTextFontSize,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  debugText: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  startButton: {
    backgroundColor: COLORS.green,
    paddingVertical: LAYOUT.completeButtonPaddingV,
    paddingHorizontal: LAYOUT.spacingLG,
    borderRadius: LAYOUT.orderGameStartButtonBorderRadius,
    elevation: 3,
    minWidth: LAYOUT.orderGameStartButtonMinWidth,
  },
  startButtonText: {
    color: COLORS.white,
    fontSize: LAYOUT.buttonTextFontSize,
    fontWeight: 'bold',
    textAlign: 'center',
    flexShrink: 0,
  },
  submitButton: {
    backgroundColor: COLORS.greenBright,
    paddingVertical: LAYOUT.completeButtonPaddingV,
    paddingHorizontal: LAYOUT.spacingLG,
    borderRadius: LAYOUT.orderGameStartButtonBorderRadius,
    marginTop: LAYOUT.orderGameSubmitButtonMarginTop,
    elevation: 3,
    minWidth: LAYOUT.orderGameStartButtonMinWidth,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: LAYOUT.buttonTextFontSize,
    fontWeight: 'bold',
    textAlign: 'center',
    flexShrink: 0,
  },
});