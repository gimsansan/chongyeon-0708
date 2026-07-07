import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';




export default function GamesLayout() {
  const insets = useSafeAreaInsets();


  const GameHeader = () => (
    <View style={{ paddingTop: insets.top, backgroundColor: 'transparent' }}>
    
    </View>
  );

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: true,
          header: GameHeader,
        }}
      >
        <Stack.Screen
          name="matchGame"
          options={{
            title: '',
          }}
        />
        <Stack.Screen
          name="orderGame"
          options={{
            title: '',
          }}
        />
        <Stack.Screen
          name="matchGameAI"
          options={{
            title: '',
          }}
        />
        <Stack.Screen
          name="matchGamePG"
          options={{
            title: '',
          }}
        />
     
      </Stack>

    
    </>
  );
}

