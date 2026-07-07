import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

interface GameControlsProps {
  readonly type: 'start' | 'play';
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly loading?: boolean;
}

export function GameControls({ type, onPress, disabled = false, loading = false }: Readonly<GameControlsProps>) {
  const getButtonConfig = () => {
    switch (type) {
      case 'start':
        return {
          text: '시작',
          style: styles.startButton,
          textStyle: styles.startButtonText,
        };
      case 'play':
        return {
          text: '🔊 다시 듣기',
          style: styles.playButton,
          textStyle: styles.playButtonText,
        };
    }
  };

  const config = getButtonConfig();

  return (
    <TouchableOpacity 
      style={[config.style, disabled && styles.disabledButton]} 
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <Text style={config.textStyle}>{config.text}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  startButton: {
    backgroundColor: '#ebaa66',
    paddingVertical: 18,
    paddingHorizontal: 35,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
    elevation: 4,
    minHeight: 60,
  },
  playButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    elevation: 3,
    minHeight: 55,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
    elevation: 0,
  },
  startButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  playButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});

