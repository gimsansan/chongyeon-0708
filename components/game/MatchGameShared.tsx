import React, { memo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { LAYOUT } from '../../constants/layout';
import WaveRipple from '../WaveRipple';

export const MATCH_THEME = {
    bg: '#352B46',
    bgEntry: '#645185',
    bgDeep: '#8D7AAE',
    card: '#4A3B66',
    tile: '#FFF7E8',
    tileText: '#2A1F3D',
    tileBorder: '#2A1F3D',
    text: '#FFF7E8',
    textMuted: 'rgba(255, 247, 232, 0.86)',
    border: 'rgba(255, 247, 232, 0.22)',
    gold: '#FFD54F',
    goldSoft: '#F4E7A8',
    mint: '#6FE0B0',
    accentAI: '#FF7A8A',
    accentPG: '#A78BFA',
    rose: '#F06B7C',
    ink: '#1A1420',
    correctBg: '#6FE0B0',
    correctBorder: '#1F6B4A',
    incorrectBg: '#E4485C',
    incorrectBorder: '#8B1E2C',
    heartOff: 'rgba(255, 247, 232, 0.36)',
    track: 'rgba(255, 247, 232, 0.18)',
} as const;

export function getMatchGameScreenBg(status: string) {
    return status === 'HOME' || status === 'LOADING'
        ? MATCH_THEME.bgEntry
        : MATCH_THEME.bgDeep;
}

export function createMatchGameScreenStyles(accent: string) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: MATCH_THEME.bgEntry },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: LAYOUT.spacingMD },
        mainTitle: {
            fontSize: LAYOUT.sectionTitleFontSize,
            fontWeight: '900',
            color: MATCH_THEME.text,
            marginBottom: LAYOUT.spacingLG,
            textAlign: 'center',
        },
        resultTitleCard: {
            backgroundColor: MATCH_THEME.card,
            borderRadius: 18,
            paddingVertical: LAYOUT.spacingMD,
            paddingHorizontal: LAYOUT.spacingLG,
            marginBottom: LAYOUT.spacingLG,
            borderWidth: 1,
            borderColor: MATCH_THEME.border,
        },
        resultTitle: {
            fontSize: LAYOUT.sectionTitleFontSize,
            fontWeight: '900',
            color: '#FFFFFF',
            textAlign: 'center',
        },
        statusText: {
            fontSize: LAYOUT.hintTextFontSize,
            fontWeight: '500',
            color: MATCH_THEME.textMuted,
            marginBottom: LAYOUT.spacingMD,
            textAlign: 'center',
        },
        gameBoard: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: '100%' },
        resultText: {
            fontSize: LAYOUT.completedTitleFontSize,
            marginVertical: LAYOUT.spacingXS,
            textAlign: 'center',
            color: '#FFFFFF',
        },
        primaryButton: {
            backgroundColor: accent,
            paddingVertical: LAYOUT.completeButtonPaddingV,
            paddingHorizontal: LAYOUT.spacingLG,
            borderRadius: 18,
            marginVertical: LAYOUT.spacingXS,
            width: LAYOUT.auditoryPrimaryButtonWidthPercent,
        },
        resultPrimaryButton: {
            backgroundColor: accent,
            paddingVertical: LAYOUT.completeButtonPaddingV,
            paddingHorizontal: LAYOUT.spacingLG,
            borderRadius: 18,
            marginVertical: LAYOUT.spacingXS,
            width: LAYOUT.auditoryPrimaryButtonWidthPercent,
        },
        resultPrimaryButtonText: {
            color: '#FFFFFF',
            fontSize: LAYOUT.buttonTextFontSize,
            fontWeight: '800',
            textAlign: 'center',
        },
        primaryButtonText: {
            color: MATCH_THEME.text,
            fontSize: LAYOUT.buttonTextFontSize,
            fontWeight: '800',
            textAlign: 'center',
        },
        secondaryButton: {
            backgroundColor: MATCH_THEME.gold,
            paddingVertical: LAYOUT.completeButtonPaddingV,
            paddingHorizontal: LAYOUT.spacingLG,
            borderRadius: 18,
            marginVertical: LAYOUT.spacingXS,
            width: LAYOUT.auditoryPrimaryButtonWidthPercent,
        },
        secondaryButtonText: {
            color: MATCH_THEME.ink,
            fontSize: LAYOUT.buttonTextFontSize,
            fontWeight: '800',
            textAlign: 'center',
        },
        statsButton: {
            backgroundColor: MATCH_THEME.mint,
            paddingVertical: LAYOUT.completeButtonPaddingV,
            paddingHorizontal: LAYOUT.spacingLG,
            borderRadius: 18,
            marginVertical: LAYOUT.spacingXS,
            width: LAYOUT.auditoryPrimaryButtonWidthPercent,
        },
        statsButtonText: {
            color: MATCH_THEME.ink,
            fontSize: LAYOUT.buttonTextFontSize,
            fontWeight: '800',
            textAlign: 'center',
            flexShrink: 0,
        },
        gameButton: {
            backgroundColor: MATCH_THEME.tile,
            paddingVertical: LAYOUT.spacingSM,
            paddingHorizontal: LAYOUT.spacingMD,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: MATCH_THEME.tileBorder,
            margin: LAYOUT.auditoryGameButtonMargin,
            minWidth: LAYOUT.auditoryGameButtonMinWidth,
        },
        correctButton: {
            backgroundColor: MATCH_THEME.correctBg,
            borderColor: MATCH_THEME.correctBorder,
        },
        incorrectButton: {
            backgroundColor: MATCH_THEME.incorrectBg,
            borderColor: MATCH_THEME.incorrectBorder,
        },
        disabledButton: {
            opacity: 1,
        },
        gameButtonText: {
            color: MATCH_THEME.tileText,
            fontSize: LAYOUT.smallButtonTextFontSize,
            fontWeight: '700',
            textAlign: 'center',
        },
        correctButtonText: {
            color: '#1A1420',
        },
        incorrectButtonText: {
            color: '#FFFFFF',
        },
        disabledButtonText: {
            color: MATCH_THEME.tileText,
        },
    });
}

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
                <Text style={styles.title}>내 통계</Text>
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

export const MatchGameStatusChips = memo(function MatchGameStatusChips({
    difficulty,
    remainingChoices,
    score,
    maxChoices = 3,
}: {
    difficulty: number;
    remainingChoices: number;
    score: number;
    maxChoices?: number;
}) {
    return (
        <View style={styles.statusRow}>
            <View style={styles.chip}>
                <Text style={styles.chipText}>LV {difficulty}</Text>
            </View>
            <View style={styles.chip}>
                {Array.from({ length: maxChoices }, (_, i) => (
                    <Text
                        key={i}
                        style={[styles.heart, i < remainingChoices ? styles.heartOn : styles.heartOff]}
                    >
                        {i < remainingChoices ? '♥' : '♡'}
                    </Text>
                ))}
            </View>
            <View style={styles.chip}>
                <Text style={styles.chipText}>{score}점</Text>
            </View>
        </View>
    );
});

export function MatchGameListeningScreen() {
    return (
        <View style={styles.loadingContainer}>
            <WaveRipple
                size={LAYOUT.auditoryWaveAnimationSize}
                color={MATCH_THEME.goldSoft}
                style={styles.waveAnimation}
            />
            <Text style={styles.loadingText}>소리를 재생하고 있습니다...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: MATCH_THEME.bgDeep },
    title: { fontSize: LAYOUT.completionTextFontSize, fontWeight: '900', color: MATCH_THEME.text, marginBottom: LAYOUT.spacingLG, textAlign: 'center' },
    statsHeaderSection: {
        paddingHorizontal: LAYOUT.spacingMD,
        paddingTop: LAYOUT.spacingMD,
        paddingBottom: LAYOUT.spacingSM,
    },
    overallStatsCard: {
        backgroundColor: MATCH_THEME.card,
        borderRadius: 18,
        padding: LAYOUT.spacingMD,
        marginTop: LAYOUT.spacingSM,
        borderWidth: 1,
        borderColor: MATCH_THEME.border,
        alignItems: 'center',
    },
    overallStatsTitle: {
        fontSize: LAYOUT.smallButtonTextFontSize,
        color: MATCH_THEME.textMuted,
        marginBottom: LAYOUT.spacingXS,
    },
    overallStatsValue: {
        fontSize: LAYOUT.auditoryOverallStatsValueFontSize,
        fontWeight: '900',
        color: MATCH_THEME.goldSoft,
        marginBottom: LAYOUT.spacingXS,
    },
    overallStatsDetail: {
        fontSize: LAYOUT.totalCountFontSize,
        color: MATCH_THEME.textMuted,
    },
    statsContainer: {
        paddingHorizontal: LAYOUT.spacingMD,
        paddingTop: LAYOUT.spacingSM,
        paddingBottom: LAYOUT.spacingMD
    },
    statCard: {
        backgroundColor: MATCH_THEME.card,
        borderRadius: 18,
        padding: LAYOUT.auditoryStatsCardPadding,
        marginBottom: LAYOUT.auditoryStatsCardMarginBottom,
        borderWidth: 1,
        borderColor: MATCH_THEME.border,
    },
    statCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: LAYOUT.spacingSM,
    },
    statName: {
        fontSize: LAYOUT.completedTitleFontSize,
        fontWeight: '800',
        color: MATCH_THEME.text,
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
        backgroundColor: MATCH_THEME.track,
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
        fontWeight: '800',
        color: MATCH_THEME.text,
    },
    attemptText: {
        fontSize: LAYOUT.totalCountFontSize,
        color: MATCH_THEME.textMuted,
    },
    noDataText: {
        fontSize: LAYOUT.totalCountFontSize,
        color: MATCH_THEME.textMuted,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: LAYOUT.spacingXS,
    },
    statsBackButton: {
        backgroundColor: MATCH_THEME.mint,
        paddingVertical: LAYOUT.completeButtonPaddingV,
        paddingHorizontal: LAYOUT.spacingLG,
        borderRadius: 18,
        marginVertical: LAYOUT.spacingXS,
        width: LAYOUT.auditoryStatsBackButtonWidthPercent,
        alignSelf: 'center',
    },
    statsBackButtonText: {
        color: MATCH_THEME.ink,
        fontSize: LAYOUT.buttonTextFontSize,
        fontWeight: '800',
        textAlign: 'center',
        flexShrink: 0,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: MATCH_THEME.bgDeep,
    },
    loadingText: {
        marginTop: LAYOUT.auditoryLoadingTextMarginTop,
        fontSize: LAYOUT.smallButtonTextFontSize,
        color: MATCH_THEME.textMuted,
        textAlign: 'center',
        fontWeight: '500',
    },
    waveAnimation: {
        width: LAYOUT.auditoryWaveAnimationSize,
        height: LAYOUT.auditoryWaveAnimationSize,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: LAYOUT.spacingSM,
        marginBottom: LAYOUT.spacingMD,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: MATCH_THEME.card,
        borderWidth: 1,
        borderColor: MATCH_THEME.border,
        borderRadius: 18,
        paddingVertical: LAYOUT.spacingSM,
        paddingHorizontal: LAYOUT.spacingMD,
    },
    chipText: {
        fontSize: LAYOUT.hintTextFontSize,
        fontWeight: '800',
        color: MATCH_THEME.text,
    },
    heart: {
        fontSize: LAYOUT.hintTextFontSize,
        marginHorizontal: 1,
    },
    heartOn: {
        color: MATCH_THEME.rose,
    },
    heartOff: {
        color: MATCH_THEME.heartOff,
    },
});
