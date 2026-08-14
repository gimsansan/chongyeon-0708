/**
 * 🧊 냉장고 + 정답 흡입 퀴즈 테스트
 *
 *
 * - 게이지 바: 70% 초록, 90% 주황, 100% 빨강 깜빡임
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
} from "react-native";
import { LAYOUT } from "../../../constants/layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "../../../services/audioCompat";
import Rive from "rive-react-native";
import StarIcon from "../../../assets/icons/star.svg";
import RefriStartBtn from "../../../assets/icons/refri_start_btnco1.svg";
import { MONO_ITEMS, type MonoItem } from "../../../constants/refriItems";
import * as Haptics from "expo-haptics";

const REFRI_RIVE_AVAILABLE = true;

type QuizItem = MonoItem;
const CARD_SLOTS = 6;
const MAX_ABSORB = 6; // Rive 용기 최대 개수

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type RefriState = "closed" | "open";

export default function RefriTestScreen() {
  const insets = useSafeAreaInsets();
  const [remainingIds, setRemainingIds] = useState<string[]>(() =>
    MONO_ITEMS.map((i) => i.id),
  );
  const [slotItems, setSlotItems] = useState<(QuizItem | null)[]>(() =>
    new Array(CARD_SLOTS).fill(null),
  );
  const [currentState, setCurrentState] = useState<RefriState>("closed");
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<QuizItem>(MONO_ITEMS[0]);
  const [isAnswerLocked, setIsAnswerLocked] = useState(false);
  const [gauge, setGauge] = useState(0);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  // Rive absorbAmount: 문제수÷6 = 용기당 문제수 → correctCount 기준 0~6
  const totalProblems = MONO_ITEMS.length;
  const absorbAmount = Math.min(
    MAX_ABSORB,
    Math.floor((correctCount / totalProblems) * MAX_ABSORB),
  );
  const totalAttempts = correctCount + wrongCount;
  const correctRate =
    totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;

  // 애니메이션 값
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const gaugeAnim = useRef(new Animated.Value(0)).current;
  const gaugeBlink = useRef(new Animated.Value(1)).current;
  const blinkLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // 버튼 애니메이션 값들 제거 (단순 TouchableOpacity 사용)

  // 상자 애니메이션 값들 (4개 상자)
  const crateOpacities = useRef([
    new Animated.Value(1), // 왼쪽 아래
    new Animated.Value(1), // 왼쪽 위
    new Animated.Value(1), // 오른쪽 아래
    new Animated.Value(1), // 오른쪽 위
  ]).current;

  const crateScales = useRef([
    new Animated.Value(1), // 왼쪽 아래
    new Animated.Value(1), // 왼쪽 위
    new Animated.Value(1), // 오른쪽 아래
    new Animated.Value(1), // 오른쪽 위
  ]).current;

  // 별 애니메이션 (메인 별 + 반짝임 3개)
  const starMainScale = useRef(new Animated.Value(0.9)).current;
  const starMainOpacity = useRef(new Animated.Value(0.8)).current;
  const sparkle1Scale = useRef(new Animated.Value(0)).current;
  const sparkle1Opacity = useRef(new Animated.Value(0)).current;
  const sparkle2Scale = useRef(new Animated.Value(0)).current;
  const sparkle2Opacity = useRef(new Animated.Value(0)).current;
  const sparkle3Scale = useRef(new Animated.Value(0)).current;
  const sparkle3Opacity = useRef(new Animated.Value(0)).current;

  // 별 애니메이션 시작
  const startStarAnimation = useCallback(() => {
    // 메인 별 pulse 애니메이션 (2초 주기)
    const mainPulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(starMainScale, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(starMainOpacity, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(starMainScale, {
            toValue: 0.9,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(starMainOpacity, {
            toValue: 0.8,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    // 반짝임 1 (0.2초 딜레이)
    const sparkle1Blink = Animated.loop(
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(sparkle1Scale, {
            toValue: 1.2,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle1Opacity, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(sparkle1Scale, {
            toValue: 0,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle1Opacity, {
            toValue: 0,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    // 반짝임 2 (0.7초 딜레이)
    const sparkle2Blink = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.parallel([
          Animated.timing(sparkle2Scale, {
            toValue: 1.2,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle2Opacity, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(sparkle2Scale, {
            toValue: 0,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle2Opacity, {
            toValue: 0,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    // 반짝임 3 (1.2초 딜레이)
    const sparkle3Blink = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.parallel([
          Animated.timing(sparkle3Scale, {
            toValue: 1.2,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle3Opacity, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(sparkle3Scale, {
            toValue: 0,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle3Opacity, {
            toValue: 0,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    mainPulse.start();
    sparkle1Blink.start();
    sparkle2Blink.start();
    sparkle3Blink.start();
  }, [
    starMainScale,
    starMainOpacity,
    sparkle1Scale,
    sparkle1Opacity,
    sparkle2Scale,
    sparkle2Opacity,
    sparkle3Scale,
    sparkle3Opacity,
  ]);

  // 퀴즈 카드 애니메이션 (정답 흡입) — MONO_ITEMS 6개 모두
  const answerAnimations = useRef(
    MONO_ITEMS.reduce(
      (acc, item) => {
        acc[item.id] = {
          translateX: new Animated.Value(0),
          translateY: new Animated.Value(0),
          scale: new Animated.Value(1),
          opacity: new Animated.Value(1),
        };
        return acc;
      },
      {} as Record<
        string,
        {
          translateX: Animated.Value;
          translateY: Animated.Value;
          scale: Animated.Value;
          opacity: Animated.Value;
        }
      >,
    ),
  ).current;

  const fridgeRef = useRef<View | null>(null);
  const answerRefs = useRef<Record<string, View | null>>({});
  const remainingIdsRef = useRef<string[]>(remainingIds);

  const soundRef = useRef<Audio.Sound | null>(null);
  const riveRef = useRef<any>(null);

  useEffect(() => {
    remainingIdsRef.current = remainingIds;
  }, [remainingIds]);

  // Rive 문 직접 제어 (stale closure 우회)
  const setRiveDoor = (isOpen: boolean) => {
    if (riveRef.current) {
      console.log("🎬 Rive 직접 제어: isOpen =", isOpen);
      riveRef.current.setInputState("Refri_SM", "isOpen", isOpen);
    }
  };

  // Rive absorbAmount 동기화 (0~6)
  useEffect(() => {
    if (riveRef.current) {
      riveRef.current.setInputState("Refri_SM", "absorbAmount", absorbAmount);
    }
  }, [absorbAmount]);

  useEffect(() => {
    const setupAudioMode = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.warn("오디오 모드 설정 실패", error);
      }
    };

    void setupAudioMode();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (blinkLoopRef.current) {
        blinkLoopRef.current.stop();
      }
    };
  }, []);

  // 상태 전환 애니메이션 (정답: 냉장고 열림)
  const switchState = useCallback(
    (newState: RefriState) => {
      console.log(
        "🚪 switchState 호출:",
        newState,
        "currentState:",
        currentState,
        "isAnimating:",
        isAnimating,
      );

      if (newState === currentState) {
        console.log("❌ 이미 같은 상태 - 무시");
        return;
      }
      if (isAnimating) {
        console.log("❌ 애니메이션 중 - 무시");
        return;
      }

      console.log("✅ switchState 실행!");
      setIsAnimating(true);
      setCurrentState(newState);

      // Rive 애니메이션 제어
      if (riveRef.current) {
        const isOpen = newState === "open";
        console.log("🎬 Rive setInputState: isOpen =", isOpen);
        riveRef.current.setInputState("Refri_SM", "isOpen", isOpen);
      }

      // Rive 애니메이션 완료 후 isAnimating 해제 (열림/닫힘 약 500ms)
      setTimeout(() => {
        setIsAnimating(false);
        console.log("🔓 isAnimating = false");
      }, 550);
    },
    [currentState, isAnimating],
  );

  // 흔들림 애니메이션 (오답 효과)
  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);

    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 12,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -12,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 6,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -6,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 3,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shakeAnim]);

  // 바운스 애니메이션 (정답 축하 효과)
  const triggerBounce = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsAnimating(false);
    });
  }, [isAnimating, scaleAnim]);

  const stopGaugeBlink = () => {
    gaugeBlink.setValue(1);
    if (blinkLoopRef.current) {
      blinkLoopRef.current.stop();
      blinkLoopRef.current = null;
    }
  };

  const startGaugeBlink = () => {
    stopGaugeBlink();
    blinkLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(gaugeBlink, {
          toValue: 0.45,
          duration: 350,
          useNativeDriver: false,
        }),
        Animated.timing(gaugeBlink, {
          toValue: 1,
          duration: 350,
          useNativeDriver: false,
        }),
      ]),
    );
    blinkLoopRef.current.start();
  };

  const setGaugeToValue = (value: number) => {
    const v = Math.min(100, Math.max(0, value));
    setGauge(v);
    Animated.timing(gaugeAnim, {
      toValue: v,
      duration: 220,
      useNativeDriver: false,
    }).start();
    updateCrateVisibility(v);
    if (v >= 100) startGaugeBlink();
    else stopGaugeBlink();
  };

  // 상자 가시성 업데이트 함수
  const updateCrateVisibility = (currentGauge: number) => {
    // 4개 상자가 25%, 50%, 75%, 100%에서 각각 사라짐
    const crateThresholds = [25, 50, 75, 100];

    crateThresholds.forEach((threshold, index) => {
      if (currentGauge >= threshold) {
        // 상자 사라짐 애니메이션 (scale + opacity)
        Animated.parallel([
          Animated.timing(crateOpacities[index], {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.spring(crateScales[index], {
            toValue: 0.3,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }),
        ]).start();
      }
    });
  };

  const resetAnswerAnimations = () => {
    MONO_ITEMS.forEach((item) => {
      const anim = answerAnimations[item.id];
      if (anim) {
        anim.translateX.setValue(0);
        anim.translateY.setValue(0);
        anim.scale.setValue(1);
        anim.opacity.setValue(1);
      }
    });
  };

  // 버튼 애니메이션 함수들 제거 (단순 TouchableOpacity activeOpacity 사용)

  const playSound = async (item: QuizItem) => {
    if (!item.sound) return;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync(item.sound, {
        shouldPlay: true,
        volume: 1.0,
      });
      soundRef.current = sound;
    } catch (error) {
      console.warn("사운드 재생 실패", error);
    }
  };

  const pickRandomAndPlay = useCallback(async (pool: string[]) => {
    if (pool.length === 0) return;
    const items = pool
      .map((id) => MONO_ITEMS.find((i) => i.id === id))
      .filter((x): x is QuizItem => x != null);
    const shuffled = shuffle(items);
    const slots: (QuizItem | null)[] = [];
    const slotCount = Math.min(CARD_SLOTS, shuffled.length);
    for (let i = 0; i < CARD_SLOTS; i++)
      slots.push(i < shuffled.length ? shuffled[i] : null);
    const next = shuffled[Math.floor(Math.random() * slotCount)];

    setRiveDoor(false);
    setCurrentState("closed");
    setIsAnimating(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsAnimating(false);

    resetAnswerAnimations();
    setIsAnswerLocked(false);
    setSlotItems(slots);
    setCurrentQuiz(next);
    await playSound(next);
  }, []);

  const startGame = useCallback(async () => {
    Haptics.selectionAsync().catch(() => {});
    setIsGameStarted(true);
    await pickRandomAndPlay(remainingIds);
  }, [pickRandomAndPlay, remainingIds]);

  const handleReplay = async () => {
    await playSound(currentQuiz); // 다시 듣기
  };

  // 게임 리셋 함수
  const resetGame = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    // 게이지 초기화
    setGauge(0);
    gaugeAnim.setValue(0);
    stopGaugeBlink(); //

    // 냉장고 상태 초기화
    setCurrentState("closed");
    if (riveRef.current) {
      riveRef.current.setInputState("Refri_SM", "isOpen", false);
      riveRef.current.setInputState("Refri_SM", "absorbAmount", 0);
    }

    // 상자 초기화 (모든 상자 다시 보이기)
    crateOpacities.forEach((opacity) => {
      opacity.setValue(1);
    });
    crateScales.forEach((scale) => {
      scale.setValue(1);
    });

    // 퀴즈 상태 초기화
    resetAnswerAnimations();
    setIsAnswerLocked(false);
    setIsGameStarted(false);
    setIsGameComplete(false);
    setCorrectCount(0);
    setWrongCount(0);
    setRemainingIds(MONO_ITEMS.map((i) => i.id));
    setSlotItems(new Array(CARD_SLOTS).fill(null));
    setCurrentQuiz(MONO_ITEMS[0]);
  }, [gaugeAnim]);

  const applyCorrectAndNext = (id: string) => {
    const current = remainingIdsRef.current;
    const nextRemaining = current.filter((i) => i !== id);
    setRemainingIds(nextRemaining);
    const solvedCount = MONO_ITEMS.length - nextRemaining.length;
    setCorrectCount(solvedCount);
    setGaugeToValue((solvedCount / MONO_ITEMS.length) * 100);
    if (nextRemaining.length === 0) {
      // 6용기 상태를 잠깐 보여준 뒤 결과 메시지 표시
      const showResultDelay = 800;
      setTimeout(() => {
        resetAnswerAnimations();
        setIsAnswerLocked(false);
        setIsGameComplete(true);
        startStarAnimation();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }, showResultDelay);
    } else {
      setTimeout(() => pickRandomAndPlay(nextRemaining), 100);
    }
  };

  const animateCorrectAnswer = (id: string) => {
    const ref = answerRefs.current[id];
    if (!ref || !fridgeRef.current) {
      triggerBounce();
      applyCorrectAndNext(id);
      return;
    }

    ref.measure((ax, ay, aw, ah, aPageX, aPageY) => {
      fridgeRef.current?.measure((fx, fy, fw, fh, fPageX, fPageY) => {
        const moveX = fPageX + fw / 2 - (aPageX + aw / 2);
        const moveY = fPageY + fh / 2 - (aPageY + ah / 2);
        const anim = answerAnimations[id];

        Animated.parallel([
          Animated.timing(anim.translateX, {
            toValue: moveX,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateY, {
            toValue: moveY,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(anim.scale, {
            toValue: 0.3,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(anim.opacity, {
            toValue: 0,
            duration: 520,
            useNativeDriver: true,
          }),
        ]).start(() => {
          applyCorrectAndNext(id);
        });
      });
    });
  };

  const handleSelectAnswer = (item: QuizItem) => {
    if (!isGameStarted) return;
    if (isAnswerLocked) return;
    setIsAnswerLocked(true);
    const isCorrect = item.id === currentQuiz.id;
    if (isCorrect) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      // 타이밍 맞춰 문 열기 → 카드 흡입 (Rive 문 애니메이션과 부드럽게 연결)
      switchState("open");
      setTimeout(() => {
        animateCorrectAnswer(item.id);
      }, 250);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      // 오답: 오답 횟수 증가 + 냉장고 흔들림 + 해당 카드 바운스 후 다시 선택 가능
      setWrongCount((prev) => prev + 1);
      setTimeout(() => {
        triggerShake();
      }, 200);
      // 카드 제자리 바운스
      const anim = answerAnimations[item.id];
      if (anim) {
        Animated.sequence([
          Animated.timing(anim.scale, {
            toValue: 1.12,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.spring(anim.scale, {
            toValue: 1,
            friction: 4,
            tension: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
      setTimeout(() => setIsAnswerLocked(false), 700);
    }
  };

  const gaugeColor = () => {
    if (gauge >= 100) return "#F44336";
    if (gauge >= 90) return "#FB8C00";
    if (gauge >= 70) return "#43A047";
    return "#66BB6A";
  };

  const gaugeWidth = gaugeAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  // 배경 렌더링 (고정, 흔들림 없음)
  const renderBackground = () => {
    if (!REFRI_RIVE_AVAILABLE) {
      return (
        <View
          style={{
            width: LAYOUT.refriRiveWidth,
            height: LAYOUT.refriRiveHeight,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.2)",
          }}
        >
          <Text style={{ color: "#888", fontSize: 12 }}>배경 리소스 없음</Text>
          <Text style={{ color: "#666", fontSize: 10, marginTop: 4 }}>
            refri_bg.riv
          </Text>
        </View>
      );
    }
    return (
      <Rive
        resourceName="refri_bg"
        style={{ width: LAYOUT.refriRiveWidth, height: LAYOUT.refriRiveHeight }}
        autoplay={false}
      />
    );
  };

  // 냉장고 렌더링 (State Machine 포함, shake 적용 대상)
  const renderFridge = () => {
    if (!REFRI_RIVE_AVAILABLE) {
      return (
        <View
          style={{
            width: LAYOUT.refriRiveWidth,
            height: LAYOUT.refriRiveHeight,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.2)",
          }}
        >
          <Text style={{ color: "#888", fontSize: 12 }}>리소스 없음</Text>
          <Text style={{ color: "#666", fontSize: 10, marginTop: 4 }}>
            refribon.riv
          </Text>
        </View>
      );
    }
    return (
      <Rive
        ref={riveRef}
        resourceName="refrigerator_obj"
        stateMachineName="Refri_SM"
        style={{ width: LAYOUT.refriRiveWidth, height: LAYOUT.refriRiveHeight }}
        autoplay={false}
      />
    );
  };

  const CRATE_IMAGE = require("../../../assets/refri/crate_tall2x.webp");

  // 상자 렌더링 함수 (위→아래 순서: 3,2,1,0)
  const renderCrates = () => (
    <View style={styles.cratesContainer}>
      <View style={styles.leftCrateStack}>
        {[3, 2, 1, 0].map((idx) => (
          <Animated.View
            key={idx}
            style={[
              styles.crateWrapper,
              {
                opacity: crateOpacities[idx],
                transform: [{ scale: crateScales[idx] }],
              },
            ]}
          >
            <Image source={CRATE_IMAGE} style={styles.crateBox} />
          </Animated.View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 게이지 — 항상 표시 (시작 전 0%, 시작 후 진행률) */}
      <View style={styles.gaugeSection}>
        <View style={styles.gaugeContainer}>
          <View style={styles.gaugeTrack}>
            {/* 단계별 구분선 */}
            <View style={[styles.gaugeMilestone, { left: "70%" }]}>
              <View
                style={[styles.milestoneIcon, { backgroundColor: "#43A047" }]}
              />
            </View>
            <View style={[styles.gaugeMilestone, { left: "90%" }]}>
              <View
                style={[styles.milestoneIcon, { backgroundColor: "#FB8C00" }]}
              />
            </View>

            <Animated.View
              style={[
                styles.gaugeFill,
                {
                  width: gaugeWidth,
                  backgroundColor: gaugeColor(),
                  opacity: gauge >= 100 ? gaugeBlink : 1,
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* 냉장고 + 상자 표시 영역 */}
      <View style={styles.refriContainer} ref={fridgeRef}>
        <View style={styles.refriWithCratesWrapper}>
          {/* 상자들 (먼저 렌더링 = 뒤에 표시) */}
          {renderCrates()}

          {/* 배경 (고정, 흔들림 없음) */}
          <View style={styles.backgroundWrapper}>{renderBackground()}</View>

          {/* 냉장고 (State Machine 포함, shake 적용) */}
          <Animated.View
            style={[
              styles.fridgeWrapper,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }, { translateX: shakeAnim }],
              },
            ]}
          >
            {renderFridge()}
          </Animated.View>
        </View>
      </View>

      {/* 게임 완료 화면 */}
      {isGameComplete && (
        <View style={styles.completeOverlay}>
          <View style={styles.completeBox}>
            <View style={styles.completeEmoji}>
              <Animated.View
                style={{
                  transform: [{ scale: starMainScale }],
                  opacity: starMainOpacity,
                }}
              >
                <StarIcon
                  width={LAYOUT.refriCompleteEmojiFontSize}
                  height={LAYOUT.refriCompleteEmojiFontSize}
                />
              </Animated.View>

              {/* 반짝임 1 */}
              <Animated.View
                style={[
                  styles.sparkleIcon,
                  {
                    top: "15%",
                    left: "20%",
                    transform: [{ scale: sparkle1Scale }],
                    opacity: sparkle1Opacity,
                  },
                ]}
              >
                <View style={styles.sparkleShape} />
              </Animated.View>

              {/* 반짝임 2 */}
              <Animated.View
                style={[
                  styles.sparkleIcon,
                  {
                    top: "10%",
                    right: "20%",
                    transform: [{ scale: sparkle2Scale }],
                    opacity: sparkle2Opacity,
                  },
                ]}
              >
                <View style={styles.sparkleShape} />
              </Animated.View>

              {/* 반짝임 3 */}
              <Animated.View
                style={[
                  styles.sparkleIcon,
                  {
                    bottom: "25%",
                    right: "15%",
                    transform: [{ scale: sparkle3Scale }],
                    opacity: sparkle3Opacity,
                  },
                ]}
              >
                <View style={styles.sparkleShape} />
              </Animated.View>
            </View>
            <Text style={styles.completeTitle}>모두 완료!</Text>

            <Text style={styles.completeStats}>정답률: {correctRate}%</Text>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={resetGame}
              activeOpacity={0.88}
            >
              <Ionicons
                name="refresh"
                size={LAYOUT.refriReplayIconSize}
                color="white"
              />
              <Text style={styles.completeButtonText}>다시 하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 플로팅 다시 듣기 (게임 중일 때만, 하단 고정) */}
      {isGameStarted && (
        <View
          style={[
            styles.floatingReplayWrap,
            { bottom: insets.bottom + LAYOUT.refriBottomInsetOffset },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={styles.floatingReplayBtn}
            onPress={handleReplay}
            activeOpacity={0.88}
          >
            <Ionicons
              name="volume-high"
              size={LAYOUT.refriVolumeIconSize}
              color="#444"
            />
          </TouchableOpacity>
        </View>
      )}

      {/* 정답 카드 6슬롯 — 선반(Tray) 위에 배치 */}
      <View style={styles.answersContainer}>
        {slotItems.map((item, i) => {
          const cardWidth = LAYOUT.refriAnswerCardWidth;
          if (item == null) {
            return null;
          }
          const anim = answerAnimations[item.id];
          if (!anim)
            return <View key={`slot-${i}`} style={{ width: cardWidth }} />;
          return (
            <View
              key={`slot-${i}`}
              ref={(node) => {
                answerRefs.current[item.id] = node;
              }}
              collapsable={false}
              style={{ width: cardWidth }}
            >
              <Animated.View
                style={[
                  styles.answerCard,
                  {
                    transform: [
                      { translateX: anim.translateX },
                      { translateY: anim.translateY },
                      { scale: anim.scale },
                    ],
                    opacity: anim.opacity,
                  },
                ]}
              >
                <TouchableOpacity
                  style={[styles.answerInner, { width: cardWidth }]}
                  activeOpacity={0.88}
                  onPress={() => handleSelectAnswer(item)}
                  disabled={isAnswerLocked}
                >
                  <Image
                    source={item.imageSource}
                    style={styles.answerImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.answerLabel}>{item.label}</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          );
        })}
      </View>

      {/* 시작 버튼 — 게임 시작 전에만 하단 고정 */}
      {!isGameStarted && (
        <View
          style={[
            styles.controlSection,
            { paddingBottom: insets.bottom + LAYOUT.refriBottomInsetOffset },
          ]}
        >
          <TouchableOpacity
            onPress={startGame}
            activeOpacity={0.88}
            style={styles.controlBtnStartWrap}
          >
            <RefriStartBtn
              width={LAYOUT.refriStartBtnWidth}
              height={LAYOUT.refriStartBtnHeight}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  gaugeSection: {
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: LAYOUT.refriGaugeSectionPaddingV,
    paddingHorizontal: LAYOUT.refriGaugeSectionPaddingH,
    marginBottom: LAYOUT.refriGaugeToFridgeGap,
    height: LAYOUT.refriGaugeSectionHeight,
    zIndex: 100,
  },
  gaugeContainer: {
    width: LAYOUT.refriGaugeContainerWidthPercent,
    position: "relative",
    marginTop: 40,
  },
  gaugeTrack: {
    height: LAYOUT.refriGaugeTrackHeight,
    borderRadius: LAYOUT.refriGaugeTrackBorderRadius,
    backgroundColor: "#E0E6ED",
    overflow: "hidden",
    position: "relative",
  },
  gaugeMilestone: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  milestoneIcon: {
    width: LAYOUT.refriGaugeMilestoneSize,
    height: LAYOUT.refriGaugeMilestoneSize,
    borderRadius: LAYOUT.refriGaugeMilestoneSize / 2,
  },
  gaugeFill: {
    height: "100%",
    borderRadius: LAYOUT.refriGaugeTrackBorderRadius,
  },

  // 냉장고 + 상자 영역
  refriContainer: {
    height: LAYOUT.screenHeight * LAYOUT.refriSceneHeightRatio,
    justifyContent: "center",
    alignItems: "center",
    marginTop: LAYOUT.refriContainerMarginTop,
  },
  refriWithCratesWrapper: {
    position: "relative",
    width: "100%",
    height: LAYOUT.screenHeight * LAYOUT.refriSceneHeightRatio,
    justifyContent: "center",
    alignItems: "center",
  },
  backgroundWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  fridgeWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },

  // 상자 스타일 (반응형)
  cratesContainer: {
    position: "absolute",
    left: 0,
    bottom: LAYOUT.screenHeight * LAYOUT.refriCratesBottomRatio,
    justifyContent: "flex-end",
    alignItems: "flex-start",
    paddingLeft: LAYOUT.screenWidth * LAYOUT.refriCratesPaddingLeftRatio,
    paddingBottom: LAYOUT.screenHeight * LAYOUT.refriCratesPaddingBottomRatio,
    zIndex: 10,
  },
  leftCrateStack: {
    flexDirection: "column-reverse",
    alignItems: "center",
  },
  crateWrapper: {
    marginBottom:
      LAYOUT.screenHeight * LAYOUT.refriCrateWrapperMarginBottomRatio,
    top: LAYOUT.screenHeight * LAYOUT.refriCrateWrapperTopRatio,
  },
  crateBox: {
    width: LAYOUT.screenWidth * LAYOUT.refriCrateBoxSizeRatio,
    height: LAYOUT.screenWidth * LAYOUT.refriCrateBoxSizeRatio,
    resizeMode: "contain",
  },

  // 플로팅 다시 듣기 (하단 고정, bottom은 JSX에서 insets 반영)
  floatingReplayWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: LAYOUT.refriZIndexFloatingReplay,
  },
  floatingReplayBtn: {
    width: LAYOUT.refriFloatingReplaySize,
    height: LAYOUT.refriFloatingReplaySize,
    borderRadius: LAYOUT.refriFloatingReplaySize / 2,
    backgroundColor: "#F0EDE8",
    justifyContent: "center",
    alignItems: "center",
    elevation: LAYOUT.refriFloatingReplayElevation,
  },
  // 컨트롤 섹션 — 시작 버튼만 하단 고정
  controlSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: LAYOUT.refriZIndexControlSection,
    alignItems: "center",
    paddingHorizontal: LAYOUT.refriControlSectionPaddingH,
  },
  controlBtnStartWrap: {
    minWidth: LAYOUT.refriControlBtnMinWidth,
  },

  // 하단 단어 카드 전용 선반(Tray)
  answersContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingTop: LAYOUT.refriTrayPaddingTop,
    paddingHorizontal: LAYOUT.refriTrayPaddingH,
    paddingBottom: LAYOUT.refriTrayPaddingBottom,
    gap: LAYOUT.refriTrayGap,
    zIndex: LAYOUT.refriZIndexAnswers,
    minHeight: LAYOUT.screenHeight * LAYOUT.refriTrayMinHeightRatio,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderTopLeftRadius: LAYOUT.refriTrayBorderRadius,
    borderTopRightRadius: LAYOUT.refriTrayBorderRadius,
  },
  answerCard: {
    backgroundColor: "white",
    borderRadius: LAYOUT.refriAnswerCardBorderRadius,
    padding: LAYOUT.refriAnswerCardPadding,
    borderWidth: 2,
    borderColor: "#BDBDBD",
    elevation: LAYOUT.refriAnswerCardElevation,
    alignItems: "center",
  },
  answerInner: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: LAYOUT.refriAnswerInnerMinHeight,
  },
  answerImage: {
    width: LAYOUT.refriAnswerImageSize,
    height: LAYOUT.refriAnswerImageSize,
  },
  answerLabel: {
    marginTop: LAYOUT.refriAnswerLabelMarginTop,
    fontSize: LAYOUT.refriAnswerLabelFontSize,
    fontWeight: "700",
    color: "#263238",
    textAlign: "center",
  },

  // 게임 완료 화면
  completeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: LAYOUT.refriZIndexCompleteOverlay,
  },
  completeBox: {
    backgroundColor: "white",
    borderRadius: LAYOUT.refriCompleteBoxBorderRadius,
    padding: LAYOUT.refriCompleteBoxPadding,
    alignItems: "center",
    elevation: LAYOUT.refriCompleteBoxElevation,
    minWidth: LAYOUT.refriCompleteBoxMinWidth,
  },
  completeEmoji: {
    marginBottom: LAYOUT.spacingSM,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: LAYOUT.refriCompleteEmojiFontSize,
    height: LAYOUT.refriCompleteEmojiFontSize,
  },
  sparkleIcon: {
    position: "absolute",
    width: 8,
    height: 8,
  },
  sparkleShape: {
    width: 8,
    height: 8,
    backgroundColor: "#FFD700",
    borderRadius: 4,
  },
  completeTitle: {
    fontSize: LAYOUT.refriCompleteTitleFontSize,
    fontWeight: "800",
    color: "#4CAF50",
    marginBottom: LAYOUT.spacingSM,
  },

  completeStats: {
    fontSize: LAYOUT.refriCompleteStatsFontSize,
    fontWeight: "700",
    color: "#263238",
    marginBottom: LAYOUT.spacingLG,
  },
  completeButton: {
    flexDirection: "row",
    backgroundColor: "#7cbd7e",
    paddingHorizontal: LAYOUT.refriCompleteButtonPaddingH,
    paddingVertical: LAYOUT.completeButtonPaddingV,
    borderRadius: LAYOUT.refriControlBtnBorderRadius,
    alignItems: "center",
    gap: LAYOUT.refriCompleteButtonGap,
    elevation: LAYOUT.completeButtonElevation,
  },
  completeButtonText: {
    color: "white",
    fontSize: LAYOUT.refriCompleteSubtitleFontSize,
    fontWeight: "700",
  },
});
