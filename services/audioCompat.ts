import {
  createAudioPlayer,
  setAudioModeAsync as setExpoAudioModeAsync,
  type AudioPlayer,
  type AudioSource,
  type AudioStatus,
  type InterruptionMode,
} from 'expo-audio';

type PlaybackStatus = {
  isLoaded: boolean;
  didJustFinish: boolean;
  positionMillis: number;
  durationMillis: number;
};

type CreateSoundOptions = {
  shouldPlay?: boolean;
  volume?: number;
  isLooping?: boolean;
  rate?: number;
  shouldCorrectPitch?: boolean;
  progressUpdateIntervalMillis?: number;
};

type LegacyAudioMode = {
  playsInSilentModeIOS?: boolean;
  staysActiveInBackground?: boolean;
  shouldDuckAndroid?: boolean;
  playThroughEarpieceAndroid?: boolean;
  allowsRecordingIOS?: boolean;
};

type PlayerWithListeners = AudioPlayer & {
  addListener: (
    eventName: 'playbackStatusUpdate',
    listener: (status: AudioStatus) => void
  ) => { remove: () => void };
};

function toPlaybackStatus(status: AudioStatus): PlaybackStatus {
  return {
    isLoaded: status.isLoaded,
    didJustFinish: status.didJustFinish,
    positionMillis: Math.round(status.currentTime * 1000),
    durationMillis: Math.round(status.duration * 1000),
  };
}

function toInterruptionMode(shouldDuckAndroid?: boolean): InterruptionMode | undefined {
  if (shouldDuckAndroid == null) return undefined;
  return shouldDuckAndroid ? 'duckOthers' : 'mixWithOthers';
}

async function setCompatAudioModeAsync(mode: LegacyAudioMode): Promise<void> {
  await setExpoAudioModeAsync({
    playsInSilentMode: mode.playsInSilentModeIOS,
    shouldPlayInBackground: mode.staysActiveInBackground,
    interruptionMode: toInterruptionMode(mode.shouldDuckAndroid),
    shouldRouteThroughEarpiece: mode.playThroughEarpieceAndroid,
    allowsRecording: mode.allowsRecordingIOS,
  });
}

class CompatSound {
  private subscription?: { remove: () => void };

  private constructor(private readonly player: AudioPlayer) {}

  static async createAsync(source: AudioSource, options: CreateSoundOptions = {}) {
    const player = createAudioPlayer(source, {
      updateInterval: options.progressUpdateIntervalMillis ?? 500,
    });
    const sound = new CompatSound(player);

    if (options.volume != null) player.volume = options.volume;
    if (options.isLooping != null) player.loop = options.isLooping;
    if (options.rate != null) player.setPlaybackRate(options.rate);
    if (options.shouldCorrectPitch != null) player.shouldCorrectPitch = options.shouldCorrectPitch;
    if (options.shouldPlay) player.play();

    return { sound, status: sound.getCurrentStatus() };
  }

  async playAsync(): Promise<PlaybackStatus> {
    this.player.play();
    return this.getStatusAsync();
  }

  async replayAsync(): Promise<PlaybackStatus> {
    await this.player.seekTo(0);
    this.player.play();
    return this.getStatusAsync();
  }

  async playFromPositionAsync(positionMillis: number): Promise<PlaybackStatus> {
    await this.player.seekTo(positionMillis / 1000);
    this.player.play();
    return this.getStatusAsync();
  }

  async unloadAsync(): Promise<PlaybackStatus> {
    const status = this.getCurrentStatus();
    this.subscription?.remove();
    this.subscription = undefined;
    this.player.remove();
    return status;
  }

  async getStatusAsync(): Promise<PlaybackStatus> {
    return this.getCurrentStatus();
  }

  async setProgressUpdateIntervalAsync(): Promise<void> {
    return Promise.resolve();
  }

  setOnPlaybackStatusUpdate(listener: ((status: PlaybackStatus) => void) | null): void {
    this.subscription?.remove();
    this.subscription = undefined;

    if (!listener) return;

    this.subscription = (this.player as PlayerWithListeners).addListener('playbackStatusUpdate', (status) => {
      listener(toPlaybackStatus(status));
    });
  }

  private getCurrentStatus(): PlaybackStatus {
    return toPlaybackStatus(this.player.currentStatus);
  }
}

export namespace Audio {
  export type Sound = CompatSound;

  export const Sound = {
    createAsync: CompatSound.createAsync,
  };

  export const setAudioModeAsync = setCompatAudioModeAsync;
}
