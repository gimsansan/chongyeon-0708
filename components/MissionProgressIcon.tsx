import { Ionicons } from '@expo/vector-icons';
import React, { useContext, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ClearContext } from '../context/ClearContext';
import { StarContext } from '../context/StarContext';

// 컴포넌트가 받을 props의 타입을 정의합니다.
interface MissionProgressIconProps {
  gameId: string;
  title: string;
  missionText: string;
  clearText: string;
  progressItems: { label: string; value: string | number }[];
}

export default function MissionProgressIcon({
  gameId,
  title,
  missionText,
  clearText,
  progressItems,
}: MissionProgressIconProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const starContext = useContext(StarContext);
  const clearContext = useContext(ClearContext);

  // 컨텍스트 데이터가 없으면 아무것도 렌더링하지 않습니다.
  if (!starContext || !clearContext) {
    return null;
  }

  const hasStar = starContext.starData[gameId];
  const isCleared = clearContext.clearData[gameId];
  
  // 클리어 여부에 따라 아이콘 색상을 결정합니다.
  const iconColor = isCleared ? '#FFD700' : hasStar ? '#c0c0c0' : '#a0a0a0';

  return (
    <>
      {/* 화면 우상단에 위치할 아이콘 버튼 */}
      <TouchableOpacity
        style={styles.iconContainer}
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
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View  style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{title}</Text>
            
            {/* 미션 조건 */}
            <View style={styles.conditionRow}>
              <Ionicons name="star" size={20} color={hasStar ? '#FFD700' : '#a0a0a0'} />
              <Text style={styles.conditionText}>별 획득: {missionText}</Text>
            </View>
            
            {/* 클리어 조건 */}
            <View style={styles.conditionRow}>
              <View style={[styles.clearIconBorder, isCleared && { borderColor: '#FFD700' }]} />
              <Text style={styles.conditionText}>클리어: {clearText}</Text>
            </View>

            <View style={styles.divider} />
            
            {/* 현재 진행 상황 */}
            <Text style={styles.progressTitle}>현재 진행 상황</Text>
            {progressItems.map((item, index) => (
              <Text key={index} style={styles.progressText}>
                - {item.label}: {item.value}
              </Text>
            ))}
            
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '85%',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  conditionText: {
    fontSize: 16,
    marginLeft: 10,
  },
  clearIconBorder: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#a0a0a0',
    marginLeft: 2, // 아이콘 정렬 맞춤
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 15,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  progressText: {
    fontSize: 15,
    marginBottom: 5,
    color: '#333',
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: '#007bff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});