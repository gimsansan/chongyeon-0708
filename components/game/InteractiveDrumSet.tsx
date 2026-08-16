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


/**
 * 드럼 그림 크기 = 화면 폭 × 이 비율. 부모가 drumSize를 안 주면 쓰는 예비값이다.
 * 0.72는 393dp 기기의 기존 그림 크기(283dp)를 그대로 재현하는 값 — 예전 식은
 * 상자 0.9W 안에 paddingBottom 70을 두고 그리는 구조라 실제 그림은 0.9W-70이었다.
 */
const DRUM_WIDTH_RATIO = 0.72;
/** 태블릿에서 그림만 거대해지지 않도록 하는 상한 */
const DRUM_MAX_SIZE = 520;
/**
 * 캐릭터 크기 = 그림 크기 × 이 비율.
 * 기존 0.15는 상자(0.9W) 기준이었다. 그림 기준으로 옮기며 0.15 × (353.7/283.7)로 환산.
 */
const CHARACTER_SIZE_RATIO = 0.1875;
/**
 * 캐릭터 시작 위치(그림 크기 대비 0~1). 기존에는 사라진 순환 버튼 옆에 두느라
 * 그림 아래 여백(70dp)에 걸쳐 있었다. 그 여백이 없어져 그림 안으로 clamp된다.
 */
const CHARACTER_START_X = 0.736;
const CHARACTER_START_Y = 0.871;
/**
 * 드래그를 놓았을 때 악기로 붙는 반경(그림 크기 대비).
 * 기존 0.12는 상자 기준이라 그림 기준으로는 0.12 × (353.7/283.7) = 0.1496.
 * 이 값이라야 393dp 기기의 판정 반경(42dp)이 그대로 유지된다.
 */
const SNAP_THRESHOLD = 0.1496;

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
  /** true면 캐릭터 미렌더(상위에서 고정 오버레이로 표시) */
  readonly hideCharacterAndButtons?: boolean;
  /**
   * 그려질 드럼 그림의 한 변(dp). 부모가 실제 가용 높이를 재서 넘긴다.
   * 여기서 창 높이로 추정하면 하단 탭바 높이를 이 파일에 베껴 두게 되므로 받아서 쓴다.
   */
  readonly drumSize?: number;
  /** 세로가 좁은 기기에서 여백만 줄이는 압축 모드 */
  readonly compact?: boolean;
}

export interface InteractiveDrumSetRef {
  moveToNextInstrument: () => void;
  /** 순서를 거꾸로 되짚어 이전 악기로 캐릭터 이동 */
  moveToPrevInstrument: () => void;
  /** 현재 악기의 중립 위치로 캐릭터 이동 (다음 문제 준비용) */
  moveToNeutralPosition: (instrument: InstrumentType) => void;
}

const InteractiveDrumSetInner = (props: Readonly<InteractiveDrumSetProps>, ref: React.Ref<InteractiveDrumSetRef>) => {
  const { layout, numInstruments, onInstrumentPlay, onInstrumentChange, isGameAudioPlaying = false, isGameMode = false, isQuizWaiting = false, onAnswerSubmit, hideCurrentInstrumentLabel = false, hideCharacterAndButtons = false, drumSize, compact = false } = props;
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

  /**
   * 드럼 그림의 한 변(dp). 원본(last_22~55.png)이 540×540 정사각이라 가로세로가 같다.
   * 마커·캐릭터·스냅 반경이 모두 이 값 하나를 기준으로 하므로 그림과 절대 어긋나지 않는다.
   */
  const availableWidth = dimensions.width - insets.left - insets.right;
  const drumSetSize = drumSize ?? Math.min(availableWidth * DRUM_WIDTH_RATIO, DRUM_MAX_SIZE);
  const characterSize = Math.max(40, drumSetSize * CHARACTER_SIZE_RATIO);
  /** 캐릭터가 그림 밖으로 나가지 않는 한계 */
  const characterMax = Math.max(0, drumSetSize - characterSize);

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

  // 캐릭터 초기 위치: 그림 오른쪽 아래. 좌표가 비율이라 기기 크기와 무관하게 같은 자리다
  useEffect(() => {
    const startX = Math.min(characterMax, CHARACTER_START_X * drumSetSize);
    const startY = Math.min(characterMax, CHARACTER_START_Y * drumSetSize);

    translateX.setValue(startX);
    translateY.setValue(startY);
    setCharacterPosition({ x: startX, y: startY });
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


  // 디바이스 크기 변경 감지 (예비 크기 계산에 쓰이는 dimensions 갱신)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  /**
   * 그림 크기가 바뀌면(부모 실측값 도착·화면 크기 변경) 캐릭터를 같은 비율 자리로 옮긴다.
   * 위치를 px로 들고 있어서 크기만 바뀌면 그림 위 상대 위치가 어긋나기 때문이다.
   */
  const prevDrumSetSizeRef = useRef(drumSetSize);
  useEffect(() => {
    const prev = prevDrumSetSizeRef.current;
    prevDrumSetSizeRef.current = drumSetSize;
    if (prev <= 0 || prev === drumSetSize) return;

    const ratio = drumSetSize / prev;
    const nextX = Math.min(characterMax, characterPosition.x * ratio);
    const nextY = Math.min(characterMax, characterPosition.y * ratio);

    translateX.setValue(nextX);
    translateY.setValue(nextY);
    setCharacterPosition({ x: nextX, y: nextY });
  }, [drumSetSize]);

  // 거리 계산 함수
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }) => {
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
  };

  // 가장 가까운 악기 위치 찾기 
  const findNearestInstrument = (x: number, y: number): InstrumentType | null => {
    const relativeX = x / drumSetSize;
    const relativeY = y / drumSetSize;

    let nearestInstrument: InstrumentType | null = null;
    let minDistance = Infinity;

    Object.entries(DRUM_POSITIONS).forEach(([instrument, position]) => {
      const distance = calculateDistance({ x: relativeX, y: relativeY }, position);

      if (distance < minDistance && distance < SNAP_THRESHOLD) {
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
    const targetX = position.x * drumSetSize - characterSize / 2;
    const targetY = position.y * drumSetSize - characterSize / 2;

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
    
    // 중립 오프셋 적용 (없으면 기본값 사용)
    const dx = neutralOffset?.dx ?? 0.05;
    const dy = neutralOffset?.dy ?? 0.05;
    const neutralX = (position.x + dx) * drumSetSize - characterSize / 2;
    const neutralY = (position.y + dy) * drumSetSize - characterSize / 2;

    // 경계 체크
    const clampedX = Math.max(0, Math.min(characterMax, neutralX));
    const clampedY = Math.max(0, Math.min(characterMax, neutralY));

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

    let newX = characterPosition.x + translationX;
    let newY = characterPosition.y + translationY;

    // 실시간 경계 체크 (그림 안으로 제한)
    newX = Math.max(0, Math.min(characterMax, newX));
    newY = Math.max(0, Math.min(characterMax, newY));

    translateX.setValue(newX);
    translateY.setValue(newY);
  };

  const onHandlerStateChange = (event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, translationY } = event.nativeEvent;
      const newX = characterPosition.x + translationX;
      const newY = characterPosition.y + translationY;

      // 그림 안으로 제한
      const boundedX = Math.max(0, Math.min(characterMax, newX));
      const boundedY = Math.max(0, Math.min(characterMax, newY));

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
    <View style={[styles.container, compact && styles.containerCompact]}>

      <View style={[styles.drumSetContainer, compact && styles.drumSetContainerCompact, { width: drumSetSize, height: drumSetSize }]}>
   
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
          const markerSize = 30;
          return (
            <TouchableOpacity
              key={instrument}
              style={[
                styles.instrumentMarker,
                {
                  left: position.x * drumSetSize - markerSize / 2,
                  top: position.y * drumSetSize - markerSize / 2,
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
  /** 세로가 좁은 기기에서 여백만 줄인다 (색·모양·크기 비율은 그대로) */
  containerCompact: {
    padding: 10,
  },
  drumSetContainer: {
    position: 'relative',
    backgroundColor: 'transparent',
    borderRadius: 20,

    marginBottom: 20,

  },
  drumSetContainerCompact: {
    marginBottom: 10,
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
});

const InteractiveDrumSet = forwardRef<InteractiveDrumSetRef, InteractiveDrumSetProps>(InteractiveDrumSetInner);
export default InteractiveDrumSet;
export { InteractiveDrumSet };
