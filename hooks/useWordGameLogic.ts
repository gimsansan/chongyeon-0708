import { useState, useCallback } from 'react';
import { WORD_DIFFICULTY_LEVELS, WordPair, WordDifficultyType } from '../constants/wordSounds';

export type GameState = 'ready' | 'playing' | 'answered' | 'waitingForNextRound';

interface UseWordGameLogicProps {
  difficulty: WordDifficultyType;
  onGameComplete?: (score: number, maxScore: number, percentage: number) => void;
}

export function useWordGameLogic({ difficulty, onGameComplete }: UseWordGameLogicProps) {
  const [currentWordPair, setCurrentWordPair] = useState<WordPair | null>(null);
  const [correctWord, setCorrectWord] = useState<'word1' | 'word2' | null>(null);
  const [correctSound, setCorrectSound] = useState<any>(null);
  const [gameState, setGameState] = useState<GameState>('ready');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isLastAnswerCorrect, setIsLastAnswerCorrect] = useState<boolean | null>(null);
  const [answerHistory, setAnswerHistory] = useState<boolean[]>([]); // 정답/오답 기록
  const [usedPairs, setUsedPairs] = useState<Set<number>>(new Set()); // 이미 사용한 단어 쌍 인덱스

  const currentDifficulty = WORD_DIFFICULTY_LEVELS[difficulty];
  const availablePairs = currentDifficulty.pairs;
  const maxRounds = currentDifficulty.rounds;

  const startNewRound = useCallback(() => {
    setUsedPairs(prev => {
      // 아직 사용하지 않은 단어 쌍 찾기
      const availableIndices = availablePairs
        .map((_, index) => index)
        .filter(index => !prev.has(index));

      // 모든 단어 쌍을 사용했다면 리셋
      let indicesToUse = availableIndices;
      let newUsedPairs = prev;
      
      if (availableIndices.length === 0) {
        indicesToUse = availablePairs.map((_, index) => index);
        newUsedPairs = new Set();
      }

      // 랜덤으로 단어 쌍 선택
      const randomIndex = indicesToUse[Math.floor(Math.random() * indicesToUse.length)];
      const selectedPair = availablePairs[randomIndex];
      
      setCurrentWordPair(selectedPair);

      // 랜덤으로 word1 또는 word2 중 하나를 정답으로 선택
      const isWord1 = Math.random() < 0.5;
      setCorrectWord(isWord1 ? 'word1' : 'word2');
      setCorrectSound(isWord1 ? selectedPair.sound1 : selectedPair.sound2);
      setSelectedAnswer(null);
      setIsLastAnswerCorrect(null);

      setGameState('ready');
      
      // 사용한 단어 쌍 기록하여 반환
      return new Set([...newUsedPairs, randomIndex]);
    });
  }, [availablePairs]);

  const handleAnswer = useCallback(
    (selectedWord: string) => {
      if (gameState !== 'answered' || !currentWordPair || !correctWord) {
        return;
      }

      const correctWordText = currentWordPair[correctWord];
      const isCorrect = selectedWord === correctWordText;
      let newScore = score;
      setSelectedAnswer(selectedWord);
      setIsLastAnswerCorrect(isCorrect);

      if (isCorrect) {
        newScore = score + 1;
        setScore(newScore);
        setFeedbackMessage('⭕');
        setShowFeedback(true);
      } else {
        setFeedbackMessage('❌');
        setShowFeedback(true);
      }
      
      // 정답/오답 기록 추가
      setAnswerHistory(prev => [...prev, isCorrect]);

      setGameState('waitingForNextRound');

      // 600ms 후 자동으로 다음 문제 진행
      setTimeout(() => {
        setShowFeedback(false);
        if (round >= maxRounds) {
          onGameComplete?.(newScore, maxRounds, Math.round((newScore / maxRounds) * 100));
        } else {
          setRound((prevRound) => prevRound + 1);
          startNewRound();
        }
      }, 600);
    },
    [gameState, currentWordPair, correctWord, score, round, maxRounds, onGameComplete, startNewRound]
  );

  const resetGame = useCallback(() => {
    setScore(0);
    setRound(1);
    setAnswerHistory([]);
    setUsedPairs(new Set());
    startNewRound();
  }, [startNewRound]);

  const resetGameWithoutStarting = useCallback(() => {
    setScore(0);
    setRound(1);
    setCurrentWordPair(null);
    setCorrectWord(null);
    setCorrectSound(null);
    setSelectedAnswer(null);
    setIsLastAnswerCorrect(null);
    setGameState('ready');
    setShowFeedback(false);
    setFeedbackMessage('');
    setAnswerHistory([]);
    setUsedPairs(new Set());
  }, []);

  const startPlaying = useCallback(() => {
    setGameState('playing');
  }, []);

  const setAnswered = useCallback(() => {
    setGameState('answered');
  }, []);

  return {
    // State
    currentWordPair,
    correctWord,
    correctSound,
    gameState,
    score,
    round,
    showFeedback,
    feedbackMessage,
    selectedAnswer,
    isLastAnswerCorrect,
    currentDifficulty,
 
    
    // Actions
    startNewRound,
    handleAnswer,
    resetGame,
    resetGameWithoutStarting,
    startPlaying,
    setAnswered,
  };
}

