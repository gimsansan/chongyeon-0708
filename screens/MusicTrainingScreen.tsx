import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,

} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer } from 'expo-audio';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';

// Context 및 컴포넌트 임포트
import MissionProgressIcon from '../components/MissionProgressIcon';
import { ClearContext } from '../context/ClearContext';
import { StarContext } from '../context/StarContext';
import { RippleLayer } from '../components/RippleLayer';
import { ParticleVisualizer } from '../components/ParticleVisualizer';
import { MiniKeyboardMap } from '../components/MiniKeyboardMap';
import { FallingNoteTrack } from '../components/FallingNoteTrack';
import { FallingReplayPrompt, FallingResultOverlay } from '../components/FallingResultOverlays';
import { songs, type Song, type SongScale } from '../data/songs';
import { useStopAudioOnBlur } from '../hooks/useStopAudioOnBlur';
import type { Difficulty, Note } from '../types/music';
import {
  MUSIC_PROGRESS_KEY,
  allNotes,
  difficultyLevels,
  isBlackKeyMap,
  level1_absoluteBeginner,
  level2_beginner,
  level3_intermediate,
  level4_advanced,
  level5_specialTraining,
  noteToKeyMap,
  soundFiles,
  whiteIdxRefById,
  type MusicProgress,
} from '../constants/music';
import {
  HIT_WINDOW_MS,
  computeFocusStart,
  fallingScaleLabels,
  fallingTempoLabels,
  getFallingClearTarget,
  getFallingNoteId,
  getJudgmentGrade,
  type FallingResult,
  type FallingTempoMode,
  type FallingTrackMetrics,
  type ScheduledFallingNote,
} from './musicTrainingHelpers';
import { useSyncGameData } from '../hooks/useSyncGameData';



const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const useAutoFocusViewport = ({
  currentNote,
  viewportStartIdx,
  setViewportStartIdx,
  totalWhite,
  viewportSize = 14,
}: {
  currentNote: string | null;
  viewportStartIdx: number;
  setViewportStartIdx: React.Dispatch<React.SetStateAction<number>>;
  totalWhite: number;
  viewportSize?: number;
}) => {
  const startRef = useRef(viewportStartIdx);

  useEffect(() => {
    startRef.current = viewportStartIdx;
  }, [viewportStartIdx]);

  useEffect(() => {
    if (currentNote == null) return;
    const noteWhiteIdx = whiteIdxRefById.get(currentNote);
    if (noteWhiteIdx == null) return;

    const base = startRef.current;
    const target = computeFocusStart(noteWhiteIdx, base, viewportSize, totalWhite);
    if (target === base) return;

    startRef.current = target;
    setViewportStartIdx(target);
  }, [currentNote, totalWhite, viewportSize, setViewportStartIdx]);
};

/**
 * 상주시킬 건반 플레이어 수.
 *
 * 안드로이드는 **앱(UID)당 동시 AudioTrack을 약 40개로 제한**한다. `createAudioPlayer`는
 * 재생 여부와 무관하게 만드는 즉시 트랙 하나를 잡으므로(내부에서 `prepare()`까지 한다),
 * 52개를 미리 만들면 한도를 넘겨 **만들어지자마자 죽고 `play()`가 무음이 된다.**
 * 넘겼을 때 뜨는 로그: `AF::Track: no more tracks available` / `Cannot create AudioTrack`.
 *
 * 12인 이유: 동물 12 · 단어 8 · 드럼 5 · 냉장고 1 = **26개가 앱 수명 동안 상주**하므로
 * 이 화면 몫은 14 안팎이다. 여유 2를 두었다. 예전 15는 그 계산 없이 고른 값이었다.
 *
 * 화면에는 27건반(백건 16 + 흑건 11)이 보이므로 **12는 한 화면을 다 못 덮는다.**
 * 처음 누르는 음과 축출된 음을 다시 누를 때 지연이 있다. 한도 안에서의 의도된 절충이다.
 *
 * 근거·다른 방향: `doc/audio-무음-원인과-방향.md`
 */
const CACHE_LIMIT = 12;

type TrainingMode = 'random' | 'falling' | null;

// 2.5D 타격감을 제공하는 개별 피아노 건반 컴포넌트 (UI 스레드 구동)
const PianoKey = React.memo(({
  note,
  isBlack,
  isVisible,
  width,
  height,
  leftPosition,
  onPressIn,
  onPressOut,
  showKeyLabels,
  keyboardLabel,
}: {
  note: Note;
  isBlack: boolean;
  isVisible: boolean;
  width: number;
  height: number;
  leftPosition?: number;
  onPressIn: (note: Note, event: any) => void;
  onPressOut: (note: Note) => void;
  showKeyLabels: boolean;
  keyboardLabel?: string;
}) => {
  const translateY = useSharedValue(0);
  const shadowOpacity = useSharedValue(isBlack ? 0.35 : 0.15);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      shadowOpacity: shadowOpacity.value,
      backgroundColor: isBlack
        ? (translateY.value > 0 ? '#2a2a2a' : '#111111')
        : (translateY.value > 0 ? '#ececec' : '#ffffff'),
    };
  });

  const handlePressIn = (event: any) => {
    if (!isVisible) return;

    // Y축으로 즉시 눌림 작동 (백건 18px, 흑건 14px)
    translateY.value = isBlack ? 9 : 12;
    shadowOpacity.value = 0.06; // 눌리면 입체 그림자가 사라지듯 옅어짐

    // 햅틱 진동 유발 (중간 세기 타격감)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    onPressIn(note, event);
  };

  const handlePressOut = () => {
    if (!isVisible) return;

    // 부드럽게 원위치로 복구
    translateY.value = withTiming(0, { duration: 80 });
    shadowOpacity.value = withTiming(isBlack ? 0.35 : 0.15, { duration: 80 });

    onPressOut(note);
  };

  if (isBlack) {
    return (
      <AnimatedPressable
        disabled={!isVisible}
        style={[
          styles.blackKey,
          { width, height, left: leftPosition },
          animatedStyle,
          !isVisible && styles.keyDisabled,
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Text style={[styles.blackKeyTextLabel, !isVisible && styles.keyLabelDisabled]}>{note}</Text>
        {showKeyLabels && keyboardLabel && (
          <Text style={[styles.blackKeyLabel, !isVisible && styles.keyLabelDisabled]}>{keyboardLabel}</Text>
        )}
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      disabled={!isVisible}
      style={[
        styles.whiteKey,
        { width, height },
        animatedStyle,
        !isVisible && styles.whiteKeyDisabled,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Text style={[styles.keyTextLabel, !isVisible && styles.keyLabelDisabled]}>{note}</Text>
      {showKeyLabels && keyboardLabel && (
        <Text style={[styles.whiteKeyLabel, !isVisible && styles.keyLabelDisabled]}>{keyboardLabel}</Text>
      )}
    </AnimatedPressable>
  );
});

// 옥타브 시프트 뷰포트 하의 건반 렌더링
const renderPianoViewportRow = (
  notes: Note[],
  visibleNotes: Set<Note>,
  activeNotes: any,
  handlers: any,
  dynamicStyles: any,
  showKeyLabels: boolean,
  viewportStartIdx: number,
  viewportSize: number
) => {
  const whiteKeys = notes.filter(note => !isBlackKeyMap[note]);

  // 전체 백건 중 현재 뷰포트에 포함될 14개의 백건 필터링
  const visibleWhiteKeys = whiteKeys.slice(viewportStartIdx, viewportStartIdx + viewportSize);
  const visibleWhiteKeySet = new Set(visibleWhiteKeys);

  // 뷰포트 내 백건들에 인접한 흑건들만 도출
  const visibleBlackKeys = notes.filter(note => {
    if (!isBlackKeyMap[note]) return false;

    // 이 흑건에 바로 선행하는 백건 찾기
    const noteName = note.substring(0, note.length - 1);
    const octave = note.substring(note.length - 1);
    let precedingWhiteKeyNote: Note | undefined;
    switch (noteName) {
      case 'C#': precedingWhiteKeyNote = `C${octave}` as Note; break;
      case 'D#': precedingWhiteKeyNote = `D${octave}` as Note; break;
      case 'F#': precedingWhiteKeyNote = `F${octave}` as Note; break;
      case 'G#': precedingWhiteKeyNote = `G${octave}` as Note; break;
      case 'A#': precedingWhiteKeyNote = `A${octave}` as Note; break;
    }
    return precedingWhiteKeyNote ? visibleWhiteKeySet.has(precedingWhiteKeyNote) : false;
  });

  const getBlackKeyPosition = (note: Note): number | null => {
    const { whiteKeyWidth, blackKeyWidth } = dynamicStyles;
    const noteName = note.substring(0, note.length - 1);
    const octave = note.substring(note.length - 1);
    let precedingWhiteKeyNote: Note | undefined;
    switch (noteName) {
      case 'C#': precedingWhiteKeyNote = `C${octave}` as Note; break;
      case 'D#': precedingWhiteKeyNote = `D${octave}` as Note; break;
      case 'F#': precedingWhiteKeyNote = `F${octave}` as Note; break;
      case 'G#': precedingWhiteKeyNote = `G${octave}` as Note; break;
      case 'A#': precedingWhiteKeyNote = `A${octave}` as Note; break;
    }
    if (!precedingWhiteKeyNote) return null;
    const index = visibleWhiteKeys.indexOf(precedingWhiteKeyNote);
    if (index === -1) return null;
    // 뷰포트 상대적 위치로 흑건 위치 계산
    return (index + 1) * whiteKeyWidth - (blackKeyWidth / 2);
  };

  return (
    <View style={styles.rowContainer}>
      {visibleWhiteKeys.map(note => {
        const isVisible = visibleNotes.has(note);
        return (
          <PianoKey
            key={note}
            note={note}
            isBlack={false}
            isVisible={isVisible}
            width={dynamicStyles.whiteKeyWidth}
            height={dynamicStyles.whiteKeyHeight}
            onPressIn={handlers.handleNotePressIn}
            onPressOut={handlers.handleNotePressOut}
            showKeyLabels={showKeyLabels}
            keyboardLabel={noteToKeyMap[note]}
          />
        );
      })}
      {visibleBlackKeys.map(note => {
        const isVisible = visibleNotes.has(note);
        const leftPosition = getBlackKeyPosition(note);
        if (leftPosition === null) return null;
        return (
          <PianoKey
            key={note}
            note={note}
            isBlack={true}
            isVisible={isVisible}
            width={dynamicStyles.blackKeyWidth}
            height={dynamicStyles.blackKeyHeight}
            leftPosition={leftPosition}
            onPressIn={handlers.handleNotePressIn}
            onPressOut={handlers.handleNotePressOut}
            showKeyLabels={showKeyLabels}
            keyboardLabel={noteToKeyMap[note]}
          />
        );
      })}
    </View>
  );
};

export function MusicTrainingScreen() {

  // 전송용 데이터
  const { syncData } = useSyncGameData();
  
  // 데이터 수집 상태
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [repeatCount, setRepeatCount] = useState(0);
  const [sessionLog, setSessionLog] = useState<any[]>([]);

  const KEYBOARD_ENABLED = false;
  const VISUALIZER_MODE: 'ripple' | 'particle' = 'particle'; // 스위치 제공 ('ripple'로 변경 시 이전 물결로 복구)
  const SHOW_ANSWER_HINT = true; // 테스트용 정답 힌트 노출 스위치 (true 활성화 / false 비활성화)
  const [isReady, setIsReady] = useState(false);

  // 청능 훈련 상태 관리
  const [activeNotes, setActiveNotes] = useState<{ [key in Note]?: boolean }>({});
  const [mode, setMode] = useState<TrainingMode>(null);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('3단계');
  const [progress, setProgress] = useState<MusicProgress>({});
  const [showMissionSuccess, setShowMissionSuccess] = useState(false);
  const [hasShownMissionSuccess, setHasShownMissionSuccess] = useState(false);

  // 낙하노트 모드 상태 관리
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [selectedSongScale, setSelectedSongScale] = useState<SongScale>('penta5');
  const [selectedSongId, setSelectedSongId] = useState(songs.find(song => song.scale === 'penta5')?.id ?? songs[0]?.id ?? '');
  const [selectedTempoMode, setSelectedTempoMode] = useState<FallingTempoMode>('normal');
  const [lastFallingResult, setLastFallingResult] = useState<FallingResult | null>(null);
  const [showFallingReplayPrompt, setShowFallingReplayPrompt] = useState(false);
  const scheduledNotesRef = useRef<ScheduledFallingNote[]>([]);
  const [hitNoteIds, setHitNoteIds] = useState<string[]>([]);
  const [missNoteIds, setMissNoteIds] = useState<string[]>([]);
  const [fallingResult, setFallingResult] = useState<FallingResult | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [judgmentPulseKey, setJudgmentPulseKey] = useState(0);
  const [missPulseKey, setMissPulseKey] = useState(0);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackMetricsRef = useRef<FallingTrackMetrics | null>(null);
  const isTraining = mode !== null;
  const isFallingNoteActive = mode === 'falling';
  const availableFallingSongs = songs.filter(song => song.scale === selectedSongScale);
  const selectedFallingSong = availableFallingSongs.find(song => song.id === selectedSongId)
    ?? availableFallingSongs[0]
    ?? songs[0]
    ?? null;
  const activeFallingSong = currentSong ?? selectedFallingSong;
  const activeFallingBpm = activeFallingSong
    ? selectedTempoMode === 'normal'
      ? activeFallingSong.normalBpm
      : activeFallingSong.slowBpm
    : 72;

  const clearFallingNoteTimers = useCallback(() => {
    scheduledNotesRef.current.forEach((scheduledNote) => {
      if (scheduledNote.timeoutId) {
        clearTimeout(scheduledNote.timeoutId);
      }
    });
    scheduledNotesRef.current = [];
  }, []);

  const handleNoteSchedule = useCallback((note: Note, expectedTimestamp: number, beat: number) => {
    const id = getFallingNoteId(note, beat);
    if (scheduledNotesRef.current.some(scheduledNote => scheduledNote.id === id)) {
      return;
    }

    scheduledNotesRef.current.push({
      id,
      note,
      expectedTimestamp,
      hit: false,
      reached: false,
      missed: false,
      beat,
    });
  }, []);

  const handleTrackNoteHit = useCallback((note: Note, beat: number, reachedTimestamp: number, hitX: number, hitY: number) => {
    const id = getFallingNoteId(note, beat);
    const targetNote = scheduledNotesRef.current.find(scheduledNote => scheduledNote.id === id);
    if (!targetNote || targetNote.reached) {
      return;
    }

    targetNote.reached = true;
    targetNote.hitX = hitX;
    targetNote.hitY = hitY;
    const driftMs = Math.round(reachedTimestamp - targetNote.expectedTimestamp);
    console.log(`[FallingNote] ${id} reached judgment line. drift=${driftMs}ms`);

    setTimeout(() => {
      const latestNote = scheduledNotesRef.current.find(scheduledNote => scheduledNote.id === id);
      if (latestNote && !latestNote.hit && !latestNote.missed) {
        latestNote.missed = true;
        latestNote.judgment = 'Miss';
        setMissNoteIds(prev => [...prev, id]);
        setMissPulseKey(prev => prev + 1);
      }
    }, HIT_WINDOW_MS);
  }, []);

  // 옥타브 시프트 뷰포트 상태 (난이도에 따라 백건 개수 가변)
  const getViewportSize = () => {
    if (difficulty === '1단계') return 8;
    if (difficulty === '2단계') return 15;
    return 16; // 3단계(중급) 및 4단계(상급)에서 16건반 지원
  };
  const VIEWPORT_SIZE = getViewportSize();

  const [viewportStartIdx, setViewportStartIdx] = useState(14);
  const [fallingTrackWidth, setFallingTrackWidth] = useState(0);

  // 1, 2, 3단계에서는 시작 옥타브 인덱스를 C3(14)로 강제 고정
  const isFixedViewport = difficulty === '1단계' || difficulty === '2단계' || difficulty === '3단계';
  const currentStartIdx = isFixedViewport ? 14 : viewportStartIdx;

  // 옥타브 버튼 애니메이션용 Shared Values
  const leftArrowOpacity = useSharedValue(1);
  const leftArrowTranslateX = useSharedValue(0);
  const rightArrowOpacity = useSharedValue(1);
  const rightArrowTranslateX = useSharedValue(0);

  // 옥타브 가이드 애니메이션 제어
  useEffect(() => {
    if (!isTraining || !currentNote) {
      leftArrowOpacity.value = withTiming(1, { duration: 200 });
      leftArrowTranslateX.value = withTiming(0, { duration: 200 });
      rightArrowOpacity.value = withTiming(1, { duration: 200 });
      rightArrowTranslateX.value = withTiming(0, { duration: 200 });
      return;
    }

    const noteWhiteIdx = whiteIdxRefById.get(currentNote);
    if (noteWhiteIdx == null) return;

    // 오직 4단계(상급) 모드에서만 화면 밖에 음이 있을 때 화살표 힌트 가이드 애니메이션 기동
    const isGuideActive = difficulty === '4단계';
    const showLeftGuide = isGuideActive && noteWhiteIdx < currentStartIdx;
    const showRightGuide = isGuideActive && noteWhiteIdx >= currentStartIdx + VIEWPORT_SIZE;

    if (showLeftGuide) {
      leftArrowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 500, easing: Easing.ease }),
          withTiming(1, { duration: 500, easing: Easing.ease })
        ),
        -1,
        true
      );
      leftArrowTranslateX.value = withRepeat(
        withSequence(
          withTiming(-6, { duration: 400, easing: Easing.ease }),
          withTiming(0, { duration: 400, easing: Easing.ease })
        ),
        -1,
        true
      );
    } else {
      leftArrowOpacity.value = withTiming(1, { duration: 200 });
      leftArrowTranslateX.value = withTiming(0, { duration: 200 });
    }

    if (showRightGuide) {
      rightArrowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 500, easing: Easing.ease }),
          withTiming(1, { duration: 500, easing: Easing.ease })
        ),
        -1,
        true
      );
      rightArrowTranslateX.value = withRepeat(
        withSequence(
          withTiming(6, { duration: 400, easing: Easing.ease }),
          withTiming(0, { duration: 400, easing: Easing.ease })
        ),
        -1,
        true
      );
    } else {
      rightArrowOpacity.value = withTiming(1, { duration: 200 });
      rightArrowTranslateX.value = withTiming(0, { duration: 200 });
    }
  }, [isTraining, currentNote, currentStartIdx, difficulty, VIEWPORT_SIZE]);

  // 터치 물결 효과용 Shared Values
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);
  const rippleProgress = useSharedValue(0);
  const triggerTime = useSharedValue(0); // 파티클 트리거용 시간 Shared Value

  // 오디오 플레이어 캐시 (최대 CACHE_LIMIT개). 맨 앞이 가장 최근에 친 음이다
  const soundCache = useRef<{ [key in Note]?: any }>({});
  const recentlyUsedNotes = useRef<Note[]>([]);
  const starContext = useContext(StarContext) as any;
  const clearContext = useContext(ClearContext) as any;
  const isFocused = useIsFocused();

  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // 자동 옥타브 포커싱 훅 결합 (기존 포커싱 기능은 완전히 비활성화하여 수동 이동 유도)
  useAutoFocusViewport({
    currentNote: null,
    viewportStartIdx,
    setViewportStartIdx,
    totalWhite: allNotes.filter(n => !isBlackKeyMap[n]).length,
    viewportSize: VIEWPORT_SIZE,
  });

  // 초기화 및 라이프사이클 관리
  useEffect(() => {
    let isMounted = true;

    async function initializeApp() {
      try {
        // 화면 방향 고정 (가로)
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        // 오디오 모드는 `AudioManagerProvider`가 앱 시작 시 1회 설정한다(4-B에서 일원화).
      } catch (e) {
        console.error('App initialization failed:', e);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    }

    initializeApp();

    // 저장 기록 로드
    const loadProgress = async () => {
      try {
        const savedProgress = await AsyncStorage.getItem(MUSIC_PROGRESS_KEY);
        if (savedProgress) {
          setProgress(JSON.parse(savedProgress));
        }
      } catch (e) {
        console.error('Failed to load music progress.', e);
      }
    };
    loadProgress();

    return () => {
      isMounted = false;
      clearFallingNoteTimers();
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
      // 사운드 리소스 안전 해제 (메모리 누수 차단)
      for (const player of Object.values(soundCache.current)) {
        try {
          player?.remove();
        } catch (e) {
          console.warn('Failed to release audio player on unmount', e);
        }
      }
      // 캐시 강제 소거로 핫 리로드 시 발생하는 release 충돌 해결
      soundCache.current = {};
      recentlyUsedNotes.current = [];
    };
  }, [clearFallingNoteTimers]);

  useEffect(() => {
    if (!isFocused) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => { });
    } else if (isReady) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => { });
    }
  }, [isFocused, isReady]);

  // 저장 기록 동기화
  useEffect(() => {
    if (Object.keys(progress).length > 0) {
      AsyncStorage.setItem(MUSIC_PROGRESS_KEY, JSON.stringify(progress)).catch(e =>
        console.error('Failed to save music progress.', e)
      );
    }
  }, [progress]);

  useEffect(() => {
    if (!isFallingNoteActive || previewCount === null) return;

    previewTimerRef.current = setTimeout(() => {
      setPreviewCount(prev => {
        if (prev === null) return null;
        return prev > 0 ? prev - 1 : null;
      });
    }, previewCount === 0 ? 500 : 700);

    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
    };
  }, [isFallingNoteActive, previewCount]);

  const handleSelectSongScale = (scale: SongScale) => {
    setSelectedSongScale(scale);
    const firstSongForScale = songs.find(song => song.scale === scale);
    if (firstSongForScale) {
      setSelectedSongId(firstSongForScale.id);
    }
  };

  const getVisibleNoteSet = (): Set<Note> => {
    switch (difficulty) {
      case '1단계': return new Set(level1_absoluteBeginner);
      case '2단계': return new Set(level2_beginner);
      case '3단계': return new Set(level3_intermediate);
      case '4단계': return new Set(level4_advanced);
      case '5단계': return new Set(level5_specialTraining);
      default: return new Set(level3_intermediate);
    }
  };
  const visibleNoteSet = getVisibleNoteSet();

  const handleTrackMetrics = useCallback((metrics: FallingTrackMetrics) => {
    trackMetricsRef.current = metrics;
  }, []);

  const triggerFallingHitEffect = useCallback((note: Note, fallbackX?: number, fallbackY?: number) => {
    const metrics = trackMetricsRef.current;
    const laneIndex = currentSong?.palette.indexOf(note) ?? -1;
    const canUseTrackMetrics = metrics && laneIndex >= 0;
    const hitX = canUseTrackMetrics
      ? metrics.x + metrics.laneStartX + laneIndex * metrics.laneWidth + metrics.laneWidth / 2
      : fallbackX ?? width / 2;
    const hitY = canUseTrackMetrics
      ? metrics.y + metrics.judgmentLineY
      : fallbackY ?? height / 2;

    touchX.value = hitX;
    touchY.value = hitY;
    triggerTime.value = Date.now();
    setJudgmentPulseKey(prev => prev + 1);
  }, [currentSong, height, touchX, touchY, triggerTime, width]);

  const resetFallingStats = () => {
    setHitNoteIds([]);
    setMissNoteIds([]);
    setFallingResult(null);
    setLastFallingResult(null);
    setShowFallingReplayPrompt(false);
    setJudgmentPulseKey(0);
    setMissPulseKey(0);
  };

  /**
   * 가장 오래 안 쓴 음부터 플레이어를 해제해 AudioTrack을 돌려준다.
   * **울리는 중인 음은 건너뛴다** — 해제하면 나던 소리가 끊긴다.
   * 해제에 성공하면 true.
   */
  const evictLeastRecentlyUsedNote = (): boolean => {
    for (let i = recentlyUsedNotes.current.length - 1; i >= 0; i--) {
      const candidate = recentlyUsedNotes.current[i];
      const player = soundCache.current[candidate];
      if (player?.playing) continue;

      recentlyUsedNotes.current.splice(i, 1);
      delete soundCache.current[candidate];
      try {
        player?.remove();
      } catch (e) { }
      return true;
    }
    return false;
  };

  const playSound = async (note: Note) => {
    try {
      let player = soundCache.current[note];
      if (!player) {
        // 만드는 순간 AudioTrack을 잡으므로 **만들기 전에** 자리를 비운다.
        // 전부 울리는 중이라 못 비우면 그냥 만든다 — 여유 2를 남겨 둔 이유다.
        while (recentlyUsedNotes.current.length >= CACHE_LIMIT) {
          if (!evictLeastRecentlyUsedNote()) break;
        }
        player = createAudioPlayer(soundFiles[note]);
        const createdPlayer = player;
        soundCache.current[note] = createdPlayer;

        // 죽은 플레이어는 예외도 로그도 없이 무음이 된다. 유일한 통보 경로가 이 이벤트다.
        //
        // 알리기만 하면 **죽은 플레이어가 캐시에 남는다.** 다음 터치도 같은 플레이어를
        // 재사용하므로 그 건반은 계속 무음이다 — 탭을 나갔다 오거나(`useStopAudioOnBlur`)
        // LRU에 밀려날 때까지. 캐시에서 빼두면 다음 터치 때 새로 만들어 바로 회복한다.
        try {
          createdPlayer.addListener('playbackStatusUpdate', (status: any) => {
            if (!status?.error) return;
            console.warn(`[audio] '${note}' 재생 에러:`, status.error);

            // 그 사이에 교체·축출됐다면 남의 플레이어다. 건드리지 않는다
            if (soundCache.current[note] !== createdPlayer) return;
            delete soundCache.current[note];
            recentlyUsedNotes.current = recentlyUsedNotes.current.filter(n => n !== note);
            try { createdPlayer.remove(); } catch (e) { }
          });
        } catch (e) { }
      }

      // 방금 친 음을 맨 앞으로 (맨 뒤가 가장 오래 안 쓴 음 = 축출 대상)
      recentlyUsedNotes.current = recentlyUsedNotes.current.filter(n => n !== note);
      recentlyUsedNotes.current.unshift(note);

      // 탭을 떠날 때 pause()만 하면 currentTime이 0이어도 play()가 무음이 된다.
      // 동물게임과 같이 항상 되감은 뒤 재생한다.
      await player.seekTo(0);
      player.play();
    } catch (error) {
      console.log(`'${note}' 음원 재생 실패:`, error);
    }
  };

  /**
   * 🎹 탭을 떠날 때 건반 소리를 끊고 **플레이어를 해제한다.**
   * 탭은 언마운트되지 않으므로 위 언마운트 클린업은 탭 전환 때 실행되지 않는다.
   *
   * 이전에는 `pause()`만 하고 캐시를 남겼다(재진입 첫 음 지연을 피하려고).
   * 그런데 `pause()`는 소리만 멈추고 **AudioTrack은 계속 붙잡는다.** 그래서 피아노를
   * 다녀오면 기타·단어 탭까지 앱 전체 한도에 걸려 무음이 됐다.
   * **자리를 돌려주려면 해제해야 한다.** 재진입 첫 음 지연은 그 대가로 받아들인 것이다.
   */
  useStopAudioOnBlur(() => {
    for (const player of Object.values(soundCache.current)) {
      try {
        player?.remove();
      } catch (e) { }
    }
    soundCache.current = {};
    recentlyUsedNotes.current = [];
  });

  const playNextQuestion = useCallback(() => {
    let notesToUse: Note[];
    switch (difficulty) {
      case '1단계': notesToUse = level1_absoluteBeginner; break;
      case '2단계': notesToUse = level2_beginner; break;
      case '3단계': notesToUse = level3_intermediate; break;
      case '4단계': notesToUse = level4_advanced; break;
      case '5단계': notesToUse = level5_specialTraining; break;
      default: notesToUse = level3_intermediate; break;
    }
    const randomIndex = Math.floor(Math.random() * notesToUse.length);
    const randomNote = notesToUse[randomIndex];
    setCurrentNote(randomNote);
    setRepeatCount(0); // 새 문제 출제 시 데이터 초기화 및 시간 기록
    playSound(randomNote);
  }, [difficulty]);

  const handleDifficultyChange = (name: Difficulty) => {
    setDifficulty(name);
    if (mode === 'random') {
      setCurrentNote(null);
      setScore(0);
      setFeedback(`난이도가 ${name}로 변경되었습니다. [문제 재생]을 누르세요.`);
    }
  };

  const startTraining = () => {
    clearFallingNoteTimers();
    setMode('random');
    setScore(0);
    setSessionLog([]); // 세션 로그 초기화
    setFeedback('난이도를 선택하고 [문제 재생]을 눌러 시작하세요!');
    setShowMissionSuccess(false);
    setHasShownMissionSuccess(false);
    setCurrentSong(null);
    setCurrentNote(null);
  };

  const handleResetProgress = async () => {
    try {
      await AsyncStorage.removeItem(MUSIC_PROGRESS_KEY);
      setProgress({});
      setScore(0);
      setCurrentNote(null);
      setFeedback('기록이 초기화되었습니다.');
    } catch (e) {
      console.error('Failed to reset music progress.', e);
    }
  };

  const startFallingNoteMode = (songToPlay: Song | null = selectedFallingSong) => {
    if (!songToPlay) return;

    clearFallingNoteTimers();
    setMode('falling');
    setScore(0);
    resetFallingStats();
    setCurrentNote(null);
    setPreviewCount(3);
    setCurrentSong(songToPlay);
  };

  const stopTraining = () => {
    // 훈련 종료시 데이터 전송
    if (mode === 'random' && sessionLog.length > 0) {
      const correctCount = sessionLog.filter(log => log.is_correct).length;
      
      const medicalDataPayload = {
        difficulty_level: difficulty,
        total_attempts: sessionLog.length,
        correct_count: correctCount,
        accuracy_rate: parseFloat(((correctCount / sessionLog.length) * 100).toFixed(1)),
        detailed_logs: sessionLog // 모든 건반 터치 기록 포함
      };

      console.log("🚀 [의료 데이터 전송] music:", medicalDataPayload);
      syncData('music', medicalDataPayload);
    }
    
    clearFallingNoteTimers();
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setMode(null);
    setCurrentNote(null);
    setCurrentSong(null);
    setPreviewCount(null);
    resetFallingStats();
    setShowMissionSuccess(false);
    setHasShownMissionSuccess(false);
    setFeedback('');
  };

  const handleSongEnd = useCallback(() => {
    const totalNotes = currentSong?.notes.length ?? 0;
    const perfect = scheduledNotesRef.current.filter(note => note.judgment === 'Perfect').length;
    const great = scheduledNotesRef.current.filter(note => note.judgment === 'Great').length;
    const good = scheduledNotesRef.current.filter(note => note.judgment === 'Good').length;
    const hits = perfect + great + good;
    const misses = Math.max(0, totalNotes - hits);
    const accuracy = totalNotes > 0 ? Math.round((hits / totalNotes) * 100) : 0;
    const clearTarget = getFallingClearTarget(currentSong);
    const cleared = accuracy >= clearTarget && misses <= 3;

    setLastFallingResult({
      title: currentSong?.title ?? '낙하노트',
      totalNotes,
      perfect,
      great,
      good,
      cleared,
    });
    clearFallingNoteTimers();
    setMode(null);
    setCurrentNote(null);
    setPreviewCount(null);
    setShowFallingReplayPrompt(true);
  }, [clearFallingNoteTimers, currentSong]);

  const replayFallingSong = () => {
    startFallingNoteMode(currentSong ?? selectedFallingSong);
  };

  const showLastFallingResult = () => {
    if (!lastFallingResult) return;
    setShowFallingReplayPrompt(false);
    setFallingResult(lastFallingResult);
    setCurrentSong(null);
  };

  const closeFallingResult = () => {
    setFallingResult(null);
    setLastFallingResult(null);
    setCurrentSong(null);
  };

  const repeatSound = () => {
    if (currentNote) {
      setRepeatCount(prev => prev + 1); // 횟수 증가
      playSound(currentNote);
    }
  };

  const handleNotePressIn = useCallback((note: Note, event: any) => {
    // 1. 소리 재생
    playSound(note);
    setActiveNotes(prev => ({ ...prev, [note]: true }));

    // 2. 터치한 절대 좌표 위치(pageX, pageY)를 이용한 물결(Ripple) 이펙트 트리거
    const nativeEvent = event?.nativeEvent;
    console.log(`[Touch debug] note: ${note}, hasEvent: ${!!event}, hasNativeEvent: ${!!nativeEvent}`);
    if (nativeEvent && !isFallingNoteActive) {
      const { pageX, pageY } = nativeEvent;
      console.log(`[Touch debug] Coordinates: pageX=${pageX}, pageY=${pageY}`);
      touchX.value = pageX;
      touchY.value = pageY;
      triggerTime.value = Date.now(); // 파티클 트리거 시간 갱신

      rippleProgress.value = 0;
      rippleProgress.value = withSequence(
        withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 0 })
      );
    }

    // 3. 청능 훈련 채점 판단
    if (mode === 'falling' && currentSong) {
      const now = Date.now();
      const targetCandidate = scheduledNotesRef.current
        .map((scheduledNote, index) => ({
          index,
          drift: Math.abs(scheduledNote.expectedTimestamp - now),
          scheduledNote,
        }))
        .filter(({ drift, scheduledNote }) =>
          !scheduledNote.hit && !scheduledNote.missed && scheduledNote.note === note && drift <= HIT_WINDOW_MS
        )
        .sort((a, b) => a.drift - b.drift)[0];
      const targetIndex = targetCandidate?.index ?? -1;

      if (targetIndex !== -1) {
        const hitNote = scheduledNotesRef.current[targetIndex];
        const driftMs = now - hitNote.expectedTimestamp;
        const judgment = getJudgmentGrade(driftMs);
        scheduledNotesRef.current[targetIndex].hit = true;
        scheduledNotesRef.current[targetIndex].judgment = judgment;
        setHitNoteIds(prev => [...prev, hitNote.id]);

        triggerFallingHitEffect(note, hitNote.hitX ?? nativeEvent?.pageX, hitNote.hitY ?? nativeEvent?.pageY);

        if (judgment === 'Perfect') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        }
      } else {
        setMissPulseKey(prev => prev + 1);
      }
    } else if (mode === 'random' && currentNote) {
      const isCorrect = note === currentNote;
      const responseTime = questionStartTime ? (Date.now() - questionStartTime) / 1000 : 0;

      // 이번 터치에 대한 상세 정보 로그 저장
      const attemptRecord = {
        target_note: currentNote,
        selected_note: note,
        is_correct: isCorrect,
        response_time_seconds: parseFloat(responseTime.toFixed(2)), // 💡 반응 시간은 소수점 2자리
        repeat_listens: repeatCount
      };
      setSessionLog(prev => [...prev, attemptRecord]);

      if (isCorrect) {
        const newScore = score + 1;
        setScore(newScore);

        const currentProgress = progress[difficulty] || { cumulativeSuccesses: 0, highestScore: 0 };
        const newCumulativeSuccesses = currentProgress.cumulativeSuccesses + 1;

        const updatedProgress = {
          ...progress,
          [difficulty]: {
            cumulativeSuccesses: newCumulativeSuccesses,
            highestScore: Math.max(currentProgress.highestScore, newScore),
          },
        };
        setProgress(updatedProgress);

        if (newCumulativeSuccesses >= 3) {
          starContext?.addStar(`music_${difficulty}`);
        }
        if (newScore >= 5) {
          clearContext?.markAsCleared(`music_${difficulty}`);
        }

        if (newScore >= 5 && !hasShownMissionSuccess) {
          // 훈련 세션당 1회만 성공 피드백을 제공해 반복 모달을 방지
          setHasShownMissionSuccess(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShowMissionSuccess(true);
          setFeedback('정답!');
          setTimeout(() => {
            setShowMissionSuccess(false);
            setFeedback('다음 문제');
            playNextQuestion();
          }, 2500);
        } else {
          setFeedback('정답!');
          setTimeout(() => {
            setFeedback('다음 문제');
            playNextQuestion();
          }, 1000);
        }
      } else {
        setScore(prev => (prev > 0 ? prev - 1 : 0));
        setFeedback('오답! 다시 들어보세요.');
        // 오답 시 재시도 시간을 새로 재기 위해 타이머 리셋
        setQuestionStartTime(Date.now());
      }
    }
  }, [mode, currentNote, currentSong, isFallingNoteActive, playNextQuestion, score, progress, difficulty, hasShownMissionSuccess, starContext, clearContext, triggerFallingHitEffect, questionStartTime, repeatCount]);

  const handleNotePressOut = useCallback((note: Note) => {
    setActiveNotes(prev => {
      const newActiveNotes = { ...prev };
      delete newActiveNotes[note];
      return newActiveNotes;
    });
  }, []);

  const handleShiftLeft = () => {
    setViewportStartIdx(0);
  };

  const handleShiftRight = () => {
    setViewportStartIdx(14);
  };


  const isFallingResultVisible = fallingResult !== null;
  const shouldUseFallingBottomPanel = isFallingNoteActive || isFallingResultVisible || showFallingReplayPrompt;
  const bottomPanelHeight = shouldUseFallingBottomPanel ? 56 : 96;
  const usableWidth = Math.max(1, width - insets.left - insets.right);
  const usableHeight = Math.max(1, height - insets.top - insets.bottom);
  const PIANO_AREA_PADDING = 20;
  const pianoAreaWidth = Math.max(1, usableWidth - PIANO_AREA_PADDING);
  const availablePlayHeight = Math.max(1, usableHeight - bottomPanelHeight - 20);
  const standardWhiteKeyHeight = Math.max(80, usableHeight - bottomPanelHeight - 90);
  const fallingWhiteKeyHeight = Math.max(108, Math.min(156, availablePlayHeight * 0.4));
  const fallingNotePalette = isFallingNoteActive ? currentSong?.palette ?? null : null;
  const pianoNotes: Note[] = fallingNotePalette ?? allNotes;
  const pianoVisibleNoteSet: Set<Note> = fallingNotePalette ? new Set<Note>(fallingNotePalette) : visibleNoteSet;
  const pianoViewportStartIdx = fallingNotePalette ? 0 : currentStartIdx;
  const pianoViewportSize = fallingNotePalette ? fallingNotePalette.length : VIEWPORT_SIZE;

  const measuredPianoAreaWidth = isFallingNoteActive && fallingTrackWidth > 0
    ? fallingTrackWidth
    : pianoAreaWidth;
  const dynamicWhiteKeyWidth = measuredPianoAreaWidth / pianoViewportSize;
  const dynamicStyles = {
    whiteKeyWidth: dynamicWhiteKeyWidth,
    blackKeyWidth: dynamicWhiteKeyWidth * 0.6,
    whiteKeyHeight: isFallingNoteActive ? fallingWhiteKeyHeight : standardWhiteKeyHeight,
    blackKeyHeight: (isFallingNoteActive ? fallingWhiteKeyHeight : standardWhiteKeyHeight) * 0.65,
  };

  const handlers = { handleNotePressIn, handleNotePressOut };
  const fallingResultHits = fallingResult
    ? fallingResult.perfect + fallingResult.great + fallingResult.good
    : 0;
  const fallingResultMisses = fallingResult
    ? Math.max(0, fallingResult.totalNotes - fallingResultHits)
    : 0;
  const fallingResultAccuracy = fallingResult && fallingResult.totalNotes > 0
    ? Math.round((fallingResultHits / fallingResult.totalNotes) * 100)
    : 0;
  const safeAreaFrameStyle = {
    top: insets.top,
    right: insets.right,
    bottom: insets.bottom,
    left: insets.left,
  };

  const progressItems = difficultyLevels.map(level => {
    const levelProgress = progress[level.name] || { cumulativeSuccesses: 0, highestScore: 0 };
    const starStatus = starContext?.starData[`music_${level.name}`] ? '★' : '☆';
    const clearStatus = clearContext?.clearData[`music_${level.name}`] ? '✓' : '✗';
    return {
      label: `${level.label} (${starStatus}, ${clearStatus})`,
      value: `누적 ${levelProgress.cumulativeSuccesses}회 / 최고 ${levelProgress.highestScore}점`,
    };
  });

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={[]} style={styles.fullScreen}>
      <MissionProgressIcon
        gameId="music"
        title="피아노 미션"
        missionText="각 난이도에서 정답 누적 3회"
        clearText="각 난이도에서 총점 5점 달성"
        progressItems={progressItems}
        style={{
          top: Math.max(12, insets.top),
          right: insets.right + 12,
        }}
        onReset={handleResetProgress}
      />
      {/* 2. Midground Layer (Piano & 훈련 인터페이스) */}
      <View style={[styles.midgroundLayer, safeAreaFrameStyle]} pointerEvents="box-none">
        {/* 상단 피아노 건반 영역 */}
        <View style={styles.pianoArea} pointerEvents="box-none">
          {isFallingNoteActive && currentSong ? (
            <View style={styles.fallingModeLayout} pointerEvents="box-none">
              <View
                style={styles.fallingTrackArea}
                pointerEvents="none"
                onLayout={(event) => {
                  const nextWidth = event.nativeEvent.layout.width;
                  setFallingTrackWidth(prev => Math.abs(prev - nextWidth) < 0.5 ? prev : nextWidth);
                }}
              >
                <FallingNoteTrack
                  song={currentSong}
                  bpm={activeFallingBpm}
                  onNoteSchedule={handleNoteSchedule}
                  onNoteHit={handleTrackNoteHit}
                  onSongEnd={handleSongEnd}
                  hitNoteIds={hitNoteIds}
                  missNoteIds={missNoteIds}
                  judgmentPulseKey={judgmentPulseKey}
                  missPulseKey={missPulseKey}
                  onTrackMetrics={handleTrackMetrics}
                  dynamicWhiteKeyWidth={dynamicWhiteKeyWidth}
                  laneStartX={0}
                  isPlaying={isFallingNoteActive && previewCount === null}
                />
              </View>

              <View style={styles.fallingKeyboardArea} pointerEvents="box-none">
                <View style={[styles.pianoContainer, styles.fallingPianoContainer]} pointerEvents="box-none">
                  <View style={styles.pianoWrapper} pointerEvents="box-none">
                    {renderPianoViewportRow(
                      pianoNotes,
                      pianoVisibleNoteSet,
                      activeNotes,
                      handlers,
                      dynamicStyles,
                      KEYBOARD_ENABLED,
                      pianoViewportStartIdx,
                      pianoViewportSize
                    )}
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <>
              {!isFixedViewport && (
                <View style={styles.octaveController}>
                  <Animated.View style={{
                    opacity: leftArrowOpacity,
                    transform: [{ translateX: leftArrowTranslateX }]
                  }}>
                    <TouchableOpacity
                      style={[
                        styles.octaveBtn,
                        viewportStartIdx === 0 && styles.octaveBtnDisabled,
                        (isTraining && currentNote && (whiteIdxRefById.get(currentNote) ?? 0) < viewportStartIdx && difficulty === '4단계') && styles.octaveBtnHighlight
                      ]}
                      onPress={handleShiftLeft}
                      disabled={viewportStartIdx === 0}
                    >
                      <Ionicons name="chevron-back" size={24} color="#fff" />
                      <Text style={styles.octaveBtnText}>옥타브 낮춤</Text>
                    </TouchableOpacity>
                  </Animated.View>

                  {/* 중앙 미니 피아노 맵 배치 */}
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <MiniKeyboardMap
                      viewportStartIdx={currentStartIdx}
                      setViewportStartIdx={setViewportStartIdx}
                      currentNote={currentNote}
                      isTraining={isTraining}
                      viewportSize={VIEWPORT_SIZE}
                    />
                  </View>

                  <Animated.View style={{
                    opacity: rightArrowOpacity,
                    transform: [{ translateX: rightArrowTranslateX }]
                  }}>
                    <TouchableOpacity
                      style={[
                        styles.octaveBtn,
                        viewportStartIdx === 14 && styles.octaveBtnDisabled,
                        (isTraining && currentNote && (whiteIdxRefById.get(currentNote) ?? 0) >= viewportStartIdx + VIEWPORT_SIZE && difficulty === '4단계') && styles.octaveBtnHighlight
                      ]}
                      onPress={handleShiftRight}
                      disabled={viewportStartIdx === 14}
                    >
                      <Text style={styles.octaveBtnText}>옥타브 높임</Text>
                      <Ionicons name="chevron-forward" size={24} color="#fff" />
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              )}

              <View style={styles.pianoContainer} pointerEvents="box-none">
                <View style={styles.pianoWrapper} pointerEvents="box-none">
                  {renderPianoViewportRow(
                    pianoNotes,
                    pianoVisibleNoteSet,
                    activeNotes,
                    handlers,
                    dynamicStyles,
                    KEYBOARD_ENABLED,
                    pianoViewportStartIdx,
                    pianoViewportSize
                  )}
                </View>
              </View>
            </>
          )}
        </View>

        {/* 하단 미션 제어반 */}
        <View style={[styles.trainingContainer, shouldUseFallingBottomPanel && styles.fallingTrainingContainer]}>
          {/* 왼쪽 영역: 점수 및 피드백 */}
          {!shouldUseFallingBottomPanel && (
            <View style={styles.infoSection}>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreText}>점수: {score}</Text>
              </View>
              <Text style={styles.feedbackText}>{feedback}</Text>
              {SHOW_ANSWER_HINT && isTraining && currentNote && (
                <Text style={styles.hintText}>★ 정답: {currentNote}</Text>
              )}
            </View>
          )}

          {/* 중앙 영역: 무작위 난이도 / 낙하노트 곡 선택 */}
          <View style={styles.fallingPickerSection}>
            {mode === 'random' && (
              <View style={styles.difficultyContainer}>
                {difficultyLevels.map(({ name, label }) => (
                  <TouchableOpacity
                    key={name}
                    style={[styles.difficultyButton, difficulty === name && styles.difficultyButtonActive]}
                    onPress={() => handleDifficultyChange(name)}
                  >
                    <Text style={styles.difficultyButtonText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {!isTraining && !isFallingResultVisible && !showFallingReplayPrompt && (
              <>
                <View style={styles.scaleToggleRow}>
                  {(['penta5', 'white8'] as SongScale[]).map(scale => (
                    <TouchableOpacity
                      key={scale}
                      style={[styles.scaleToggleButton, selectedSongScale === scale && styles.scaleToggleButtonActive]}
                      onPress={() => handleSelectSongScale(scale)}
                    >
                      <Text style={styles.scaleToggleText}>{fallingScaleLabels[scale]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.scaleToggleRow}>
                  {(['normal', 'slow'] as FallingTempoMode[]).map(tempoMode => (
                    <TouchableOpacity
                      key={tempoMode}
                      style={[styles.scaleToggleButton, selectedTempoMode === tempoMode && styles.scaleToggleButtonActive]}
                      onPress={() => setSelectedTempoMode(tempoMode)}
                    >
                      <Text style={styles.scaleToggleText}>{fallingTempoLabels[tempoMode]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.songPickerRow}>
                  {availableFallingSongs.map(song => (
                    <TouchableOpacity
                      key={song.id}
                      style={[styles.songPickerButton, selectedFallingSong?.id === song.id && styles.songPickerButtonActive]}
                      onPress={() => setSelectedSongId(song.id)}
                    >
                      <Text style={styles.songPickerText}>{song.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>

          {/* 오른쪽 영역: 훈련 액션 */}
          <View style={styles.actionSection}>
            {!isTraining && !showFallingReplayPrompt && !isFallingResultVisible && (
              <TouchableOpacity
                style={styles.trainingButton}
                onPress={() => startFallingNoteMode()}
              >
                <Text style={styles.buttonText}>연주 시작</Text>
              </TouchableOpacity>
            )}
            {(isTraining || (!showFallingReplayPrompt && !isFallingResultVisible)) && (
              <TouchableOpacity
                style={[styles.trainingButton, isTraining && styles.trainingButtonActive]}
                onPress={isTraining ? stopTraining : startTraining}
              >
                <Text style={styles.buttonText}>{isTraining ? '훈련 종료' : '훈련 모드'}</Text>
              </TouchableOpacity>
            )}
            {isTraining && !isFallingNoteActive && (
              <TouchableOpacity
                style={[styles.repeatButton, !currentNote && { backgroundColor: '#007BFF' }]}
                onPress={currentNote ? repeatSound : playNextQuestion}
              >
                <Text style={styles.buttonText}>{currentNote ? '다시 듣기' : '문제 재생'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* 미션 성공 오버레이 (터치 차단 포함) */}
      {showMissionSuccess && (
        <View style={styles.missionOverlay}>
          <View style={styles.missionOverlayBox}>
            <Text style={styles.missionOverlayText}>★ 미션 성공! ★</Text>
            <Text style={styles.missionOverlaySubText}>자유롭게 계속 도전해보세요!</Text>
          </View>
        </View>
      )}

      {isFallingNoteActive && previewCount !== null && (
        <View style={styles.previewOverlay} pointerEvents="none">
          <Text style={styles.previewText}>{previewCount === 0 ? 'Start' : previewCount}</Text>
        </View>
      )}

      {showFallingReplayPrompt && lastFallingResult && !fallingResult && (
        <FallingReplayPrompt
          result={lastFallingResult}
          onReplay={replayFallingSong}
          onShowResult={showLastFallingResult}
        />
      )}

      {fallingResult && !isTraining && (
        <FallingResultOverlay
          result={fallingResult}
          accuracy={fallingResultAccuracy}
          hits={fallingResultHits}
          misses={fallingResultMisses}
          onClose={closeFallingResult}
        />
      )}

      {/* 3. Ripple Effect Layer / Particle Visualizer (가장 상위 레이어 zIndex: 99 강제 배치) */}
      <View style={styles.rippleContainer} pointerEvents="none">
        {VISUALIZER_MODE === 'particle' ? (
          <ParticleVisualizer
            touchX={touchX}
            touchY={touchY}
            triggerTime={triggerTime}
            particleCount={20}
            particleSizeScale={isFallingNoteActive ? 0.85 : 1}
            particleSpeedScale={isFallingNoteActive ? 0.85 : 1}
            maxParticles={isFallingNoteActive ? 80 : 120}
          />
        ) : (
          <RippleLayer touchX={touchX} touchY={touchY} rippleProgress={rippleProgress} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#000',
    flexDirection: 'column',
  },
  midgroundLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
    zIndex: 2,
  },
  trainingContainer: {
    width: '100%',
    height: 96,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(34, 34, 34, 0.85)',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  fallingTrainingContainer: {
    height: 56,
    paddingVertical: 5,
  },
  infoSection: {
    flex: 1.2,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  hintText: {
    color: '#FF453A',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  fallingPickerSection: {
    flex: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSection: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  repeatButton: {
    backgroundColor: '#34C759',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pianoArea: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 10,
  },
  fallingModeLayout: {
    flex: 1,
    width: '100%',
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  fallingTrackArea: {
    flex: 1,
    width: '100%',
    marginBottom: 6,
    minHeight: 0,
    overflow: 'hidden',
  },
  fallingKeyboardArea: {
    width: '100%',
    justifyContent: 'center',
    paddingTop: 2,
    paddingBottom: 6,
    flexShrink: 0,
    zIndex: 12,
    elevation: 12,
  },
  octaveController: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '95%',
    backgroundColor: 'rgba(41, 41, 41, 0.8)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  octaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007BFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  octaveBtnHighlight: {
    backgroundColor: '#00e5ff',
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  octaveBtnDisabled: {
    backgroundColor: '#555',
    opacity: 0.5,
  },
  octaveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginHorizontal: 4,
  },
  difficultyContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 5,
  },
  difficultyButton: {
    backgroundColor: '#555',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginHorizontal: 3,
  },
  difficultyButtonActive: {
    backgroundColor: '#007BFF',
  },
  difficultyButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  scaleToggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 5,
  },
  scaleToggleButton: {
    backgroundColor: '#444',
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginHorizontal: 3,
  },
  scaleToggleButtonActive: {
    backgroundColor: '#007BFF',
  },
  scaleToggleText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  songPickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  songPickerButton: {
    backgroundColor: '#333',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  songPickerButtonActive: {
    borderColor: '#00e5ff',
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
  },
  songPickerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  pianoContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  fallingPianoContainer: {
    flex: 0,
    paddingHorizontal: 0,
  },
  pianoWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContainer: {
    flexDirection: 'row',
    position: 'relative',
    marginVertical: 8,
  },
  trainingButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainingButtonActive: {
    backgroundColor: '#FF3B30',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  feedbackText: {
    fontSize: 15,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 2,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  whiteKey: {
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: 'white',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 15,
    // 2.5D 입체감 그림자
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 4,
    elevation: 10,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  blackKey: {
    position: 'absolute',
    backgroundColor: 'black',
    borderRadius: 4,
    zIndex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 12,
    // 2.5D 입체감 그림자
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 5,
    elevation: 15,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  keyTextLabel: {
    fontSize: 14,
    color: '#555',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  blackKeyTextLabel: {
    fontSize: 11,
    color: '#bbb',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  whiteKeyLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
  },
  blackKeyLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
  },
  whiteKeyDisabled: {
    backgroundColor: '#666',
    borderColor: '#444',
    opacity: 0.25,
  },
  keyDisabled: {
    opacity: 0.25,
  },
  keyLabelDisabled: {
    color: '#555',
  },
  rippleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
    elevation: 99,
  },
  missionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 96, // 하단 제어반(96px)을 제외한 피아노 영역 전체를 커버하여 터치 차단
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 90,
  },
  missionOverlayBox: {
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#00e5ff',
    alignItems: 'center',
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  missionOverlayText: {
    color: '#00e5ff',
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  missionOverlaySubText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 96,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 95,
  },
  previewText: {
    color: '#00e5ff',
    fontSize: 54,
    fontWeight: '900',
    textShadowColor: '#00e5ff',
    textShadowRadius: 14,
  },
});
