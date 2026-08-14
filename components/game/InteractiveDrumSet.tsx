import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PanGestureHandler,
  State,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';

import { useAudioManager } from '../../context/AudioManager';
import { DRUM_INSTRUMENTS, InstrumentType } from '../../constants/drumSounds';
import { DrumLayout, LAYOUT_2_DRUMS, drumLayouts } from '../../constants/drumLayouts';

const { width: initialScreenWidth, height: initialScreenHeight } = Dimensions.get('window');


const DRUM_IMAGE_ASPECT_RATIO = 1;

// (기본 전역 순서는 존재하지만 컴포넌트에서는 layout.order를 사용)
const DEFAULT_DRUM_ORDER: InstrumentType[] = ['snare', 'hihat', 'cymbal', 'tom', 'kick'];

// 레이아웃별 하이라이트 이미지 매핑 (정적 로드)
const HIGHLIGHT_IMAGES = {
  // 2악기 레이아웃
  2: {
    snare: require('../../assets/images/last_22_blue_snare.png'),
    kick: require('../../assets/images/last_22_red_kick.png'),
    hihat: require('../../assets/images/last_22.png'), // 사용하지 않음
    cymbal: require('../../assets/images/last_22.png'), // 사용하지 않음
    tom: require('../../assets/images/last_22.png'), // 사용하지 않음
  },
  // 3악기 레이아웃
  3: {
    snare: require('../../assets/images/last_33_blue_snare.png'),
    kick: require('../../assets/images/last_33_red_kick.png'),
    hihat: require('../../assets/images/last_33_green_hihat.png'),
    cymbal: require('../../assets/images/last_33.png'), // 사용하지 않음
    tom: require('../../assets/images/last_33.png'), // 사용하지 않음
  },
  // 4악기 레이아웃
  4: {
    snare: require('../../assets/images/last_44_blue_snare.png'),
    kick: require('../../assets/images/last_44_red_kick.png'),
    hihat: require('../../assets/images/last_44_green_hihat.png'),
    cymbal: require('../../assets/images/last_44_pink_cymbal.png'),
    tom: require('../../assets/images/last_44.png'), // 사용하지 않음
  },
  // 5악기 레이아웃
  5: {
    snare: require('../../assets/images/last_55_blue_snare.png'),
    kick: require('../../assets/images/last_55_red_kick.png'),
    hihat: require('../../assets/images/last_55_green_hihat.png'),
    cymbal: require('../../assets/images/last_55_pink_cymbal.png'),
    tom: require('../../assets/images/last_55_orange_tom.png'),
  },
};

interface InteractiveDrumSetProps {
  readonly layout?: DrumLayout;
  readonly numInstruments?: 2 | 3 | 4 | 5;
  readonly onInstrumentPlay?: (instrumentName: string) => void;
  readonly onInstrumentChange?: (instrument: InstrumentType | null) => void;
  readonly isGameAudioPlaying?: boolean;
  readonly isGameMode?: boolean;
  /** 퀴즈 정답 대기 상태일 때 악기 터치를 정답 제출로 처리 */
  readonly isQuizWaiting?: boolean;
  /** 정답 제출 콜백 (퀴즈 모드) */
  readonly onAnswerSubmit?: (instrument: InstrumentType) => void;
  /** true면 현재 악기 이름 레이블 숨김 (퀴즈 시작 후) */
  readonly hideCurrentInstrumentLabel?: boolean;
  /** true면 캐릭터·순환 버튼 미렌더(상위에서 고정 오버레이로 표시) */
  readonly hideCharacterAndButtons?: boolean;
  /** true면 캐릭터만 표시하고 순환 버튼은 숨김(상위 고정 버튼 사용 시) */
  readonly hideCycleButton?: boolean;
}

export interface InteractiveDrumSetRef {
  moveToNextInstrument: () => void;
  /** 순서를 거꾸로 되짚어 이전 악기로 캐릭터 이동 */
  moveToPrevInstrument: () => void;
  /** 현재 악기의 중립 위치로 캐릭터 이동 (다음 문제 준비용) */
  moveToNeutralPosition: (instrument: InstrumentType) => void;
}

const InteractiveDrumSetInner = (props: Readonly<InteractiveDrumSetProps>, ref: React.Ref<InteractiveDrumSetRef>) => {
  const { layout, numInstruments, onInstrumentPlay, onInstrumentChange, isGameAudioPlaying = false, isGameMode = false, isQuizWaiting = false, onAnswerSubmit, hideCurrentInstrumentLabel = false, hideCharacterAndButtons = false, hideCycleButton = false } = props;
  const activeLayout = layout ?? drumLayouts[String(numInstruments ?? 2) as keyof typeof drumLayouts] ?? LAYOUT_2_DRUMS;
  const audioManager = useAudioManager();
  const insets = useSafeAreaInsets();
  const [dimensions, setDimensions] = useState({ width: initialScreenWidth, height: initialScreenHeight });
  const [characterPosition, setCharacterPosition] = useState({ x: 0, y: 0 });
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentType | null>(null);
  const [currentInstrumentIndex, setCurrentInstrumentIndex] = useState<number>(-1); // 화살표 이동용 현재 인덱스
  /** 사용자가 악기를 한 번이라도 선택(탭·스냅·순환)한 뒤에만 악기명 라벨 표시 */
  const [instrumentLabelVisible, setInstrumentLabelVisible] = useState(false);

  // currentInstrument 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    if (onInstrumentChange) {
      onInstrumentChange(currentInstrument);
    }
  }, [currentInstrument, onInstrumentChange]);

  // layout에서 악기 상세(좌표, 반지름 등) 추출
  const DRUM_DETAILS = activeLayout.details;
  const DRUM_POSITIONS = Object.fromEntries(
    Object.entries(DRUM_DETAILS).map(([key, { x, y }]) => [key, { x, y }])
  ) as Record<InstrumentType, { x: number; y: number }>;
  // 이 레이아웃에서 실제 사용할 악기 순서
  const layoutOrder = activeLayout.order;

  // 애니메이션 값들
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const characterPulse = useRef(new Animated.Value(1)).current;
  const markerPulse = useRef(new Animated.Value(1)).current;
  // 하이라이트 오퍼시티(모든 악기용 - 모두 구현됨)
  const snareHighlightOpacity = useRef(new Animated.Value(0)).current;
  const kickHighlightOpacity = useRef(new Animated.Value(0)).current;
  const hihatHighlightOpacity = useRef(new Animated.Value(0)).current;
  const cymbalHighlightOpacity = useRef(new Animated.Value(0)).current;
  const tomHighlightOpacity = useRef(new Animated.Value(0)).current;

  // 하이라이트 스케일 효과 (강렬한 인터렉션용)
  const snareHighlightScale = useRef(new Animated.Value(1)).current;
  const kickHighlightScale = useRef(new Animated.Value(1)).current;
  const hihatHighlightScale = useRef(new Animated.Value(1)).current;
  const cymbalHighlightScale = useRef(new Animated.Value(1)).current;
  const tomHighlightScale = useRef(new Animated.Value(1)).current;

  // 하이라이트 진동 효과 (약한 흔들림)
  const snareHighlightShake = useRef(new Animated.Value(0)).current;
  const kickHighlightShake = useRef(new Animated.Value(0)).current;
  const hihatHighlightShake = useRef(new Animated.Value(0)).current;
  const cymbalHighlightShake = useRef(new Animated.Value(0)).current;
  const tomHighlightShake = useRef(new Animated.Value(0)).current;

  // 애니메이션 상태 추적 (동시 실행 방지)
  const animationRefs = useRef<Record<InstrumentType, any>>({
    snare: null,
    kick: null,
    hihat: null,
    cymbal: null,
    tom: null,
  });

  // 캐릭터 초기 위치: 순환 버튼 바로 우측, 세로는 버튼과 맞춤
  useEffect(() => {
    const currentAvailableHeight = dimensions.height - insets.top - insets.bottom;
    const currentAvailableWidth = dimensions.width - insets.left - insets.right;
    const currentDrumSetSize = Math.min(currentAvailableWidth * 0.9, currentAvailableHeight * 0.6 / DRUM_IMAGE_ASPECT_RATIO);
    const currentCharacterSize = Math.max(40, currentDrumSetSize * 0.15);

    // 순환 버튼: right: availableWidth*0.3, width 60 → 버튼 오른쪽 끝 + 8px 간격
    const rightOffset = currentAvailableWidth * 0.3;
    const centerX = Math.min(
      currentDrumSetSize - currentCharacterSize,
      Math.max(0, currentDrumSetSize - rightOffset + 8)
    );
    // 버튼과 세로 중앙 맞춤 (버튼 bottom: 50, height: 60)
    const bottomY = currentDrumSetSize - 50 - 60 + 30 - currentCharacterSize / 2;

    translateX.setValue(centerX);
    translateY.setValue(bottomY);
    setCharacterPosition({ x: centerX, y: bottomY });
  }, []);

  // 캐릭터 펄스 애니메이션 - 컴포넌트 마운트 후 500ms 대기 후 시작
  useEffect(() => {
    const timer = setTimeout(() => {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(characterPulse, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(characterPulse, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // 드럼 마커 펄스 애니메이션 - 700ms 후 시작
  useEffect(() => {
    const timer = setTimeout(() => {
      const markerAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(markerPulse, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(markerPulse, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      markerAnimation.start();
    }, 700);

    return () => {
      clearTimeout(timer);
    };
  }, []);


  // 디바이스 크기 변경 감지 및 캐릭터 위치 조정
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const newDimensions = { width: window.width, height: window.height };
      const newAvailableHeight = newDimensions.height - insets.top - insets.bottom;
      const newAvailableWidth = newDimensions.width - insets.left - insets.right;
      const newDrumSetSize = Math.min(newAvailableWidth * 0.9, newAvailableHeight * 0.6 / DRUM_IMAGE_ASPECT_RATIO);
      const newCharacterSize = Math.max(40, newDrumSetSize * 0.1);

      // 캐릭터 위치가 새 경계를 벗어났는지 확인하고 조정
      const maxX = newDrumSetSize - newCharacterSize;
      const maxY = newDrumSetSize - newCharacterSize;

      let adjustedX = characterPosition.x;
      let adjustedY = characterPosition.y;

      if (characterPosition.x > maxX) adjustedX = maxX;
      if (characterPosition.y > maxY) adjustedY = maxY;

      // 위치가 변경되었다면 애니메이션과 함께 업데이트
      if (adjustedX !== characterPosition.x || adjustedY !== characterPosition.y) {
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: adjustedX,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: adjustedY,
            useNativeDriver: true,
          }),
        ]).start();

        setCharacterPosition({ x: adjustedX, y: adjustedY });
      }

      setDimensions(newDimensions);
    });

    return () => subscription?.remove();
  }, [characterPosition]);


  const availableHeight = dimensions.height - insets.top - insets.bottom;
  const availableWidth = dimensions.width - insets.left - insets.right;

  // 반응형 드럼세트 크기 계산 
  const maxContainerWidth = availableWidth * 0.9;
  const maxContainerHeight = availableHeight * 0.6; // Safe Area 내 가용 높이의 60%
  const drumSetSize = Math.min(maxContainerWidth, maxContainerHeight / DRUM_IMAGE_ASPECT_RATIO);
  const characterSize = Math.max(40, drumSetSize * 0.15);

  // 거리 계산 함수
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }) => {
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
  };

  // 가장 가까운 악기 위치 찾기 
  const findNearestInstrument = (x: number, y: number): InstrumentType | null => {
    const currentAvailableHeight = dimensions.height - insets.top - insets.bottom;
    const currentAvailableWidth = dimensions.width - insets.left - insets.right;
    const currentDrumSetSize = Math.min(currentAvailableWidth * 0.9, currentAvailableHeight * 0.6 / DRUM_IMAGE_ASPECT_RATIO);
    const relativeX = x / currentDrumSetSize;
    const relativeY = y / currentDrumSetSize;

    let nearestInstrument: InstrumentType | null = null;
    let minDistance = Infinity;

    Object.entries(DRUM_POSITIONS).forEach(([instrument, position]) => {
      const distance = calculateDistance({ x: relativeX, y: relativeY }, position);

      const snapThreshold = Math.max(0.12, 0.2 - (currentDrumSetSize / 1000));
      if (distance < minDistance && distance < snapThreshold) {
        minDistance = distance;
        nearestInstrument = instrument as InstrumentType;
      }
    });

    return nearestInstrument;
  };

  // 악기 위치
  const snapToInstrument = (instrument: InstrumentType) => {
    const position = DRUM_POSITIONS[instrument];
    if (!position) {
      console.warn(`snapToInstrument: position for instrument '${instrument}' not found in current layout`);
      return;
    }
    const currentAvailableHeight = dimensions.height - insets.top - insets.bottom;
    const currentAvailableWidth = dimensions.width - insets.left - insets.right;
    const currentDrumSetSize = Math.min(currentAvailableWidth * 0.9, currentAvailableHeight * 0.6 / DRUM_IMAGE_ASPECT_RATIO);
    const targetX = position.x * currentDrumSetSize - characterSize / 2;
    const targetY = position.y * currentDrumSetSize - characterSize / 2;

    Animated.parallel([
      Animated.spring(translateX, {
        toValue: targetX,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(translateY, {
        toValue: targetY,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.2,
          useNativeDriver: true,
          duration: 100,
        }),
        Animated.timing(scale, {
          toValue: 1,
          useNativeDriver: true,
          duration: 100,
        }),
      ]),
    ]).start();

    setCharacterPosition({ x: targetX, y: targetY });
    setCurrentInstrument(instrument);
    setInstrumentLabelVisible(true);

    // 드래그로 선택된 악기의 순서 인덱스 업데이트
    const instrumentIndex = layoutOrder.indexOf(instrument);
    if (instrumentIndex !== -1) {
      setCurrentInstrumentIndex(instrumentIndex);
    }

    // 퀴즈 모드: 정답 제출 + 터치 피드백 소리만
    if (isQuizWaiting && onAnswerSubmit) {
      onAnswerSubmit(instrument);
      audioManager.playSound(instrument, DRUM_INSTRUMENTS[instrument].sound);
    } else if (!isGameAudioPlaying) {
      // 일반 연주 모드: 소리 + 하이라이트
      audioManager.playSound(instrument, DRUM_INSTRUMENTS[instrument].sound);
      onInstrumentPlay?.(DRUM_INSTRUMENTS[instrument].name);
      triggerHighlight(instrument);
    }
  };

  // 악기별 하이라이트 트리거 함수 (개선됨)
  const triggerHighlight = (instrument: InstrumentType) => {
    // guard: instrument must exist in current layout
    if (!DRUM_DETAILS[instrument]) {
      console.warn(`triggerHighlight: instrument '${instrument}' not present in current layout`);
      return;
    }

    // 기존 애니메이션 중지 (잔상 방지)
    if (animationRefs.current[instrument]) {
      animationRefs.current[instrument].stop();
      animationRefs.current[instrument] = null;
    }

    // 해당 악기의 애니메이션 값들 가져오기
    let opacityValue: Animated.Value;
    let scaleValue: Animated.Value;
    let shakeValue: Animated.Value;

    switch (instrument) {
      case 'snare':
        opacityValue = snareHighlightOpacity;
        scaleValue = snareHighlightScale;
        shakeValue = snareHighlightShake;
        break;
      case 'kick':
        opacityValue = kickHighlightOpacity;
        scaleValue = kickHighlightScale;
        shakeValue = kickHighlightShake;
        break;
      case 'hihat':
        opacityValue = hihatHighlightOpacity;
        scaleValue = hihatHighlightScale;
        shakeValue = hihatHighlightShake;
        break;
      case 'cymbal':
        opacityValue = cymbalHighlightOpacity;
        scaleValue = cymbalHighlightScale;
        shakeValue = cymbalHighlightShake;
        break;
      case 'tom':
        opacityValue = tomHighlightOpacity;
        scaleValue = tomHighlightScale;
        shakeValue = tomHighlightShake;
        break;
      default:
        return;
    }

    // 애니메이션 시작 (강렬한 인터렉션 효과)
    opacityValue.setValue(0);
    scaleValue.setValue(1);
    shakeValue.setValue(0);

    const animation = Animated.parallel([
      // 기존 opacity 애니메이션
      Animated.sequence([
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true
        }),
        Animated.timing(opacityValue, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        }),
      ]),
      // 스케일 효과: opacity에 비례해서 커짐
      Animated.sequence([
        Animated.timing(scaleValue, {
          toValue: 1.02,
          duration: 80,
          useNativeDriver: true
        }),
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
      ]),
      // 진동 효과: 랜덤한 흔들림
      Animated.sequence([
        Animated.timing(shakeValue, {
          toValue: Math.random() * 2 - 1,
          duration: 80,
          useNativeDriver: true
        }),
        Animated.timing(shakeValue, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        }),
      ]),
    ]);

    animationRefs.current[instrument] = animation;
    animation.start(() => {
      // 애니메이션 완료 후 참조 제거
      animationRefs.current[instrument] = null;
    });
  };

  // 화살표로 다음 악기로 이동
  const moveToNextInstrument = () => {
    const newIndex = (currentInstrumentIndex + 1) % layoutOrder.length;
    const instrument = layoutOrder[newIndex];
    setCurrentInstrumentIndex(newIndex);
    snapToInstrument(instrument);
  };

  // 화살표로 이전 악기로 이동 (역순 재생). 아직 선택 전(-1)이면 마지막 악기부터 시작
  const moveToPrevInstrument = () => {
    const newIndex = currentInstrumentIndex < 0
      ? layoutOrder.length - 1
      : (currentInstrumentIndex - 1 + layoutOrder.length) % layoutOrder.length;
    const instrument = layoutOrder[newIndex];
    setCurrentInstrumentIndex(newIndex);
    snapToInstrument(instrument);
  };

  // 현재 악기의 중립 위치로 이동 (다음 문제 준비용)
  const moveToNeutralPosition = (instrument: InstrumentType) => {
    const position = DRUM_POSITIONS[instrument];
    const neutralOffset = activeLayout.neutralOffsets?.[instrument];
    if (!position) {
      console.warn(`moveToNeutralPosition: position for instrument '${instrument}' not found`);
      return;
    }
    
    const currentAvailableHeight = dimensions.height - insets.top - insets.bottom;
    const currentAvailableWidth = dimensions.width - insets.left - insets.right;
    const currentDrumSetSize = Math.min(currentAvailableWidth * 0.9, currentAvailableHeight * 0.6 / DRUM_IMAGE_ASPECT_RATIO);
    
    // 중립 오프셋 적용 (없으면 기본값 사용)
    const dx = neutralOffset?.dx ?? 0.05;
    const dy = neutralOffset?.dy ?? 0.05;
    const neutralX = (position.x + dx) * currentDrumSetSize - characterSize / 2;
    const neutralY = (position.y + dy) * currentDrumSetSize - characterSize / 2;
    
    // 경계 체크
    const maxX = currentDrumSetSize - characterSize;
    const maxY = currentDrumSetSize - characterSize;
    const clampedX = Math.max(0, Math.min(maxX, neutralX));
    const clampedY = Math.max(0, Math.min(maxY, neutralY));

    Animated.parallel([
      Animated.spring(translateX, {
        toValue: clampedX,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.spring(translateY, {
        toValue: clampedY,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
    ]).start();

    setCharacterPosition({ x: clampedX, y: clampedY });
    setCurrentInstrument(null); // 악기 선택 해제 (중립 상태)
  };

  useImperativeHandle(ref, () => ({ moveToNextInstrument, moveToPrevInstrument, moveToNeutralPosition }), [currentInstrumentIndex, layoutOrder, snapToInstrument, dimensions, insets, characterSize, activeLayout]);

  // 제스처
  const onGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    const { translationX, translationY } = event.nativeEvent;

    // Safe Area 경계 제한
    const currentAvailableHeight = dimensions.height - insets.top - insets.bottom;
    const currentAvailableWidth = dimensions.width - insets.left - insets.right;
    const currentDrumSetSize = Math.min(currentAvailableWidth * 0.9, currentAvailableHeight * 0.6 / DRUM_IMAGE_ASPECT_RATIO);
    const maxX = currentDrumSetSize - characterSize;
    const maxY = currentDrumSetSize - characterSize;

    let newX = characterPosition.x + translationX;
    let newY = characterPosition.y + translationY;

    // 실시간 경계 체크
    newX = Math.max(0, Math.min(maxX, newX));
    newY = Math.max(0, Math.min(maxY, newY));

    translateX.setValue(newX);
    translateY.setValue(newY);
  };

  const onHandlerStateChange = (event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, translationY } = event.nativeEvent;
      const newX = characterPosition.x + translationX;
      const newY = characterPosition.y + translationY;

      // Safe Area를 고려한 경계 체크
      const currentAvailableHeight = dimensions.height - insets.top - insets.bottom;
      const currentAvailableWidth = dimensions.width - insets.left - insets.right;
      const currentDrumSetSize = Math.min(currentAvailableWidth * 0.9, currentAvailableHeight * 0.6 / DRUM_IMAGE_ASPECT_RATIO);
      const boundedX = Math.max(0, Math.min(currentDrumSetSize - characterSize, newX));
      const boundedY = Math.max(0, Math.min(currentDrumSetSize - characterSize, newY));

      // 가장 가까운 악기 찾기
      const nearestInstrument = findNearestInstrument(boundedX + characterSize / 2, boundedY + characterSize / 2);

      if (nearestInstrument) {
        // 악기 위치로 스냅
        snapToInstrument(nearestInstrument);
      } else {
        // 원래 위치로 복귀
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: boundedX,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: boundedY,
            useNativeDriver: true,
          }),
        ]).start();

        setCharacterPosition({ x: boundedX, y: boundedY });
        // 드래그가 악기 밖으로 나갔을 때는 currentInstrument를 리셋하지 않음
      }
    }
  };

  return (
    <View style={styles.container}>

      <View style={[styles.drumSetContainer, { width: drumSetSize, height: drumSetSize }]}>
   
        <Image
          source={activeLayout.image}
          style={styles.drumSetImage}
          resizeMode="contain"
        />
        {/* 파트별 하이라이트 오버레이 (모든 악기 - 레이아웃별 이미지 적용) */}
        {layoutOrder.includes('kick') && (
          <Animated.Image
            source={HIGHLIGHT_IMAGES[numInstruments || 2].kick}
            style={[
              styles.drumSetImage,
              {
                position: 'absolute',
                left: 0,
                top: 0,
                opacity: kickHighlightOpacity,
                transform: [
                  { scale: kickHighlightScale },
                  { translateX: kickHighlightShake }
                ]
              }
            ]}
            resizeMode="contain"
          />
        )}
        {layoutOrder.includes('snare') && (
          <Animated.Image
            source={HIGHLIGHT_IMAGES[numInstruments || 2].snare}
            style={[
              styles.drumSetImage,
              {
                position: 'absolute',
                left: 0,
                top: 0,
                opacity: snareHighlightOpacity,
                transform: [
                  { scale: snareHighlightScale },
                  { translateX: snareHighlightShake }
                ]
              }
            ]}
            resizeMode="contain"
          />
        )}
        {layoutOrder.includes('hihat') && (
          <Animated.Image
            source={HIGHLIGHT_IMAGES[numInstruments || 2].hihat}
            style={[styles.drumSetImage, { position: 'absolute', left: 0, top: 0, opacity: hihatHighlightOpacity }]}
            resizeMode="contain"
          />
        )}
        {layoutOrder.includes('cymbal') && (
          <Animated.Image
            source={HIGHLIGHT_IMAGES[numInstruments || 2].cymbal}
            style={[styles.drumSetImage, { position: 'absolute', left: 0, top: 0, opacity: cymbalHighlightOpacity }]}
            resizeMode="contain"
          />
        )}
        {layoutOrder.includes('tom') && (
          <Animated.Image
            source={HIGHLIGHT_IMAGES[numInstruments || 2].tom}
            style={[
              styles.drumSetImage,
              {
                position: 'absolute',
                left: 0,
                top: 0,
                opacity: tomHighlightOpacity,
                transform: [
                  { scale: tomHighlightScale },
                  { translateX: tomHighlightShake }
                ]
              }
            ]}
            resizeMode="contain"
          />
        )}


        {Object.entries(DRUM_POSITIONS).map(([instrument, position]) => {
          const currentAvailableHeight = dimensions.height - insets.top - insets.bottom;
          const currentAvailableWidth = dimensions.width - insets.left - insets.right;
          const currentDrumSetSize = Math.min(currentAvailableWidth * 0.9, currentAvailableHeight * 0.6 / DRUM_IMAGE_ASPECT_RATIO);
          const markerSize = 30;
          return (
            <TouchableOpacity
              key={instrument}
              style={[
                styles.instrumentMarker,
                {
                  left: position.x * currentDrumSetSize - markerSize / 2,
                  top: position.y * currentDrumSetSize - markerSize / 2,
                  width: markerSize,
                  height: markerSize,
                  borderRadius: markerSize / 2,
                  backgroundColor: currentInstrument === instrument ? '#7cbd7e' : '#FF9800',
                  transform: [{ scale: markerPulse }],
                },
              ]}
              onPress={() => {
                setCurrentInstrument(instrument as InstrumentType);
                setInstrumentLabelVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.markerInner}>
                <Text style={styles.markerText}>🎵</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {!hideCharacterAndButtons && (
          <>
            {/* 드래그 가능한 캐릭터 */}
            <PanGestureHandler
              onGestureEvent={onGestureEvent}
              onHandlerStateChange={onHandlerStateChange}
            >
              <Animated.View
                style={[
                  styles.character,
                  {
                    width: characterSize,
                    height: characterSize,
                    transform: [
                      { translateX },
                      { translateY },
                      { scale: Animated.multiply(scale, characterPulse) },
                    ],
                  },
                ]}
              >
                <Image
                  source={require('../../assets/images/character.png')}
                  style={styles.characterImage}
                  resizeMode="contain"
                />
              </Animated.View>
            </PanGestureHandler>
            {/* 악기 순환 버튼 (우측) - hideCycleButton이면 상위 고정 버튼만 사용 */}
            {!hideCycleButton && (
              <Animated.View style={[styles.controlButtonsContainer, { right: availableWidth * 0.1 }]}>
                <TouchableOpacity
                  style={styles.cycleButton}
                  onPress={() => moveToNextInstrument()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cycleButtonText}>▶️1</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </>
        )}
      </View>

      {/* 현재 악기 표시 - 퀴즈 중 숨김, 사운드 체크는 첫 상호작용 후에만 표시 */}
      {currentInstrument && !hideCurrentInstrumentLabel && instrumentLabelVisible && (
        <View style={[
          styles.currentInstrumentDisplay,
          {
            width: Math.max(140, drumSetSize * 0.11),
            height: 35,
            minHeight: 50,
            transform: [{ translateX: -Math.max(35, drumSetSize * 0.055) }],
          }
        ]}>
          <Text style={styles.currentInstrumentText}>
            {DRUM_INSTRUMENTS[currentInstrument].name}
          </Text>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  drumSetContainer: {
    position: 'relative',
    backgroundColor: 'transparent',
    borderRadius: 20,

    marginBottom: 20,
    paddingBottom: 70, // 화살표 버튼들을 위한 공간 확보
  },
  drumSetImage: {
    width: '100%',
    height: '100%',
  },
  instrumentMarker: {
    position: 'absolute',
    opacity: 0.85,
    elevation: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  markerInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  markerText: {
    fontSize: 16,
  },
  character: {
    position: 'absolute',
    zIndex: 10,
  },
  characterImage: {
    width: '100%',
    height: '100%',
  },
  currentInstrumentDisplay: {
    position: 'absolute',
    top: 1,
    left: '50%',
    backgroundColor: 'rgba(252, 237, 204, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    elevation: 5,
    zIndex: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentInstrumentText: {
    color: '#555457',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0,
    lineHeight: 22,
  },
  // 악기 순환 버튼 컨테이너 (반응형 절대값 배치)
  controlButtonsContainer: {
    position: 'absolute',
    bottom: 10,
    zIndex: 100, // 다른 요소 위에 표시되도록 z-index 추가
  },
  cycleButton: {
    width: 60,
    height: 60,
    backgroundColor: '#ecc681',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  cycleButtonText: {
    fontSize: 20,
    color: 'white',  // 흰색으로 복구
    fontWeight: 'bold',
  },

  // 기존 arrowController 스타일 제거 (더 이상 사용되지 않음)
});

const InteractiveDrumSet = forwardRef<InteractiveDrumSetRef, InteractiveDrumSetProps>(InteractiveDrumSetInner);
export default InteractiveDrumSet;
export { InteractiveDrumSet };
