import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { FormToast } from '@/components/motorista/form-toast';
import { SuwaveColors } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { completeDriverRideRequest, pingDriverLocation } from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';
import { formatDriverEta, formatRideFare } from '@/utils/rides';

/**
 * Equivalente nativo da tela `ride-active` (`RideActive`) em
 * app/motorista/src/app/page.tsx:1442-1512.
 *
 * Mapa (`map-art`/`react-native-maps`) permanece como placeholder.
 */
export default function RideActiveScreen() {
  const { token } = useAuth();
  const ride = useDriverFlowStore((state) => state.activeRide);
  const setActiveRide = useDriverFlowStore((state) => state.setActiveRide);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const eta = formatDriverEta(ride?.distance_meters);
  const fare = formatRideFare(ride?.distance_meters, ride?.vehicle_type);
  const [driverLocation, setDriverLocation] = useState<Location.LocationObject | null>(null);

  const routeCoords = (ride?.route_geometry ?? []).map((pt) => ({ latitude: pt.lat, longitude: pt.lng }));
  const hasRoute = routeCoords.length > 0;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;

    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted' || cancelled) return;
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 20, timeInterval: 8000 },
        (loc) => {
          if (cancelled) return;
          setDriverLocation(loc);
          pingDriverLocation(token as string, {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy_meters: loc.coords.accuracy ?? undefined,
          }).catch(() => {});
        },
      ).then((s) => { sub = s; });
    });

    return () => { cancelled = true; sub?.remove(); };
  }, [token]);

  async function handleComplete() {
    if (!token || !ride) {
      router.push('/ride-completed');
      return;
    }
    setIsBusy(true);
    setMessage('');
    try {
      await completeDriverRideRequest(token, ride.id);
      setActiveRide(null);
      router.push('/ride-completed');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível concluir a corrida.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <MapView
        provider={PROVIDER_GOOGLE}
        showsUserLocation={false}
        style={styles.map}
        region={
          driverLocation
            ? {
                latitude: driverLocation.coords.latitude,
                longitude: driverLocation.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }
            : {
                latitude: -15.7942,
                longitude: -47.8822,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }
        }
      >
        {driverLocation ? (
          <Marker
            coordinate={{
              latitude: driverLocation.coords.latitude,
              longitude: driverLocation.coords.longitude,
            }}
            title="Sua posição"
          />
        ) : null}
        {hasRoute ? (
          <Polyline coordinates={routeCoords} strokeColor="#ffc61a" strokeWidth={4} />
        ) : null}
      </MapView>

      <View style={styles.bottomSheet}>
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        <View style={styles.locationCopy}>
          <Text style={styles.locationLabel}>Indo ao passageiro</Text>
          <Text style={styles.locationValue}>{ride?.origin_label ?? 'Ponto de embarque'}</Text>
        </View>

        {eta ? (
          <View style={styles.etaRow}>
            <Feather color="#0a6b4f" name="navigation" size={18} />
            <View>
              <Text style={styles.etaValue}>{eta}</Text>
              <Text style={styles.etaLabel}>até o embarque · {ride?.origin_label ?? 'origem'}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.checklist}>
          <View style={styles.checklistRow}>
            <View style={styles.checklistIcon}>
              <Feather color="#fff" name="user" size={11} />
            </View>
            <Text style={styles.checklistLabel}>{ride?.passenger_name ?? 'Passageiro SUWAVE'}</Text>
          </View>
          {ride?.destination_label ? (
            <View style={[styles.checklistRow, styles.checklistRowBorder]}>
              <View style={styles.checklistIcon}>
                <Feather color="#fff" name="navigation" size={11} />
              </View>
              <Text style={styles.checklistLabel}>Destino: {ride.destination_label}</Text>
            </View>
          ) : null}
          {fare ? (
            <View style={[styles.checklistRow, styles.checklistRowBorder]}>
              <View style={styles.checklistIcon}>
                <Feather color="#fff" name="zap" size={11} />
              </View>
              <Text style={styles.checklistLabel}>Valor estimado: {fare}</Text>
            </View>
          ) : null}
        </View>

        <FormToast message={message} />

        <ActionButton disabled={isBusy} loading={isBusy} onPress={handleComplete}>
          Concluir corrida
        </ActionButton>
        <ActionButton iconDirection="none" onPress={() => router.replace('/dashboard')} secondary>
          Voltar ao dashboard
        </ActionButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#edf4f4',
  },
  map: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 20,
  },
  handleRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  handle: {
    width: 56,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#d8e0e5',
  },
  locationCopy: {
    gap: 4,
    marginBottom: 12,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#607381',
    textTransform: 'uppercase',
  },
  locationValue: {
    fontSize: 20,
    fontWeight: '900',
    color: SuwaveColors.ink,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e8f8ef',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  etaValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0a6b4f',
  },
  etaLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: '#607381',
  },
  checklist: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8edf1',
    borderRadius: 14,
    paddingHorizontal: 18,
    marginBottom: 12,
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
