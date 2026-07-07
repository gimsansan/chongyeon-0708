import React, { createContext, useContext, useRef, useEffect, useMemo } from 'react';
import { Audio } from '../services/audioCompat';

interface AudioManagerContextType {
  playSound: (soundKey: string, source: any) => Promise<void>;
  playSoundWithCallback: (soundKey: string, source: any, onComplete?: () => void) => Promise<void>;
  stopAllSounds: () => Promise<void>;
  getCurrentTab: () => string;
  setCurrentTab: (tab: string) => void;
  isPlaying: (soundKey: string) => boolean;
}

const AudioManagerContext = createContext<AudioManagerContextType | null>(null);

export function AudioManagerProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const soundsRef = useRef<Map<string, Audio.Sound>>(new Map());
  const currentTabRef = useRef<string>('');
  // 큐잉 시스템을 위한 상태
  const playQueueRef = useRef<Array<{key: string, source: any, onComplete?: () => void}>>([]);
  const isProcessingRef = useRef<boolean>(false);

  // 모든 오디오 정리
  const stopAllSounds = async () => {
    console.log('🎵 AudioManager: 모든 오디오 정리');

    const promises = [];
    for (const [key, sound] of soundsRef.current) {
      promises.push(
        sound.unloadAsync().catch(error => {
          console.warn(`AudioManager: ${key} 정리 실패:`, error);
        })
      );
    }

    await Promise.all(promises);
    soundsRef.current.clear();
    console.log('✅ AudioManager: 모든 오디오 정리 완료');
  };

  // 탭 변경 시 자동 정리
  const setCurrentTab = async (newTab: string) => {
    if (currentTabRef.current !== newTab) {
      console.log(`🔄 AudioManager: 탭 변경 ${currentTabRef.current} → ${newTab}`);
      await stopAllSounds();
      currentTabRef.current = newTab;
    }
  };

  // 단일 오디오 재생 (공통 로직)
  const playSingleSound = async (soundKey: string, source: any, onComplete?: () => void) => {
    try {
      // 기존 같은 키의 소리 정리
      const existingSound = soundsRef.current.get(soundKey);
      if (existingSound) {
        await existingSound.unloadAsync();
        soundsRef.current.delete(soundKey);
      }

      // 새 소리 생성
      const { sound } = await Audio.Sound.createAsync(source, {
        shouldPlay: true,
        volume: 1,
        isLooping: false,
      });

      soundsRef.current.set(soundKey, sound);
      console.log(`🎵 AudioManager: ${soundKey} 재생됨 (${currentTabRef.current} 탭)`);

      // 재생 완료 시 콜백 실행 후 자동 정리
      sound.setOnPlaybackStatusUpdate(async (status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          try {
            await sound.unloadAsync();
            soundsRef.current.delete(soundKey);
            console.log(`🧹 AudioManager: ${soundKey} 자동 정리됨`);
            // 콜백 실행
            onComplete?.();
          } catch (error) {
            console.warn(`AudioManager: 자동 정리 실패 ${soundKey}:`, error);
          }
        }
      });

      // 백업 타이머 (1.5초 후 강제 정리 및 콜백)
      setTimeout(async () => {
        if (soundsRef.current.has(soundKey)) {
          try {
            await sound.unloadAsync();
            soundsRef.current.delete(soundKey);
            console.log(`⏰ AudioManager: ${soundKey} 백업 정리됨`);
            onComplete?.();
          } catch (error) {
            console.warn(`AudioManager: 백업 정리 실패 ${soundKey}:`, error);
          }
        }
      }, 1500);

    } catch (error) {
      console.error(`AudioManager: ${soundKey} 재생 실패:`, error);
      // 에러 시에도 콜백 실행
      onComplete?.();
    }
  };

  // 큐 처리 함수
  const processQueue = async () => {
    if (isProcessingRef.current || playQueueRef.current.length === 0) return;

    isProcessingRef.current = true;
    const { key, source, onComplete } = playQueueRef.current.shift()!;

    try {
      await playSingleSound(key, source, onComplete);
    } finally {
      isProcessingRef.current = false;
      // 다음 큐 처리 (50ms 간격으로 안정성 확보)
      setTimeout(processQueue, 50);
    }
  };

  // 큐잉된 소리 재생
  const playSound = async (soundKey: string, source: any) => {
    playQueueRef.current.push({ key: soundKey, source });
    processQueue();
  };

  // 콜백이 있는 큐잉된 소리 재생 (게임용)
  const playSoundWithCallback = async (soundKey: string, source: any, onComplete?: () => void) => {
    playQueueRef.current.push({ key: soundKey, source, onComplete });
    processQueue();
  };

  // 특정 소리 재생 상태 확인
  const isPlaying = (soundKey: string): boolean => {
    return soundsRef.current.has(soundKey);
  };

  // 앱 종료 시 정리
  useEffect(() => {
    return () => {
      console.log('🏁 AudioManager: 앱 종료 - 최종 정리');
      stopAllSounds();
    };
  }, []);

  const value = useMemo(() => ({
    playSound,
    playSoundWithCallback,
    stopAllSounds,
    getCurrentTab: () => currentTabRef.current,
    setCurrentTab,
    isPlaying,
  }), [playSound, playSoundWithCallback, stopAllSounds, setCurrentTab, isPlaying]);

  return (
    <AudioManagerContext.Provider value={value}>
      {children}
    </AudioManagerContext.Provider>
  );
}

export function useAudioManager() {
  const context = useContext(AudioManagerContext);
  if (!context) {
    throw new Error('useAudioManager must be used within AudioManagerProvider');
  }
  return context;
}
