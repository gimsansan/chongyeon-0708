import { useState, useEffect, useRef } from 'react';
import { Audio } from '../services/audioCompat';
import { useSharedValue } from 'react-native-reanimated';

export function useWordAudioPlayer() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const progress = useSharedValue(0);
  const timerRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const isCleaningUpRef = useRef(false);
  const playbackIdRef = useRef(0);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  const cleanupAudio = async () => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    try {
      // 타이머 정리
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // 사운드 정리
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (error) {
          console.warn('사운드 정리 중 오류:', error);
        }
        soundRef.current = null;
      }
    } finally {
      isCleaningUpRef.current = false;
    }
  };

  const playWordSound = async (
    soundSource: any,
    wordText: string,
    onComplete?: () => void
  ): Promise<void> => {
    // 재생 ID 증가 (동시 호출 방지)
    const currentPlaybackId = ++playbackIdRef.current;
    
    try {
      // 이미 재생 중이면 이전 재생 중단
      if (isPlaying) {
        await cleanupAudio();
        // 짧은 지연으로 정리 완료 대기
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // 재생 ID가 변경되었다면 중단 (더 새로운 요청이 있음)
      if (currentPlaybackId !== playbackIdRef.current) {
        return;
      }

      setIsPlaying(true);
      completedRef.current = false;

      console.log(`🔊 Playing word: ${wordText}`);

      // 오디오 모드 설정 (스피커 사용 및 볼륨 최대화)
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });

      // 새로운 사운드 생성 (볼륨 최대)
      const { sound: newSound } = await Audio.Sound.createAsync(soundSource, {
        shouldPlay: true,
        volume: 1.0,
        isLooping: false,
        rate: 1.0,
        shouldCorrectPitch: true,
        progressUpdateIntervalMillis: 100,
      });

      // 재생 ID 확인 (생성 중에 새로운 요청이 있었는지 확인)
      if (currentPlaybackId !== playbackIdRef.current) {
        await newSound.unloadAsync();
        return;
      }

      soundRef.current = newSound;

      // 재생 완료 및 진행도 감지
      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish && !completedRef.current) {
          handlePlaybackComplete(onComplete, currentPlaybackId);
        }
        // 진행도 동기화 (positionMillis, durationMillis)
        const pos = status.positionMillis ?? 0;
        const dur = status.durationMillis ?? 1;
        progress.value = dur > 0 ? Math.min(pos / dur, 1) : 0;
      });

      progress.value = 0;

      // 백업 타이머 (3초)
      timerRef.current = setTimeout(() => {
        if (!completedRef.current && currentPlaybackId === playbackIdRef.current) {
          console.log('⚠️ 백업 타이머로 재생 완료 처리');
          handlePlaybackComplete(onComplete, currentPlaybackId);
        }
      }, 3000);

    } catch (error) {
      console.error('단어 사운드 재생 오류:', error);
      if (currentPlaybackId === playbackIdRef.current) {
        setIsPlaying(false);
        completedRef.current = false;
        progress.value = 0;
        onComplete?.();
      }
    }
  };

  const handlePlaybackComplete = (onComplete?: () => void, playbackId?: number) => {
    // 재생 ID 확인 (현재 재생과 일치하는지 확인)
    if (playbackId && playbackId !== playbackIdRef.current) {
      return;
    }

    if (!completedRef.current) {
      completedRef.current = true;
      setIsPlaying(false);
      progress.value = 1;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      
      onComplete?.();
    }
  };

  const stopSound = async () => {
    // 재생 ID 증가하여 현재 재생 무효화
    playbackIdRef.current++;
    await cleanupAudio();
    setIsPlaying(false);
    completedRef.current = true;
    progress.value = 0;
  };

  return {
    playWordSound,
    stopSound,
    isPlaying,
    progress,
  };
}

