import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWordAudioPlayer } from '../../hooks/useWordAudioPlayer';
import { WordPair } from '../../constants/wordSounds';
import { LAYOUT } from '../../constants/layout';
import { COLORS, WAVEFORM_GRADIENT } from '../../constants/colors';
import { Waveform } from './Waveform';
import { getImmutableWaveformData } from './waveformData';

interface WordFlashcardProps {
  readonly wordPair: WordPair;
  /** true면 스택 뒤 카드용: 전체 듣기·VS 미표시 */
  /** minimal이 true면: 뒤집은 카드(뒷면) 용 — 전체 듣기 버튼/VS 표시/파형 등 미노출(최소 정보만 보여줌) */
  /** 카드 "미니멀"(최소 정보) 모드: true 시 뒷면(힌트 없음·파형 등 미노출) 용. better name? showMinimal/compact/summary/backFace? */
  readonly minimal?: boolean;
}

export function WordFlashcard({
  wordPair,
  minimal = false,
}: Readonly<WordFlashcardProps>) {
  const audioPlayer = useWordAudioPlayer();
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  const [isPlayingAll, setIsPlayingAll] = useState(false);

  // ✅ SSOT: showWaveform은 playingWord에서 파생
  const showWaveform = playingWord !== null;

  // ✅ SSOT: 파형 데이터도 playingWord에서 파생
  const waveformData = getImmutableWaveformData(playingWord || ''); //waveformData는 playingWord에서 파생

  // wordPair 변경 시 상태 초기화
  useEffect(() => {
    setPlayingWord(null);
    setIsPlayingAll(false);
    // showWaveform은 자동으로 false가 됨 (파생 상태)
  }, [wordPair]);

  // 단어 1 재생 핸들러
  const handlePlayWord1 = () => {
    if (isPlayingAll) return;
    
    // ✅ SSOT: playingWord만 설정, showWaveform은 자동 파생
    setPlayingWord(wordPair.word1);
    
    // 재생 완료 시 상태 초기화
    audioPlayer.playWordSound(wordPair.sound1, wordPair.word1, () => {
      setPlayingWord(null);
      // showWaveform은 자동으로 false가 됨
    });
  };

  // 단어 2 재생 핸들러
  const handlePlayWord2 = () => {
    if (isPlayingAll) return;
    
    // ✅ SSOT: playingWord만 설정, showWaveform은 자동 파생
    setPlayingWord(wordPair.word2);
    
    // 재생 완료 시 상태 초기화
    audioPlayer.playWordSound(wordPair.sound2, wordPair.word2, () => {
      setPlayingWord(null);
      // showWaveform은 자동으로 false가 됨
    });
  };

  // word1 재생 완료 후 word2 준비
  const handleWord1Complete = () => {
    setTimeout(() => {
      setPlayingWord(wordPair.word2);
      audioPlayer.playWordSound(wordPair.sound2, wordPair.word2, handleWord2Complete);
    }, 300);
  };

  // word2 재생 완료 후 상태 초기화
  const handleWord2Complete = () => {
    setPlayingWord(null);
    setIsPlayingAll(false);
  };

  // ✅ 전체 듣기 핸들러 - 단순하고 안정적인 순차 재생
  const handlePlayAll = () => {
    if (isPlayingAll) return;
    
    setIsPlayingAll(true);
    setPlayingWord(wordPair.word1);
    audioPlayer.playWordSound(wordPair.sound1, wordPair.word1, handleWord1Complete);
  };

  return (
    <View style={styles.container}>
      {!minimal && (
        <>
          {/* 전체 듣기 버튼 */}
          <TouchableOpacity 
            style={[styles.playAllButton, isPlayingAll && styles.playAllButtonDisabled]}
            onPress={handlePlayAll}
            disabled={isPlayingAll}
            activeOpacity={0.88}
          >
            <Text style={styles.playAllButtonText}>
              {isPlayingAll ? '재생 중...' : '전체 듣기'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* 단어 쌍 카드 */}
      <View>
        <View style={styles.wordsRow}>
          {/* 단어 1 */}
          <View style={styles.wordColumnContainer}>
            <TouchableOpacity
              style={[styles.wordCard, isPlayingAll && styles.wordCardDisabled]}
              onPress={handlePlayWord1}
              disabled={isPlayingAll}
              activeOpacity={0.7}
            >
              <Text style={styles.wordText}>{wordPair.word1}</Text>
              <View style={styles.playButton}>
                <Ionicons name="volume-high" size={40} color={COLORS.success} />
              </View>
            </TouchableOpacity>
          </View>

          {/* VS 표시 (뒤 카드에서는 숨김) */}
          {!minimal && (
            <View style={styles.vsContainer}>
              <Text style={styles.vsText}>VS</Text>
            </View>
          )}
          {minimal && <View style={styles.vsContainerSpacer} />}

          {/* 단어 2 */}
          <View style={styles.wordColumnContainer}>
            <TouchableOpacity
              style={[styles.wordCard, isPlayingAll && styles.wordCardDisabled]}
              onPress={handlePlayWord2}
              disabled={isPlayingAll}
              activeOpacity={0.7}
            >
              <Text style={styles.wordText}>{wordPair.word2}</Text>
              <View style={styles.playButton}>
                <Ionicons name="volume-high" size={40} color={COLORS.success} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 파형 표시 영역 - 고정 공간 */}
        <View style={styles.waveformContainer}>
        {showWaveform && !isPlayingAll && (
            <Waveform
              data={waveformData}
              isPlaying={audioPlayer.isPlaying}
              color={WAVEFORM_GRADIENT.start}
              width={LAYOUT.waveformWidth}
              height={LAYOUT.waveformHeight}
              progress={audioPlayer.progress}
            />
          )}
          </View>
          
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: LAYOUT.containerPaddingV,
    paddingHorizontal: LAYOUT.containerPaddingH,
    
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: LAYOUT.playAllButtonPaddingH,
    paddingVertical: LAYOUT.playAllButtonPaddingV,
    borderRadius: LAYOUT.playAllButtonBorderRadius,
    marginBottom: LAYOUT.playAllButtonMarginBottom,
    elevation: LAYOUT.playAllButtonElevation,
    gap: 8,
  },
  playAllButtonDisabled: {
    backgroundColor: COLORS.borderGray,
    opacity: 0.6,
  },
  playAllButtonText: {
    fontSize: LAYOUT.playAllButtonFontSize,
    fontWeight: 'bold',
    color: 'white',
  },
  wordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: LAYOUT.wordsRowMarginBottom,
  },
  wordColumnContainer: {
    alignItems: 'center',
    gap: LAYOUT.wordColumnContainerGap,
  },
  wordCard: {
    backgroundColor: COLORS.white,
    borderRadius: LAYOUT.wordCardBorderRadius,
    padding: LAYOUT.wordCardPadding,
    alignItems: 'center',
    minWidth: LAYOUT.wordCardMinWidth,
    elevation: 4,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  wordCardDisabled: {
    opacity: 0.5,
  },
  wordText: {
    fontSize: LAYOUT.wordTextFontSize,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: LAYOUT.wordTextMarginBottom,
  },
  playButton: {
    padding: LAYOUT.playButtonPadding,
  },
  vsContainer: {
    backgroundColor: WAVEFORM_GRADIENT.start,
    borderRadius: 24,
    paddingHorizontal: LAYOUT.vsPaddingH,
    paddingVertical: LAYOUT.vsPaddingV,
  },
  vsText: {
    fontSize: LAYOUT.vsFontSize,
    fontWeight: 'bold',
    color: 'white',
  },
  vsContainerSpacer: {
    paddingHorizontal: LAYOUT.vsPaddingH,
    paddingVertical: LAYOUT.vsPaddingV,
    minWidth: LAYOUT.vsSpacerMinWidth,
  },
  waveformContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: LAYOUT.waveformContainerHeight,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingVertical: LAYOUT.waveformContainerPaddingV,
   
  },
});

export default WordFlashcard;



