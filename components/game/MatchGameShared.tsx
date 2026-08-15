import React, { memo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { LAYOUT } from '../../constants/layout';
import WaveRipple from '../WaveRipple';

export type MatchGameUserStats = { [sound: string]: { correct: number; total: number } };

const getGrade = (correct: number, total: number) => {
    if (total === 0) return { emoji: '❓', label: '미도전', color: COLORS.gradeUntried };
    const acc = (correct / total) * 100;
    if (acc >= 90) return { emoji: '🔥', label: '완벽', color: COLORS.gradePerfect };
    if (acc >= 75) return { emoji: '⭐', label: '우수', color: COLORS.gradeExcellent };
    if (acc >= 50) return { emoji: '👍', label: '보통', color: COLORS.gradeNormal };
    return { emoji: '💪', label: '연습필요', color: COLORS.gradePractice };
};

export const MatchGameStatsScreen = memo(({ stats, onGoHome }: { stats: MatchGameUserStats, onGoHome: () => void }) => {
    const sortedStats = Object.entries(stats)
        .sort(([, a], [, b]) => (a.total === 0 ? 1 : a.correct / a.total) - (b.total === 0 ? 1 : b.correct / b.total));

    const totalAttempts = sortedStats.reduce((sum, [, { total }]) => sum + total, 0);
    const totalCorrect = sortedStats.reduce((sum, [, { correct }]) => sum + correct, 0);
    const overallAccuracy = totalAttempts === 0 ? 0 : (totalCorrect / totalAttempts) * 100;

    return (
        <View style={styles.container}>
            <View style={styles.statsHeaderSection}>
                <Text style={styles.title}>📊 내 통계</Text>
                <View style={styles.overallStatsCard}>
                    <Text style={styles.overallStatsTitle}>전체 정확도</Text>
                    <Text style={styles.overallStatsValue}>
                        {totalAttempts === 0 ? 'N/A' : `${Math.round(overallAccuracy)}%`}
                    </Text>
                    <Text style={styles.overallStatsDetail}>
                        총 {totalAttempts}회 시도 · {totalCorrect}회 정답
                    </Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.statsContainer}>
                {sortedStats.map(([name, { correct, total }]) => {
                    const accuracy = total === 0 ? 'N/A' : `${Math.round((correct / total) * 100)}%`;
                    const grade = getGrade(correct, total);
                    return (
                        <View key={name} style={styles.statCard}>
                            <View style={styles.statCardHeader}>
                                <Text style={styles.statName}>{name}</Text>
                                <View style={styles.gradeContainer}>
                                    <Text style={styles.gradeEmoji}>{grade.emoji}</Text>
                                    <Text style={[styles.gradeLabel, { color: grade.color }]}>
                                        {grade.label}
                                    </Text>
                                </View>
                            </View>

                            {total > 0 ? (
                                <>
                                    <View style={styles.progressBarContainer}>
                                        <View
                                            style={[
                                                styles.progressBar,
                                                {
                                                    width: `${(correct / total) * 100}%`,
                                                    backgroundColor: grade.color
                                                }
                                            ]}
                                        />
                                    </View>
                                    <View style={styles.statDetails}>
                                        <Text style={styles.accuracyText}>
                                            {accuracy}
                                        </Text>
                                        <Text style={styles.attemptText}>
                                            {correct}/{total}회
                                        </Text>
                                    </View>
                                </>
                            ) : (
                                <Text style={styles.noDataText}>아직 시도하지 않았습니다</Text>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            <TouchableOpacity style={styles.statsBackButton} onPress={onGoHome} activeOpacity={0.8}>
                <Text style={styles.statsBackButtonText} numberOfLines={1}>🏠 홈으로</Text>
            </TouchableOpacity>
        </View>
    );
});

export function MatchGameListeningScreen() {
    return (
        <View style={styles.loadingContainer}>
            <WaveRipple
                size={LAYOUT.auditoryWaveAnimationSize}
                color="#79A1FF"
                style={styles.waveAnimation}
            />
            <Text style={styles.loadingText}>소리를 재생하고 있습니다...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundGray },
    title: { fontSize: LAYOUT.completionTextFontSize, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: LAYOUT.spacingLG, textAlign: 'center' },
    statsHeaderSection: {
        paddingHorizontal: LAYOUT.spacingMD,
        paddingTop: LAYOUT.spacingMD,
        paddingBottom: LAYOUT.spacingSM,
    },
    overallStatsCard: {
        backgroundColor: COLORS.background,
        borderRadius: LAYOUT.cardBorderRadius,
        padding: LAYOUT.spacingMD,
        marginTop: LAYOUT.spacingSM,
        elevation: 3,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        alignItems: 'center',
    },
    overallStatsTitle: {
        fontSize: LAYOUT.smallButtonTextFontSize,
        color: COLORS.textSecondary,
        marginBottom: LAYOUT.spacingXS,
    },
    overallStatsValue: {
        fontSize: LAYOUT.auditoryOverallStatsValueFontSize,
        fontWeight: 'bold',
        color: COLORS.blue,
        marginBottom: LAYOUT.spacingXS,
    },
    overallStatsDetail: {
        fontSize: LAYOUT.totalCountFontSize,
        color: COLORS.textLight,
    },
    statsContainer: {
        paddingHorizontal: LAYOUT.spacingMD,
        paddingTop: LAYOUT.spacingSM,
        paddingBottom: LAYOUT.spacingMD
    },
    statCard: {
        backgroundColor: COLORS.background,
        borderRadius: LAYOUT.auditoryStatsCardBorderRadius,
        padding: LAYOUT.auditoryStatsCardPadding,
        marginBottom: LAYOUT.auditoryStatsCardMarginBottom,
        elevation: 2,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    statCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: LAYOUT.spacingSM,
    },
    statName: {
        fontSize: LAYOUT.completedTitleFontSize,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    gradeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: LAYOUT.spacingXS,
    },
    gradeEmoji: {
        fontSize: LAYOUT.completedTitleFontSize,
    },
    gradeLabel: {
        fontSize: LAYOUT.totalCountFontSize,
        fontWeight: '600',
    },
    progressBarContainer: {
        height: LAYOUT.auditoryProgressBarHeight,
        backgroundColor: COLORS.grayLight,
        borderRadius: LAYOUT.auditoryProgressBarBorderRadius,
        overflow: 'hidden',
        marginBottom: LAYOUT.spacingXS,
    },
    progressBar: {
        height: '100%',
        borderRadius: LAYOUT.auditoryProgressBarBorderRadius,
    },
    statDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    accuracyText: {
        fontSize: LAYOUT.smallButtonTextFontSize,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    attemptText: {
        fontSize: LAYOUT.totalCountFontSize,
        color: COLORS.textSecondary,
    },
    noDataText: {
        fontSize: LAYOUT.totalCountFontSize,
        color: COLORS.textLight,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: LAYOUT.spacingXS,
    },
    statsBackButton: {
        backgroundColor: COLORS.successGreen,
        paddingVertical: LAYOUT.completeButtonPaddingV,
        paddingHorizontal: LAYOUT.spacingLG,
        borderRadius: LAYOUT.cardBorderRadius,
        marginVertical: LAYOUT.spacingXS,
        width: LAYOUT.auditoryStatsBackButtonWidthPercent,
        alignSelf: 'center',
        elevation: 3,
    },
    statsBackButtonText: {
        color: COLORS.white,
        fontSize: LAYOUT.buttonTextFontSize,
        fontWeight: 'bold',
        textAlign: 'center',
        flexShrink: 0,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: LAYOUT.auditoryLoadingTextMarginTop,
        fontSize: LAYOUT.smallButtonTextFontSize,
        color: COLORS.textLoading,
        textAlign: 'center',
        fontWeight: '500',
    },
    waveAnimation: {
        width: LAYOUT.auditoryWaveAnimationSize,
        height: LAYOUT.auditoryWaveAnimationSize,
    },
});
