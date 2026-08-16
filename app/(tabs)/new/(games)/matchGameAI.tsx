import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { memo, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import MissionProgressIcon from '../../../../components/MissionProgressIcon';
import { createMatchGameScreenStyles, MATCH_THEME, MatchGameListeningScreen, MatchGameStatsScreen, MatchGameStatusChips } from '../../../../components/game/MatchGameShared';
import { ClearContext } from '../../../../context/ClearContext';
import { StarContext } from '../../../../context/StarContext';
import { SOUNDS_CONFIG } from '../../../../constants/animalSounds';
import { gameAudioManager } from '../../../../services/GameAudioManager';
import { useSyncGameData } from '../../../../hooks/useSyncGameData';

const LEARNING_RATE = 0.1;
const DISCOUNT_FACTOR = 0.9;
const MAX_CHOICES = 3;
const STORAGE_KEY = '@AuditoryTrainingApp:gameState';

type GameStatus = 'HOME' | 'LOADING' | 'LISTENING' | 'PLAYING' | 'RESULTS' | 'STATS';
type GameMode = 'STANDARD' | 'WEAKNESS';
type QTable = { [state: string]: { [action: string]: number } };
type UserStats = { [sound: string]: { correct: number; total: number } };

type GameState = {
    status: GameStatus;
    mode: GameMode;
    difficulty: number;
    qTable: QTable;
    userStats: UserStats;
    remainingChoices: number;
    correctSoundNames: Set<string>;
    userSelections: { [key: string]: 'correct' | 'incorrect' };
    score: number;
    roundResult: 'WIN' | 'LOSE' | null;
    // ====[ 미션 추가 1: 미션 달성을 위한 상태 추가 ]====
    hasLostChanceInRun: boolean;
    // ===============================================
    // 전송용 데이터 수집 상태
    playedDifficulty: number;      // 이번 라운드 시작 시 난이도
    gameStartTime: number | null;  // 조작 시작 시간
    roundWrongAttempts: string[];  // 이번 라운드 오답 목록
};

type Action =
    | { type: 'LOAD_DATA_SUCCESS'; payload: Partial<Pick<GameState, 'difficulty' | 'qTable' | 'userStats'>> }
    | { type: 'LOAD_DATA_FAILURE' }
    | { type: 'SET_STATUS'; payload: GameStatus }
    | { type: 'GAME_START_REQUEST'; payload: { mode: GameMode; isNewRun: boolean } } // isNewRun 추가
    | { type: 'GAME_START_SUCCESS'; payload: { correctNames: Set<string> } }
    | { type: 'SELECT_ANSWER'; payload: { selectedName: string; isCorrect: boolean } };

const initialQTable = SOUNDS_CONFIG.reduce((acc, s) => ({ ...acc, [s.name]: SOUNDS_CONFIG.reduce((q, i) => ({ ...q, [i.name]: 0 }), {}) }), {});
const initialUserStats = SOUNDS_CONFIG.reduce((acc, s) => ({ ...acc, [s.name]: { correct: 0, total: 0 } }), {});

const initialState: GameState = {
    status: 'LOADING',
    mode: 'STANDARD',
    difficulty: 1,
    qTable: initialQTable,
    userStats: initialUserStats,
    remainingChoices: MAX_CHOICES,
    correctSoundNames: new Set(),
    userSelections: {},
    score: 0,
    roundResult: null,
    // ====[ 미션 추가 2: 상태 초기값 설정 ]====
    hasLostChanceInRun: false,
    // =====================================
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
        case 'GAME_START_REQUEST':
            return {
                ...state,
                status: 'PLAYING',
                mode: action.payload.mode,
                userSelections: {},
                score: 0,
                remainingChoices: MAX_CHOICES,
                roundResult: null,
                // ====[ 미션 추가 3: 게임 시작 시 미션 상태 초기화 ]====
                hasLostChanceInRun: action.payload.isNewRun ? false : state.hasLostChanceInRun,
                // ===============================================
                // 라운드 기록 초기화 및 현재 난이도 고정
                playedDifficulty: state.difficulty,
                roundWrongAttempts: [],
                gameStartTime: Date.now(), // 여기서부터 시간 측정 시작
            };
        case 'GAME_START_SUCCESS':
            return { ...state, correctSoundNames: action.payload.correctNames };
        case 'SELECT_ANSWER': {
            const { selectedName, isCorrect } = action.payload;
            const newSelections = { ...state.userSelections, [selectedName]: isCorrect ? 'correct' : 'incorrect' } as const;
            const newStats = { ...state.userStats };
            const newQTable = JSON.parse(JSON.stringify(state.qTable));
            const reward = isCorrect ? 1 : -1;

            state.correctSoundNames.forEach(name => {
                if(!state.userSelections[name]){
                    newStats[name] = { correct: newStats[name].correct + (isCorrect ? 1 : 0), total: newStats[name].total + 1 };
                    const futureQValues = Object.values(newQTable[selectedName] ?? {}) as number[];
                    const maxFutureQ = futureQValues.length > 0 ? Math.max(...futureQValues) : 0;
                    const oldQ = newQTable[name]?.[selectedName] ?? 0;
                    newQTable[name][selectedName] = oldQ + LEARNING_RATE * (reward + DISCOUNT_FACTOR * maxFutureQ - oldQ);
                }
            });
            
            const newCorrectNames = new Set(state.correctSoundNames);
            if (isCorrect) newCorrectNames.delete(selectedName);

            const didWin = newCorrectNames.size === 0;
            const didLose = !isCorrect && state.remainingChoices - 1 <= 0;
            const isFinished = didWin || didLose;
            const newDifficulty = didWin ? state.difficulty + 1 : (didLose && state.difficulty > 1 ? state.difficulty - 1 : state.difficulty); // 오답 시 난이도 하락 로직 추가

            return {
                ...state,
                userSelections: newSelections,
                correctSoundNames: newCorrectNames,
                remainingChoices: isCorrect ? state.remainingChoices : state.remainingChoices - 1,
                score: isCorrect ? state.score + (10 * state.difficulty) : state.score,
                status: isFinished ? 'RESULTS' : 'PLAYING',
                difficulty: newDifficulty,
                userStats: newStats,
                qTable: newQTable,
                roundResult: isFinished ? (didWin ? 'WIN' : 'LOSE') : null,
                // ====[ 미션 추가 4: 실수 기록 ]====
                hasLostChanceInRun: state.hasLostChanceInRun || !isCorrect,
                // =================================
                // 오답 시 동물 이름 기록
                roundWrongAttempts: isCorrect ? state.roundWrongAttempts : [...state.roundWrongAttempts, selectedName],
            };
        }
        default:
            return state;
    }
}

const useAuditoryGame = () => {
    const [state, dispatch] = useReducer(gameReducer, initialState);
    const { syncData } = useSyncGameData(); // 전송용 데이터

    // ====[ 미션 추가 5: 컨텍스트 및 Ref 사용 ]====
    const starContext = useContext(StarContext);
    const clearContext = useContext(ClearContext);
    const prevDifficultyRef = useRef<number>(state.difficulty);
    useEffect(() => {
        prevDifficultyRef.current = state.difficulty;
    });
    const previousDifficulty = prevDifficultyRef.current;
    
    useEffect(() => {
        // 난이도가 2에서 3으로 상승하는 순간
        if (previousDifficulty === 2 && state.difficulty === 3) {
            starContext?.addStar('matchGameAI');
            if (!state.hasLostChanceInRun) {
                clearContext?.markAsCleared('matchGameAI');
            }
        }
    }, [state.difficulty, state.hasLostChanceInRun, previousDifficulty, starContext, clearContext]);
    // ===============================================

    useEffect(() => {
        const loadData = async () => {
            try {
                await gameAudioManager.loadSoundsAsync();
                const savedData = await AsyncStorage.getItem(STORAGE_KEY);
                if (savedData) {
                    const { difficulty, qTable, userStats } = JSON.parse(savedData);
                    dispatch({ type: 'LOAD_DATA_SUCCESS', payload: { difficulty, qTable, userStats } });
                } else {
                    dispatch({ type: 'LOAD_DATA_FAILURE' });
                }
            } catch (e) {
                console.error("데이터 로딩/초기화 실패", e);
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
                difficulty: state.playedDifficulty, // 💡 다음 난이도가 아닌 '플레이한' 난이도 전송
                score: state.score,
                roundResult: state.roundResult,
                userStats: state.userStats,         // 전체 통계
                wrong_selections: state.roundWrongAttempts, // 이번 판 오답
                error_count: state.roundWrongAttempts.length,
                completion_time_seconds: parseFloat(durationSeconds.toFixed(2)) // 소수점 2자리
            };

            console.log("🚀 [의료 데이터 전송] matchGameAI:", medicalDataPayload);
            syncData('matchGameAI', medicalDataPayload);
        }
    }, [state.status, syncData]);

    useEffect(() => {
        if (state.status === 'RESULTS' || state.status === 'HOME') {
            const dataToSave = {
                difficulty: state.difficulty,
                qTable: state.qTable,
                userStats: state.userStats,
            };
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
        }
    }, [state.status, state.difficulty, state.qTable, state.userStats]);
    
    // isNewRun 파라미터 추가
    const startGame = useCallback(async (mode: GameMode, isNewRun: boolean = false) => {
        dispatch({ type: 'GAME_START_REQUEST', payload: { mode, isNewRun } });

        let quizSounds: { name: string; file: any }[] = [];
        const soundCount = Math.min(state.difficulty + 2, SOUNDS_CONFIG.length);  // 소리 개수 제한
        let useStandardMode = mode === 'STANDARD';

        if (mode === 'WEAKNESS') {
            const accuracies = Object.entries(state.userStats)
            .map(([name, { correct, total }]) => ({ name, acc: total < 3 ? 1 : correct / total }))
            .sort((a, b) => a.acc - b.acc);
            
            const weakSoundsSet = new Set(accuracies.slice(0, soundCount).map(s => s.name));  // 약점 소리 선택
            
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

        // ✅ 순차적으로 재생 (모두 끝날 때까지 대기)
        // --- 디버그 로그: 제거 시 아래 블록 전체 삭제 후, 맨 아래 주석 처리된 원본 for 루프 주석 해제 ---
        const playOrder = quizSounds.map((s) => s.name);
        console.log('[matchGameAI] 이번 라운드 재생 순서 (정답 후보):', playOrder.join(' → '));

        for (let i = 0; i < quizSounds.length; i++) {
            const sound = quizSounds[i];
            console.log(`[matchGameAI] 재생 ${i + 1}/${quizSounds.length}: "${sound.name}"`);
            await gameAudioManager.playSound(sound.name);
            await new Promise(resolve => setTimeout(resolve, 800));
        }
        // --- /디버그 ---

        // [원본] 로그 없이 재생 (위 디버그 블록 삭제 후 이 주석만 해제)
        // for (const sound of quizSounds) {
        //     await gameAudioManager.playSound(sound.name);
        //     await new Promise(resolve => setTimeout(resolve, 800));
        // }

        // ✅ 재생 후 게임 시작 처리
        dispatch({ 
            type: 'GAME_START_SUCCESS', 
            payload: { correctNames: new Set(quizSounds.map(s => s.name)) } 
        });
        dispatch({ type: 'SET_STATUS', payload: 'PLAYING' });
    }, [state.difficulty, state.userStats, state.qTable]);


    const handleSelectAnswer = useCallback((selectedName: string) => {
        if (state.status !== 'PLAYING') return;
        const isCorrect = state.correctSoundNames.has(selectedName);
        dispatch({ type: 'SELECT_ANSWER', payload: { selectedName, isCorrect } });
    }, [state.status, state.correctSoundNames]);

    const navigate = (status: GameStatus) => dispatch({ type: 'SET_STATUS', payload: status });

    return { state, startGame, handleSelectAnswer, navigate };
};

const HomeScreen = memo(({ onStartGame, onShowStats }: { onStartGame: (mode: GameMode, isNewRun: boolean) => void, onShowStats: () => void }) => (
    <View style={styles.centered}>
        <Text style={styles.mainTitle}>🎯 청능 훈련 (Q-Learning)</Text>
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
                            !!status && styles.disabledButtonText
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
        <Text style={styles.mainTitle}>{state.roundResult === 'WIN' ? '🎉 라운드 성공! 🎉' : '😥 라운드 실패 😥'}</Text>
        <Text style={styles.resultText}>최종 점수: {state.score}</Text>
        {state.roundResult === 'LOSE' && 
            <Text style={styles.resultText}>남은 정답: {[...state.correctSoundNames].join(', ')}</Text>
        }
        <TouchableOpacity style={styles.primaryButton} onPress={() => onContinue(state.mode, false)} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>▶️ 계속하기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statsButton} onPress={onGoHome} activeOpacity={0.8}>
            <Text style={styles.statsButtonText}>🏠 홈으로</Text>
        </TouchableOpacity>
    </View>
));

export default function MatchGameAI() {
    const { state, startGame, handleSelectAnswer, navigate } = useAuditoryGame();

    const renderScreen = () => {
        switch (state.status) {
            case 'HOME': return <HomeScreen onStartGame={startGame} onShowStats={() => navigate('STATS')} />;
            case 'PLAYING': return <GameScreen state={state} onSelect={handleSelectAnswer} />;
            case 'RESULTS': return <ResultsScreen state={state} onContinue={startGame} onGoHome={() => navigate('HOME')} />;
            case 'STATS': return <MatchGameStatsScreen stats={state.userStats} onGoHome={() => navigate('HOME')} />;
            case 'LISTENING': return <MatchGameListeningScreen />;
            case 'LOADING': default: return <ActivityIndicator size="large" color={MATCH_THEME.gold} />;
            }
        };

    return (
        <View style={styles.container}>
            {/* ====[ UI 추가: 미션 아이콘 ]==== */}
            {state.status !== 'LOADING' && state.status !== 'HOME' && (
              <MissionProgressIcon
                gameId="matchGameAI"
                title="Q-러닝 미션"
                missionText="난이도 3 도달하기"
                clearText="기회 소모 없이 난이도 3 도달"
                progressItems={[
                  { label: '현재 난이도', value: state.difficulty },
                  { label: '이번 런 기회 소모', value: state.hasLostChanceInRun ? '있음' : '없음' }
                ]}
              />
            )}
            {/* ================================ */}
            {renderScreen()}
        </View>
    );
}

const styles = createMatchGameScreenStyles(MATCH_THEME.accentAI);