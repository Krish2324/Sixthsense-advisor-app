import { Stack } from 'expo-router';
import { COLORS } from '../../src/constants/theme';

export default function ApplicationLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
        animation: 'slide_from_right',
        animationDuration: 300,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="intro-video" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="video-interview" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="pending" options={{ animation: 'fade' }} />
    </Stack>
  );
}
