import { Stack } from "expo-router";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { StarProvider } from "../context/StarContext";
import { ClearProvider } from "../context/ClearContext";
import { AudioManagerProvider } from "../context/AudioManager";


SplashScreen.preventAutoHideAsync().catch(() => {});

function AnimatedSplashScreen({ children, image }: { children: React.ReactNode; image: number }) {
  const [isAppReady, setAppReady] = useState(false);
  const [isSplashAnimationComplete, setAnimationComplete] = useState(false);
  const animation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isAppReady) {
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(animation, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        })
      ]).start(() => {
        setAnimationComplete(true);
      });
    }
  }, [isAppReady]);

  const onImageLoaded = async () => {
    try {
      await SplashScreen.hideAsync();
    } catch (e) {
      console.error(e);
    } finally {
      setAppReady(true);
    }
  };

  const animatedValues = useMemo(() => ({
    rotateValue: animation.interpolate({
      inputRange: [0, 1],
      outputRange: ["340deg", "-20deg"],
    }),
    scaleValue: animation.interpolate({
      inputRange: [0, 1],
      outputRange: [0.5, 1.5],
    }),
  }), [animation]);

  return (
    <View style={styles.container}>
      {isAppReady && children}
      {!isSplashAnimationComplete && (
        <>
          <Animated.View
            style={[
              styles.background,
              {
                opacity: animation,
              },
            ]}
          />
          
          <View style={styles.imageContainer}>
        
            <Animated.Image
              source={image}
              style={[
                styles.image,
                {
                  opacity: animation,
                  transform: [
                    { scale: animatedValues.scaleValue },
                    { rotate: animatedValues.rotateValue },
                  ],
                },
              ]}
              onLoadEnd={onImageLoaded}
              fadeDuration={0}
            />
            
          </View>
        </>
      )}

    </View>
  );
}

export default function RootLayout() {
  return (
    <StarProvider>
      <ClearProvider>
        <AudioManagerProvider>
          <AnimatedSplashScreen image={require("../assets/images/splash.png")}>
            <StatusBar style="dark" animated hidden={false} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </AnimatedSplashScreen>
        </AudioManagerProvider>
      </ClearProvider>
    </StarProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  background: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#ffffff",
  },
  imageContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    padding: 0,
    margin: 0,
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
    elevation: 0,
    shadowOpacity: 0,
    backgroundColor: "transparent",
  },
});




