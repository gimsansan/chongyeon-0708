import { Text, StyleSheet, View, TouchableOpacity } from 'react-native';

interface GameSettingsSliderProps {
  readonly questionCount: number;
  readonly countdownSpeed: number;
  readonly instrumentCount: number;
  readonly onQuestionCountChange: (value: number) => void;
  readonly onCountdownSpeedChange: (value: number) => void;
  readonly onInstrumentCountChange: (value: number) => void;
}

export default function GameSettingsSlider({
  questionCount,
  countdownSpeed,
  instrumentCount,
  onQuestionCountChange,
  onCountdownSpeedChange,
  onInstrumentCountChange
}: Readonly<GameSettingsSliderProps>) {
  console.log('🎨 GameSettingsSlider 렌더링됨:', { 
    questionCount, 
    countdownSpeed, 
    instrumentCount,
  });
  
  // 버튼 옵션 정의
  const questionOptions = [3, 5, 7, 10];
  const countdownOptions = [3, 4, 5];
  const instrumentOptions = [2, 3, 4, 5];

  return (
    <View style={styles.settingsContainer}>
      {/* 문제 수 설정 */}
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>문제 수</Text>
        <View style={styles.buttonGroup}>
          {questionOptions.map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.optionButton,
                questionCount === value && styles.optionButtonSelected
              ]}
              onPress={() => {
                console.log('📊 문제 수 선택:', value);
                onQuestionCountChange(value);
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionButtonText,
                questionCount === value && styles.optionButtonTextSelected
              ]}>
                {value}개
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 카운트다운 속도 설정 */}
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>카운트다운</Text>
        <View style={styles.buttonGroup}>
          {countdownOptions.map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.optionButton,
                countdownSpeed === value && styles.optionButtonSelected
              ]}
              onPress={() => {
                console.log('⏰ 카운트다운 선택:', value);
                onCountdownSpeedChange(value);
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionButtonText,
                countdownSpeed === value && styles.optionButtonTextSelected
              ]}>
                {value}초
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 악기 수 설정 */}
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>악기 수</Text>
        <View style={styles.buttonGroup}>
          {instrumentOptions.map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.optionButton,
                instrumentCount === value && styles.optionButtonSelected
              ]}
              onPress={() => {
                console.log('🥁 악기 수 선택:', value);
                onInstrumentCountChange(value);
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionButtonText,
                instrumentCount === value && styles.optionButtonTextSelected
              ]}>
                {value}개
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  settingsContainer: {
    width: '100%',
    paddingVertical: 10,
  },
  settingRow: {
    marginBottom: 25,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    minWidth: 65,
    alignItems: 'center',
    elevation: 2,
  },
  optionButtonSelected: {
    backgroundColor: '#7cbd7e',
    borderColor: '#7cbd7e',
    elevation: 4,
  },
  optionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  optionButtonTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
});
