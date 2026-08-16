import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer } from 'expo-audio';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import MissionProgressIcon from '../../../components/MissionProgressIcon';
import { useStopAudioOnBlur } from '../../../hooks/useStopAudioOnBlur';
import { ClearContext } from '../../../context/ClearContext';
import { StarContext } from '../../../context/StarContext';
import { useSyncGameData } from '../../../hooks/useSyncGameData';

// 1. 기타용 노트 타입 정의 (총 28개)
type GuitarNote = 
  | 'E2' | 'F2' | 'F#2' | 'G2' | 'G#2' | 'A2' | 'A#2' | 'B2'
  | 'C3' | 'C#3' | 'D3' | 'D#3' | 'E3' | 'F3' | 'F#3' | 'G3' | 'G#3' | 'A3' | 'A#3' | 'B3'
  | 'C4' | 'C#4' | 'D4' | 'D#4' | 'E4' | 'F4' | 'F#4' | 'G4';

const guitarSounds: { [key in GuitarNote]: any } = {
  'E2': require('../../../assets/sounds/guitar/E2.m4a'), 'F2': require('../../../assets/sounds/guitar/F2.m4a'),
  'F#2': require('../../../assets/sounds/guitar/F_sharp2.m4a'), 'G2': require('../../../assets/sounds/guitar/G2.m4a'),
  'G#2': require('../../../assets/sounds/guitar/G_sharp2.m4a'), 'A2': require('../../../assets/sounds/guitar/A2.m4a'),
  'A#2': require('../../../assets/sounds/guitar/A_sharp2.m4a'), 'B2': require('../../../assets/sounds/guitar/B2.m4a'),
  'C3': require('../../../assets/sounds/guitar/C3.m4a'), 'C#3': require('../../../assets/sounds/guitar/C_sharp3.m4a'),
  'D3': require('../../../assets/sounds/guitar/D3.m4a'), 'D#3': require('../../../assets/sounds/guitar/D_sharp3.m4a'),
  'E3': require('../../../assets/sounds/guitar/E3.m4a'), 'F3': require('../../../assets/sounds/guitar/F3.m4a'),
  'F#3': require('../../../assets/sounds/guitar/F_sharp3.m4a'), 'G3': require('../../../assets/sounds/guitar/G3.m4a'),
  'G#3': require('../../../assets/sounds/guitar/G_sharp3.m4a'), 'A3': require('../../../assets/sounds/guitar/A3.m4a'),
  'A#3': require('../../../assets/sounds/guitar/A_sharp3.m4a'), 'B3': require('../../../assets/sounds/guitar/B3.m4a'),
  'C4': require('../../../assets/sounds/guitar/C4.m4a'), 'C#4': require('../../../assets/sounds/guitar/C_sharp4.m4a'),
  'D4': require('../../../assets/sounds/guitar/D4.m4a'), 'D#4': require('../../../assets/sounds/guitar/D_sharp4.m4a'),
  'E4': require('../../../assets/sounds/guitar/E4.m4a'), 'F4': require('../../../assets/sounds/guitar/F4.m4a'),
  'F#4': require('../../../assets/sounds/guitar/F_sharp4.m4a'), 'G4': require('../../../assets/sounds/guitar/G4.m4a'),
};

const GUITAR_PROGRESS_KEY = '@MiniGameApp:guitarProgress';

/**
 * 상주시킬 기타 플레이어 수. 피아노(`MusicTrainingScreen`)와 같은 이유·같은 값이다.
 *
 * 안드로이드는 앱당 동시 AudioTrack을 약 40개로 제한하고, `createAudioPlayer`는 만드는
 * 즉시 트랙을 잡는다. 28개를 미리 만들면 앱 전체 한도에 걸려 **만들어지자마자 죽는다.**
 * 배경 상주(동물 12 · 단어 8 · 드럼 5 · 냉장고 1 = 26)를 빼면 이 화면 몫은 14 안팎이다.
 *
 * 근거·다른 방향: `doc/audio-무음-원인과-방향.md`
 */
const CACHE_LIMIT = 12;

/**
 * 줄 이름('1번줄(E)') 칸 폭. 지판 나무판·너트를 이 값만큼 오른쪽에서 시작시킨다.
 * 이름이 한 줄에 들어가야 하므로 오른쪽 여백(10)까지 감안해 잡은 값이다.
 */
const NAME_COL_WIDTH = 84;

/** 프렛을 눌렀을 때 밝게 빛나는 시간(ms). 소리 어택 정도만 짧게 */
const FRET_FLASH_MS = 260;

/**
 * 프렛 와이어를 그릴 가로 위치. 칸은 `justifyContent:'space-around'`로 4등분되므로
 * 칸 경계는 정확히 25 / 50 / 75%다.
 */
const FRET_WIRE_POSITIONS = ['25%', '50%', '75%'] as const;

/**
 * 우상단 미션 '?' 아이콘이 차지하는 폭(아이콘 32 + 좌우 패딩 8씩 + 여유).
 * 아이콘은 화면 기준 absolute라 지판이 그 밑으로 들어가면 1번줄 마지막 칸과 겹친다.
 */
const MISSION_ICON_CLEARANCE = 52;

/**
 * 좌측 패널을 **압축 모드**로 바꾸는 높이(dp). 실제로 측정된 패널 높이가 이보다 작으면
 * SCORE·버튼의 세로를 줄여 난이도 버튼 몫을 벌어 준다.
 *
 * 근거: 압축 전 고정비는 약 219dp(패딩 16 + SCORE 57 + 훈련 버튼 42 + 다시 듣기 36 +
 * 피드백 38 + 난이도 라벨 18 + 버튼 간격 12)라, 난이도 버튼 하나가 글자(13px)와 테두리를
 * 담는 최소 높이 약 19dp를 확보하려면 패널이 295dp는 돼야 한다. 여유를 둬 320으로 잡았다.
 * 가로 시 화면 세로가 약 380dp 미만인 기기(구형 소형 안드로이드·iPhone SE급)가 여기 걸린다.
 */
const COMPACT_PANEL_HEIGHT = 320;

export default function Guitar() {
  const [isReady, setIsReady] = useState(false);
  const [activeNotes, setActiveNotes] = useState<{ [key in GuitarNote]?: boolean }>({});
  const [isTraining, setIsTraining] = useState(false);
  const [currentNote, setCurrentNote] = useState<GuitarNote | null>(null);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [difficulty, setDifficulty] = useState('1단계');
  const [progress, setProgress] = useState<any>({});

  // 최대 CACHE_LIMIT개. 맨 앞이 가장 최근에 낸 음이다
  const soundCache = useRef<{ [key in GuitarNote]?: any }>({});
  const recentlyUsedNotes = useRef<GuitarNote[]>([]);

  // 프렛 누름 하이라이트를 끄는 타이머. 같은 음을 연타하면 앞 타이머를 취소하고 다시 건다
  const flashTimers = useRef<{ [key in GuitarNote]?: ReturnType<typeof setTimeout> }>({});

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  /** 가로 화면 좌측 패널 폭. 좁은 기기에서 지판을 너무 먹지 않도록 화면 폭에 비례시키고 상하한을 둔다 */
  const sidebarWidth = Math.round(Math.min(200, Math.max(150, windowWidth * 0.22)));
  /** 프렛 글자 크기. 6줄이 세로를 나눠 쓰므로 화면 높이를 기준으로 잡는다 */
  const fretFontSize = Math.round(Math.max(12, Math.min(18, windowHeight * 0.042)));

  /**
   * 패널에 실제로 주어진 세로. `windowHeight`에서 탭바(64 + insets.bottom)를 빼서 추정할 수도
   * 있지만, 그러면 `app/(tabs)/_layout.tsx`의 탭바 높이를 여기에 베껴 두게 된다.
   * 측정값을 쓰면 탭바·인셋이 바뀌어도 따라온다. 압축 여부는 레이아웃에 영향을 주지 않으므로
   * (패널 높이는 부모가 정한다) 측정 → 재렌더가 되풀이되지 않는다.
   */
  const [panelHeight, setPanelHeight] = useState(0);
  const isCompactPanel = panelHeight > 0 && panelHeight < COMPACT_PANEL_HEIGHT;

  const { syncData } = useSyncGameData();
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [repeatCount, setRepeatCount] = useState(0);
  const [sessionLog, setSessionLog] = useState<any[]>([]);

  const starContext = useContext(StarContext);
  const clearContext = useContext(ClearContext);
  const isFocused = useIsFocused();

  // 1. 초기화 (오디오 모드 및 화면 방향)
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        // 오디오 모드는 `AudioManagerProvider`가 앱 시작 시 1회 설정한다(4-B에서 일원화).
        const saved = await AsyncStorage.getItem(GUITAR_PROGRESS_KEY);
        if (saved && isMounted) setProgress(JSON.parse(saved));
      } finally {
        if (isMounted) setIsReady(true);
      }
    }
    init();

    return () => {
      isMounted = false;
      // 사운드 해제
      for (const player of Object.values(soundCache.current)) {
        player?.remove();
      }
      soundCache.current = {};
      recentlyUsedNotes.current = [];
      // 하이라이트 타이머가 언마운트 뒤에 setState를 부르지 않도록 정리
      for (const timer of Object.values(flashTimers.current)) {
        if (timer) clearTimeout(timer);
      }
      flashTimers.current = {};
    };
  }, []);

  useEffect(() => {
    const changeOrientation = async () => {
      if (isFocused) {
        // 기타 화면을 보고 있을 때만 가로
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else {
        // 다른 탭으로 나가는 순간 세로로 복구
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    };

    changeOrientation().catch(err => console.log(err));
  }, [isFocused]);

  useEffect(() => {
    if (Object.keys(progress).length > 0) {
      AsyncStorage.setItem(GUITAR_PROGRESS_KEY, JSON.stringify(progress));
    }
  }, [progress]);

  /**
   * 🎸 탭을 떠날 때 기타 소리를 끊고 **플레이어를 해제한다.**
   * 탭은 언마운트되지 않으므로 언마운트 클린업은 탭 전환 때 실행되지 않는다.
   *
   * 이전에는 `pause()`만 하고 캐시를 남겼다. 그런데 `pause()`는 소리만 멈추고
   * **AudioTrack은 계속 붙잡는다.** 기타를 다녀오면 피아노·단어가 앱 전체 한도에 걸렸다.
   * 자리를 돌려주려면 해제해야 한다. 재진입 첫 음 지연은 그 대가다.
   */
  const isScreenFocused = useStopAudioOnBlur(() => {
    for (const player of Object.values(soundCache.current)) {
      try {
        player?.remove();
      } catch (e) { }
    }
    soundCache.current = {};
    recentlyUsedNotes.current = [];
  });

  /**
   * 가장 오래 안 쓴 음부터 플레이어를 해제해 AudioTrack을 돌려준다.
   * **울리는 중인 음은 건너뛴다** — 해제하면 나던 소리가 끊긴다. 해제에 성공하면 true.
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

  // 2. 사운드 재생 (expo-audio 방식: 폴리포니 지원)
  const playSound = async (note: GuitarNote) => {
    // 정답을 맞히면 1.2초 뒤에 다음 문제음이 예약된다(:224). 그 사이에 탭을 떠났다면
    // 다른 탭에서 기타 소리가 울리므로 재생하지 않는다. (문제 출제 흐름 자체는 그대로 두고
    // 소리만 내지 않는다 — 돌아와서 '다시 듣기'를 누르면 들린다)
    if (!isScreenFocused.current) return;

    try {
      let player = soundCache.current[note];
      if (!player) {
        // 만드는 순간 AudioTrack을 잡으므로 **만들기 전에** 자리를 비운다
        while (recentlyUsedNotes.current.length >= CACHE_LIMIT) {
          if (!evictLeastRecentlyUsedNote()) break;
        }
        player = createAudioPlayer(guitarSounds[note]);
        const createdPlayer = player;
        soundCache.current[note] = createdPlayer;

        // 죽은 플레이어는 예외도 로그도 없이 무음이 된다. 유일한 통보 경로가 이 이벤트다.
        //
        // 알리기만 하면 **죽은 플레이어가 캐시에 남는다.** 다음 터치도 같은 플레이어를
        // 재사용하므로 그 음은 계속 무음이다 — 탭을 나갔다 오거나(`useStopAudioOnBlur`)
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

      // 방금 낸 음을 맨 앞으로 (맨 뒤가 가장 오래 안 쓴 음 = 축출 대상)
      recentlyUsedNotes.current = recentlyUsedNotes.current.filter(n => n !== note);
      recentlyUsedNotes.current.unshift(note);

      // 탭을 떠날 때 pause()만 하면 currentTime이 0이어도 play()가 무음이 된다.
      // 동물게임과 같이 항상 되감은 뒤 재생한다.
      await player.seekTo(0);
      if (!isScreenFocused.current) return;
      player.play();
    } catch (error) {
      console.log(`재생 실패: ${note}`, error);
    }
  };

  const getVisibleNoteSet = useCallback((level: string) => {
    const allNotesList = Object.keys(guitarSounds) as GuitarNote[];
    switch (level) {
      case '1단계': return new Set(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
      case '2단계': return new Set(allNotesList.filter(n => !n.includes('#')));
      case '3단계': return new Set(allNotesList.slice(0, 18));
      case '4단계': return new Set(allNotesList);
      default: return new Set(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    }
  }, []);

  const playNextQuestion = useCallback(() => {
    const visibleNotes = Array.from(getVisibleNoteSet(difficulty)) as GuitarNote[];
    const randomNote = visibleNotes[Math.floor(Math.random() * visibleNotes.length)];
    setCurrentNote(randomNote);
    setRepeatCount(0);
    playSound(randomNote).then(() => setQuestionStartTime(Date.now()));
  }, [difficulty, getVisibleNoteSet]);

  const startTraining = () => {
    setIsTraining(true);
    setScore(0);
    setSessionLog([]);
    setFeedback('훈련 시작!');
    playNextQuestion();
  };

  // ✅ 데이터 전송 로직이 포함된 stopTraining
  const stopTraining = () => {
    if (isTraining && sessionLog.length > 0) {
      const correctCount = sessionLog.filter(l => l.is_correct).length;
      const payload = {
        difficulty_level: difficulty,
        total_attempts: sessionLog.length,
        correct_count: correctCount,
        accuracy_rate: parseFloat(((correctCount / sessionLog.length) * 100).toFixed(1)),
        detailed_logs: sessionLog
      };
      console.log("🚀 [의료 데이터 전송] guitar:", payload);
      syncData('guitar', payload);
    }
    
    setIsTraining(false);
    setCurrentNote(null);
    setFeedback('');
  };

  /**
   * 누른 프렛을 잠깐 밝게 만든다. **사용자가 누른 프렛에만** 건다 —
   * 문제 출제(`playNextQuestion`)나 '다시 듣기'에 걸면 정답 위치가 그대로 노출된다.
   */
  const flashFret = (note: GuitarNote) => {
    setActiveNotes(prev => ({ ...prev, [note]: true }));
    const previousTimer = flashTimers.current[note];
    if (previousTimer) clearTimeout(previousTimer);
    flashTimers.current[note] = setTimeout(() => {
      delete flashTimers.current[note];
      setActiveNotes(prev => {
        const next = { ...prev };
        delete next[note];
        return next;
      });
    }, FRET_FLASH_MS);
  };

  const handleNotePress = (note: GuitarNote) => {
    flashFret(note);
    playSound(note);
    if (!isTraining || !currentNote) return;

    const isCorrect = note === currentNote;
    const responseTime = (Date.now() - (questionStartTime || 0)) / 1000;

    setSessionLog(prev => [...prev, {
      target_note: currentNote,
      selected_note: note,
      is_correct: isCorrect,
      response_time_seconds: parseFloat(responseTime.toFixed(2)),
      repeat_listens: repeatCount
    }]);

    if (isCorrect) {
      const newScore = score + 1;
      setScore(newScore);
      const currentProgress = progress[difficulty] || { cumulativeSuccesses: 0, highestScore: 0 };
      const newCumulativeSuccesses = currentProgress.cumulativeSuccesses + 1;
      setProgress({
        ...progress,
        [difficulty]: {
          cumulativeSuccesses: newCumulativeSuccesses,
          highestScore: Math.max(currentProgress.highestScore, newScore),
        }
      });
      // 미션 모달의 안내('난이도별 누적 3회 성공')와 같은 조건. 피아노(`MusicTrainingScreen`)와 동일하다
      if (newCumulativeSuccesses >= 3) starContext?.addStar(`guitar_${difficulty}`);
      if (newScore >= 5) clearContext?.markAsCleared(`guitar_${difficulty}`);
      setFeedback('정답입니다! 🎸');
      setTimeout(playNextQuestion, 1200);
    } else {
      setFeedback('틀렸습니다! 다시 들어보세요.');
      setQuestionStartTime(Date.now());
    }
  };

  const renderGuitarStrings = () => {
    const visibleNoteSet = getVisibleNoteSet(difficulty);
    const strings = [
      { name: '1번줄(E)', notes: ['E4', 'F4', 'F#4', 'G4'] },
      { name: '2번줄(B)', notes: ['B3', 'C4', 'C#4', 'D4'] },
      { name: '3번줄(G)', notes: ['G3', 'G#3', 'A3', 'A#3'] },
      { name: '4번줄(D)', notes: ['D3', 'D#3', 'E3', 'F3'] },
      { name: '5번줄(A)', notes: ['A2', 'A#2', 'B2', 'C3'] },
      { name: '6번줄(E)', notes: ['E2', 'F2', 'F#2', 'G2'] },
    ];

    return (
      <View style={styles.fretboardContainer}>
        {/* 지판 나무판. 줄 이름 칸 오른쪽부터 6줄 전체를 한 판으로 덮는다(행마다 그리면 모서리가 끊김) */}
        <View style={[styles.woodPanel, { left: NAME_COL_WIDTH }]} pointerEvents="none" />

        {strings.map((str, idx) => (
          <View key={idx} style={styles.stringRow}>
            <View style={styles.stringNameCell}>
              <Text style={styles.stringName} numberOfLines={1}>{str.name}</Text>
            </View>
            <View style={styles.fretContainer}>
              {/* 프렛 와이어. 칸 경계(25/50/75%)에 세로선을 두면 행마다 그려도 위아래로 이어져 한 줄로 보인다 */}
              {FRET_WIRE_POSITIONS.map(x => (
                <View key={x} style={[styles.fretWire, { left: x }]} pointerEvents="none" />
              ))}
              <View style={[styles.stringLine, { height: 1.2 + idx * 0.5 }]} />
              {str.notes.map(note => {
                const isVisible = visibleNoteSet.has(note as GuitarNote);
                const isActive = !!activeNotes[note as GuitarNote];
                return (
                  <TouchableOpacity
                    key={note}
                    disabled={!isVisible}
                    activeOpacity={0.9}
                    style={[styles.fret, isActive && styles.fretActive, !isVisible && styles.fretDisabled]}
                    onPressIn={() => handleNotePress(note as GuitarNote)}
                  >
                    <Text style={[
                      styles.fretText,
                      { fontSize: fretFontSize },
                      isActive && styles.fretTextActive,
                      !isVisible && styles.textDisabled,
                    ]}>{note}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* 너트(0프렛): 지판 왼쪽 끝의 뼈색 바. 프렛 위에 그려야 하므로 행들보다 뒤에 렌더 */}
        <View style={[styles.nut, { left: NAME_COL_WIDTH }]} pointerEvents="none" />
      </View>
    );
  };

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d4a373" />
      </View>
    );
  }

  // 피드백 문구의 성격에 따라 색만 바꾼다(정답 초록 / 오답 붉은색 / 그 외 기본)
  const isCorrectFeedback = feedback.includes('정답');
  const isWrongFeedback = feedback.includes('틀렸');

  // 미션 모달의 '현재 진행 상황'. 별(★/☆)과 클리어(✓/✗)를 함께 보이는 피아노와 같은 형식이다
  const progressItems = ['1단계', '2단계', '3단계', '4단계'].map(d => {
    const levelProgress = progress[d] || { cumulativeSuccesses: 0, highestScore: 0 };
    const starStatus = starContext?.starData[`guitar_${d}`] ? '★' : '☆';
    const clearStatus = clearContext?.clearData[`guitar_${d}`] ? '✓' : '✗';
    return {
      label: `${d} (${starStatus}, ${clearStatus})`,
      value: `누적 ${levelProgress.cumulativeSuccesses}회 / 최고 ${levelProgress.highestScore}점`,
    };
  });

  return (
    <View style={[styles.container, { paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View
        style={[styles.sidebar, { width: sidebarWidth }, isCompactPanel && styles.sidebarCompact]}
        onLayout={e => setPanelHeight(e.nativeEvent.layout.height)}
      >


        <View style={[styles.scoreCard, isCompactPanel && styles.scoreCardCompact]}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={[styles.scoreValue, isCompactPanel && styles.scoreValueCompact]}>{score}</Text>
        </View>

        <TouchableOpacity
          style={[styles.mainBtn, isTraining && styles.mainBtnStop, isCompactPanel && styles.mainBtnCompact]}
          activeOpacity={0.85}
          onPress={isTraining ? stopTraining : startTraining}
        >
          <Text style={[styles.btnText, isTraining && styles.btnTextStop]}>
            {isTraining ? '훈련 종료' : '훈련 시작'}
          </Text>
        </TouchableOpacity>

        {isTraining && (
            <TouchableOpacity style={[styles.repeatBtn, isCompactPanel && styles.repeatBtnCompact]} activeOpacity={0.85} onPress={() => {setRepeatCount(r=>r+1); playSound(currentNote!)}}>
                <Text style={styles.repeatBtnText}>🔊 다시 듣기</Text>
            </TouchableOpacity>
        )}

        <View style={styles.diffSection}>
          <Text style={styles.sectionLabel}>난이도</Text>
          <View style={styles.diffList}>
            {['1단계','2단계','3단계','4단계'].map(d => {
              const isSelected = difficulty === d;
              return (
                <TouchableOpacity
                  key={d}
                  activeOpacity={0.85}
                  style={[styles.diffBtn, isSelected && styles.diffActive, isTraining && !isSelected && styles.diffLocked]}
                  onPress={() => setDifficulty(d)}
                  disabled={isTraining}
                >
                  <Text style={[styles.diffText, isSelected && styles.diffTextActive]}>{d}</Text>
                
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 문구가 없을 때도 자리를 비워 둬 버튼 위치가 흔들리지 않게 한다 */}
        <View style={[styles.feedbackSlot, isCompactPanel && styles.feedbackSlotCompact]}>
          {!!feedback && (
            <View style={[
              styles.feedbackBox,
              isCorrectFeedback && styles.feedbackBoxCorrect,
              isWrongFeedback && styles.feedbackBoxWrong,
            ]}>
              <Text style={[
                styles.feedbackText,
                isCorrectFeedback && styles.feedbackTextCorrect,
                isWrongFeedback && styles.feedbackTextWrong,
              ]}>{feedback}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.fretboardArea}>{renderGuitarStrings()}</View>

      {/* MissionProgressIcon 자체가 absolute다. 래퍼로 한 번 더 감싸면 좌표가 겹쳐 밀리므로 style로 위치만 준다 */}
      <MissionProgressIcon
        gameId="guitar"
        title="기타 미션"
        missionText="난이도별 누적 3회 성공"
        clearText="최고 점수 5점 달성"
        style={{ top: Math.max(10, insets.top), right: insets.right + 14 }}
        progressItems={progressItems}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#1a120b', justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#1a120b', flexDirection: 'row' },

  // ── 좌측 패널 ─────────────────────────────────────────────
  // 폭은 화면 폭에 따라 인라인으로 주입된다(sidebarWidth)
  // 가로 모드에서 쓸 수 있는 세로는 화면 높이에서 탭바(64 + insets.bottom)를 뺀 값이다.
  // 여기 있는 항목들의 세로 고정비 합이 그 값을 넘으면 맨 아래 피드백이 잘려 안 보인다.
  sidebar: { backgroundColor: '#3c2a21', paddingHorizontal: 12, paddingVertical: 8, borderRightWidth: 2, borderRightColor: '#d4a373' },
  /**
   * 짧은 패널(< COMPACT_PANEL_HEIGHT)에서만 덧씌우는 압축값들. 위 항목들의 세로를 합쳐
   * 약 25dp 줄여 그만큼을 난이도 버튼 4칸에 넘긴다. 색·모양은 건드리지 않는다.
   */
  sidebarCompact: { paddingVertical: 6 },

  scoreCard: { backgroundColor: '#2d2016', borderRadius: 10, borderWidth: 1, borderColor: '#5f4339', paddingVertical: 4, alignItems: 'center', marginBottom: 8 },
  scoreCardCompact: { paddingVertical: 2, marginBottom: 4 },
  scoreLabel: { color: '#a98467', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5 },
  scoreValue: { color: '#faedcd', fontSize: 22, lineHeight: 26, fontWeight: 'bold' },
  scoreValueCompact: { fontSize: 18, lineHeight: 21 },

  /** 주 버튼(훈련 시작). 밝은 앰버 = 이 화면에서 가장 먼저 누를 것 */
  mainBtn: { backgroundColor: '#d4a373', paddingVertical: 9, borderRadius: 10, alignItems: 'center', marginBottom: 6, elevation: 3 },
  mainBtnCompact: { paddingVertical: 7, marginBottom: 4 },
  /** 종료는 시작과 같은 자리에 오므로 색을 완전히 갈라 놔야 잘못 누르지 않는다 */
  mainBtnStop: { backgroundColor: '#7a4a3a', borderWidth: 1, borderColor: '#d4a373', elevation: 0 },
  btnText: { color: '#2d2016', fontWeight: 'bold', fontSize: 15 },
  btnTextStop: { color: '#faedcd' },

  /** 훈련 중에만 나타난다. 이 버튼이 늘어나는 만큼 아래 항목이 밀리므로 세로를 아낀다 */
  repeatBtn: { backgroundColor: '#8b5e3c', paddingVertical: 7, borderRadius: 10, alignItems: 'center', marginBottom: 6 },
  repeatBtnCompact: { paddingVertical: 6, marginBottom: 4 },
  repeatBtnText: { color: '#fff8ee', fontWeight: 'bold', fontSize: 13 },

  /**
   * 패널에서 **유일하게 늘고 주는 칸**(flex: 1). 남는 세로는 여기가 먹고,
   * 모자라면 여기가 줄어든다. 그래야 아래 피드백이 밖으로 밀려나지 않는다.
   */
  diffSection: { marginTop: 2, flex: 1, minHeight: 0 },
  sectionLabel: { color: '#a98467', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.2, marginBottom: 5, marginLeft: 2 },
  diffList: { flex: 1, flexDirection: 'column', gap: 4 },
  /** 4칸이 목록 높이를 나눠 갖는다. 넓은 기기에서 버튼만 커지지 않게 maxHeight로 막는다 */
  diffBtn: { flex: 1, maxHeight: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#4f3422', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#5f4339' },
  diffActive: { backgroundColor: '#d4a373', borderColor: '#f0d5b0' },
  /** 훈련 중에는 난이도를 못 바꾼다(disabled). 눌리지 않는다는 걸 흐리게 보여 준다 */
  diffLocked: { opacity: 0.45 },
  diffText: { color: '#e8d5c0', fontSize: 13, fontWeight: '600' },
  diffTextActive: { color: '#2d2016', fontWeight: 'bold' },

  /**
   * 패널 맨 아래 칸. 문구가 없어도 높이를 차지해 레이아웃이 안 튄다.
   *
   * 예전에는 `marginTop:'auto'`로 아래에 붙였는데, **남는 공간이 없으면 auto 마진은 0이 된다.**
   * 훈련을 켜면 '다시 듣기'가 끼어들어 패널이 화면보다 길어졌고, 이 칸이 패널 밖으로
   * 밀려나 잘렸다 — 피드백이 아예 안 보이던 원인이다. 지금은 위 `diffSection`(flex: 1)이
   * 남는 세로를 맡으므로 auto 마진 없이도 항상 맨 아래에 있고, 모자라도 밀려나지 않는다.
   */
  feedbackSlot: { minHeight: 38, justifyContent: 'center' },
  feedbackSlotCompact: { minHeight: 34 },
  feedbackBox: { backgroundColor: '#2d2016', borderRadius: 8, borderWidth: 1, borderColor: '#5f4339', paddingVertical: 7, paddingHorizontal: 6 },
  feedbackBoxCorrect: { backgroundColor: '#2c3a20', borderColor: '#5c7a3c' },
  feedbackBoxWrong: { backgroundColor: '#3a231c', borderColor: '#8a4a3a' },
  feedbackText: { color: '#faedcd', fontWeight: 'bold', textAlign: 'center', fontSize: 13 },
  feedbackTextCorrect: { color: '#c7e8a0' },
  feedbackTextWrong: { color: '#f3b0a0' },

  // ── 지판 ─────────────────────────────────────────────────
  // paddingRight는 우상단 '?' 아이콘 자리를 비워 두는 값(MISSION_ICON_CLEARANCE)
  fretboardArea: { flex: 1, paddingTop: 18, paddingBottom: 12, paddingLeft: 8, paddingRight: MISSION_ICON_CLEARANCE },
  fretboardContainer: { flex: 1, flexDirection: 'column', position: 'relative' },
  /** 6줄 뒤에 깔리는 나무판. left는 줄 이름 칸 폭만큼 인라인으로 주입된다 */
  woodPanel: { position: 'absolute', top: 0, right: 0, bottom: 0, backgroundColor: '#2a1c12', borderRadius: 10, borderWidth: 1, borderColor: '#5f4339', zIndex: 0 },
  /** 너트. 프렛 버튼(elevation 2)보다 위에 그려야 가려지지 않는다 */
  nut: { position: 'absolute', top: 0, bottom: 0, width: 5, backgroundColor: '#e8dcc0', borderRadius: 3, zIndex: 3, elevation: 3 },

  stringRow: { flex: 1, flexDirection: 'row', alignItems: 'center', position: 'relative', zIndex: 1 },
  stringNameCell: { width: NAME_COL_WIDTH, paddingRight: 10, justifyContent: 'center' },
  stringName: { color: '#d4a373', fontWeight: 'bold', fontSize: 11, textAlign: 'right' },
  fretContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', zIndex: 1, position: 'relative' },
  fretWire: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: '#7a6047', opacity: 0.75, zIndex: 0 },
  stringLine: { position: 'absolute', left: 0, right: 0, top: '50%', backgroundColor: '#c5c5c5', zIndex: 0 },

  fret: { width: '22%', height: '78%', backgroundColor: '#3a2a1c', borderRadius: 8, borderWidth: 1, borderColor: '#6b4a33', justifyContent: 'center', alignItems: 'center', elevation: 2, zIndex: 1 },
  /** 누른 순간(FRET_FLASH_MS 동안). 사이드바 주 버튼과 같은 앰버 = "지금 소리 난 자리" */
  fretActive: { backgroundColor: '#d4a373', borderColor: '#ffe6c4', borderWidth: 2, elevation: 6 },
  fretDisabled: { backgroundColor: '#241a12', opacity: 0.15, elevation: 0 },
  fretText: { color: '#f5e6d3', fontWeight: 'bold' },
  fretTextActive: { color: '#2d2016' },
  textDisabled: { color: '#6b5a4a' },
});