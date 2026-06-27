import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '@/components/motorista/native-map';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormToast } from '@/components/motorista/form-toast';
import { SuwaveColors } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { acceptDriverRideRequest, declineDriverRideRequest } from '@/services/driver-client';
import { fetchDriverRoute } from '@/services/maps-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';
import { formatRideDistance, formatRideFare } from '@/utils/rides';

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
  const mapRef = useRef<MapView | null>(null);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [driverCoords, setDriverCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeDuration, setRouteDuration] = useState<string | null>(null);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);

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
                setRouteDuration(summary.durationLabel);
                setRouteDistance(summary.distanceLabel);
              }
            })
            .catch(() => {
              if (!cancelled) {
                setMessage('Não foi possível abrir a rota do Google Maps agora.');
              }
            });
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

  const rideOrigin = useMemo(
    () => hasRideOrigin ? { latitude: ride!.origin_latitude!, longitude: ride!.origin_longitude! } : null,
    [hasRideOrigin, ride],
  );

  const mapCoordinates = useMemo(
    () => [driverCoords, rideOrigin].filter((coord): coord is { latitude: number; longitude: number } => Boolean(coord)),
    [driverCoords, rideOrigin],
  );

  const recenterRoute = useCallback(() => {
    if (mapCoordinates.length < 2) return;
    mapRef.current?.fitToCoordinates(mapCoordinates, {
      animated: true,
      edgePadding: { bottom: 300, left: 44, right: 44, top: 90 },
    });
  }, [mapCoordinates]);

  useEffect(() => {
    if (mapCoordinates.length < 2) return;
    const timeout = setTimeout(() => {
      recenterRoute();
    }, 250);
    return () => clearTimeout(timeout);
  }, [mapCoordinates, recenterRoute]);

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

  const fareLabel = ride?.gross_fare
    ? new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(ride.gross_fare)
    : formatRideFare(ride?.distance_meters, ride?.vehicle_type) ?? 'R$ 0,00';
  const farePerKm = ride?.gross_fare && ride?.distance_meters
    ? ride.gross_fare / Math.max(ride.distance_meters / 1000, 1)
    : null;
  const farePerKmLabel = farePerKm
    ? `${new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(farePerKm)}/km`
    : 'valor estimado';
  const pickupDistanceLabel = routeDistance ?? formatRideDistance(ride?.driver_pickup_distance_meters ?? ride?.distance_meters);
  const pickupDurationLabel = routeDuration ?? '4 min';
  const destinationDistanceLabel = formatRideDistance(ride?.distance_meters);
  const isDelivery = ride?.request_kind === 'delivery';

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Abrir menu" onPress={() => router.replace('/dashboard')} style={styles.headerButton}>
          <Feather color={SuwaveColors.ink} name="menu" size={22} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{isDelivery ? 'Nova Entrega' : 'Nova Corrida'}</Text>
          <Text style={styles.headerSubtitle}>Solicitação de corrida</Text>
        </View>
        <View style={styles.priorityPill}>
          <View style={styles.priorityDot} />
          <Text style={styles.priorityText}>Não afeta a 1ª</Text>
        </View>
      </View>

      {mapRegion ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          region={mapRegion}
          style={styles.map}
          showsBuildings={false}
          showsCompass={false}
          showsMyLocationButton={false}
          showsTraffic={false}
          showsUserLocation={false}
        >
          {driverCoords ? (
            <Marker coordinate={driverCoords} title="Você">
              <View style={styles.driverMarker}>
                <Feather color="#1c7df2" name="navigation" size={22} />
              </View>
            </Marker>
          ) : null}
          {rideOrigin ? (
            <Marker coordinate={rideOrigin} title="Coleta">
              <View style={styles.pickupMarker}>
                <Feather color="#fff" name={isDelivery ? 'package' : 'user'} size={20} />
              </View>
            </Marker>
          ) : null}
          {routeCoords.length > 0 ? (
            <Polyline coordinates={routeCoords} lineCap="round" lineJoin="round" strokeColor="#12b892" strokeWidth={6} />
          ) : null}
        </MapView>
      ) : (
        <View style={[styles.map, styles.mapPlaceholder]}>
          <Text style={styles.mapPlaceholderText}>Localizando motorista...</Text>
        </View>
      )}

      <Pressable accessibilityLabel="Centralizar rota" onPress={recenterRoute} style={styles.locateButton}>
        <Feather color={SuwaveColors.ink} name="crosshair" size={20} />
      </Pressable>

      <View style={styles.offerSheet}>
        <View style={styles.paymentPill}>
          <Text style={styles.paymentText}>{ride?.payment_method === 'pix' ? 'Pix' : 'Dinheiro'}</Text>
        </View>

        <Text style={styles.earningsLabel}>Ganhos da corrida</Text>
        <Text style={styles.fare}>{fareLabel}</Text>
        <Text style={styles.farePerKm}>{farePerKmLabel}</Text>

        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Feather color="#e4ae12" name="clock" size={18} />
            <Text style={styles.metricValue}>{pickupDurationLabel}</Text>
          </View>
          <Text style={styles.metricDivider}>•</Text>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{pickupDistanceLabel}</Text>
            <Text style={styles.metricHint}>até a coleta</Text>
          </View>
          <Text style={styles.metricDivider}>•</Text>
          <View style={styles.metric}>
            <Feather color="#e4ae12" name="star" size={18} />
            <Text style={styles.metricValue}>4,91</Text>
            <Text style={styles.metricHint}>avaliação</Text>
          </View>
        </View>

        <View style={styles.rule} />

        <View style={styles.badgeRow}>
          <View style={styles.smallBadge}>
            <Feather color="#c8940a" name="tag" size={13} />
            <Text style={styles.smallBadgeText}>Preço x1,2</Text>
          </View>
          <View style={styles.smallBadge}>
            <Feather color="#c8940a" name="dollar-sign" size={13} />
            <Text style={styles.smallBadgeText}>{fareLabel}</Text>
          </View>
        </View>

        <View style={styles.routeCard}>
          <View style={styles.routeLine}>
            <View style={styles.routeDotStart} />
            <View style={styles.routeDash} />
            <View style={styles.routeDotEnd} />
          </View>
          <View style={styles.routeCopy}>
            <Text style={styles.routeTitle}>{pickupDurationLabel} ({pickupDistanceLabel})</Text>
            <Text numberOfLines={2} style={styles.routeAddress}>{ride?.origin_label ?? 'Origem enviada pelo passageiro'}</Text>
            <Text style={[styles.routeTitle, styles.routeTitleSecond]}>9 min ({destinationDistanceLabel})</Text>
            <Text numberOfLines={2} style={styles.routeAddress}>{ride?.destination_label ?? 'Destino do cliente'}</Text>
          </View>
        </View>

        <FormToast message={message} />

        <Pressable disabled={isBusy} onPress={handleAccept} style={({ pressed }) => [styles.acceptButton, (pressed || isBusy) && styles.buttonPressed]}>
          <View style={styles.acceptIcon}>
            <Feather color="#10a984" name="check" size={18} />
          </View>
          <Text style={styles.acceptText}>Aceitar</Text>
        </Pressable>

        <View style={styles.secondaryActions}>
          <Pressable onPress={() => setMessage('Detalhes completos aparecem após aceitar a solicitação.')} style={({ pressed }) => [styles.detailButton, pressed && styles.buttonPressed]}>
            <Feather color="#b18714" name="info" size={18} />
            <Text style={styles.detailText}>Detalhes</Text>
          </Pressable>
          <Pressable disabled={isBusy} onPress={handleDecline} style={({ pressed }) => [styles.cancelButton, (pressed || isBusy) && styles.buttonPressed]}>
            <View style={styles.cancelIcon}>
              <Feather color="#ef3f4b" name="x" size={16} />
            </View>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff5cf',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: '#fff7dd',
    borderRadius: 13,
    elevation: 4,
    height: 42,
    justifyContent: 'center',
    shadowColor: '#765b18',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    width: 42,
  },
  headerTitleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    color: '#151d20',
    fontSize: 21,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#897b62',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  priorityPill: {
    alignItems: 'center',
    backgroundColor: '#0b1113',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 11,
  },
  priorityDot: {
    backgroundColor: '#12d7a3',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  priorityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  map: {
    alignSelf: 'center',
    borderRadius: 18,
    height: '58%',
    overflow: 'hidden',
    width: '100%',
  },
  mapPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#f5efe2',
    justifyContent: 'center',
  },
  mapPlaceholderText: {
    color: '#776b5b',
    fontSize: 14,
    fontWeight: '800',
  },
  driverMarker: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#d3d7d9',
    borderRadius: 22,
    borderWidth: 1,
    elevation: 5,
    height: 44,
    justifyContent: 'center',
    shadowColor: '#073449',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    width: 44,
  },
  pickupMarker: {
    alignItems: 'center',
    backgroundColor: '#f98716',
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 5,
    height: 44,
    justifyContent: 'center',
    shadowColor: '#5e3708',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    width: 44,
  },
  locateButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    bottom: '38%',
    elevation: 5,
    height: 40,
    justifyContent: 'center',
    left: 18,
    position: 'absolute',
    shadowColor: '#073449',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    width: 40,
  },
  offerSheet: {
    backgroundColor: '#fff8dc',
    borderColor: '#f1df9b',
    borderRadius: 18,
    borderWidth: 1,
    bottom: 12,
    elevation: 8,
    left: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    position: 'absolute',
    right: 18,
    shadowColor: '#765b18',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
  },
  paymentPill: {
    alignSelf: 'center',
    backgroundColor: '#dff1cf',
    borderColor: '#c8e4b4',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  paymentText: {
    color: '#269255',
    fontSize: 11,
    fontWeight: '900',
  },
  earningsLabel: {
    color: '#82745a',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center',
  },
  fare: {
    color: '#111',
    fontSize: 39,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 45,
    textAlign: 'center',
  },
  farePerKm: {
    color: '#2d2923',
    fontSize: 12,
    fontWeight: '900',
    marginTop: -3,
    textAlign: 'center',
  },
  metricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 8,
  },
  metric: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  metricValue: {
    color: '#1c2528',
    fontSize: 14,
    fontWeight: '900',
  },
  metricHint: {
    color: '#7b725e',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 2,
  },
  metricDivider: {
    color: '#202020',
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: 3,
  },
  rule: {
    backgroundColor: '#19b493',
    borderRadius: 2,
    height: 3,
    marginHorizontal: 10,
    marginTop: 10,
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 8,
  },
  smallBadge: {
    alignItems: 'center',
    backgroundColor: '#f9eeb8',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  smallBadgeText: {
    color: '#8e7017',
    fontSize: 11,
    fontWeight: '900',
  },
  routeCard: {
    backgroundColor: '#fff9e6',
    borderWidth: 1,
    borderColor: '#eadca9',
    borderRadius: 14,
    flexDirection: 'row',
    minHeight: 104,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  routeLine: {
    alignItems: 'center',
    marginRight: 10,
    paddingVertical: 3,
    width: 18,
  },
  routeDotStart: {
    backgroundColor: '#13a987',
    borderRadius: 8,
    height: 16,
    width: 16,
  },
  routeDash: {
    borderColor: '#9a9180',
    borderStyle: 'dotted',
    borderWidth: 1,
    flex: 1,
    marginVertical: 3,
    width: 1,
  },
  routeDotEnd: {
    backgroundColor: '#f98716',
    borderRadius: 8,
    height: 16,
    width: 16,
  },
  routeCopy: {
    flex: 1,
  },
  routeTitle: {
    color: '#1c2528',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  routeTitleSecond: {
    marginTop: 8,
  },
  routeAddress: {
    color: '#746c5f',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  acceptButton: {
    alignItems: 'center',
    backgroundColor: '#0fab8a',
    borderRadius: 9,
    flexDirection: 'row',
    gap: 12,
    height: 46,
    justifyContent: 'center',
    marginTop: 10,
  },
  acceptIcon: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  acceptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  detailButton: {
    alignItems: 'center',
    backgroundColor: '#fff8df',
    borderColor: '#f1c94d',
    borderRadius: 9,
    borderWidth: 1.5,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 40,
    justifyContent: 'center',
  },
  detailText: {
    color: '#b18714',
    fontSize: 14,
    fontWeight: '900',
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: '#ef3f4b',
    borderRadius: 9,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 40,
    justifyContent: 'center',
  },
  cancelIcon: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 11,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  cancelText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  buttonPressed: {
    opacity: 0.72,
  },
});
