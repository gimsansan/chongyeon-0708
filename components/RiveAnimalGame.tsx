import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Rive, { Fit, RiveRef } from 'rive-react-native';

const STATE_MACHINE = 'AnimalStatus';

type TriggerName = 'isCorrect' | 'isError';

export interface RiveAnimalGameRef {
  triggerCorrect: () => void;
  triggerError: () => void;
}

interface RiveAnimalGameProps {
  style?: StyleProp<ViewStyle>;
  /** Rive 로드 후 재생 시작 시 한 번 적용할 동물 인덱스 (예: 12 = 투명) */
  initialAnimalIndex?: number;
}

const RiveAnimalGame = forwardRef<RiveAnimalGameRef, RiveAnimalGameProps>(
  ({ style, initialAnimalIndex }, ref) => {
    const riveRef = useRef<RiveRef>(null);
    const hasSetInitialIndex = useRef(false);
    // 상태머신이 붙기 전에 들어온 트리거는 여기 담았다가 onPlay에서 쏜다.
    // 담지 않으면 fireState가 조용히 사라져 모션이 통째로 빠진다.
    const isStateMachineReady = useRef(false);
    const pendingTriggers = useRef<TriggerName[]>([]);

    const fire = useCallback((trigger: TriggerName) => {
      if (!isStateMachineReady.current) {
        pendingTriggers.current.push(trigger);
        return;
      }
      riveRef.current?.fireState(STATE_MACHINE, trigger);
    }, []);

    const triggerCorrect = useCallback(() => fire('isCorrect'), [fire]);
    const triggerError = useCallback(() => fire('isError'), [fire]);

    useImperativeHandle(ref, () => ({
      triggerCorrect,
      triggerError,
    }), [triggerCorrect, triggerError]);

    const onPlay = useCallback(
      (_animationName: string, isStateMachine: boolean) => {
        if (!isStateMachine) return;
        isStateMachineReady.current = true;

        // 동물 인덱스를 트리거보다 먼저 넣는다 — 순서가 바뀌면 이전 동물이 모션을 탄다.
        if (initialAnimalIndex !== undefined && !hasSetInitialIndex.current) {
          hasSetInitialIndex.current = true;
          riveRef.current?.setInputState(STATE_MACHINE, 'animalIndex', initialAnimalIndex);
        }

        if (pendingTriggers.current.length > 0) {
          const queued = pendingTriggers.current;
          pendingTriggers.current = [];
          queued.forEach((trigger) => riveRef.current?.fireState(STATE_MACHINE, trigger));
        }
      },
      [initialAnimalIndex]
    );

    return (
      <Rive
        ref={riveRef}
        resourceName="animals_motion"
        stateMachineName={STATE_MACHINE}
        autoplay
        fit={Fit.Contain}
        style={StyleSheet.flatten([styles.container, style]) as ViewStyle}
        onPlay={onPlay}
      />
    );
  },
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
});

export default RiveAnimalGame;
