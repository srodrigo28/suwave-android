import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '@/components/motorista/native-map';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { AppHeader } from '@/components/motorista/app-header';
import { FormToast } from '@/components/motorista/form-toast';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { pickupDriverDelivery } from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';

/**
 * Equivalente nativo da tela `delivery-accepted` (`DeliveryAccepted`) em
 * app/motorista/src/app/page.tsx:1658-1712.
 */
export default function DeliveryAcceptedScreen() {
  const { token } = useAuth();
  const delivery = useDriverFlowStore((state) => state.activeDelivery);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [driverLocation, setDriverLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then(setDriverLocation)
        .catch(() => {});
    });
  }, []);

  async function handlePickup() {
    if (!token || !delivery) {
      router.push('/delivery-active');
      return;
    }
    setIsBusy(true);
    setMessage('');
    try {
      await pickupDriverDelivery(token, delivery.id);
      router.push('/delivery-active');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível confirmar a retirada.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader onBack={() => router.replace('/dashboard')} />

        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={
            driverLocation
              ? { latitude: driverLocation.coords.latitude, longitude: driverLocation.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
              : { latitude: -15.7942, longitude: -47.8822, latitudeDelta: 0.05, longitudeDelta: 0.05 }
          }
        >
          {driverLocation ? (
            <Marker coordinate={{ latitude: driverLocation.coords.latitude, longitude: driverLocation.coords.longitude }} title="Você" />
          ) : null}
        </MapView>

        <View style={styles.successBox}>
          <Feather color="#f2b100" name="zap" size={32} style={styles.successIcon} />
          <View style={styles.successCopy}>
            <Text style={styles.successTitle}>Entrega aceita — vá até a loja</Text>
            <Text style={styles.successText}>{delivery?.seller ?? 'Loja SUWAVE'}</Text>
          </View>
        </View>

        <View style={styles.checklist}>
          <View style={styles.checklistRow}>
            <View style={styles.checklistIcon}>
              <Feather color="#fff" name="navigation" size={11} />
            </View>
            <Text style={styles.checklistLabel}>{delivery?.address ?? 'Endereço da loja'}</Text>
          </View>
          <View style={[styles.checklistRow, styles.checklistRowBorder]}>
            <View style={styles.checklistIcon}>
              <Feather color="#fff" name="map" size={11} />
            </View>
            <Text style={styles.checklistLabel}>Pedido #{delivery?.short_id ?? '—'}</Text>
          </View>
          <View style={[styles.checklistRow, styles.checklistRowBorder]}>
            <View style={styles.checklistIcon}>
              <Feather color="#fff" name="check" size={11} />
            </View>
            <Text style={styles.checklistLabel}>{delivery?.items_count ?? 0} iten(s)</Text>
          </View>
        </View>

        <FormToast message={message} />

        <ActionButton disabled={isBusy} loading={isBusy} onPress={handlePickup}>
          Confirmar retirada
        </ActionButton>
        <ActionButton onPress={() => router.replace('/dashboard')} secondary>
          Voltar ao dashboard
        </ActionButton>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: SuwaveColors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: SuwaveSpacing.screenVerticalTop,
    paddingBottom: SuwaveSpacing.screenVerticalBottom,
  },
  map: {
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff8e4',
    borderWidth: 1,
    borderColor: '#ffe39a',
    borderRadius: 16,
    padding: 16,
  },
  successIcon: {
    flexShrink: 0,
  },
  successCopy: {
    flex: 1,
    gap: 4,
  },
  successTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#22384a',
    lineHeight: 20,
  },
  successText: {
    fontSize: 15,
    lineHeight: 19,
    color: '#556977',
  },
  checklist: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8edf1',
    borderRadius: 14,
    paddingHorizontal: 18,
    marginVertical: 18,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  checklistRowBorder: {
    borderTopWidth: 1,
    borderTopColor: SuwaveColors.line,
  },
  checklistIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffc61a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#243949',
    lineHeight: 21,
  },
});
