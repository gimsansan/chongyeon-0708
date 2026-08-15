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
import { useFocusEffect, useIsFocused } from 'expo-router';
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

export default function Guitar() {
  const [isReady, setIsReady] = useState(false);
  const [activeNotes, setActiveNotes] = useState<{ [key in GuitarNote]?: boolean }>({});
  const [isTraining, setIsTraining] = useState(false);
  const [currentNote, setCurrentNote] = useState<GuitarNote | null>(null);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [difficulty, setDifficulty] = useState('1단계');
  const [progress, setProgress] = useState<any>({});

  const soundCache = useRef<{ [key in GuitarNote]?: any }>({});
  
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

  // 탭 진입 시 기타 음 28개를 미리 만들어 둔다. 이미 있으면 건너뛴다 (캐시는 블러 때 비우지 않음).
  useFocusEffect(
    useCallback(() => {
      for (const note of Object.keys(guitarSounds) as GuitarNote[]) {
        if (soundCache.current[note]) continue;
        try {
          soundCache.current[note] = createAudioPlayer(guitarSounds[note]);
       } catch (error) {
          console.warn(`기타 프리로드 실패: ${note}`, error);
        }
      }
    }, [])
  );

  useEffect(() => {
    if (Object.keys(progress).length > 0) {
      AsyncStorage.setItem(GUITAR_PROGRESS_KEY, JSON.stringify(progress));
    }
  }, [progress]);

  /**
   * 🎸 탭을 떠날 때 울리던 기타 소리를 끊는다.
   * 탭은 언마운트되지 않으므로 언마운트 클린업(플레이어 해제)은 탭 전환 때 실행되지 않는다.
   * **캐시는 비우지 않는다** — 비우면 다시 들어올 때 첫 음 지연이 되살아난다.
   */
  const isScreenFocused = useStopAudioOnBlur(() => {
    for (const player of Object.values(soundCache.current)) {
      try {
        player?.pause();
      } catch (e) { }
    }
  });

  // 2. 사운드 재생 (expo-audio 방식: 폴리포니 지원)
  const playSound = async (note: GuitarNote) => {
    // 정답을 맞히면 1.2초 뒤에 다음 문제음이 예약된다(:224). 그 사이에 탭을 떠났다면
    // 다른 탭에서 기타 소리가 울리므로 재생하지 않는다. (문제 출제 흐름 자체는 그대로 두고
    // 소리만 내지 않는다 — 돌아와서 '다시 듣기'를 누르면 들린다)
    if (!isScreenFocused.current) return;

    try {
      let player = soundCache.current[note];
      if (!player) {
        player = createAudioPlayer(guitarSounds[note]);
        soundCache.current[note] = player;
      }

      // 처음(0)이면 되감기 없이 바로 재생. 위치가 남아 있을 때만 되감기를 기다린다.
      // 같은 음 연타는 임시 플레이어를 만들지 않고 이 캐시 스피커를 처음부터 다시 낸다.
      if (player.currentTime > 0) {
        await player.seekTo(0);
        if (!isScreenFocused.current) return;
      }
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