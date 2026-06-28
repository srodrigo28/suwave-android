import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { listDriverRideRequests } from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export function usePushNotifications() {
  const { token } = useAuth();
  const setPendingRide = useDriverFlowStore((state) => state.setPendingRide);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!token) return;
    const authToken = token;

    async function openRideOfferFromNotification(rideRequestId?: string) {
      try {
        const rides = await listDriverRideRequests(authToken);
        const targetRide = rides.find((ride) => ride.id === rideRequestId) ?? rides[0] ?? null;
        if (targetRide) {
          setPendingRide(targetRide);
          router.push('/ride-available');
          return;
        }
      } catch {
        // deixa cair no dashboard para o motorista atualizar a fila manualmente
      }

      router.push('/dashboard');
    }

    Notifications.requestPermissionsAsync().then(({ status }) => {
      if (status !== 'granted' || !Device.isDevice) return;

      Notifications.getExpoPushTokenAsync()
        .then((pushToken) => {
          if (pushToken.data) {
            const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://99dev.pro/suwave-api').replace(/\/$/, '');
            fetch(`${baseUrl}/api/v1/driver/push-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
              body: JSON.stringify({ token: pushToken.data }),
            })
              .then((res) => { if (!res.ok) console.warn('[push] falha ao salvar token:', res.status); })
              .catch((err) => console.warn('[push] erro de rede ao salvar token:', err));
          }
        })
        .catch(() => {});
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.type === 'new_ride' || data?.screen === 'ride-available') {
        void openRideOfferFromNotification(typeof data?.ride_request_id === 'string' ? data.ride_request_id : undefined);
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
  }, [setPendingRide, token]);
}
