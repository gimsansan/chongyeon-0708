import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import Rive from "rive-react-native";


interface DrumGameOverScreenProps {
  score: number;
  maxScore: number;
  onRestart: () => void;
  onGoHome: () => void;
}

function DrumGameOverScreen({
  score,
  maxScore,
  onRestart,
  onGoHome,
}: DrumGameOverScreenProps) {
  // 점수에 따른 메시지 결정
  const getScoreMessage = () => {
    if (score === maxScore) return " 완벽해요!";
    if (score >= maxScore * 0.7) return " 잘했어요!";
    return "아쉬워요!";
  };

  // Rive 진행 게이지 컨트롤용 ref
  const riveRef = useRef<any>(null);

  // 점수 비율(0~1) → 0~100 구간 값으로 변환
  const clampedMaxScore = Math.max(maxScore, 1);
  const targetGaugeValue = (score / clampedMaxScore) * 100;

  // 결과 화면이 열릴 때 게이지가 0 → targetGaugeValue 까지 짧게 차오르게 함
  useEffect(() => {
    if (!riveRef.current) return;

    const duration = 600; // 전체 애니메이션 시간(ms)
    const steps = 30;
    const stepTime = duration / steps;
    const stepDelta = targetGaugeValue / steps;

    let current = 0;
    let cancelled = false;
    let timeoutId: any;

    // 초기값 0으로 리셋
    riveRef.current.setInputState("State Machine 1", "Number 1", 0);

    const tick = () => {
      if (cancelled || !riveRef.current) return;
      current += stepDelta;
      const clamped = Math.min(current, targetGaugeValue);

      riveRef.current.setInputState("State Machine 1", "Number 1", clamped);

      if (clamped < targetGaugeValue) {
        timeoutId = setTimeout(tick, stepTime);
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [targetGaugeValue]);

  return (
    <View style={styles.container}>
      <View style={styles.resultWrapper}>
        <View style={styles.resultContent}>


          {/* 점수 카드 */}
          <View style={styles.scoreCard}>
            {/* 점수와 진행 바를 함께 배치 */}
            <View style={styles.scoreContainer}>


              {/* 점수 진행 바 - Rive 게이지 */}
              <View style={styles.progressBar}>
                <Rive
                  ref={riveRef}
                  resourceName="pro_box33"
                  stateMachineName="State Machine 1"
                  style={{ width: 220, height: 40 }}
                  autoplay
                />
              </View>
              <Text style={styles.scoreMessage}>{getScoreMessage()}</Text>
              <Text style={styles.scoreCombined}>
                {score}/{maxScore}
              </Text>
            </View>


          </View>

          {/* 버튼 */}
          <View style={styles.buttonContainer}>
            <Pressable
              onPress={onRestart}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.buttonText}>다시 하기</Text>
            </Pressable>

            <Pressable
              onPress={onGoHome}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.buttonText}>나가기</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  resultWrapper: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  resultContent: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  scoreCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    alignItems: "center",
    elevation: 4,
    marginBottom: 20,
  },
  scoreCombined: {
    marginTop: 16,
    fontSize: 28,
    fontWeight: "bold",
    color: "#7cbd7e",
    textAlign: "center",
    textShadowColor: "rgba(135, 206, 235, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,

  },
  scoreContainer: {
    alignItems: "center",
    marginBottom: 20,



  },
  scoreMessage: {
    fontSize: 32,
    color: "#333",
    marginTop: 5,
    fontWeight: "bold",
  },
  progressBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
    gap: 6,
  },
  buttonContainer: {
    width: "100%",
    gap: 15,
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#7cbd7e",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 12,
    minHeight: 80,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF", // 흰색
  },
  pressedButton: {
    transform: [{ scale: 0.98 }],
    opacity: 0.8,
  },
});

export default DrumGameOverScreen;
