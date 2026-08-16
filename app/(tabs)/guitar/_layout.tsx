import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer } from 'expo-audio';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  ActivityIndicator
} from 'react-native';
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
        soundCache.current[note] = player;

        // 죽은 플레이어는 예외도 로그도 없이 무음이 된다. 유일한 통보 경로가 이 이벤트다.
        try {
          player.addListener('playbackStatusUpdate', (status: any) => {
            if (status?.error) console.warn(`[audio] '${note}' 재생 에러:`, status.error);
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

  const handleNotePress = (note: GuitarNote) => {
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
      starContext?.addStar(`guitar_${difficulty}`);
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
        {strings.map((str, idx) => (
          <View key={idx} style={styles.stringRow}>
            <Text style={styles.stringName}>{str.name}</Text>
            <View style={styles.fretContainer}>
              <View style={[styles.stringLine, { height: 1.2 + idx * 0.5 }]} />
              {str.notes.map(note => {
                const isVisible = visibleNoteSet.has(note as GuitarNote);
                return (
                  <TouchableOpacity 
                    key={note} 
                    disabled={!isVisible}
                    style={[styles.fret, !isVisible && styles.fretDisabled]}
                    onPressIn={() => handleNotePress(note as GuitarNote)}
                  >
                    <Text style={[styles.fretText, !isVisible && styles.textDisabled]}>{note}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    );
  };

  if (!isReady) return <ActivityIndicator size="large" style={{flex:1}} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.sidebar}>
        <Text style={styles.scoreText}>SCORE: {score}</Text>
        <TouchableOpacity style={styles.mainBtn} onPress={isTraining ? stopTraining : startTraining}>
          <Text style={styles.btnText}>{isTraining ? '종료' : '훈련 시작'}</Text>
        </TouchableOpacity>
        {isTraining && (
            <TouchableOpacity style={styles.repeatBtn} onPress={() => {setRepeatCount(r=>r+1); playSound(currentNote!)}}>
                <Text style={styles.btnText}>다시 듣기</Text>
            </TouchableOpacity>
        )}
        <View style={styles.diffList}>
          {['1단계','2단계','3단계','4단계'].map(d => (
            <TouchableOpacity key={d} style={[styles.diffBtn, difficulty === d && styles.diffActive]} onPress={() => setDifficulty(d)} disabled={isTraining}>
              <Text style={styles.diffText}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.feedback}>{feedback}</Text>
      </View>

      <View style={styles.fretboardArea}>{renderGuitarStrings()}</View>

      <View style={styles.missionWrapper} pointerEvents="box-none">
        <MissionProgressIcon
          gameId="guitar"
          title="기타 미션"
          missionText="난이도별 누적 3회 성공"
          clearText="최고 점수 5점 달성"
          progressItems={['1단계','2단계','3단계','4단계'].map(d => ({
            label: `${d} (${starContext?.starData[`guitar_${d}`] ? '★' : '☆'})`,
            value: `누적 ${progress[d]?.cumulativeSuccesses || 0} / 최고 ${progress[d]?.highestScore || 0}`
          }))}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a120b', flexDirection: 'row' },
  sidebar: { width: 170, backgroundColor: '#3c2a21', padding: 15, alignItems: 'center', borderRightWidth: 2, borderRightColor: '#d4a373' },
  scoreText: { fontSize: 22, fontWeight: 'bold', color: '#e5e5e5', marginBottom: 15 },
  mainBtn: { backgroundColor: '#d4a373', padding: 12, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 8 },
  repeatBtn: { backgroundColor: '#8b5e3c', padding: 10, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 8 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  diffList: { flexDirection: 'column', width: '100%', gap: 4, marginTop: 10 },
  diffBtn: { backgroundColor: '#4f3422', padding: 6, borderRadius: 5, alignItems: 'center' },
  diffActive: { backgroundColor: '#d4a373' },
  diffText: { color: '#fff', fontSize: 11 },
  feedback: { marginTop: 15, color: '#faedcd', fontWeight: 'bold', textAlign: 'center', fontSize: 12 },
  fretboardArea: { flex: 1, paddingTop: 30, paddingBottom: 10, paddingHorizontal: 10 },
  fretboardContainer: { flex: 1, flexDirection: 'column' },
  stringRow: { flex: 1, flexDirection: 'row', alignItems: 'center', position: 'relative' },
  stringName: { width: 75, color: '#d4a373', fontWeight: 'bold', zIndex: 1, fontSize: 12, textAlign: 'center' },
  fretContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', zIndex: 1, position: 'relative' },
  stringLine: { position: 'absolute', left: 0, right: 0, top: '50%', backgroundColor: '#c5c5c5', zIndex: 0 },
  fret: { width: '22%', height: '80%', backgroundColor: '#2d2016', borderRadius: 6, borderWidth: 1, borderColor: '#5f4339', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  fretDisabled: { backgroundColor: '#221a14', opacity: 0.15, borderColor: '#332211' },
  fretText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  textDisabled: { color: '#444' },
  missionWrapper: { position: 'absolute', top: 10, right: 20, zIndex: 999 },
});