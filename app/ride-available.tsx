import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '@/components/motorista/native-map';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { AppHeader } from '@/components/motorista/app-header';
import { FormToast } from '@/components/motorista/form-toast';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { acceptDriverRideRequest, declineDriverRideRequest } from '@/services/driver-client';
import { fetchDriverRoute } from '@/services/maps-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';
import { formatRideDistance, formatRideTime } from '@/utils/rides';

/**
 * Equivalente nativo da tela `ride-available` (`RideAvailable`) em
 * app/motorista/src/app/page.tsx:1355-1440.
 *
 * Recebe a corrida pendente via `pendingRide` no store (set pelo dashboard
 * ao tocar no card da corrida).
 */
export default function RideAvailableScreen() {
  const { token } = useAuth();
  const ride = useDriverFlowStore((state) => state.pendingRide);
  const setPendingRide = useDriverFlowStore((state) => state.setPendingRide);
  const setActiveRide = useDriverFlowStore((state) => state.setActiveRide);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [driverCoords, setDriverCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);

  const hasRideOrigin =
    typeof ride?.origin_latitude === 'number' && typeof ride?.origin_longitude === 'number';

  useEffect(() => {
    let cancelled = false;
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted' || cancelled) return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((loc) => {
        if (cancelled) return;
        const driver = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setDriverCoords(driver);
        if (hasRideOrigin) {
          fetchDriverRoute(
            { lat: loc.coords.latitude, lng: loc.coords.longitude },
            { lat: ride!.origin_latitude!, lng: ride!.origin_longitude! },
          )
            .then((summary) => {
              if (!cancelled) {
                setRouteCoords(summary.geometry.map((pt) => ({ latitude: pt.lat, longitude: pt.lng })));
              }
            })
            .catch(() => {});
        }
      }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [hasRideOrigin, ride]);

  async function handleAccept() {
    if (!token || !ride) { router.push('/ride-active'); return; }
    setIsBusy(true);
    setMessage('');
    try {
      const updated = await acceptDriverRideRequest(token, ride.id);
      setPendingRide(null);
      setActiveRide(updated);
      router.replace('/ride-active');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível aceitar a corrida.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDecline() {
    if (!token || !ride) { router.replace('/ride-declined'); return; }
    setIsBusy(true);
    setMessage('');
    try {
      await declineDriverRideRequest(token, ride.id);
      setPendingRide(null);
      router.replace('/ride-declined');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível recusar a corrida.');
    } finally {
      setIsBusy(false);
    }
  }

  const rideOrigin = hasRideOrigin
    ? { latitude: ride!.origin_latitude!, longitude: ride!.origin_longitude! }
    : null;

  const mapRegion = (() => {
    if (driverCoords && rideOrigin) {
      const midLat = (driverCoords.latitude + rideOrigin.latitude) / 2;
      const midLng = (driverCoords.longitude + rideOrigin.longitude) / 2;
      const deltaLat = Math.abs(driverCoords.latitude - rideOrigin.latitude) * 1.6 + 0.01;
      const deltaLng = Math.abs(driverCoords.longitude - rideOrigin.longitude) * 1.6 + 0.01;
      return { latitude: midLat, longitude: midLng, latitudeDelta: deltaLat, longitudeDelta: deltaLng };
    }
    if (driverCoords) {
      return { latitude: driverCoords.latitude, longitude: driverCoords.longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 };
    }
    return null;
  })();

  return (
    <SafeAreaView style={styles.safeArea}>
      {mapRegion ? (
        <MapView provider={PROVIDER_GOOGLE} region={mapRegion} style={styles.map} showsUserLocation={false}>
          {driverCoords ? (
            <Marker coordinate={driverCoords} title="Você">
              <View style={styles.driverDot} />
            </Marker>
          ) : null}
          {rideOrigin ? (
            <Marker coordinate={rideOrigin} title="Embarque" pinColor={SuwaveColors.yellow} />
          ) : null}
          {routeCoords.length > 0 ? (
            <Polyline coordinates={routeCoords} strokeColor={SuwaveColors.yellow} strokeWidth={3} />
          ) : null}
        </MapView>
      ) : null}

      <ScrollView contentContainerStyle={[styles.content, mapRegion ? styles.contentWithMap : null]}>
        <AppHeader onBack={() => router.replace('/dashboard')} />

        <View style={styles.successBox}>
          <Feather color="#f2b100" name="truck" size={32} style={styles.successIcon} />
          <View style={styles.successCopy}>
            <Text style={styles.successTitle}>Nova corrida disponível</Text>
            <Text style={styles.successText}>{ride?.passenger_name ?? 'Passageiro SUWAVE'}</Text>
          </View>
        </View>

        <View style={styles.checklist}>
          <View style={styles.checklistRow}>
            <View style={styles.checklistIcon}>
              <Feather color="#fff" name="navigation" size={11} />
            </View>
            <Text style={styles.checklistLabel}>{ride?.origin_label ?? 'Origem enviada pelo passageiro'}</Text>
          </View>
          {ride?.destination_label ? (
            <View style={[styles.checklistRow, styles.checklistRowBorder]}>
              <View style={styles.checklistIcon}>
                <Feather color="#fff" name="map" size={11} />
              </View>
              <Text style={styles.checklistLabel}>{ride.destination_label}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>Distância</Text>
            <Text style={styles.cardValue}>{formatRideDistance(ride?.distance_meters)}</Text>
          </View>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>Lugares</Text>
            <Text style={styles.cardValue}>{ride?.requested_seats ?? '—'}</Text>
          </View>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>Pedido</Text>
            <Text style={styles.cardValue}>{ride ? formatRideTime(ride.requested_at) : '—'}</Text>
          </View>
        </View>

        <FormToast message={message} />

        <ActionButton disabled={isBusy} loading={isBusy} onPress={handleAccept}>
          Aceitar corrida
        </ActionButton>
        <ActionButton disabled={isBusy} onPress={handleDecline} secondary>
          Recusar
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
  map: {
    width: '100%',
    height: 190,
  },
  driverDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#fff',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: SuwaveSpacing.screenVerticalTop,
    paddingBottom: SuwaveSpacing.screenVerticalBottom,
  },
  contentWithMap: {
    paddingTop: 16,
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
  card: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#f6fbf8',
    borderWidth: 1,
    borderColor: '#cfe7dc',
    borderRadius: 8,
    padding: 13,
    marginBottom: 8,
  },
  cardItem: {
    flex: 1,
    gap: 3,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6b8090',
    textTransform: 'uppercase',
  },
  cardValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#133343',
  },
});
