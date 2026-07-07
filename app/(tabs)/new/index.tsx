import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import React, { useContext, useState } from 'react';
import { Alert, Text, View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ClearContext } from '../../../context/ClearContext';
import { StarContext } from '../../../context/StarContext';
import { useRouter } from 'expo-router';

/** [DEV] 나중에 삭제: resetAll 관련 - 게임 저장 키들 */
const GAME_STORAGE_KEYS = [
    '@AuditoryTrainingAppPG:gameState',
    '@AuditoryTrainingApp:gameState',
];

// 게임 목록 직접 정의
const games = [
    { 
        id: 'matchGame', 
        name: '소리 맞추기', 
     
        route: '/new/(games)/matchGame',
        color: '#4A90E2',
        emoji: '🎮'
    },
    { 
        id: 'orderGame', 
        name: '소리 순서', 
      
        route: '/new/(games)/orderGame',
        color: '#50C878',
        emoji: '🔄'
    },
    { 
        id: 'matchGameAI', 
        name: '강화학습', 
     
        route: '/new/(games)/matchGameAI',
        color: '#FF6B6B',
        emoji: '🚀'
    },
    { 
        id: 'matchGamePG', 
        name: 'PG', 
      
        route: '/new/(games)/matchGamePG',
        color: '#9B59B6',
        emoji: '📊'
    },
] as const;

export default function App() {
    const insets = useSafeAreaInsets();
    const starContext = useContext(StarContext);
    const clearContext = useContext(ClearContext);
    const router = useRouter();
    const [isResetting, setIsResetting] = useState(false);

    /** [DEV] 나중에 삭제: 전체 초기화 핸들러 */
    const handleResetAll = async () => {
        Alert.alert(
            '전체 초기화',
            '별, 완료, 게임 진행 데이터를 모두 초기화합니다. 계속할까요?',
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '초기화',
                    style: 'destructive',
                    onPress: async () => {
                        if (isResetting) return;
                        setIsResetting(true);
                        try {
                            await clearContext?.resetAll();
                            await starContext?.resetAll();
                            await AsyncStorage.multiRemove(GAME_STORAGE_KEYS);
                            Alert.alert('완료', '모든 데이터가 초기화되었습니다.');
                        } catch (e) {
                            console.error('Reset failed:', e);
                            Alert.alert('오류', '초기화에 실패했습니다.');
                        } finally {
                            setIsResetting(false);
                        }
                    },
                },
            ]
        );
    };

    if (!starContext || !clearContext) {
        return (
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={[styles.container, { paddingTop: insets.top }]}>
                    <Text style={styles.loadingText}>로딩 중...</Text>
                </View>
            </GestureHandlerRootView>
        );
    }

    const { starData } = starContext;
    const { clearData } = clearContext;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View
                style={[
                    styles.container,
                    { paddingTop: insets.top, paddingBottom: insets.bottom },
                ]}
            >
                <ScrollView 
                    style={styles.scrollContainer}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={true}
                >
                    {/* 섹션: 게임 선택 */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>🎯 청능 훈련 게임</Text>
                            <Text style={styles.sectionSubtitle}>
                                원하는 게임을 선택하여 청능 훈련을 시작하세요!
                            </Text>
                            {/* [DEV] 나중에 삭제: 초기화 버튼 */}
                            <TouchableOpacity
                                style={styles.resetButton}
                                onPress={handleResetAll}
                                disabled={isResetting}
                            >
                                <Text style={styles.resetButtonText}>
                                    {isResetting ? '초기화 중...' : '전체 초기화'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* 게임 그리드 */}
                        <View style={styles.gameGrid}>
                            {games.map((game) => {
                                const hasStar = !!starData[game.id];
                                const isCleared = !!clearData[game.id];

                                return (
                                    <TouchableOpacity 
                                        key={game.id} 
                                        style={[
                                            styles.gameCard,
                                            isCleared && styles.clearedCard
                                        ]} 
                                        onPress={() => router.push(game.route as any)}
                                        activeOpacity={0.7}
                                    >
                                        {/* 별 배지 */}
                                        {hasStar && (
                                            <View style={styles.starBadge}>
                                                <Ionicons name="star" size={16} color="#FFD700" />
                                            </View>
                                        )}
                                        
                                        {/* 클리어 배지 */}
                                        {isCleared && (
                                            <View style={styles.clearedBadge}>
                                                <Text style={styles.clearedText}>완료</Text>
                                            </View>
                                        )}

                                        {/* 아이콘 컨테이너 */}
                                        <View style={[styles.iconContainer, { backgroundColor: `${game.color}15` }]}>
                                            <Text style={styles.gameEmoji}>{game.emoji}</Text>
                                        </View>
                                        
                                        {/* 게임 이름 */}
                                        <Text style={styles.gameName}>{game.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </ScrollView>
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 30,
    },
    loadingText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    
    // 섹션 스타일
    section: {
        marginHorizontal: 15,
        marginVertical: 10,
    },
    sectionHeader: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: 20,
        borderRadius: 15,
        marginBottom: 15,
        elevation: 3,
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
        color: '#333',
    },
    sectionSubtitle: {
        fontSize: 16,
        textAlign: 'center',
        color: '#666',
        lineHeight: 22,
    },
    resetButton: {
        marginTop: 12,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#ffebee',
        borderRadius: 8,
    },
    resetButtonText: {
        fontSize: 13,
        color: '#c62828',
        fontWeight: '600',
    },
    
    // 게임 그리드
    gameGrid: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 15,
        padding: 15,
        elevation: 2,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    
    // 게임 카드
    gameCard: {
        width: '48%',
        aspectRatio: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        padding: 15,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        elevation: 3,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    clearedCard: {
        borderColor: '#FFD700',
        borderWidth: 3,
    },
    
    // 아이콘 컨테이너
    iconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    gameEmoji: {
        fontSize: 36,
    },
    
    // 게임 이름
    gameName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
    },
    
    // 별 배지
    starBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#FFF9E6',
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: '#FFD700',
        zIndex: 1,
    },
    
    // 클리어 배지
    clearedBadge: {
        position: 'absolute',
        bottom: 8,
        backgroundColor: '#FFD700',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
        zIndex: 1,
    },
    clearedText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
});