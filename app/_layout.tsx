import NetInfo from '@react-native-community/netinfo';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/auth-context';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { reportClientError } from '@/services/driver-client';

const slide = { animation: 'slide_from_right' } as const;
const modal = { animation: 'slide_from_bottom' } as const;

type ErrorUtilsLike = {
  getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

function NotificationSetup() {
  usePushNotifications();
  return null;
}

function OfflineBanner() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const opacity = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? true;
      setIsConnected(connected);
      Animated.timing(opacity, {
        toValue: connected ? 0 : 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
    return unsubscribe;
  }, [opacity]);

  if (isConnected !== false) return null;

  return (
    <Animated.View style={[bannerStyles.banner, { opacity }]}>
      <Text style={bannerStyles.text}>Sem conexão — dados podem estar desatualizados</Text>
    </Animated.View>
  );
}

const bannerStyles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#374151',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

function GlobalErrorSetup() {
  useEffect(() => {
    const runtime = globalThis as typeof globalThis & {
      ErrorUtils?: ErrorUtilsLike;
      addEventListener?: (type: string, listener: (event: PromiseRejectionEvent) => void) => void;
      removeEventListener?: (type: string, listener: (event: PromiseRejectionEvent) => void) => void;
    };
    const errorUtils = runtime.ErrorUtils;
    const prevHandler = errorUtils?.getGlobalHandler?.();

    if (errorUtils && prevHandler) {
      errorUtils.setGlobalHandler((error, isFatal) => {
        reportClientError({
          code: 'unhandled_js_error',
          message: error?.message ?? String(error),
          context: { isFatal: isFatal ?? false, stack: error?.stack?.slice(0, 1000) },
        });
        prevHandler(error, isFatal);
      });
    }

    const handlePromise = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? 'Unhandled promise rejection');
      reportClientError({ code: 'unhandled_promise_rejection', message });
    };
    if (typeof runtime.addEventListener === 'function') {
      runtime.addEventListener('unhandledrejection', handlePromise);
    }

    return () => {
      if (errorUtils && prevHandler) {
        errorUtils.setGlobalHandler(prevHandler);
      }
      if (typeof runtime.removeEventListener === 'function') {
        runtime.removeEventListener('unhandledrejection', handlePromise);
      }
    };
  }, []);
  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationSetup />
      <GlobalErrorSetup />
      <OfflineBanner />
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
        <Stack.Screen name="dev-map-demo" />
        <Stack.Screen name="ride-available" options={modal} />
        <Stack.Screen name="ride-active" />
        <Stack.Screen name="ride-declined" options={slide} />
        <Stack.Screen name="ride-completed" options={slide} />
        <Stack.Screen name="ride-driver-rating" options={slide} />
        <Stack.Screen name="ride-payment" options={slide} />
        <Stack.Screen name="delivery-available" options={modal} />
        <Stack.Screen name="delivery-accepted" />
        <Stack.Screen name="delivery-active" />
        <Stack.Screen name="delivery-completed" options={slide} />
      </Stack>
      <StatusBar style="dark" />
    </AuthProvider>
  );
}
