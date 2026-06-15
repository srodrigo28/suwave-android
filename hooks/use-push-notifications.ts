import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/contexts/auth-context';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const { token } = useAuth();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!Device.isDevice || !token) return;

    Notifications.requestPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;

      Notifications.getExpoPushTokenAsync()
        .then((pushToken) => {
          if (pushToken.data) {
            // Store push token on backend when the endpoint becomes available
            console.log('[notifications] push token:', pushToken.data);
          }
        })
        .catch(() => {});
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.screen === 'ride-available') {
        router.push('/ride-available');
      } else if (data?.screen === 'delivery-available') {
        router.push('/delivery-available');
      } else if (data?.screen === 'status') {
        router.push('/status');
      } else if (data?.screen === 'notifications') {
        router.push('/notifications');
      }
    });

    return () => {
      responseListener.current?.remove();
    };
  }, [token]);
}
