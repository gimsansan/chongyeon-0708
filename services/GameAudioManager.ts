/**
 * matchGameAI, matchGamePG 공통 오디오 매니저
 * 동물 소리 사전 로드 후 이름으로 재생
 */
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { SOUNDS_CONFIG } from '../constants/animalSounds';

export class GameAudioManager {
  private static instance: GameAudioManager;
  private sounds = new Map<string, AudioPlayer>();

  private constructor() {}

  public static getInstance(): GameAudioManager {
    if (!GameAudioManager.instance) {
      GameAudioManager.instance = new GameAudioManager();
    }
    return GameAudioManager.instance; 
  }

  async loadSoundsAsync(): Promise<void> {
    if (this.sounds.size > 0) return;
    await Promise.all(
      SOUNDS_CONFIG.map(async ({ name, file }) => {
        try {
          this.sounds.set(name, createAudioPlayer(file, { updateInterval: 500 }));
        } catch (error) {
          console.error(`'${name}' 사운드 로딩 실패:`, error);
        }
      })
    );
  }

  async playSound(name: string): Promise<void> {
    try {
      const player = this.sounds.get(name);
      if (player) {
        // 이전 `playFromPositionAsync(0)`과 같다 — 처음으로 되감고 재생한다
        await player.seekTo(0);
        player.play();
      }
    } catch (e) {
      console.error(`'${name}' 사운드 재생 중 오류:`, e);
    }
  }
}

export const gameAudioManager = GameAudioManager.getInstance();
