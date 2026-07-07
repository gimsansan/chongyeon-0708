/**
 * matchGameAI, matchGamePG 공통 오디오 매니저
 * 동물 소리 사전 로드 후 이름으로 재생
 */
import { Audio } from './audioCompat';
import { SOUNDS_CONFIG } from '../constants/animalSounds';

export class GameAudioManager {
  private static instance: GameAudioManager;
  private sounds = new Map<string, Audio.Sound>();

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
          const { sound } = await Audio.Sound.createAsync(file);
          this.sounds.set(name, sound);
        } catch (error) {
          console.error(`'${name}' 사운드 로딩 실패:`, error);
        }
      })
    );
  }

  async playSound(name: string): Promise<void> {
    try {
      const soundObject = this.sounds.get(name);
      if (soundObject) {
        await soundObject.playFromPositionAsync(0);
      }
    } catch (e) {
      console.error(`'${name}' 사운드 재생 중 오류:`, e);
    }
  }
}

export const gameAudioManager = GameAudioManager.getInstance();
