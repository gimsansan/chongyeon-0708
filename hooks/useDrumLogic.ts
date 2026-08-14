import { useState, useCallback, useEffect, useRef } from 'react';
import { DRUM_INSTRUMENTS, InstrumentType } from '../constants/drumSounds';

export type GameState = 'ready' | 'playing' | 'answered' | 'waitingForNextRound';

interface UseGameLogicProps {
  questionCount: number;
  instrumentCount: number;
  onGameComplete?: (score: number, maxScore: number, percentage: number) => void;
}

export function useGameLogic({ questionCount, instrumentCount, onGameComplete }: UseGameLogicProps) {
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentType | null>(null);
  const [choices, setChoices] = useState<InstrumentType[]>([]);
  const [gameState, setGameState] = useState<GameState>('ready');
  const [score, setScore] = useState(0);
  const roundRef = useRef(1);
  const [round, setRound] = useState(1);
  const isAnsweringRef = useRef(false);

  // round 변경 감지 및 ref 동기화
  useEffect(() => {
    roundRef.current = round;
  }, [round]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [answerHistory, setAnswerHistory] = useState<boolean[]>([]); 

  // 악기 수에 따라 사용 가능한 악기 설정
  const availableInstruments: InstrumentType[] = (() => {
    let instruments: InstrumentType[];
    switch (instrumentCount) {
      case 2:
        instruments = ['kick', 'snare'];
        break;
      case 3:
        instruments = ['kick', 'snare', 'hihat'];
        break;
      case 4:
        instruments = ['kick', 'snare', 'hihat', 'cymbal'];
        break;
      case 5:
      default:
        instruments = ['kick', 'snare', 'hihat', 'cymbal', 'tom'];
        break;
    }
    return instruments;
  })();
  const maxRounds = questionCount;

  const startNewRound = useCallback(() => {
    // 정답 악기 랜덤 선택
    const correctInstrument =
      availableInstruments[Math.floor(Math.random() * availableInstruments.length)];
    setCurrentInstrument(correctInstrument);

    // 오답 선택지 생성 (사용 가능한 악기 수에 맞춰 조정)
    const wrongChoicesCount = Math.min(2, availableInstruments.length - 1);
    const wrongChoices = availableInstruments
      .filter((inst) => inst !== correctInstrument)
      .sort(() => 0.5 - Math.random())
      .slice(0, wrongChoicesCount);

    // 전체 선택지 섞기
    const allChoices = [correctInstrument, ...wrongChoices].sort(
      () => 0.5 - Math.random()
    );

    setChoices(allChoices);
    setGameState('ready');
  }, [availableInstruments]);

  const startPlaying = useCallback(() => {
    setGameState('playing');
  }, []);

  const handleAnswer = useCallback(
    (selectedInstrument: InstrumentType | null) => {
      // 이미 답 처리 중이면 무시 (연타 방지)
      if (isAnsweringRef.current) {
        console.log('⚠️ 답안 처리 중 - 중복 호출 무시');
        return;
      }
      isAnsweringRef.current = true;

      // 시간 초과일 경우 gameState 관계없이 처리
      if (selectedInstrument === null) {
        const newScore = score;
        setFeedbackMessage('⏰ 시간 초과!');
        setShowFeedback(true);
        setAnswerHistory(prev => [...prev, false]);
        setGameState('waitingForNextRound');

        // 0.5초 후 다음 문제 진행
        setTimeout(() => {
          setShowFeedback(false);
          isAnsweringRef.current = false;
          const currentRound = roundRef.current;
          if (currentRound >= maxRounds) {
            onGameComplete?.(newScore, maxRounds, Math.round((newScore / maxRounds) * 100));
          } else {
            const newRound = currentRound + 1;
            setRound(newRound);
            startNewRound();
            startPlaying();
          }
        }, 500);
        return;
      }

      // 시간 초과 외에는 playing 또는 answered 상태에서만 처리
      if (gameState !== 'answered' && gameState !== 'playing') {
        console.log('⚠️ 답안 선택 무시 - gameState:', gameState);
        isAnsweringRef.current = false;
        return;
      }
      
      console.log('✅ 답안 처리:', { selectedInstrument, currentInstrument, gameState });

      const isCorrect = selectedInstrument === currentInstrument;
      let newScore = score;

      if (isCorrect) {
        // 정답
        newScore = score + 1;
        setScore(newScore);
        setFeedbackMessage('✅ 정답!');
        setShowFeedback(true);
        setAnswerHistory(prev => [...prev, true]);
        setGameState('waitingForNextRound');

        // 1초 후 다음 문제
        setTimeout(() => {
          setShowFeedback(false);
          isAnsweringRef.current = false;
          const currentRound = roundRef.current;
          if (currentRound >= maxRounds) {
            onGameComplete?.(newScore, maxRounds, Math.round((newScore / maxRounds) * 100));
          } else {
            const newRound = currentRound + 1;
            setRound(newRound);
            startNewRound();
            startPlaying();
          }
        }, 1000);
      } else {
        // 오답
        setFeedbackMessage(
          `❌ 오답! 정답은 "${DRUM_INSTRUMENTS[currentInstrument!].name}"`
        );
        setShowFeedback(true);
        setAnswerHistory(prev => [...prev, false]);
        setGameState('waitingForNextRound');

        // 1초 후 다음 문제
        setTimeout(() => {
          setShowFeedback(false);
          isAnsweringRef.current = false;
          const currentRound = roundRef.current;
          if (currentRound >= maxRounds) {
            onGameComplete?.(newScore, maxRounds, Math.round((newScore / maxRounds) * 100));
          } else {
            const newRound = currentRound + 1;
            setRound(newRound);
            startNewRound();
            startPlaying();
          }
        }, 1000);
      }
    },
    [gameState, currentInstrument, score, maxRounds, onGameComplete, startNewRound, startPlaying]
  );

  const resetGame = useCallback(() => {
    setScore(0);
    setRound(1);
    setAnswerHistory([]);
    isAnsweringRef.current = false;
    startNewRound();
  }, [startNewRound]);

  const resetGameWithoutStarting = useCallback(() => {
    setScore(0);
    setRound(1);
    setCurrentInstrument(null);
    setChoices([]);
    setGameState('ready');
    setShowFeedback(false);
    setFeedbackMessage('');
    setAnswerHistory([]);
    isAnsweringRef.current = false;
  }, []);

  const setAnswered = useCallback(() => {
    setGameState('answered');
  }, []);

  return {
    // State
    currentInstrument,
    choices,
    gameState,
    score,
    round,
    showFeedback,
    feedbackMessage,
    maxRounds,
    answerHistory,
    
    
    startNewRound,
    handleAnswer,
    resetGame,
    resetGameWithoutStarting,
    startPlaying,
    setAnswered,
  };
}
