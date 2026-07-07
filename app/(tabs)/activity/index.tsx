import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from '../../../services/audioCompat';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import MissionProgressIcon from '../../../components/MissionProgressIcon';
import { ClearContext } from '../../../context/ClearContext';
import { StarContext } from '../../../context/StarContext';
import Rive from 'rive-react-native';
// Note 타입 정의
type Note =
  | 'C1' | 'C#1' | 'D1' | 'D#1' | 'E1' | 'F1' | 'F#1' | 'G1' | 'G#1' | 'A1' | 'A#1' | 'B1'
  | 'C2' | 'C#2' | 'D2' | 'D#2' | 'E2' | 'F2' | 'F#2' | 'G2' | 'G#2' | 'A2' | 'A#2' | 'B2'
  | 'C3' | 'C#3' | 'D3' | 'D#3' | 'E3' | 'F3' | 'F#3' | 'G3' | 'G#3' | 'A3' | 'A#3' | 'B3'
  | 'C4' | 'C#4' | 'D4' | 'D#4' | 'E4' | 'F4' | 'F#4' | 'G4' | 'G#4' | 'A4' | 'A#4' | 'B4'
  | 'C5' | 'C#5' | 'D5' | 'D#5';

// 사운드 파일 경로
const soundFiles: { [key in Note]: any } = {
  'C1': require('../../../assets/sounds/piano_mp4/C1.m4a'), 'C#1': require('../../../assets/sounds/piano_mp4/C_sharp1.m4a'),
  'D1': require('../../../assets/sounds/piano_mp4/D1.m4a'), 'D#1': require('../../../assets/sounds/piano_mp4/D_sharp1.m4a'),
  'E1': require('../../../assets/sounds/piano_mp4/E1.m4a'), 'F1': require('../../../assets/sounds/piano_mp4/F1.m4a'),
  'F#1': require('../../../assets/sounds/piano_mp4/F_sharp1.m4a'), 'G1': require('../../../assets/sounds/piano_mp4/G1.m4a'),
  'G#1': require('../../../assets/sounds/piano_mp4/G_sharp1.m4a'), 'A1': require('../../../assets/sounds/piano_mp4/A1.m4a'),
  'A#1': require('../../../assets/sounds/piano_mp4/A_sharp1.m4a'), 'B1': require('../../../assets/sounds/piano_mp4/B1.m4a'),
  'C2': require('../../../assets/sounds/piano_mp4/C2.m4a'), 'C#2': require('../../../assets/sounds/piano_mp4/C_sharp2.m4a'),
  'D2': require('../../../assets/sounds/piano_mp4/D2.m4a'), 'D#2': require('../../../assets/sounds/piano_mp4/D_sharp2.m4a'),
  'E2': require('../../../assets/sounds/piano_mp4/E2.m4a'), 'F2': require('../../../assets/sounds/piano_mp4/F2.m4a'),
  'F#2': require('../../../assets/sounds/piano_mp4/F_sharp2.m4a'), 'G2': require('../../../assets/sounds/piano_mp4/G2.m4a'),
  'G#2': require('../../../assets/sounds/piano_mp4/G_sharp2.m4a'), 'A2': require('../../../assets/sounds/piano_mp4/A2.m4a'),
  'A#2': require('../../../assets/sounds/piano_mp4/A_sharp2.m4a'), 'B2': require('../../../assets/sounds/piano_mp4/B2.m4a'),
  'C3': require('../../../assets/sounds/piano_mp4/C3.m4a'), 'C#3': require('../../../assets/sounds/piano_mp4/C_sharp3.m4a'),
  'D3': require('../../../assets/sounds/piano_mp4/D3.m4a'), 'D#3': require('../../../assets/sounds/piano_mp4/D_sharp3.m4a'),
  'E3': require('../../../assets/sounds/piano_mp4/E3.m4a'), 'F3': require('../../../assets/sounds/piano_mp4/F3.m4a'),
  'F#3': require('../../../assets/sounds/piano_mp4/F_sharp3.m4a'), 'G3': require('../../../assets/sounds/piano_mp4/G3.m4a'),
  'G#3': require('../../../assets/sounds/piano_mp4/G_sharp3.m4a'), 'A3': require('../../../assets/sounds/piano_mp4/A3.m4a'),
  'A#3': require('../../../assets/sounds/piano_mp4/A_sharp3.m4a'), 'B3': require('../../../assets/sounds/piano_mp4/B3.m4a'),
  'C4': require('../../../assets/sounds/piano_mp4/C4.m4a'), 'C#4': require('../../../assets/sounds/piano_mp4/C_sharp4.m4a'),
  'D4': require('../../../assets/sounds/piano_mp4/D4.m4a'), 'D#4': require('../../../assets/sounds/piano_mp4/D_sharp4.m4a'),
  'E4': require('../../../assets/sounds/piano_mp4/E4.m4a'), 'F4': require('../../../assets/sounds/piano_mp4/F4.m4a'),
  'F#4': require('../../../assets/sounds/piano_mp4/F_sharp4.m4a'), 'G4': require('../../../assets/sounds/piano_mp4/G4.m4a'),
  'G#4': require('../../../assets/sounds/piano_mp4/G_sharp4.m4a'), 'A4': require('../../../assets/sounds/piano_mp4/A4.m4a'),
  'A#4': require('../../../assets/sounds/piano_mp4/A_sharp4.m4a'), 'B4': require('../../../assets/sounds/piano_mp4/B4.m4a'),
  'C5': require('../../../assets/sounds/piano_mp4/C5.m4a'), 'C#5': require('../../../assets/sounds/piano_mp4/C_sharp5.m4a'),
  'D5': require('../../../assets/sounds/piano_mp4/D5.m4a'), 'D#5': require('../../../assets/sounds/piano_mp4/D_sharp5.m4a'),
};

// 흑건 여부 맵
const isBlackKeyMap: { [key in Note]: boolean } = {
  'C1': false, 'C#1': true, 'D1': false, 'D#1': true, 'E1': false, 'F1': false, 'F#1': true, 'G1': false, 'G#1': true, 'A1': false, 'A#1': true, 'B1': false,
  'C2': false, 'C#2': true, 'D2': false, 'D#2': true, 'E2': false, 'F2': false, 'F#2': true, 'G2': false, 'G#2': true, 'A2': false, 'A#2': true, 'B2': false,
  'C3': false, 'C#3': true, 'D3': false, 'D#3': true, 'E3': false, 'F3': false, 'F#3': true, 'G3': false, 'G#3': true, 'A3': false, 'A#3': true, 'B3': false,
  'C4': false, 'C#4': true, 'D4': false, 'D#4': true, 'E4': false, 'F4': false, 'F#4': true, 'G4': false, 'G#4': true, 'A4': false, 'A#4': true, 'B4': false,
  'C5': false, 'C#5': true, 'D5': false, 'D#5': true,
};

// 키보드-음계 매핑
const keyToNoteMap: { [key: string]: Note } = {
  'q': 'C3',  'w': 'D3',  'e': 'E3',  'r': 'F3',  't': 'G3',  'y': 'A3',  'u': 'B3',
  'i': 'C4',  'o': 'D4',  'p': 'E4',  '[': 'F4',  ']': 'G4',  '\\': 'A4', 'a': 'B4',
  's': 'C5',  'd': 'D5',
  'Q': 'C#3', 'W': 'D#3',             'R': 'F#3', 'T': 'G#3', 'Y': 'A#3',
  'I': 'C#4', 'O': 'D#4',             '{': 'F#4', '}': 'G#4', '|': 'A#4',
  'S': 'C#5', 'D': 'D#5',
  'f': 'C1',  'g': 'D1',  'h': 'E1',  'j': 'F1',  'k': 'G1',  'l': 'A1',  ';': 'B1',
  "'": 'C2',  'z': 'D2',  'x': 'E2',  'c': 'F2',  'v': 'G2',  'b': 'A2',  'n': 'B2',
  'F': 'C#1', 'G': 'D#1',             'J': 'F#1', 'K': 'G#1', 'L': 'A#1',
  '"': 'C#2', 'Z': 'D#2',             'C': 'F#2', 'V': 'G#2', 'B': 'A#2',
};

const noteToKeyMap = Object.entries(keyToNoteMap).reduce((acc, [key, note]) => {
  acc[note] = key;
  return acc;
}, {} as { [note in Note]?: string });

const CACHE_LIMIT = 20;

const allNotes = Object.keys(isBlackKeyMap) as Note[];
const level1_absoluteBeginner: Note[] = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'];
const level2_beginner: Note[] = allNotes.slice(allNotes.indexOf('C3'), allNotes.indexOf('C5') + 1).filter(note => !isBlackKeyMap[note]);
const level3_intermediate: Note[] = allNotes.slice(allNotes.indexOf('C3'), allNotes.indexOf('B4') + 1);
const level4_advanced: Note[] = allNotes;
const level5_specialTraining: Note[] = allNotes.filter(note => isBlackKeyMap[note]);

type Difficulty = '1단계' | '2단계' | '3단계' | '4단계' | '5단계';
const difficultyLevels: { name: Difficulty, label: string }[] = [
    { name: '1단계', label: '입문' },
    { name: '2단계', label: '초급' },
    { name: '3단계', label: '중급' },
    { name: '4단계', label: '상급' },
    { name: '5단계', label: '전문' },
];

const MUSIC_PROGRESS_KEY = '@MiniGameApp:musicProgress';

interface MusicProgress {
  [difficulty: string]: {
    cumulativeSuccesses: number;
    highestScore: number;
  }
}

const renderPianoRow = (notes: Note[], visibleNotes: Set<Note>, activeNotes: any, handlers: any, dynamicStyles: any, showKeyLabels: boolean) => {
  const whiteKeys = notes.filter(note => !isBlackKeyMap[note]);
  
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
      const index = whiteKeys.indexOf(precedingWhiteKeyNote);
      if (index === -1) return null;
      return (index + 1) * whiteKeyWidth - (blackKeyWidth / 2);
  };
  
  return (
      <View style={styles.rowContainer}>
          {whiteKeys.map(note => {
              const isVisible = visibleNotes.has(note);
              return (
                  <TouchableOpacity
                      key={note}
                      disabled={!isVisible}
                      style={[ styles.whiteKey, { width: dynamicStyles.whiteKeyWidth, height: dynamicStyles.whiteKeyHeight }, activeNotes[note] && styles.whiteKeyPressed, !isVisible && styles.whiteKeyDisabled ]}
                      onPressIn={() => handlers.handleNotePressIn(note)}
                      onPressOut={() => handlers.handleNotePressOut(note)}
                      activeOpacity={1}
                  >
                      {showKeyLabels && <Text style={[styles.whiteKeyLabel, !isVisible && styles.keyLabelDisabled]}>{noteToKeyMap[note]}</Text>}
                  </TouchableOpacity>
              );
          })}
          {notes.filter(note => isBlackKeyMap[note]).map(note => {
              const isVisible = visibleNotes.has(note);
              const leftPosition = getBlackKeyPosition(note);
              if (leftPosition === null) return null;
              return (
                  <TouchableOpacity
                      key={note}
                      disabled={!isVisible}
                      style={[ styles.blackKey, { width: dynamicStyles.blackKeyWidth, height: dynamicStyles.blackKeyHeight, left: leftPosition }, activeNotes[note] && styles.blackKeyPressed, !isVisible && styles.keyDisabled ]}
                      onPressIn={() => handlers.handleNotePressIn(note)}
                      onPressOut={() => handlers.handleNotePressOut(note)}
                      activeOpacity={1}
                  >
                      {showKeyLabels && <Text style={[styles.blackKeyLabel, !isVisible && styles.keyLabelDisabled]}>{noteToKeyMap[note]}</Text>}
                  </TouchableOpacity>
              );
          })}
      </View>
  );
};

export default function Music() {
  const KEYBOARD_ENABLED = false;

  const [activeNotes, setActiveNotes] = useState<{ [key in Note]?: boolean }>({});  // 활성 키 상태
  const [isTraining, setIsTraining] = useState(false); // 훈련 여부
  const [currentNote, setCurrentNote] = useState<Note | null>(null);  // 현재 문제 음계
  const [score, setScore] = useState(0);  // 점수
  const [feedback, setFeedback] = useState('');  // 피드백
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);  // 정답 애니메이션 표시 여부
  const [difficulty, setDifficulty] = useState<Difficulty>('3단계');  // 난이도
  const [progress, setProgress] = useState<MusicProgress>({});  // 진행 상태
  const [overlayVisible, setOverlayVisible] = useState(true);  // 오버레이 표시 여부
  const rotation = useSharedValue(0);  // 회전 애니메이션 값

  const { height, width } = useWindowDimensions();  // 화면 크기

  useEffect(() => { 
    if (!overlayVisible) return;
    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(90, { duration: 800 }),
      -1,
      false
    );
  }, [overlayVisible]);

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const soundCache = useRef<{ [key in Note]?: Audio.Sound }>({});
  const recentlyUsedNotes = useRef<Note[]>([]);
  
  const starContext = useContext(StarContext);
  const clearContext = useContext(ClearContext);

  useEffect(() => {
    const loadProgress = async () => {
      try {
        const savedProgress = await AsyncStorage.getItem(MUSIC_PROGRESS_KEY);
        if (savedProgress) {
          setProgress(JSON.parse(savedProgress));
        }
      } catch (e) {
        console.error("Failed to load music progress.", e);
      }
    };
    loadProgress();
  }, []);

  useEffect(() => {
    if (Object.keys(progress).length > 0) {
      AsyncStorage.setItem(MUSIC_PROGRESS_KEY, JSON.stringify(progress))
        .catch(e => console.error("Failed to save music progress.", e));
    }
  }, [progress]);

  const getVisibleNoteSet = () => {
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

  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) {
      setOverlayVisible(true);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      return;
    }
    const t = setTimeout(async () => {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      setOverlayVisible(false);
    }, 250);
    return () => clearTimeout(t);
  }, [isFocused]);

  useEffect(() => {
    return () => {
      for (const sound of Object.values(soundCache.current)) {
        sound?.unloadAsync();
      }
    };
  }, []);

  const playSound = async (note: Note) => {
    try {
      let sound = soundCache.current[note];
      if (sound) {
        recentlyUsedNotes.current = recentlyUsedNotes.current.filter(n => n !== note);
        recentlyUsedNotes.current.unshift(note);
      } else {
        if (recentlyUsedNotes.current.length >= CACHE_LIMIT) {
          const lruNote = recentlyUsedNotes.current.pop();
          if (lruNote) {
            await soundCache.current[lruNote]?.unloadAsync();
            delete soundCache.current[lruNote];
          }
        }
        const { sound: newSound } = await Audio.Sound.createAsync(soundFiles[note]);
        soundCache.current[note] = newSound;
        sound = newSound;
        recentlyUsedNotes.current.unshift(note);
      }
      await sound.replayAsync();
    } catch (error) {
      console.log(`'${note}' 음원 재생 실패:`, error);
    }
  };
  
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
    playSound(randomNote);
  }, [difficulty]); 

  const startTraining = () => {
    setIsTraining(true);
    setScore(0);
    setFeedback('훈련 시작!');
    playNextQuestion();
  };

  const stopTraining = () => {
    setIsTraining(false);
    setCurrentNote(null);
    setFeedback('');
  };

  const repeatSound = () => {
    if (currentNote) {
      playSound(currentNote);
    }
  };

  const handleNotePressIn = useCallback((note: Note) => {
    playSound(note);
    setActiveNotes(prev => ({ ...prev, [note]: true }));

    if (isTraining && currentNote) {
      if (note === currentNote) {
        const newScore = score + 1;
        setScore(newScore);

        const currentProgress = progress[difficulty] || { cumulativeSuccesses: 0, highestScore: 0 };
        const newCumulativeSuccesses = currentProgress.cumulativeSuccesses + 1;
        
        const updatedProgress = {
          ...progress,
          [difficulty]: {
            cumulativeSuccesses: newCumulativeSuccesses,
            highestScore: Math.max(currentProgress.highestScore, newScore),
          }
        };
        setProgress(updatedProgress);
        
        if (newCumulativeSuccesses >= 3) {
            starContext?.addStar(`music_${difficulty}`);
        }
        if (newScore >= 5) {
            clearContext?.markAsCleared(`music_${difficulty}`);
        }

        // 정답 시 1초 동안 Rive 애니메이션을 표시하고, 이후 다음 문제로 진행
        setShowSuccessAnim(true);
        setFeedback('정답!');
        setTimeout(() => {
          setShowSuccessAnim(false);
          setFeedback('다음 문제');
          playNextQuestion();
        }, 1000);
      } else {
        setScore(prev => prev > 0 ? prev - 1 : 0);
        setFeedback('오답! 다시 들어보세요.');
      }
    }
  }, [isTraining, currentNote, playNextQuestion, score, progress, difficulty, starContext, clearContext]);

  const handleNotePressOut = useCallback((note: Note) => {
    setActiveNotes(prev => {
      const newActiveNotes = { ...prev };
      delete newActiveNotes[note];
      return newActiveNotes;
    });
  }, []);

  const row1Notes = allNotes.slice(0, 24);
  const row2Notes = allNotes.slice(24);
  
  const CONTROL_PANEL_WIDTH = 240;
  const PIANO_AREA_PADDING = 20;
  const pianoAreaWidth = width - CONTROL_PANEL_WIDTH - PIANO_AREA_PADDING;

  const MAX_WHITE_KEYS = 16;
  
  const dynamicWhiteKeyWidth = pianoAreaWidth / MAX_WHITE_KEYS;
  const dynamicStyles = {
    whiteKeyWidth: dynamicWhiteKeyWidth,
    blackKeyWidth: dynamicWhiteKeyWidth * 0.6,
    whiteKeyHeight: (height / 2) - 25,
    blackKeyHeight: ((height / 2) - 25) * 0.65,
  };

  const handlers = { handleNotePressIn, handleNotePressOut };
  
  const progressItems = difficultyLevels.map(level => {
    const levelProgress = progress[level.name] || { cumulativeSuccesses: 0, highestScore: 0 };
    const starStatus = starContext?.starData[`music_${level.name}`] ? '★' : '☆';
    const clearStatus = clearContext?.clearData[`music_${level.name}`] ? '✓' : '✗';
    return {
      label: `${level.label} (${starStatus}, ${clearStatus})`,
      value: `누적 ${levelProgress.cumulativeSuccesses}회 / 최고 ${levelProgress.highestScore}점`
    };
  });

  if (overlayVisible) {
    return (
      <View style={styles.rotationOverlay}>
        <View style={styles.rotationContent}>
          <Animated.View style={rotationStyle}>
            <Ionicons name="phone-portrait-outline" size={100} color="rgba(255,255,255,0.9)" style={styles.rotationIcon} />
          </Animated.View>
        </View>
        <Text style={styles.rotationHintText}>가로 전환 중...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.fullScreen}>
      <View style={{ position: 'absolute', top: -20, left: 100, zIndex: 100 }}>
        <MissionProgressIcon
          gameId="music" 
          title="피아노 미션"
          missionText="각 난이도에서 정답 누적 3회"
          clearText="각 난이도에서 총점 5점 달성"
          progressItems={progressItems}
        />
      </View>
      <View style={styles.trainingContainer}>
        <Text style={styles.scoreText}>점수: {score}</Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.trainingButton} 
            onPress={isTraining ? stopTraining : startTraining}
          >
            <Text style={styles.buttonText}>{isTraining ? '훈련 종료' : '청능 훈련'}</Text>
          </TouchableOpacity>
          {isTraining && (
            <TouchableOpacity style={styles.trainingButton} onPress={repeatSound}>
              <Text style={styles.buttonText}>다시 듣기</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.feedbackText}>{feedback}</Text>
        <View style={styles.difficultyContainerWrapper}>
          <View style={styles.difficultyContainer}>
            {difficultyLevels.map(({ name, label }) => (
              <TouchableOpacity 
                key={name}
                style={[styles.difficultyButton, difficulty === name && styles.difficultyButtonActive]}
                onPress={() => !isTraining && setDifficulty(name)}
                disabled={isTraining}
              >
                <Text style={styles.difficultyButtonText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.pianoArea}>
        <View style={styles.pianoContainer}>
          <View style={styles.pianoWrapper}>
            {renderPianoRow(row2Notes, visibleNoteSet, activeNotes, handlers, dynamicStyles, KEYBOARD_ENABLED)}
            {renderPianoRow(row1Notes, visibleNoteSet, activeNotes, handlers, dynamicStyles, KEYBOARD_ENABLED)}
          </View>
        </View>
      </View>

      {/* Rive 정답 애니메이션 오버레이 */}
      {showSuccessAnim && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              zIndex: 999,
              elevation: 999,
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}
          pointerEvents="none"
        >
          <Rive
            resourceName="confetti"
            stateMachineName="State Machine 1"
            autoplay={true}
            style={{ width: 300, height: 300 }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rotationOverlay: {
    flex: 1,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rotationContent: {
    alignItems: 'center',
  },
  rotationIcon: {
    marginBottom: 0,
  },
  rotationHintText: {
    fontSize: 26,
    color: 'rgba(255,255,255,0.9)',
    position: 'absolute',
    bottom: 80,
  },
  fullScreen: { 
    flex: 1, 
    backgroundColor: '#333',
    flexDirection: 'row',
  },
  trainingContainer: { 
    width: 240,
    height: '100%',
    paddingVertical: 20, 
    paddingHorizontal: 10, 
    backgroundColor: '#222', 
    alignItems: 'center', 
    justifyContent: 'space-around',
    borderRightWidth: 2, 
    borderRightColor: '#444',
  },
  pianoArea: { 
    flex: 1,
    justifyContent: 'center', 
    alignItems: 'center', 
  },
  difficultyContainerWrapper: {
    width: '100%',
  },
  difficultyContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'center',
  },
  buttonContainer: { 
    flexDirection: 'column',
    alignItems: 'center',
  },
  pianoContainer: { 
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    paddingHorizontal: 10,
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
  difficultyButton: { 
    backgroundColor: '#555', 
    paddingVertical: 8, 
    paddingHorizontal: 15, 
    borderRadius: 15, 
    margin: 4, 
  },
  trainingButton: { 
    backgroundColor: '#007BFF', 
    paddingVertical: 12, 
    paddingHorizontal: 18, 
    borderRadius: 8, 
    marginVertical: 6, 
    width: 200, 
    alignItems: 'center',
  },
  difficultyButtonText: { 
    color: 'white', 
    fontWeight: '600', 
    fontSize: 14, 
  },
  scoreText: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: 'white',
    textAlign: 'center',
  },
  feedbackText: { 
    fontSize: 18, 
    color: '#4CAF50', 
    fontWeight: 'bold', 
    minHeight: 50, 
    textAlign: 'center',
  },
  buttonText: { 
    color: 'white', 
    fontWeight: 'bold',   
    fontSize: 16 
  },
  whiteKey: { 
    borderWidth: 1, 
    borderColor: '#000', 
    backgroundColor: 'white', 
    justifyContent: 'flex-end', 
    alignItems: 'center', 
    paddingBottom: 10, 
  },
  blackKey: { 
    position: 'absolute', 
    backgroundColor: 'black', 
    borderRadius: 4, 
    zIndex: 1, 
    justifyContent: 'flex-end', 
    alignItems: 'center', 
    paddingBottom: 8,
  },
  whiteKeyLabel: { 
    fontSize: 12, 
    color: '#333', 
    fontWeight: 'bold' 
  },
  blackKeyLabel: { 
    fontSize: 12, 
    color: 'white', 
    fontWeight: 'bold' 
  },
  difficultyButtonActive: { 
    backgroundColor: '#007BFF', 
    shadowColor: '#007BFF', 
    shadowOffset: { width: 0, height: 0 }, 
    shadowOpacity: 0.5, 
    shadowRadius: 5, 
    elevation: 5 
  },
  whiteKeyPressed: { 
    backgroundColor: '#e0e0e0' 
  },
  blackKeyPressed: { 
    backgroundColor: '#333333' 
  },
  whiteKeyDisabled: {
    backgroundColor: '#c4c4c4',
    borderColor: '#888',
  },
  keyDisabled: { 
    opacity: 0.4,
  },
  keyLabelDisabled: {
    color: '#777',
  },
  hiddenInput: { 
    position: 'absolute', 
    width: 1, 
    height: 1, 
    opacity: 0 
  },
});