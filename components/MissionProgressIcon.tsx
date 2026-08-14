import { Ionicons } from '@expo/vector-icons';
import React, { useContext, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, ScrollView, Pressable, Alert } from 'react-native';
import { ClearContext } from '../context/ClearContext';
import { StarContext } from '../context/StarContext';

// 컴포넌트가 받을 props의 타입을 정의합니다.
interface MissionProgressIconProps {
  gameId: string;
  title: string;
  missionText: string;
  clearText: string;
  progressItems: { label: string; value: string | number }[];
  style?: any;
  onReset?: () => void;
}

export default function MissionProgressIcon({
  gameId,
  title,
  missionText,
  clearText,
  progressItems,
  style,
  onReset,
}: MissionProgressIconProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const starContext = useContext(StarContext);
  const clearContext = useContext(ClearContext);

  // 컨텍스트 데이터가 없으면 아무것도 렌더링하지 않습니다.
  if (!starContext || !clearContext) {
    return null;
  }

  // 임시 디버그용 별 및 클리어 초기화 핸들러
  const handleReset = () => {
    Alert.alert(
      '데이터 초기화',
      '별 획득 및 클리어 기록을 초기화하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '초기화', 
          style: 'destructive',
          onPress: async () => {
            try {
              await starContext.resetAll();
              await clearContext.resetAll();
              if (onReset) {
                onReset();
              }
              Alert.alert('초기화 완료', '기록이 성공적으로 초기화되었습니다.');
            } catch (e) {
              console.error('Reset failed', e);
            }
          }
        }
      ]
    );
  };

  let hasStar = !!starContext.starData[gameId];
  let isCleared = !!clearContext.clearData[gameId];

  // 피아노 미션인 경우 난이도별 데이터(1~5단계)를 모아서 최종 상태 판정
  if (gameId === 'music') {
    const levels = ['1단계', '2단계', '3단계', '4단계', '5단계'];
    hasStar = levels.every(level => starContext.starData[`music_${level}`] === 1);
    isCleared = levels.every(level => clearContext.clearData[`music_${level}`] === true);
  }
  
  // 클리어 여부에 따라 아이콘 색상을 결정합니다.
  const iconColor = isCleared ? '#FFD700' : hasStar ? '#c0c0c0' : '#a0a0a0';

  return (
    <>
      {/* 화면 우상단에 위치할 아이콘 버튼 */}
      <TouchableOpacity
        style={[styles.iconContainer, style]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="help-circle-outline" size={32} color={iconColor} />
      </TouchableOpacity>

      {/* 아이콘 클릭 시 나타날 모달 */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          {/* Sibling Pressable Backdrop to capture background taps without blocking child gestures */}
          <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)} />
          
          <View style={[styles.modalContent, { overflow: 'hidden' }]}>
            {/* Top Accent Bar */}
            <View style={styles.topAccentBar} />
            
            <ScrollView showsVerticalScrollIndicator={true} style={{ maxHeight: 220, paddingTop: 10 }}>
              {/* 타이틀 및 초기화 버튼 영역 (임시 디버그용) */}
              <View style={styles.titleContainer}>
                <Text style={styles.modalTitle}>{title}</Text>
                <TouchableOpacity onPress={handleReset} style={styles.resetButton} activeOpacity={0.6}>
                  <Ionicons name="refresh-circle-outline" size={24} color="#E53E3E" />
                </TouchableOpacity>
              </View>
              
              {/* 미션 조건 (별 카드) */}
              <View style={[styles.conditionCard, styles.starCard]}>
                <Ionicons name={hasStar ? "star" : "star-outline"} size={22} color={hasStar ? '#FFD700' : '#8E8E93'} />
                <Text style={styles.conditionText}>별 획득: {missionText}</Text>
              </View>
              
              {/* 클리어 조건 (클리어 카드) */}
              <View style={[styles.conditionCard, styles.clearCard]}>
                <Ionicons name={isCleared ? "checkmark-circle" : "ellipse-outline"} size={22} color={isCleared ? '#34C759' : '#8E8E93'} />
                <Text style={styles.conditionText}>클리어: {clearText}</Text>
              </View>

              <View style={styles.divider} />
              
              {/* 현재 진행 상황 */}
              <View style={styles.progressCard}>
                <Text style={styles.progressTitle}>현재 진행 상황</Text>
                {progressItems.map((item, index) => (
                  <View key={index} style={styles.progressRow}>
                    <Text style={styles.progressBullet}>•</Text>
                    <Text style={styles.progressText}>
                      {item.label}: {item.value}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
            
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 100,
    elevation: 100,
    padding: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    width: '75%',
    maxWidth: 500,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 1,
  },
  topAccentBar: {
    height: 4,
    backgroundColor: '#4F46E5',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  resetButton: {
    marginLeft: 8,
    padding: 2,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
  },
  conditionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  starCard: {
    backgroundColor: '#FFFDF0',
    borderColor: '#FEF08A',
  },
  clearCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  conditionText: {
    fontSize: 18,
    color: '#34495E',
    marginLeft: 10,
    flexShrink: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  progressCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  progressBullet: {
    fontSize: 17,
    color: '#4F46E5',
    marginRight: 6,
    lineHeight: 22,
  },
  progressText: {
    fontSize: 17,
    color: '#4A5568',
    flexShrink: 1,
    lineHeight: 22,
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: '#4A5568',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});