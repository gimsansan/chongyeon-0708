/**
 * 📚 학습 카드 스와이프 화면
 *
 * 🎯 최적화 전략:
 * ┌─────────────────────────────────────────────────────────┐
 * │ 1. 자연스러운 애니메이션 (useNativeDriver: false)        │
 * │    - 모든 애니메이션을 JS 스레드에서 일관되게 처리       │
 * │    - setValue()와 충돌 없이 안정적 동작                  │
 * ├─────────────────────────────────────────────────────────┤
 * │ 2. 깜빡임 방지 (requestAnimationFrame)                   │
 * │    - 애니메이션 완료 → 다음 프레임에서 상태 업데이트     │
 * │    - 백그라운드 카드 전환 시 깜빡임 최소화              │
 * ├─────────────────────────────────────────────────────────┤
 * │ 3. 메모이제이션 (React.memo)                             │
 * │    - StackCard: ID 기반 비교로 불필요한 리렌더링 방지    │
 * │    - WordFlashcard: key prop으로 내부 상태 초기화        │
 * ├─────────────────────────────────────────────────────────┤
 * │ 4. 제스처 최적화 (Animated.Value.setValue)               │
 * │    - 드래그 중 리렌더링 없이 직접 값 변경 (고성능)       │
 * │    - 60fps 부드러운 터치 반응                            │
 * └─────────────────────────────────────────────────────────┘
 */

import React, { useState, useRef, memo, useEffect, useMemo, useCallback } from 'react';
import { Text, View, StyleSheet, ScrollView, Animated, TouchableOpacity, Image, ImageBackground } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
// @ts-ignore
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { EASY_WORD_PAIRS, NORMAL_WORD_PAIRS } from '../../../constants/wordSounds';
import { LAYOUT } from '../../../constants/layout';
import { COLORS } from '../../../constants/colors';
import { WordFlashcard } from '../../../components/game/WordFlashcard';
import CompletedBadgeBg from '../../../assets/icons/completed_badge_bg.svg';

const ALL_PAIRS = [...EASY_WORD_PAIRS, ...NORMAL_WORD_PAIRS];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  // ✅ AsyncStorage 연동 상태
  const [completedCards, setCompletedCards] = useState<Set<string>>(new Set());
  const [filteredPairs, setFilteredPairs] = useState([...ALL_PAIRS]);

  // ✅ 완료 메시지 Bounce 애니메이션용 ref
  const [completionMessage, setCompletionMessage] = useState<string>('');
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionScale = useRef(new Animated.Value(1)).current;

  // ✅ 완료 카드 복원 모달 상태
  const [showCompletedModal, setShowCompletedModal] = useState(false);

  const undoStackRef = useRef<string[]>([]);

  // ✅ AsyncStorage에서 완료 카드 로드
  const loadCompletedCards = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem('completedCards');
      if (saved) {
        const completed = new Set<string>(JSON.parse(saved));
        setCompletedCards(completed);
        const filtered = ALL_PAIRS.filter(p => !completed.has(p.id));
        setFilteredPairs(filtered);
      }
    } catch (error) {
      console.log('AsyncStorage 로드 실패:', error);
    }
  }, []);

  // ✅ 앱 시작 시 AsyncStorage에서 완료 카드 로드
  useEffect(() => {
    loadCompletedCards();
  }, [loadCompletedCards]);

  // ✅ 컴포넌트 언마운트 시 타이머 정리 (메모리 누수 방지)
  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
    };
  }, []);

  // ✅ AsyncStorage에 완료 카드 저장
  const saveCompletedCards = async (completed: Set<string>) => {
    try {
      await AsyncStorage.setItem('completedCards', JSON.stringify(Array.from(completed)));
    } catch (error) {
      console.log('AsyncStorage 저장 실패:', error);
    }
  };

  // ✅ 버튼 Bounce 애니메이션 (클릭 시)
  const showBadgeAnimation = () => {
    completionScale.setValue(0.9);
    Animated.sequence([
      Animated.spring(completionScale, {
        toValue: 1.06,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.spring(completionScale, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // 학습 완료 카드를 추적하기 위한 상태 (향후 서버 동기화 시 사용)
  // completedCardsRef 제거 - completedCards 상태로 통합

  // 애니메이션 값들 초기화
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  // 배지 위치 추적 (배지로 날아가는 애니메이션용)
  const badgeRef = useRef<any>(null);
  const cardStackRef = useRef<any>(null);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setCurrentIndex(0);
      };
    }, [])
  );

  const currentPair = filteredPairs[currentIndex]; // 필터된 배열에서 현재 카드 가져오기 

  // 제스처 이벤트 핸들러: 드래그 중 실시간으로 카드 위치 업데이트
  // Animated.Value.setValue()는 리렌더링을 발생시키지 않고 직접 애니메이션 값만 변경 (고성능)
  const handleGestureEvent = ({ nativeEvent }: any) => {
    panX.setValue(nativeEvent.translationX);
    panY.setValue(nativeEvent.translationY);
  };

  // 애니메이션 초기화: 모든 애니메이션 값을 초기 상태로 리셋
  // 기존 resetAnimation은 값을 바로 세팅만 하므로 리렌더와 애니메이션이 없음
  // Animated.timing을 써서 부드럽게 '원위치'로 돌아가게 한다
  const resetAnimation = () => {
    panX.setValue(0);
    panY.setValue(0);
    scale.setValue(1);
    opacity.setValue(1);
    rotation.setValue(0);
  };

  // 🔘 이전 카드 (좌측 화살표)
  const handlePrevCard = () => {
    if (currentIndex > 0) {
      animateSwipe('right', () => {
        setCurrentIndex(currentIndex - 1);
        resetAnimation();
      });
    }
  };

  // 🔘 다음 카드 (우측 화살표)
  const handleNextCard = () => {
    if (currentIndex < filteredPairs.length - 1) {
      animateSwipe('left', () => {
        setCurrentIndex(currentIndex + 1);
        resetAnimation();
      });
    }
  };

  // 🔘 학습 완료 (중앙 버튼) - 배지로 날아가는 애니메이션
  // 네, 여기서는 일반 함수 선언이 아니라, 함수 표현식을 const 변수에 할당한 "화살표 함수(arrow function)" 형태입니다.
  // 이렇게 하면 handleCompleteCard는 클릭 등에서 즉시 실행할 수 있는 함수 객체로 만들어집니다.
  const handleCompleteCard = () => {
    if (currentIndex >= filteredPairs.length) return;
    //한장을 보고 있음 커렌인댁 1 렝스1  
    // 네, currentPair는 currentIndex나 filteredPairs가 바뀔 때마다 새로 할당됩니다.
    const currentPair = filteredPairs[currentIndex];   // 현재 카드 가져오기

    // 배지와 카드 위치 측정
    if (badgeRef.current && cardStackRef.current) {
      badgeRef.current.measure((bx: number, by: number, bWidth: number, bHeight: number, bPageX: number, bPageY: number) => {
        cardStackRef.current.measure((cx: number, cy: number, cWidth: number, cHeight: number, cPageX: number, cPageY: number) => {
          // 배지 중앙 위치
          const badgeCenterX = bPageX + bWidth / 2;
          const badgeCenterY = bPageY + bHeight / 2;

          // 카드 중앙 위치
          const cardCenterX = cPageX + cWidth / 2;
          const cardCenterY = cPageY + cHeight / 2;

          // 이동 거리 계산
          const moveX = badgeCenterX - cardCenterX;
          const moveY = badgeCenterY - cardCenterY;
          // resetAnimation은 카드의 Animated.Value들을 즉시 원래 위치(중앙)으로 돌려놓는 함수입니다.
          // 즉, panX/Y 등 모든 위치/회전/스케일 값을 기본값으로 "점프"시킵니다.
          // 애니메이션 없이 즉각적으로 값을 바꾸기 때문에, 카드가 "초기 위치로 순간이동" 합니다.
          // 실제 "날아가는" 동작은 resetAnimation에서 담당하는 것이 아니라, 
          // 날아가는 동작(배지 쪽으로 이동, fade out, shrink 등)은 handleCompleteCard 내부에서
          // Animated.parallel로 panX/panY 등 값을 변경하며 만들어집니다.
          // resetAnimation은 그 애니메이션이 끝난 뒤, 다시 준비된 카드가 원위치에서 등장하도록 리셋 역할입니다.
          // 배지로 날아가는 애니메이션
          Animated.parallel([
            Animated.timing(panX, {
              toValue: moveX,
              duration: 600,
              useNativeDriver: false,
            }),
            Animated.timing(panY, {
              toValue: moveY,
              duration: 600,
              useNativeDriver: false,
            }),
            Animated.timing(scale, {
              toValue: 0,
              duration: 600,
              useNativeDriver: false,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 600,
              useNativeDriver: false,
            }),
            // 시계방향 90도 => toValue: -90으로 수정 (음수: 시계방향, 양수: 반시계방향)
            Animated.timing(rotation, {
              toValue: 90,
              duration: 600,
              useNativeDriver: false,
            }),
            // 네, 여기 콜백은 위 Animated.parallel의 모든 애니메이션(duration: 600ms)이 다 끝난 후에 실행됩니다.
          ]).start(() => {
            requestAnimationFrame(() => {
              // 상태 업데이트
              const newCompleted = new Set(completedCards);
              newCompleted.add(currentPair.id);

              setCompletedCards(newCompleted);
              saveCompletedCards(newCompleted);

              // ✅ filteredPairs에서 현재 카드 제거
              const newFiltered = filteredPairs.filter(p => p.id !== currentPair.id);
              setFilteredPairs(newFiltered);

              // ✅ 완료 체크
              if (newFiltered.length === 0) {
                setCurrentIndex(0);
              } else {
                // 인덱스 조정 (현재 카드가 제거되었으므로)
                if (currentIndex >= newFiltered.length) {
                  setCurrentIndex(newFiltered.length - 1);
                }
              }

              // 다음 카드로 애니메이션 준비
              resetAnimation();
            });
          });
        });
      });
    } else {
      // 측정 실패 시 기존 로직 실행
      const newCompleted = new Set(completedCards);
      newCompleted.add(currentPair.id);

      setCompletedCards(newCompleted);
      saveCompletedCards(newCompleted);

      const newFiltered = filteredPairs.filter(p => p.id !== currentPair.id);
      setFilteredPairs(newFiltered);

      if (newFiltered.length === 0) {
        setCurrentIndex(0);
      } else {
        if (currentIndex >= newFiltered.length) {
          setCurrentIndex(newFiltered.length - 1);
        }
      }
    }
  };

  // 🔘 모든 카드 리셋 (다시 시작)
  const handleResetAllCards = () => {
    setCompletedCards(new Set());
    setFilteredPairs([...ALL_PAIRS]);
    setCurrentIndex(0);
    saveCompletedCards(new Set());
    setShowCompletedModal(false);
  };

  // 스와이프 애니메이션: 하이브리드 최적화 전략
  // ✅ 자연스러움: 모든 애니메이션을 JS 스레드에서 실행하여 일관성 유지
  // ✅ 에러 방지: setValue()와 useNativeDriver 충돌 해결
  const animateSwipe = (direction: 'left' | 'right' | 'down', onComplete?: () => void) => {
    if (direction === 'down') {
      // 하단으로 사라지는 애니메이션
      Animated.parallel([
        Animated.timing(panY, {
          toValue: LAYOUT.screenHeight,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(scale, {
          toValue: 0.5,
          duration: 400,
          useNativeDriver: false,
        }),
      ]).start(() => {
        requestAnimationFrame(() => {
          onComplete?.();
        });
      });
    } else {
      // 기존 좌우 애니메이션
      Animated.parallel([
        Animated.timing(panX, {
          toValue: direction === 'right' ? LAYOUT.screenWidth : -LAYOUT.screenWidth,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(rotation, {
          toValue: direction === 'right' ? 25 : -25,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(scale, {
          toValue: 0.85,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start(() => {
        requestAnimationFrame(() => {
          onComplete?.();
        });
      });
    }
  };

  // 스와이프 완료 핸들러: 제스처 종료 시점에 호출됨
  // translationX: 총 이동 거리, velocityX: 스와이프 속도
  const handleSwipe = ({ nativeEvent }: any) => {
    const { translationX, velocityX, translationY } = nativeEvent;
    const DROP_ZONE_THRESHOLD = LAYOUT.dropZoneThreshold;

    // 하단 드롭존 감지 (학습 완료)
    if (translationY > DROP_ZONE_THRESHOLD && currentPair) {
      // ✅ 학습 완료 처리
      const cardId = currentPair.id;
      const newCompleted = new Set(completedCards);
      newCompleted.add(cardId);

      // ✅ 상태 업데이트
      setCompletedCards(newCompleted);
      saveCompletedCards(newCompleted);
      undoStackRef.current.push(cardId);

      // ✅ 필터된 배열에서 현재 카드 제거
      const newFiltered = filteredPairs.filter(p => p.id !== cardId);
      setFilteredPairs(newFiltered);

      // 다음 카드로 이동
      if (currentIndex < newFiltered.length) {
        animateSwipe('down', () => {
          setCurrentIndex(currentIndex); // 같은 인덱스 (다음 카드가 자동으로 올라옴)
          resetAnimation();
        });
      } else {
        // 모든 카드 완료
        resetAnimation();
      }
      return;
    }

    // ✅ 좌측 스와이프: "다시 학습" (Undo)
    else if (translationX < -50 || velocityX < -500) {
      if (undoStackRef.current.length > 0) {
        // 최근 완료 카드 복귀
        const lastCardId = undoStackRef.current.pop();
        if (lastCardId) {
          const newCompleted = new Set(completedCards);
          newCompleted.delete(lastCardId);

          setCompletedCards(newCompleted);
          saveCompletedCards(newCompleted);

          // 복귀할 카드 찾아서 filteredPairs에 추가 (중복 방지, 함수형 업데이트)
          const cardToRestore = ALL_PAIRS.find(p => p.id === lastCardId);
          if (cardToRestore) {
            setFilteredPairs(prev => {
              // 이미 존재하면 아무 변경도 하지 않음
              if (prev.some(p => p.id === cardToRestore.id)) {
                if (__DEV__) {
                  console.warn('⚠️ 복원 시도한 카드가 이미 filteredPairs에 존재:', cardToRestore.id);
                }
                return prev;
              }

              // ✅ 원래 순서대로 정렬 (ALL_PAIRS 기준)
              const newFiltered = [...prev, cardToRestore].sort((a, b) => {
                return ALL_PAIRS.indexOf(a) - ALL_PAIRS.indexOf(b);
              });

              // ✅ 복원된 카드의 새 인덱스 찾기 및 마커 위치 업데이트
              const restoredIndex = newFiltered.findIndex(p => p.id === cardToRestore.id);
              setCurrentIndex(restoredIndex);

              return newFiltered;
            });

            animateSwipe('left', () => {
              resetAnimation();
            });
          }
        }
      } else if (currentIndex > 0) {
        // undo 스택이 비어있으면 이전 카드로 이동 (기존 동작)
        animateSwipe('left', () => {
          setCurrentIndex(currentIndex - 1);
          resetAnimation();
        });
      }
    }

    // 우측 스와이프 감지 (다음 카드로 이동)
    else if (translationX > 50 || velocityX > 500) {
      if (currentIndex < filteredPairs.length - 1) {
        animateSwipe('right', () => {
          setCurrentIndex(currentIndex + 1);
          resetAnimation();
        });
      }
    }
    // 스와이프 임계값 미달 → 원위치로 복귀
    else {
      resetAnimation();
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* ✅ 완료 카드 복원 모달 */}
      {showCompletedModal && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowCompletedModal(false)}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>학습 완료된 카드 ({completedCards.size})</Text>
              <TouchableOpacity
                onPress={() => setShowCompletedModal(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={LAYOUT.modalCloseIconSize} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.completedCardsGrid}>
                {ALL_PAIRS
                  .filter(pair => completedCards.has(pair.id))
                  .map(pair => (
                    <TouchableOpacity
                      key={pair.id}
                      style={styles.completedCardItem}
                      onPress={() => {
                        // 복원 처리 (중복 방지)
                        const newCompleted = new Set(completedCards);
                        newCompleted.delete(pair.id);
                        setCompletedCards(newCompleted);
                        saveCompletedCards(newCompleted);

                        // 함수형 업데이트로 중복 체크
                        setFilteredPairs(prev => {
                          if (prev.some(p => p.id === pair.id)) {
                            if (__DEV__) {
                              console.warn('⚠️ 모달 복원 시도한 카드가 이미 filteredPairs에 존재:', pair.id);
                            }
                            return prev;
                          }
                          const newFiltered = [...prev, pair];
                          setCurrentIndex(Math.max(0, newFiltered.length - 1));
                          return newFiltered;
                        });


                      }}
                    >

                      <View style={styles.completedCardImage}>
                        <Text style={styles.completedCardText}>{pair.word1}</Text>
                        <Text style={[styles.completedCardText, { marginHorizontal: 6 }]}>/</Text>
                        <Text style={styles.completedCardText}>{pair.word2}</Text>
                      </View>
                      <View style={styles.replayIconWrap}>
                        <Ionicons name="arrow-undo-outline" size={LAYOUT.headerSmallIconSize} color={COLORS.textLight} />
                      </View>
                    </TouchableOpacity>
                  ))}
              </View>
              {/* 모달 하단 "전체 다시 하기" 버튼 */}
              <TouchableOpacity
                style={styles.completionRestartButton}
                onPress={() => {
                  handleResetAllCards();
                  setShowCompletedModal(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.completionRestartButtonText}>전체 다시 하기</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      <View style={styles.container}>
        {/* 고정 배경 이미지 */}
        <Image
          source={require('../../../assets/bg/class_R.webp')}
          style={[
            styles.fixedBackgroundImage,
            { width: LAYOUT.screenWidth, height: LAYOUT.screenHeight },
          ]}
          resizeMode='contain'
        />
        <View style={[styles.contentOverlay, { paddingTop: insets.top }]}>
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>


              <View style={styles.headerTopRow}>
                <View style={{ minWidth: LAYOUT.headerSideButtonMinWidth }} />
                <View style={styles.headerTitleCenter}>
                  <Text style={styles.headerPanelTitle}>📖  단어 카 드</Text>
                </View>
                <Animated.View
                  ref={badgeRef}
                  style={{ transform: [{ scale: completionScale }] }}
                  pointerEvents={completedCards.size > 0 ? 'auto' : 'none'}
                >
                  <TouchableOpacity
                    style={[styles.completedBadge, { backgroundColor: 'transparent', borderWidth: 0, elevation: 0 }]}
                    onPress={() => {
                      if (completedCards.size === 0) return;
                      showBadgeAnimation();
                      setShowCompletedModal(true);
                    }}
                    disabled={completedCards.size === 0}
                  >
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                      <CompletedBadgeBg width="100%" height="100%" />
                    </View>
                    <Text style={styles.completedBadgeText}>✅ {completedCards.size} 개 익힘</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>

              {/* 진행도 표시 */}
              <View style={styles.progressContainer}>
                <View style={styles.progressLineWrapper}>
                  <View style={styles.progressLine} />
                  <View style={styles.progressTicksContainer}>
                    {[0, 1, 2, 3, 4, 5].map((tick) => (
                      <View key={tick} style={styles.progressTick} />
                    ))}
                  </View>
                  <View
                    style={[
                      styles.progressMarker,
                      {
                        left: (() => {
                          const progress = filteredPairs.length <= 1 ? 0 : currentIndex / (filteredPairs.length - 1);
                          const position = Math.min(90, Math.max(0, progress * 90));
                          return `${position}%`;
                        })()
                      }
                    ]}
                  >
                    <Image
                      source={require('../../../assets/icons/mk.png')}
                      style={{ width: LAYOUT.progressMarkerIconSize, height: LAYOUT.progressMarkerIconSize }}
                    />
                  </View>
                </View>
                <Text style={styles.progressText}>
                  {currentIndex + 1} / {filteredPairs.length}
                </Text>
              </View>


              {/* Card Stack Swiper 영역 */}
              <View
                style={styles.cardStackContainer}
              >

                <View style={styles.cardStackWrapper} ref={cardStackRef}>

                  {/* 뒤 카드 미표시: 메인 카드만 표시 */}

                  {/* 메인 카드 - 스와이프 제스처 활성화 */}
                  {/* @ts-ignore - PanGestureHandler는 deprecated이지만 기능상 문제 없음 */}
                  <PanGestureHandler
                    enabled={false}
                    onGestureEvent={handleGestureEvent} /* 드래그 중 실시간 호출 */
                    onHandlerStateChange={handleSwipe}  /* 제스처 종료 시 호출 */
                  >

                    <Animated.View
                      style={[
                        styles.topCard,
                        {
                          transform: [
                            { translateX: panX },        // X축 이동 (좌우)
                            { translateY: panY },        // Y축 이동 (상하)
                            {
                              rotateZ: rotation.interpolate({
                                inputRange: [-30, 0, 30],
                                outputRange: ['-30deg', '0deg', '30deg']
                              })
                            },                            // Z축 회전
                            { scale },                   // 크기 조절
                          ],
                          opacity,                       // 불투명도
                        },
                      ]}
                    >
                      <View style={styles.topCardBackground}>
                        <Image
                          source={require('../../../assets/bg/iroawa.png')}
                          style={StyleSheet.absoluteFill}
                          resizeMode="cover"
                        />
                        {/* 반투명 베이지 오버레이 (첨부 이미지 스타일) */}
                        <View style={styles.cardOverlay} />

                        {filteredPairs.length === 0 ? (
                          <View style={styles.completionContainer}>
                            <Text style={styles.completionText}>🎉 학습을 완료하였습니다!</Text>
                            <Text style={styles.completionSubText}>모든 카드를 성공적으로 학습했습니다.</Text>
                            <TouchableOpacity
                              style={styles.completionRestartButton}
                              onPress={handleResetAllCards}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.completionRestartButtonText}>🔄 처음부터</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          currentPair && (
                            <WordFlashcard

                              key={currentPair.id}
                              wordPair={currentPair}
                            />
                          )
                        )}
                      </View>
                    </Animated.View>
                    {/* @ts-ignore */}
                  </PanGestureHandler>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* 🔘 하단 네비게이션: 화살표 + 학습완료 버튼 - ScrollView 밖으로 이동 */}
          <View
            style={[
              styles.bottomNavigationContainer,
              { bottom: insets.bottom - LAYOUT.flashcardsBottomOffset },
            ]}
          >
            {/* 좌측 화살표 */}
            <TouchableOpacity
              onPress={currentIndex > 0 ? handlePrevCard : undefined}
              style={[
                styles.navigationArrowButton,
                currentIndex === 0 && styles.navigationArrowButtonDisabled
              ]}
              activeOpacity={0.88}
            >
              <Ionicons
                name="chevron-back"
                size={LAYOUT.navArrowIconSize}
                color={currentIndex === 0 ? COLORS.borderGray : COLORS.textPrimary}
              />
            </TouchableOpacity>

            {/* 중앙 학습완료 버튼 */}
            <TouchableOpacity
              onPress={handleCompleteCard}
              style={styles.completeButton}
              activeOpacity={0.88}
            >
              <Text style={styles.completeButtonText}>학습완료</Text>
            </TouchableOpacity>

            {/* 우측 화살표 */}
            <TouchableOpacity
              onPress={currentIndex < filteredPairs.length - 1 ? handleNextCard : undefined}
              style={[
                styles.navigationArrowButton,
                currentIndex >= filteredPairs.length - 1 && styles.navigationArrowButtonDisabled
              ]}
              activeOpacity={0.88}
            >
              <Ionicons
                name="chevron-forward"
                size={LAYOUT.navArrowIconSize}
                color={currentIndex >= filteredPairs.length - 1 ? COLORS.borderGray : COLORS.textPrimary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fixedBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  contentOverlay: {
    flex: 1,
  },
  // ✅ 모달 스타일 추가
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.backgroundGray,
    paddingTop: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.modalHeaderPaddingH,
    paddingVertical: LAYOUT.modalHeaderPaddingV,
    backgroundColor: COLORS.backgroundStar,
  },
  modalTitle: {
    fontSize: LAYOUT.modalTitleFontSize,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    flex: 1,
  },
  modalCloseButton: {
    padding: LAYOUT.spacingXS,
  },
  // 헤더 좌측: 냉장고 버튼 (우측 완료 배지와 대칭)
  riveTestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: LAYOUT.headerSideButtonMinWidth,
    backgroundColor: COLORS.purple,
    paddingHorizontal: LAYOUT.headerSideButtonPaddingH,
    paddingVertical: LAYOUT.headerSideButtonPaddingV,
    borderRadius: LAYOUT.headerSideButtonBorderRadius,
    gap: 6,
    elevation: 3,
  },
  riveTestButtonText: {
    fontSize: LAYOUT.smallButtonTextFontSize,
    fontWeight: 'bold',
    color: 'white',
  },

  scrollContainer: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },

  // 섹션 스타일 (나무/종이 패널 느낌)
  section: {
    marginHorizontal: LAYOUT.sectionMarginH,
    marginVertical: LAYOUT.sectionMarginV,
    position: 'relative',
  },
  sectionTitle: {
    fontSize: LAYOUT.sectionTitleFontSize,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: LAYOUT.spacingSM,
    color: COLORS.textPrimary,
  },

  headerPanelTitle: {
    fontSize: LAYOUT.sectionTitleFontSize,
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.textPrimary,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: LAYOUT.headerTopRowMarginBottom,
  },
  headerTitleCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedBadge: {
    minWidth: LAYOUT.headerSideButtonMinWidth,
    backgroundColor: COLORS.success,
    paddingHorizontal: LAYOUT.headerSideButtonPaddingH,
    paddingVertical: LAYOUT.headerSideButtonPaddingV,
    borderRadius: LAYOUT.headerSideButtonBorderRadius,
    elevation: 3,
    justifyContent: 'center',
    alignItems: 'center',

  },
  completedBadgeText: {
    fontSize: LAYOUT.completedBadgeTextFontSize,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  sectionSubtitle: {
    fontSize: LAYOUT.sectionSubtitleFontSize,
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginBottom: LAYOUT.spacingSM,
    lineHeight: 22,
  },
  totalCount: {
    fontSize: LAYOUT.totalCountFontSize,
    fontWeight: '600',
    textAlign: 'center',
    color: COLORS.success,
    backgroundColor: 'rgba(135, 206, 235, 0.1)',
    paddingHorizontal: LAYOUT.spacingMD,
    paddingVertical: LAYOUT.spacingXS,
    borderRadius: LAYOUT.completedSectionBorderRadius,
    marginTop: LAYOUT.spacingSM,
  },

  progressContainer: {
    position: 'absolute',
    top: LAYOUT.screenHeight * 0.2,  // 화면 높이의 20% 지점
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: LAYOUT.spacingSM,
    gap: LAYOUT.spacingSM,
  },

  progressLineWrapper: {
    position: 'relative',
    width: '100%',
    height: LAYOUT.progressLineWrapperHeight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },

  progressLine: {
    position: 'absolute',
    width: LAYOUT.progressLineWidthPercent,
    height: LAYOUT.progressLineHeight,
    backgroundColor: COLORS.successLight,
    borderRadius: LAYOUT.progressLineBorderRadius,
    top: '50%',
    marginTop: -LAYOUT.progressLineHeight / 2,
  },

  progressTicksContainer: {
    position: 'absolute',
    width: LAYOUT.progressLineWidthPercent,
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
  },

  progressTick: {
    width: LAYOUT.progressTickSize,
    height: LAYOUT.progressTickSize,
    backgroundColor: COLORS.success,
    borderRadius: LAYOUT.progressTickSize / 2,
  },

  progressMarker: {
    position: 'absolute',
    width: LAYOUT.progressMarkerSize,
    height: LAYOUT.progressMarkerSize,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: LAYOUT.progressMarkerMarginLeft,
    zIndex: 10,
    overflow: 'hidden',
    marginTop: LAYOUT.progressMarkerMarginTop,
  },

  progressText: {
    fontSize: LAYOUT.progressTextFontSize,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: LAYOUT.progressTextMarginTop,
    letterSpacing: 0.5,
  },

  // Card Stack 컨테이너
  cardStackContainer: {
    backgroundColor: 'transparent',
    borderRadius: LAYOUT.cardBorderRadius,
    elevation: 0,
    minHeight: LAYOUT.cardStackMinHeight,
    marginTop: LAYOUT.cardStackMarginTop,
  },
  cardStackWrapper: {
    position: 'relative',
    height: LAYOUT.cardStackHeight,
    width: '100%',
  },

  centerCardArea: {
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },




  playButton: {
    padding: 8,
  },



  // 힌트
  hintContainer: {
    marginTop: 10,
    backgroundColor: COLORS.backgroundWarning,
    padding: 12,
    borderRadius: 10,
  },
  hintText: {
    fontSize: LAYOUT.hintTextFontSize,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  stackedCard: {
    position: 'absolute',
    left: LAYOUT.cardWidthInsetPercent,
    right: LAYOUT.cardWidthInsetPercent,
    height: '100%',
    borderRadius: LAYOUT.cardBorderRadius,
    elevation: 2,
    justifyContent: 'center',
  },
  topCard: {
    position: 'absolute',
    left: LAYOUT.cardWidthInsetPercent,
    right: LAYOUT.cardWidthInsetPercent,
    height: '100%',
    borderRadius: LAYOUT.cardBorderRadius,
    borderWidth: 0,
    justifyContent: 'center',
    zIndex: 100,
    overflow: 'hidden',
    marginTop: 70,
  },
  topCardBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: LAYOUT.topCardBackgroundBorderRadius,
    borderWidth: 2,
    borderColor: COLORS.borderGray,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 250, 240, 0.55)',
  },
  singleCard: {
    height: '100%',
    backgroundColor: COLORS.white,
    borderRadius: LAYOUT.cardBorderRadius,
    padding: LAYOUT.spacingMD,
    elevation: 6,
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  completedSection: {
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
    padding: LAYOUT.completedSectionPadding,
    borderRadius: LAYOUT.completedSectionBorderRadius,
    marginTop: LAYOUT.completedSectionMarginTop,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  completedTitle: {
    fontSize: LAYOUT.completedTitleFontSize,
    fontWeight: 'bold',
    color: COLORS.success,
    marginBottom: LAYOUT.spacingMD,
  },
  completedCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LAYOUT.spacingSM,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  completedCardItem: {
    minWidth: '45%',
    backgroundColor: COLORS.backgroundLight,
    padding: LAYOUT.completedCardItemPadding,
    borderRadius: LAYOUT.completedCardItemBorderRadius,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: LAYOUT.completedCardItemElevation,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  completedCardText: {
    fontSize: LAYOUT.completedCardTextFontSize,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  completedCardItemContainer: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replayIconWrap: {
    alignSelf: 'flex-end',
    marginTop: LAYOUT.spacingXS,
  },

  // ✅ 모달 스타일
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: COLORS.backgroundStar,
    borderTopLeftRadius: LAYOUT.modalContentBorderRadius,
    borderTopRightRadius: LAYOUT.modalContentBorderRadius,
    maxHeight: '80%',
    paddingTop: LAYOUT.spacingSM,
    elevation: 10,
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    gap: LAYOUT.spacingSM,
    alignItems: 'center',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LAYOUT.spacingSM,
  },
  modalCloseBtn: {
    width: LAYOUT.modalCloseBtnSize,
    height: LAYOUT.modalCloseBtnSize,
    borderRadius: LAYOUT.modalCloseBtnSize / 2,
    backgroundColor: 'rgba(0,0,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    paddingHorizontal: LAYOUT.modalBodyPaddingH,
    paddingVertical: LAYOUT.modalBodyPaddingV,
    paddingBottom: LAYOUT.modalBodyPaddingBottom,
  },

  // 🔘 하단 네비게이션 스타일 (scrollContainer의 zIndex:1 위에 올리기 위해 zIndex 필요)
  bottomNavigationContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
    height: LAYOUT.tabBarHeight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.bottomNavPaddingH,
    paddingVertical: 0,
    gap: LAYOUT.bottomNavGap,
    backgroundColor: 'transparent',
  },
  navigationArrowButton: {
    width: LAYOUT.navArrowButtonSize,
    height: LAYOUT.navArrowButtonSize,
    borderRadius: LAYOUT.navArrowButtonBorderRadius,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: LAYOUT.navArrowButtonElevation,
  },
  navigationArrowButtonDisabled: {
    backgroundColor: COLORS.grayLight,
    elevation: 0,
  },
  completeButton: {
    flex: 1,
    backgroundColor: COLORS.success,
    paddingHorizontal: 20,
    paddingVertical: LAYOUT.completeButtonPaddingV,
    borderRadius: LAYOUT.completeButtonBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: LAYOUT.completeButtonElevation,
    minHeight: LAYOUT.navArrowButtonSize,
  },
  completeButtonText: {
    color: COLORS.white,
    fontSize: LAYOUT.buttonTextFontSize,
    fontWeight: '600',
    textAlign: 'center',
  },

  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  completionText: {
    fontSize: LAYOUT.completionTextFontSize,
    fontWeight: 'bold',
    color: COLORS.success,
    textAlign: 'center',
    marginBottom: 10,
  },
  completionSubText: {
    fontSize: LAYOUT.completionSubTextFontSize,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  completionRestartButton: {
    marginTop: LAYOUT.completionRestartButtonMarginTop,
    marginBottom: LAYOUT.completionRestartButtonMarginBottom,
    backgroundColor: COLORS.success,
    paddingHorizontal: LAYOUT.completionRestartButtonPaddingH,
    paddingVertical: LAYOUT.completeButtonPaddingV,
    borderRadius: LAYOUT.completionRestartButtonBorderRadius,
    elevation: 3,
    alignSelf: 'center',
  },
  completionRestartButtonText: {
    color: COLORS.white,
    fontSize: LAYOUT.buttonTextFontSize,
    fontWeight: '600',
  },
  completedCardImage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stackedCardBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stackedCardBackgroundImage: {
    resizeMode: 'cover',
  },
});