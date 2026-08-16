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

/*
 * 좌표계 기준 (2026-08-17 변경)
 * -----------------------------------------------------------------------
 * 이전에는 드럼 상자에 paddingBottom: 70이 있어서 상자(S)와 그림(S-70)의
 * 좌표계가 달랐다. x,y는 상자 기준이었고 그림은 가로 35dp씩 안쪽에 그려졌다.
 * 그 70을 없애면서 x,y를 "그림 기준 0~1"로 옮겼다.
 *
 * 환산식 (393dp 기기의 기존 화면을 그대로 재현하는 값):
 *   S = 393 * 0.9 = 353.7,  그림 = S - 70 = 283.7,  가로 오프셋 = 35
 *   x' = (x * 353.7 - 35) / 283.7 = 1.24674x - 0.12337
 *   y' =  y * 353.7 / 283.7        = 1.24674y
 * neutralOffsets는 차이값이라 오프셋 없이 1.24674만 곱한다.
 *
 * 아래 값은 모두 이 식으로 기계 환산한 결과다. 눈으로 다시 맞춘 값이 아니다.
 */

// 5-instrument layout
export const LAYOUT_5_DRUMS: DrumLayout = {
  image: require('../assets/images/last_55.png'),
  colorImage: require('../assets/images/last_55.png'), 
  order: ['snare', 'hihat', 'tom', 'cymbal', 'kick'],
  details: {
    hihat:  { x: 0.064, y: 0.249 },
    snare:  { x: 0.213, y: 0.436 },
    kick:   { x: 0.450, y: 0.549 },
    cymbal: { x: 0.936, y: 0.249 },
    tom:    { x: 0.562, y: 0.187 },
  },
  neutralOffsets: {
    hihat:  { dx: -0.100, dy: -0.075 },
    snare:  { dx: -0.100, dy: 0.075 },
    kick:   { dx: 0, dy: 0.100 },
    cymbal: { dx: 0.075, dy: -0.075 },
    tom:    { dx: 0.075, dy: -0.100 },
  },
};

// 4-instrument layout
export const LAYOUT_4_DRUMS: DrumLayout = {
  image: require('../assets/images/last_44.png'),
  colorImage: require('../assets/images/last_44.png'),
  order: ['snare', 'hihat', 'cymbal', 'kick'],
  details: {
    hihat:  { x: 0.064, y: 0.249 },
    snare:  { x: 0.213, y: 0.436 },
    kick:   { x: 0.450, y: 0.549 },
    cymbal: { x: 0.936, y: 0.249 },
  },
  neutralOffsets: {
    hihat:  { dx: -0.100, dy: -0.075 },
    snare:  { dx: -0.100, dy: 0.075 },
    kick:   { dx: 0, dy: 0.100 },
    cymbal: { dx: 0.075, dy: -0.075 },
  },
};

// 3-instrument layout
export const LAYOUT_3_DRUMS: DrumLayout = {
  image: require('../assets/images/last_33.png'),
  colorImage: require('../assets/images/last_33.png'),
  order: ['snare', 'hihat', 'kick'],
  details: {
    hihat: { x: 0.114, y: 0.187 },
    snare: { x: 0.288, y: 0.436 },
    kick:  { x: 0.562, y: 0.561 },
  },
  neutralOffsets: {
    hihat: { dx: -0.100, dy: -0.075 },
    snare: { dx: -0.100, dy: 0.075 },
    kick:  { dx: 0.075, dy: 0.100 },
  },
};

// 2-instrument layout
export const LAYOUT_2_DRUMS: DrumLayout = {
  image: require('../assets/images/last_22.png'),
  colorImage: require('../assets/images/last_22.png'),
  order: ['snare', 'kick'],
  details: {
    snare: { x: 0.338, y: 0.312 },
    kick:  { x: 0.587, y: 0.436 },
  },
  neutralOffsets: {
    snare: { dx: -0.125, dy: -0.100 },
    kick:  { dx: 0.125, dy: 0.100 },
  },
};

export const drumLayouts = {
  '5': LAYOUT_5_DRUMS,
  '4': LAYOUT_4_DRUMS,
  '3': LAYOUT_3_DRUMS,
  '2': LAYOUT_2_DRUMS,
};
