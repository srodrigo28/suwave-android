import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/auth-context';
import { usePushNotifications } from '@/hooks/use-push-notifications';

const slide = { animation: 'slide_from_right' } as const;
const modal = { animation: 'slide_from_bottom' } as const;

function NotificationSetup() {
  usePushNotifications();
  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationSetup />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" options={slide} />
        <Stack.Screen name="forgot-password" options={slide} />
        <Stack.Screen name="forgot-success" options={slide} />
        <Stack.Screen name="reset-password" options={slide} />
        <Stack.Screen name="signup" options={slide} />
        <Stack.Screen name="terms" options={slide} />
        <Stack.Screen name="face" options={slide} />
        <Stack.Screen name="cnh" options={slide} />
        <Stack.Screen name="submitted" options={slide} />
        <Stack.Screen name="status" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="profile" options={slide} />
        <Stack.Screen name="notifications" options={slide} />
        <Stack.Screen name="settings" options={slide} />
        <Stack.Screen name="vehicle-list" options={slide} />
        <Stack.Screen name="vehicle-mode" options={slide} />
        <Stack.Screen name="vehicle-brand" options={slide} />
        <Stack.Screen name="vehicle-data" options={slide} />
        <Stack.Screen name="vehicle-photos" options={slide} />
        <Stack.Screen name="vehicle-review" options={slide} />
        <Stack.Screen name="finance" options={modal} />
        <Stack.Screen name="trip-history" options={modal} />
        <Stack.Screen name="reviews" options={modal} />
        <Stack.Screen name="register-trip" options={slide} />
        <Stack.Screen name="ride-available" options={modal} />
        <Stack.Screen name="ride-active" />
        <Stack.Screen name="ride-declined" options={slide} />
        <Stack.Screen name="ride-completed" options={slide} />
        <Stack.Screen name="delivery-available" options={modal} />
        <Stack.Screen name="delivery-accepted" />
        <Stack.Screen name="delivery-active" />
        <Stack.Screen name="delivery-completed" options={slide} />
      </Stack>
      <StatusBar style="dark" />
    </AuthProvider>
  );
}
