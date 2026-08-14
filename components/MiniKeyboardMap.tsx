import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { allNotes, isBlackKeyMap, whiteIdxRefById, whiteNotes } from '../constants/music';

interface MiniKeyboardMapProps {
  viewportStartIdx: number;
  setViewportStartIdx: (idx: number) => void;
  currentNote: string | null;
  isTraining: boolean;
  viewportSize?: number;
}

export const MiniKeyboardMap: React.FC<MiniKeyboardMapProps> = ({
  viewportStartIdx,
  setViewportStartIdx,
  currentNote,
  isTraining,
  viewportSize = 16,
}) => {
  // 미니맵 수치 정의
  const WHITE_KEY_WIDTH = 6;
  const WHITE_KEY_HEIGHT = 28;
  const BLACK_KEY_WIDTH = 3.6;
  const BLACK_KEY_HEIGHT = 18;

  const totalWidth = whiteNotes.length * WHITE_KEY_WIDTH; // 30 * 6 = 180px

  // 뷰포트 하이라이트 박스 애니메이션
  const animatedBoxStyle = useAnimatedStyle(() => {
    const leftPosition = viewportStartIdx * WHITE_KEY_WIDTH;
    return {
      left: withTiming(leftPosition, { duration: 250 }),
      width: viewportSize * WHITE_KEY_WIDTH, // 동적 크기 반영
    };
  });

  // 미니맵 터치 시 가장 가까운 고정 스냅 지점 매핑 (16건반 기준 0 또는 14로 토글)
  const handleMapPress = (event: any) => {
    const { locationX } = event.nativeEvent;
    const tappedWhiteIdx = Math.floor(locationX / WHITE_KEY_WIDTH);

    if (viewportSize === 16) {
      if (tappedWhiteIdx < 15) {
        setViewportStartIdx(0);
      } else {
        setViewportStartIdx(14);
      }
    } else {
      if (tappedWhiteIdx < 7) {
        setViewportStartIdx(0);
      } else if (tappedWhiteIdx >= 7 && tappedWhiteIdx < 15) {
        setViewportStartIdx(14);
      } else {
        setViewportStartIdx(16);
      }
    }
  };

  // 정답 가이드 LED 도트 위치 계산
  const getTargetDotLeft = () => {
    if (!isTraining || !currentNote) return null;
    const idx = whiteIdxRefById.get(currentNote);
    if (idx === undefined) return null;
    
    // 백건의 가로 너비 중심에 맞춰 도트 배치
    return idx * WHITE_KEY_WIDTH + (WHITE_KEY_WIDTH / 2) - 3;
  };

  const targetDotLeft = getTargetDotLeft();

  // 흑건들의 배치 렌더링을 위한 좌표 계산
  const renderBlackKeys = () => {
    const blackKeys: React.ReactNode[] = [];
    let whiteIndex = 0;

    allNotes.forEach((note) => {
      if (isBlackKeyMap[note]) {
        // 이전 백건 인덱스를 바탕으로 흑건의 가로 절대 위치 계산
        const left = whiteIndex * WHITE_KEY_WIDTH - (BLACK_KEY_WIDTH / 2);
        blackKeys.push(
          <View
            key={`mini-black-${note}`}
            style={[
              styles.miniBlackKey,
              {
                left,
                width: BLACK_KEY_WIDTH,
                height: BLACK_KEY_HEIGHT,
              },
            ]}
          />
        );
      } else {
        whiteIndex++;
      }
    });

    return blackKeys;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handleMapPress}
      style={[styles.container, { width: totalWidth, height: WHITE_KEY_HEIGHT }]}
    >
      {/* 1. 백건들을 배경으로 렌더링 */}
      <View style={styles.whiteKeysContainer}>
        {whiteNotes.map((note) => (
          <View
            key={`mini-white-${note}`}
            style={[
              styles.miniWhiteKey,
              { width: WHITE_KEY_WIDTH, height: WHITE_KEY_HEIGHT },
            ]}
          />
        ))}
      </View>

      {/* 2. 흑건들을 겹쳐서 렌더링 */}
      {renderBlackKeys()}

      {/* 3. 뷰포트 하이라이트 박스 (네온 테두리) */}
      <Animated.View style={[styles.viewportHighlight, animatedBoxStyle]} />

      {/* 4. 정답 안내 LED 가이드 도트 */}
      {targetDotLeft !== null && (
        <View style={[styles.targetGuideDot, { left: targetDotLeft }]} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  whiteKeysContainer: {
    flexDirection: 'row',
  },
  miniWhiteKey: {
    backgroundColor: '#fff',
    borderRightWidth: 0.5,
    borderRightColor: '#ddd',
  },
  miniBlackKey: {
    position: 'absolute',
    backgroundColor: '#000',
    top: 0,
    zIndex: 2,
  },
  viewportHighlight: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    borderWidth: 1.5,
    borderColor: '#00e5ff',
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderRadius: 2,
    zIndex: 3,
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 3,
  },
  targetGuideDot: {
    position: 'absolute',
    bottom: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff453a',
    zIndex: 4,
    shadowColor: '#ff453a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 5,
  },
});
