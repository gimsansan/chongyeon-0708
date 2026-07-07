import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Canvas, Path, Skia, LinearGradient, vec } from '@shopify/react-native-skia';
import { WAVEFORM_GRADIENT } from '../../constants/colors';
import {
  useSharedValue,
  withTiming,
  Easing,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

interface WaveformProps {
  /** 파형 데이터: 각 막대의 상대 높이(0~1)를 담는 배열
   *  - 배열을 쓰는 이유: 
   *    1. 파형 시각화를 위해 각 구간별 '막대' 높이값(샘플값)을 순서대로 저장
   *    2. 길이에 따라 파형 가짓수/디자인 다양화 가능
   *    3. 불변(immutable) 배열로 만들어, 외부에서 데이터가 바뀌지 않게 보장
   */
  readonly data: readonly number[];
  readonly isPlaying: boolean;
  readonly color: string;
  readonly height: number;
  readonly width: number;
  /** 실제 오디오 진행도 (0~1). 제공 시 내부 애니메이션 대신 사용 */
  /**
   * 부모 컴포넌트에서 전달받는 진행도 값.
   * 'progress'는 'SharedValue<number>' 타입으로, Reanimated의 반응형 값입니다.
   * SharedValue를 사용하는 이유는, 내부에서 값이 변경될 때마다(예: 애니메이션 도중) 
   * 파생된 값(useDerivedValue 등)이 자동으로 다시 계산되어 UI가 반응적으로 업데이트되기 때문입니다.
   * 즉, 값이 바뀌면 연관된 계산/렌더가 "자동으로" 발생합니다.
   */
  /**
   * 진행도를 "반응형 값"으로 외부에서 주입할 때 사용.
   * SharedValue<number> 타입이란:
   *   - Reanimated 라이브러리의 "실시간/반응형 값" 컨테이너를 의미.
   *   - progress.value로 수시로 값이 바뀌면 UI가 자동으로 갱신됨.
   *   - 리렌더/불필요한 state 변경 없이 애니메이션 등 실시간 변화를 효율적으로 구현.
   *   - ex) 오디오 실제 재생 진행도, 타이밍 컨트롤 등 frame별 변화에 적합.
   */
  readonly progress?: SharedValue<number>;
}

// props의 이름은 `progress` — 아래 `const progress`와 구분하려고 여기서만 `progressProp`으로 받음
export function Waveform({ data, isPlaying, color, height, width, progress: progressProp }: WaveformProps) {

  // useSharedValue는 '리액트 스테이트'처럼 값을 담는 그릇이지만, 값이 변할 때마다 연결된 파생값(useDerivedValue 등)이 자동으로 다시 계산되는 '반응형 컨테이너'입니다.
  // 여기서 fallbackProgress는 "진행도"를 담는 SharedValue<number>이며, 내부 애니메이션 관리에 사용됩니다.
  const fallbackProgress = useSharedValue(0);
  const progress = progressProp ?? fallbackProgress; // progressProp 없을 때만: 재생 시 0→1을 3초에 걸어 채움
//progress가 항상 SharedValue라는 말은 “파형 데이터를 가졌다”가 아니라,   
//**“진행도(0~1)를 담는 상자는 항상 하나 있다”**는 뜻
  useEffect(() => {
    if (progressProp) return;
    if (isPlaying) {
      fallbackProgress.value = 0;// 이전에 1까지 갔어도 다시 재생할 때마다 0에서 시작
      fallbackProgress.value = withTiming(1, {
        duration: 3000,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [isPlaying, progressProp]); 

  // progress 값에 따라 파형 경로를 동적으로 생성
  // useDerivedValue의 "내부의 콜백 함수"는 아래의 화살표 함수입니다.
  // 즉, () => { ... } 이 부분이 콜백 함수입니다!
  // 재생할 때, 그리고 또 하나는? (useDerivedValue 콜백: 진행도 반응)
  const path = useDerivedValue(
    () => {
      const p = Skia.Path.Make();//p는 파형 경로를 담는 변수
      const centerY = height / 2;
      const barWidth = width / Math.max(data.length, 1);
      const maxAmplitude = height * 0.35; 
      // 현재 재생 진행도(0~1). 예: 0.5면 전체 파형 중 왼쪽 절반 막대까지만 그림.
      // progress는 SharedValue<number> 타입이므로, 실제 값은 progress.value로 접근.
      // 이 값에 따라 파형의 어느 지점까지 그릴지를 결정한다.
      // 항상 1이 아니라, progress.value에 따라 0~1 사이 값이 됩니다.
      const currentProgress = progress.value;

      // 현재 진행도에 따라 몇 개의 막대를 그릴지 계산.
      // 예: data.length=24, currentProgress=0.5면 12개의 막대를 그림.
      // visibleBars는 currentProgress에 따라 실시간으로 변합니다 (currentProgress=0~1 범위를 가짐).
      // 즉, 항상 고정된 값이 아니라 진행도에 연동되어 동적으로 결정됨!
      const visibleBars = Math.floor(data.length * currentProgress);
      // 실제로 막대를 그림.
      //visibleBars 허용한 칸 수
      // 각 막대의 높이는 amplitude(0~1)에 maxAmplitude를 곱해서 계산.
      // 막대의 위치는 index에 barWidth를 곱해서 계산.
      // 막대의 폭은 barWidth * 0.66으로 계산.
      // 막대의 높이는 barHeight * 2로 계산.

      // 여기서는 "몇 번째까지 그릴지(visibleBars)"까지만 동적으로 그림.
      // 파형 전체 데이터(data 배열)의 "개수"는 이미 props로 들어온 상태이고,
      // 여기서는 각 막대별로 실제로 그릴지(진행도상 보일지)만 판단해 경로(Path)에 추가한다.
      // data 배열의 "길이"가 곧 그릴 막대의 "갯수"입니다.
      // 즉, 현재 구현 구조에서는 data.length가 곧 막대의 개수(전체 개수)로 쓰입니다.
      // 실제 막대의 개수(가시적 갯수)는 currentProgress에 따라 visibleBars만큼까지만 만듭니다.
      data.forEach((amplitude, index) => {
        if (index <= visibleBars) {
          // 진행도에 따라 이 막대(index)가 보이는 구간이면 실제로 스키아 경로에 추가
          const x = index * barWidth + barWidth / 2;
          const barHeight = amplitude * maxAmplitude;
          const topY = centerY - barHeight;
          p.addRect(Skia.XYWHRect(x - barWidth / 3, topY, barWidth * 0.66, barHeight * 2));
        }
      });

      return p;
    },
    [data, height, width]
  );

  // Guard: 불필요한 렌더링 차단 (hooks 이후)
  // 위 useDerivedValue 등 여러 계산(Hook)들은 그려야 할 모양(path)이나 상태를 만들어내는 "계산" 역할만 담당
  // 실제로 뭔가를 "그려주는" 역할(뷰 렌더링)은 return 쪽 뷰에서 일어남
  // 아래는 "Guard clause" — 비정상 입력(예: 데이터 없음, 사이즈 0 이하)이면 아무 뷰도 렌더하지 않음(렌더링 차단)
  // 데이터가 없거나 비어 있으면 아무것도 렌더링하지 않음(파형 자체를 그릴 수 없으므로 null 반환).
  if (!data || data.length === 0) return null;
  // height 또는 width가 0 이하일 때(즉, 파형을 실제로 그릴 공간이 없을 때)는 아무것도 렌더링하지 않도록 함. (렌더 최적화 및 오류 방지)
  // 공간(파형을 실제로 그릴 영역)이 0이거나 음수면 Skia·View에서 오류(예: NaN, crash)가 발생할 수 있으므로,
  // height 또는 width가 0 이하일 땐 렌더링 자체를 막아 안전하게 종료한다.
  if (height <= 0 || width <= 0) return null;

  return (
    // Canvas만으로도 되지만, 가운데 정렬 등 레이아웃용으로 View로 감쌈
    <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
      <Canvas style={{ width, height }}>
        {/* WAVEFORM_GRADIENT.positions는 as const 튜플 — Skia는 number[] 기대라 [...] 전개 */}
        <Path path={path} style="fill">
          <LinearGradient
            start={vec(0, height / 2)}
            end={vec(width, height / 2)}
            colors={[color, WAVEFORM_GRADIENT.middle, WAVEFORM_GRADIENT.end]}
            positions={[...WAVEFORM_GRADIENT.positions]}
          />
        </Path>
      </Canvas>
    </View>
  );
}
