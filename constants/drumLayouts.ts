import { InstrumentType } from './drumSounds';

interface InstrumentDetail {
  x: number;
  y: number;
}

/** 악기별 중립 위치 오프셋 (악기 위치에서 상대적으로 떨어진 거리) */
interface NeutralOffset {
  dx: number;
  dy: number;
}

export interface DrumLayout {
  image: any;
  colorImage: any;
  order: InstrumentType[];
  details: Partial<Record<InstrumentType, InstrumentDetail>>;
  /** 악기별 중립 위치 오프셋 (다음 문제 전 캐릭터를 약간 떨어진 위치로 이동) */
  neutralOffsets: Partial<Record<InstrumentType, NeutralOffset>>;
}

// 5-instrument layout
export const LAYOUT_5_DRUMS: DrumLayout = {
  image: require('../assets/images/last_55.png'),
  colorImage: require('../assets/images/last_55.png'), 
  order: ['snare', 'hihat', 'tom', 'cymbal', 'kick'],
  details: {
    hihat:  { x: 0.15, y: 0.2 },
    snare:  { x: 0.27, y: 0.35 },
    kick:   { x: 0.46, y: 0.44 },
    cymbal: { x: 0.85, y: 0.2 },
    tom:    { x: 0.55, y: 0.15 },
  },
  neutralOffsets: {
    hihat:  { dx: -0.08, dy: -0.06 },
    snare:  { dx: -0.08, dy: 0.06 },
    kick:   { dx: 0, dy: 0.08 },
    cymbal: { dx: 0.06, dy: -0.06 },
    tom:    { dx: 0.06, dy: -0.08 },
  },
};

// 4-instrument layout
export const LAYOUT_4_DRUMS: DrumLayout = {
  image: require('../assets/images/last_44.png'),
  colorImage: require('../assets/images/last_44.png'),
  order: ['snare', 'hihat', 'cymbal', 'kick'],
  details: {
    hihat:  { x: 0.15, y: 0.2 },
    snare:  { x: 0.27, y: 0.35 },
    kick:   { x: 0.46, y: 0.44 },
    cymbal: { x: 0.85, y: 0.2 },
  },
  neutralOffsets: {
    hihat:  { dx: -0.08, dy: -0.06 },
    snare:  { dx: -0.08, dy: 0.06 },
    kick:   { dx: 0, dy: 0.08 },
    cymbal: { dx: 0.06, dy: -0.06 },
  },
};

// 3-instrument layout
export const LAYOUT_3_DRUMS: DrumLayout = {
  image: require('../assets/images/last_33.png'),
  colorImage: require('../assets/images/last_33.png'),
  order: ['snare', 'hihat', 'kick'],
  details: {
    hihat: { x: 0.19, y: 0.15 },
    snare: { x: 0.33, y: 0.35},
    kick:  { x: 0.55, y: 0.45 },
  },
  neutralOffsets: {
    hihat: { dx: -0.08, dy: -0.06 },
    snare: { dx: -0.08, dy: 0.06 },
    kick:  { dx: 0.06, dy: 0.08 },
  },
};

// 2-instrument layout
export const LAYOUT_2_DRUMS: DrumLayout = {
  image: require('../assets/images/last_22.png'),
  colorImage: require('../assets/images/last_22.png'),
  order: ['snare', 'kick'],
  details: {
    snare: { x: 0.37, y: 0.25 },
    kick:  { x: 0.57, y: 0.35 },
  },
  neutralOffsets: {
    snare: { dx: -0.1, dy: -0.08 },
    kick:  { dx: 0.1, dy: 0.08 },
  },
};

export const drumLayouts = {
  '5': LAYOUT_5_DRUMS,
  '4': LAYOUT_4_DRUMS,
  '3': LAYOUT_3_DRUMS,
  '2': LAYOUT_2_DRUMS,
};
