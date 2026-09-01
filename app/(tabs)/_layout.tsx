import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import * as ScreenOrientation from 'expo-screen-orientation';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Animated,
  Pressable,
  StyleSheet,
} from "react-native";
import { COLORS } from "../../constants/colors";

// 탭 버튼 애니메이션 컴포넌트
const AnimatedTabBarButton = ({
  children,
  onPress,
  style,
  ...restProps
}: any) => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressOut = () => {
    Animated.sequence([
      Animated.spring(scaleValue, {
        toValue: 1.2,
        useNativeDriver: true,
        speed: 200,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        speed: 200,
      }),
    ]).start();
  };

  const { ref, pressColor, pressOpacity, hoverEffect, href, ...filteredRestProps } = restProps as any;

  return (
    <Pressable
      {...filteredRestProps}
      onPress={onPress}
      onPressOut={handlePressOut}
      style={[
        { flex: 1, justifyContent: "center", alignItems: "center" },
        style,
      ]}
      android_ripple={{ borderless: false, radius: 0 }}
    >
      <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

/** 가로로 보여줄 탭. 나머지는 전부 세로다. */
const LANDSCAPE_ROUTES = ['/activity', '/guitar'];

/**
 * 화면 방향의 **유일한 소유자.**
 *
 * 예전에는 피아노(`screens/MusicTrainingScreen.tsx`)와 기타(`app/(tabs)/guitar/_layout.tsx`)가
 * 각자 "포커스 O → 가로 / 포커스 X → 세로"를 걸었다. 탭은 언마운트되지 않아 둘 다 살아 있으므로
 * 탭을 바꾸면 두 effect가 **같이** 실행됐고, 방향은 전역 설정이라 나중에 실행된 쪽이 이겼다.
 *
 * effect는 트리 순서(`activity` → `guitar`)로 돌기 때문에 **기타 → 피아노** 이동에서
 * 피아노가 건 가로를 기타의 "나가니까 세로" 가 덮어썼다. 반대 방향은 우연히 멀쩡했다.
 *
 * 나가는 화면은 다음 화면이 무엇인지 모른다. 그래서 **떠나는 쪽이 방향을 되돌리면 안 된다.**
 * 지금 어느 탭에 있는지 아는 여기서만 건다.
 */
function useOrientationForRoute() {
  const pathname = usePathname();

  useEffect(() => {
    const wantsLandscape = LANDSCAPE_ROUTES.some(
      route => pathname === route || pathname.startsWith(route + '/')
    );

    ScreenOrientation.lockAsync(
      wantsLandscape
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : ScreenOrientation.OrientationLock.PORTRAIT_UP
    ).catch(() => { });
  }, [pathname]);
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  useOrientationForRoute();

  return (

    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { paddingBottom: 4 + insets.bottom, height: 64 + insets.bottom }],
        tabBarActiveTintColor: COLORS.textPrimary,
        tabBarInactiveTintColor: COLORS.textLight,
   /*      // screenOptions로 Tabs에 props를 내려주면
        // (예: screenOptions={{ tabBarButton: ... }})
        // 각 tab의 tabBarButton에 자동으로 전달됨.
        // props는 내부적으로 Navigation이 탭 상태, onPress 등 정보 자동 전달!
        // 네, props 파라미터는 여기서 처음 생성(정의)됩니다. */
        tabBarButton: (props) => <AnimatedTabBarButton {...props} />,
      }}
    >
      <Tabs.Screen
        name="drum"
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ color }) => (
            <Ionicons name="musical-notes" size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="learn"
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ color }) => (
            <Ionicons name="headset" size={24} color={color} />
          ),
        }}
      />

  {/*       // 아래는 "flashcards" 탭(플래시카드 기능) 추가 코드.
      // 각 라인별 설명:

      // Tabs.Screen 컴포넌트는 탭 내에서 새로운 화면(탭) 하나를 정의한다. */}
      <Tabs.Screen
     /*    // name: 이 탭의 네비게이션 이름 ("flashcards"로 지정. 라우팅에 사용.) */
        name="flashcards"
   /*      // options: 이 탭 전용 옵션 객체 */
        options={{
    /*       // tabBarLabel: 탭 하단에 표시될 라벨 설정. 
          // ()=>null로 지정해 아래 텍스트 라벨 숨김(아이콘만 보임). */
          tabBarLabel: () => null,
   /*        // tabBarIcon: 탭에 표시될 아이콘 컴포넌트 정의.
          // props에서 color(현재 테마/활성화 상태 등에 따라 결정)를 받아  
          // Ionicons에서 "book" 아이콘(책 모양), 크기 24, color 적용하여 렌더링.
          // 네, tabBarIcon이 ({ color }) 객체를 인자로 받고, 그 color 값을 실제 아이콘(color prop)에 넣어 색상이 자동 변경됩니다.
          // 아래는 color가 현재 상태(활성/비활성 등)에 따라 자동으로 전달/적용되는 예시입니다. */
          tabBarIcon: ({ color }) => (
            <Ionicons name="book" size={24} color={color} />
          ),
      /*     // tabBarIcon은 탭이 렌더될 때 호출되므로, 선택(활성) 상태에 따라 내부적으로 color값이 달라진다. */
        }}
      />

      <Tabs.Screen
        name="activity"
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="piano" size={24} color={color} />
          ),
          tabBarStyle: { display: 'none' },
        }}
      />

      <Tabs.Screen
        name="guitar"
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="guitar-acoustic" size={24} color={color} />
          ),
        }}
      />


      <Tabs.Screen
        name="new"
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ color }) => (
            <Ionicons name="paw" size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="refri-test"
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ color }) => (
            <Ionicons name="snow-outline" size={24} color={color} />
          ),
        }}
      />
    </Tabs>

  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,

    elevation: 8,

  },
});
