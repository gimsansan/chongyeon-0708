import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { FallingResult } from '../screens/musicTrainingHelpers';

interface FallingReplayPromptProps {
  result: FallingResult;
  onReplay: () => void;
  onShowResult: () => void;
}

export function FallingReplayPrompt({
  result,
  onReplay,
  onShowResult,
}: FallingReplayPromptProps) {
  return (
    <View style={styles.replayOverlay}>
      <View style={styles.replayBox}>
        <Text style={styles.replayTitle}>{result.title}</Text>
        <Text style={styles.replaySubText}>한 번 더 연습할까요?</Text>
        <TouchableOpacity style={styles.replayIconButton} onPress={onReplay}>
          <Ionicons name="refresh-circle" size={64} color="#00e5ff" />
          <Text style={styles.replayIconText}>리플레이</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resultCloseButton} onPress={onShowResult}>
          <Text style={styles.buttonText}>결과 보기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface FallingResultOverlayProps {
  result: FallingResult;
  accuracy: number;
  hits: number;
  misses: number;
  onClose: () => void;
}

export function FallingResultOverlay({
  result,
  accuracy,
  hits,
  misses,
  onClose,
}: FallingResultOverlayProps) {
  return (
    <View style={styles.resultOverlay}>
      <View style={styles.resultBox}>
        <Text style={styles.resultTitle}>
          {result.cleared ? '클리어!' : '연습 필요'}
        </Text>
        <Text style={styles.resultLine}>
          정확도 {accuracy}% · {hits}/{result.totalNotes} 히트
        </Text>
        <View style={styles.resultBadgeRow}>
          <Text style={[styles.resultBadge, styles.resultBadgePerfect]}>완벽 {result.perfect}</Text>
          <Text style={[styles.resultBadge, styles.resultBadgeGreat]}>훌륭 {result.great}</Text>
          <Text style={[styles.resultBadge, styles.resultBadgeGood]}>양호 {result.good}</Text>
          <Text style={[styles.resultBadge, styles.resultBadgeMiss]}>놓침 {misses}</Text>
        </View>
        <TouchableOpacity style={styles.resultCloseButton} onPress={onClose}>
          <Text style={styles.buttonText}>확인</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  replayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 96,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  replayBox: {
    minWidth: 300,
    backgroundColor: 'rgba(18, 18, 22, 0.96)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#00e5ff',
    paddingVertical: 18,
    paddingHorizontal: 26,
    alignItems: 'center',
  },
  replayTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  replaySubText: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 10,
  },
  replayIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 20,
  },
  replayIconText: {
    color: '#00e5ff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: -4,
  },
  resultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 96,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  resultBox: {
    minWidth: 360,
    backgroundColor: 'rgba(18, 18, 22, 0.96)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#00e5ff',
    paddingVertical: 18,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  resultTitle: {
    color: '#00e5ff',
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 14,
  },
  resultLine: {
    color: 'rgba(255, 255, 255, 0.86)',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
  },
  resultBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  resultBadge: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  resultBadgePerfect: {
    backgroundColor: 'rgba(255, 213, 79, 0.22)',
    borderColor: '#ffd54f',
    borderWidth: 1,
  },
  resultBadgeGreat: {
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
    borderColor: '#00e5ff',
    borderWidth: 1,
  },
  resultBadgeGood: {
    backgroundColor: 'rgba(93, 230, 196, 0.18)',
    borderColor: '#5de6c4',
    borderWidth: 1,
  },
  resultBadgeMiss: {
    backgroundColor: 'rgba(255, 82, 82, 0.2)',
    borderColor: '#ff5252',
    borderWidth: 1,
  },
  resultCloseButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 14,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
