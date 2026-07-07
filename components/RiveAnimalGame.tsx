import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Rive, { Fit, RiveRef } from 'rive-react-native';

const STATE_MACHINE = 'AnimalStatus';

export interface RiveAnimalGameRef {
  triggerCorrect: () => void;
  triggerError: () => void;
  setAnimalIndex: (index: number) => void;
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

    const triggerCorrect = useCallback(() => {
      riveRef.current?.fireState(STATE_MACHINE, 'isCorrect');
    }, []);

    const triggerError = useCallback(() => {
      riveRef.current?.fireState(STATE_MACHINE, 'isError');
    }, []);

    const setAnimalIndex = useCallback((index: number) => {
      riveRef.current?.setInputState(STATE_MACHINE, 'animalIndex', index);
    }, []);

    useImperativeHandle(ref, () => ({
      triggerCorrect,
      triggerError,
      setAnimalIndex,
    }), [triggerCorrect, triggerError, setAnimalIndex]);

    const onPlay = useCallback(
      (_animationName: string, isStateMachine: boolean) => {
        if (isStateMachine && initialAnimalIndex !== undefined && !hasSetInitialIndex.current) {
          hasSetInitialIndex.current = true;
          riveRef.current?.setInputState(STATE_MACHINE, 'animalIndex', initialAnimalIndex);
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
