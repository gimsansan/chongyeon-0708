import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import MissionProgressIcon from '../../../../components/MissionProgressIcon';
import { createMatchGameScreenStyles, getMatchGameScreenBg, MATCH_THEME, MatchGameListeningScreen, MatchGameStatsScreen, MatchGameStatusChips } from '../../../../components/game/MatchGameShared';
import { ClearContext } from '../../../../context/ClearContext';
import { StarContext } from '../../../../context/StarContext';
import { SOUNDS_CONFIG } from '../../../../constants/animalSounds';
import { gameAudioManager } from '../../../../services/GameAudioManager';
import { useSyncGameData } from '../../../../hooks/useSyncGameData';

const LEARNING_RATE = 0.1;

const MAX_CHOICES = 3;
const STORAGE_KEY = '@AuditoryTrainingAppPG:gameState';

type GameStatus = 'HOME' | 'LOADING' | 'LISTENING' | 'PLAYING' | 'RESULTS' | 'STATS';
type GameMode = 'STANDARD' | 'WEAKNESS';
type Policy = { [state: string]: { [action: string]: number } };
type UserStats = { [sound: string]: { correct: number; total: number } };

type GameState = {
    status: GameStatus;
    mode: GameMode;
    difficulty: number;
    policy: Policy;
    userStats: UserStats;
    remainingChoices: number;
    correctSoundNames: Set<string>;
    userSelections: { [key: string]: 'correct' | 'incorrect' };
    score: number;
    roundResult: 'WIN' | 'LOSE' | null;
    hasLostChanceInRun: boolean; // 기회 소모 여부 추적
    // 전송용 데이터 수집 상태
    playedDifficulty: number;      // 이번 라운드 시작 시 난이도
    gameStartTime: number | null;  // 조작 시작 시간
    roundWrongAttempts: string[];  // 이번 라운드 오답 목록
};

type Action =
    | { type: 'LOAD_DATA_SUCCESS'; payload: Partial<Pick<GameState, 'difficulty' | 'policy' | 'userStats'>> }
    | { type: 'LOAD_DATA_FAILURE' }
    | { type: 'SET_STATUS'; payload: GameStatus }
    | { type: 'START_GAME'; payload: { mode: GameMode; correctNames: Set<string>; isNewRun: boolean } }
    | { type: 'SELECT_ANSWER'; payload: { selectedName: string; isCorrect: boolean } };

const initialPolicy = SOUNDS_CONFIG.reduce((acc, s) => ({
    ...acc,
    [s.name]: SOUNDS_CONFIG.reduce((policy, i) => ({ ...policy, [i.name]: 1 / SOUNDS_CONFIG.length }), {})
}), {});

const initialUserStats = SOUNDS_CONFIG.reduce((acc, s) => ({ ...acc, [s.name]: { correct: 0, total: 0 } }), {});

const initialState: GameState = {
    status: 'LOADING',
    mode: 'STANDARD',
    difficulty: 1,
    policy: initialPolicy,
    userStats: initialUserStats,
    remainingChoices: MAX_CHOICES,
    correctSoundNames: new Set(),
    userSelections: {},
    score: 0,
    roundResult: null,
    hasLostChanceInRun: false, // 초기값 설정
    playedDifficulty: 1,
    gameStartTime: null,
    roundWrongAttempts: [],
};

function gameReducer(state: GameState, action: Action): GameState {
    switch (action.type) {
        case 'LOAD_DATA_SUCCESS':
            return { ...state, ...action.payload, status: 'HOME' };
        case 'LOAD_DATA_FAILURE':
             return { ...state, status: 'HOME' };
        case 'SET_STATUS':
            return { ...state, status: action.payload };
        case 'START_GAME':
            return {
                ...state,
                status: 'PLAYING',
                mode: action.payload.mode,
                correctSoundNames: action.payload.correctNames,
                userSelections: {},
                score: 0,
                remainingChoices: MAX_CHOICES,
                roundResult: null,
                // 새로운 게임 시작 시에만 기회 소모 여부 초기화
                hasLostChanceInRun: action.payload.isNewRun ? false : state.hasLostChanceInRun,
                // 라운드 기록 초기화 및 현재 난이도 고정
                playedDifficulty: state.difficulty,
                roundWrongAttempts: [],
                gameStartTime: Date.now(), // 반응 시간 측정 시작
            };
        case 'SELECT_ANSWER': {
            const { selectedName, isCorrect } = action.payload;
            if (state.userSelections[selectedName]) return state;

            const newSelections = { ...state.userSelections, [selectedName]: isCorrect ? 'correct' : 'incorrect' as 'correct' | 'incorrect' };
            const newStats = { ...state.userStats };
            const statsForSelection = newStats[selectedName] || { correct: 0, total: 0 };
            newStats[selectedName] = { correct: statsForSelection.correct + (isCorrect ? 1 : 0), total: statsForSelection.total + 1 };
            const newPolicy = JSON.parse(JSON.stringify(state.policy));
            const reward = isCorrect ? 1 : -1;
            const policyForState = newPolicy[selectedName];
            const currentProb = policyForState[selectedName];
            const newUnnormalizedProb = currentProb * Math.exp(LEARNING_RATE * reward);
            policyForState[selectedName] = newUnnormalizedProb;
            const totalProb = Object.values(policyForState).reduce((sum: number, p: any) => sum + p, 0);

            if (totalProb > 0) {
                Object.keys(policyForState).forEach(actionKey => {
                    policyForState[actionKey] /= totalProb;
                });
            }

            const newCorrectNames = new Set(state.correctSoundNames);
            if (isCorrect) newCorrectNames.delete(selectedName);

            const didWin = newCorrectNames.size === 0;
            const didLose = !isCorrect && state.remainingChoices - 1 <= 0;
            const isFinished = didWin || didLose;
            const newDifficulty = didWin ? state.difficulty + 1 : (didLose && state.difficulty > 1 ? state.difficulty - 1 : state.difficulty);

            return {
                ...state,
                userSelections: newSelections,
                correctSoundNames: newCorrectNames,
                remainingChoices: isCorrect ? state.remainingChoices : state.remainingChoices - 1,
                score: isCorrect ? state.score + (10 * state.difficulty) : state.score,
                status: isFinished ? 'RESULTS' : 'PLAYING',
                difficulty: newDifficulty,
                userStats: newStats,
                policy: newPolicy,
                roundResult: isFinished ? (didWin ? 'WIN' : 'LOSE') : null,
                // 오답 시 기회 소모 기록
                hasLostChanceInRun: state.hasLostChanceInRun || !isCorrect,
                // 오답일 경우 어떤 동물을 눌렀는지 기록
                roundWrongAttempts: isCorrect ? state.roundWrongAttempts : [...state.roundWrongAttempts, selectedName],
            };
        }
        default:
            return state;
    }
}

// ===================================================================================
// 📁 src/hooks/useAuditoryGame.ts
// ===================================================================================
const useAuditoryGame = () => {
    const [state, dispatch] = useReducer(gameReducer, initialState);
    const { syncData } = useSyncGameData(); // 전송용 데이터
    
    const starContext = useContext(StarContext);
    const clearContext = useContext(ClearContext);
    
    // 이전 난이도를 추적하기 위한 ref
    const prevDifficultyRef = useRef<number>(state.difficulty);
    useEffect(() => {
        prevDifficultyRef.current = state.difficulty;
    });
    const previousDifficulty = prevDifficultyRef.current;
    
    // 난이도 변경 감지하여 미션/클리어 조건 확인
    useEffect(() => {
        // 난이도가 2에서 3으로 상승하는 순간
        if (previousDifficulty === 2 && state.difficulty === 3) {
            starContext?.addStar('matchGamePG'); // 별 획득
            if (!state.hasLostChanceInRun) {
                clearContext?.markAsCleared('matchGamePG'); // 기회 소모 없었으면 클리어
            }
        }
    }, [state.difficulty, state.hasLostChanceInRun, previousDifficulty, starContext, clearContext]);

    useEffect(() => {
        const loadData = async () => {
            try {
                await gameAudioManager.loadSoundsAsync();
                const savedData = await AsyncStorage.getItem(STORAGE_KEY);
                if (savedData) {
                    const parsedData = JSON.parse(savedData);
                    dispatch({ type: 'LOAD_DATA_SUCCESS', payload: { ...parsedData } });
                } else {
                    dispatch({ type: 'LOAD_DATA_FAILURE' });
                }
            } catch (e) {
                console.error("데이터 로딩 실패", e);
                dispatch({ type: 'LOAD_DATA_FAILURE' });
            }
        };
        loadData();
    }, []);

    // RESULTS 상태가 되면 전송
    useEffect(() => {
        if (state.status === 'RESULTS') {
            const endTime = Date.now();
            const durationSeconds = state.gameStartTime ? (endTime - state.gameStartTime) / 1000 : 0;

            const medicalDataPayload = {
                difficulty: state.playedDifficulty, // 💡 실제 플레이했던 난이도
                score: state.score,
                roundResult: state.roundResult,
                userStats: state.userStats,         // 전체 누적 통계
                wrong_selections: state.roundWrongAttempts, // 이번 판 구체적 오답
                error_count: state.roundWrongAttempts.length,
                completion_time_seconds: parseFloat(durationSeconds.toFixed(2)) // 소수점 2자리
            };

            console.log("🚀 [의료 데이터 전송] matchGamePG:", medicalDataPayload);
            syncData('matchGamePG', medicalDataPayload);
        }
    }, [state.status, syncData]);

    useEffect(() => {
        if (state.status !== 'LOADING') {
            const dataToSave = {
                difficulty: state.difficulty,
                policy: state.policy,
                userStats: state.userStats,
            };
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
        }
    }, [state.difficulty, state.policy, state.userStats]);

    const startGame = useCallback(async (mode: GameMode, isNewRun: boolean = false) => {
        let quizSounds: { name: string; file: any }[] = [];
        const soundCount = Math.min(2 + state.difficulty, SOUNDS_CONFIG.length);
        let useStandardMode = mode === 'STANDARD';

        if (mode === 'WEAKNESS') {
            const accuracies = Object.entries(state.userStats)
                .map(([name, { correct, total }]) => ({ name, acc: total < 3 ? 1 : correct / total }))
                .sort((a, b) => a.acc - b.acc);
            
            const weakSoundsSet = new Set(accuracies.slice(0, soundCount).map(s => s.name));
            
            if (weakSoundsSet.size >= 2) {
                quizSounds = SOUNDS_CONFIG.filter(s => weakSoundsSet.has(s.name));
            } else {
                useStandardMode = true;
            }
        }

        // ✅ 소리 재생 전: "LISTENING" 상태로 전환
        dispatch({ type: 'SET_STATUS', payload: 'LISTENING' });
        
        if (useStandardMode) {
            const shuffled = [...SOUNDS_CONFIG].sort(() => 0.5 - Math.random());
            quizSounds = shuffled.slice(0, soundCount);
        }

        // --- 디버그 로그: 제거 시 아래 블록 전체 삭제 후, 맨 아래 주석 처리된 원본 for 루프 주석 해제 ---
        const playOrder = quizSounds.map((s) => s.name);
        console.log('[matchGamePG] 이번 라운드 재생 순서 (정답 후보):', playOrder.join(' → '));

        for (let i = 0; i < quizSounds.length; i++) {
            const sound = quizSounds[i];
            console.log(`[matchGamePG] 재생 ${i + 1}/${quizSounds.length}: "${sound.name}"`);
            await gameAudioManager.playSound(sound.name);
            await new Promise(resolve => setTimeout(resolve, 800));
        }
        // --- /디버그 ---

        // [원본] 로그 없이 재생 (위 디버그 블록 삭제 후 이 주석만 해제)
        // for (const sound of quizSounds) {
        //     await gameAudioManager.playSound(sound.name);
        //     await new Promise(resolve => setTimeout(resolve, 800));
        // }

        dispatch({ type: 'START_GAME', payload: { mode, correctNames: new Set(quizSounds.map(s => s.name)), isNewRun } });
    }, [state.difficulty, state.userStats]);

    const handleSelectAnswer = useCallback((selectedName: string) => {
        if (state.status !== 'PLAYING') return;
        const isCorrect = state.correctSoundNames.has(selectedName);
        dispatch({ type: 'SELECT_ANSWER', payload: { selectedName, isCorrect } });
    }, [state.status, state.correctSoundNames]);

    const navigate = (status: GameStatus) => dispatch({ type: 'SET_STATUS', payload: status });

    return { state, startGame, handleSelectAnswer, navigate };
};

// ===================================================================================
// 📁 src/screens/ (UI 화면 컴포넌트들)
// ===================================================================================
const HomeScreen = memo(({ onStartGame, onShowStats }: { onStartGame: (mode: GameMode, isNewRun: boolean) => void, onShowStats: () => void }) => (
    <View style={styles.centered}>
        <Text style={styles.mainTitle}>🎯 청능 훈련 (PG)</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => onStartGame('STANDARD', true)} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>표준 모드</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => onStartGame('WEAKNESS', true)} activeOpacity={0.8}>
            <Text style={styles.secondaryButtonText}>약점 훈련 모드</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statsButton} onPress={onShowStats} activeOpacity={0.8}>
            <Text style={styles.statsButtonText} numberOfLines={1}>내 통계 보기</Text>
        </TouchableOpacity>
    </View>
));

const GameScreen = memo(({ state, onSelect }: { state: GameState, onSelect: (name: string) => void }) => (
    <View style={styles.centered}>
        <MatchGameStatusChips
            difficulty={state.difficulty}
            remainingChoices={state.remainingChoices}
            score={state.score}
            maxChoices={MAX_CHOICES}
        />
        <Text style={styles.statusText}>들었던 소리를 모두 선택하세요</Text>
        <View style={styles.gameBoard}>
            {SOUNDS_CONFIG.map(({ name }) => {
                const status = state.userSelections[name];
                return (
                    <TouchableOpacity
                        key={name}
                        style={[
                            styles.gameButton,
                            status === 'correct' && styles.correctButton,
                            status === 'incorrect' && styles.incorrectButton,
                            !!status && styles.disabledButton,
                        ]}
                        onPress={() => onSelect(name)}
                        disabled={!!status}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            styles.gameButtonText,
                            status === 'correct' && styles.correctButtonText,
                            status === 'incorrect' && styles.incorrectButtonText,
                        ]}>
                            {name}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    </View>
));

const ResultsScreen = memo(({ state, onContinue, onGoHome }: { state: GameState, onContinue: (mode: GameMode, isNewRun: boolean) => void, onGoHome: () => void }) => (
    <View style={styles.centered}>
        <View style={styles.resultTitleCard}>
            <View style={styles.resultTitleRow}>
                <Ionicons name={state.roundResult === 'WIN' ? 'trophy' : 'sad'} size={28} color={MATCH_THEME.text} />
                <Text style={styles.resultTitle}>{state.roundResult === 'WIN' ? '라운드 성공!' : '라운드 실패'}</Text>
            </View>
        </View>
        <Text style={styles.resultText}>최종 점수: {state.score}</Text>
        {state.roundResult === 'LOSE' &&
            <Text style={styles.resultText}>남은 정답: {[...state.correctSoundNames].join(', ') || '없음'}</Text>
        }
        <TouchableOpacity style={styles.resultPrimaryButton} onPress={() => onContinue(state.mode, false)} activeOpacity={0.8}>
            <Text style={styles.resultPrimaryButtonText}>계속하기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statsButton} onPress={onGoHome} activeOpacity={0.8}>
            <Text style={styles.statsButtonText}>홈으로</Text>
        </TouchableOpacity>
    </View>
));

export default function MatchGamePG() {
    const { state, startGame, handleSelectAnswer, navigate } = useAuditoryGame();

    const renderScreen = () => {
        switch (state.status) {
            case 'HOME': return <HomeScreen onStartGame={startGame} onShowStats={() => navigate('STATS')} />;
            case 'PLAYING': return <GameScreen state={state} onSelect={handleSelectAnswer} />;
            case 'RESULTS': return <ResultsScreen state={state} onContinue={startGame} onGoHome={() => navigate('HOME')} />;
            case 'STATS': return <MatchGameStatsScreen stats={state.userStats} onGoHome={() => navigate('HOME')} />;
            case 'LISTENING': return <MatchGameListeningScreen />;
            case 'LOADING': default: return <View style={styles.centered}><ActivityIndicator size="large" color={MATCH_THEME.gold} /></View>;
        }
    };

        return (
      <View style={[styles.container, { backgroundColor: getMatchGameScreenBg(state.status) }]}>
        {state.status !== 'LOADING' && state.status !== 'HOME' && (
          <MissionProgressIcon
            gameId="matchGamePG"
            title="PG 훈련 미션"
            missionText="난이도 3 도달하기"
            clearText="기회 소모 없이 난이도 3 도달"
            progressItems={[
              { label: '현재 난이도', value: state.difficulty },
              { label: '이번 런 기회 소모', value: state.hasLostChanceInRun ? '있음' : '없음' }
            ]}
          />
        )}
        {renderScreen()}
      </View>
    );
}

const styles = createMatchGameScreenStyles(MATCH_THEME.accentAI);