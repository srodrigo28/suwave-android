import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, FlatList, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { FormToast } from '@/components/motorista/form-toast';
import { SkeletonBox } from '@/components/motorista/skeleton-box';
import { SuwaveColors } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import MapView, { Marker, PROVIDER_GOOGLE } from '@/components/motorista/native-map';

import {
  acceptDriverRideRequest,
  declineDriverRideRequest,
  DriverDelivery,
  DriverProfile,
  DriverRideRequest,
  getDriverProfile,
  listAvailableDriverDeliveries,
  listDriverRideRequests,
  pingDriverLocation,
  setDriverOffline,
  setDriverOnline,
} from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';
import { isVehicleApproved } from '@/utils/vehicles';

/**
 * Equivalente nativo da tela `dashboard` (`Dashboard`) em
 * app/motorista/src/app/page.tsx:5575-6240.
 *
 * Simplificacoes mantidas: mapa e placeholder (sem react-native-maps);
 * localizacao real (expo-location/sendCurrentDriverLocation) e para Fase avancada.
 */

export default function DashboardScreen() {
  const { token, logout } = useAuth();
  const setPendingRide = useDriverFlowStore((state) => state.setPendingRide);
  const setPendingDelivery = useDriverFlowStore((state) => state.setPendingDelivery);
  const setActiveRide = useDriverFlowStore((state) => state.setActiveRide);
  const [isOnline, setIsOnline] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [rideRequests, setRideRequests] = useState<DriverRideRequest[]>([]);
  const [deliveryOffers, setDeliveryOffers] = useState<DriverDelivery[]>([]);
  const [rideFeedback, setRideFeedback] = useState('');
  const [busyRideId, setBusyRideId] = useState<string | null>(null);
  const [newRideAlert, setNewRideAlert] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const prevRideCountRef = useRef(0);

  const registeredVehicles = driverProfile?.vehicles ?? [];
  const approvedVehicle = registeredVehicles.find(isVehicleApproved);
  const pendingVehicle = registeredVehicles.find((v) => !isVehicleApproved(v));
  const hasApprovedVehicle = Boolean(approvedVehicle);
  const shouldShowAddVehicle = driverProfile ? registeredVehicles.length === 0 : false;
  const shouldShowVehicleWaiting = registeredVehicles.length > 0 && !hasApprovedVehicle && Boolean(pendingVehicle);
  const effectiveIsOnline = hasApprovedVehicle && isOnline;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    getDriverProfile(token).then((profile) => {
      if (cancelled) return;
      setDriverProfile(profile);
      const hasApproved = (profile.vehicles ?? []).some(isVehicleApproved);
      setIsOnline(hasApproved && profile.is_online);
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar seu perfil.');
    });

    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!effectiveIsOnline || !token) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let consecutiveErrors = 0;
    let idleSeconds = 0;
    const appStateRef = { current: AppState.currentState };

    const BASE_INTERVAL = 4000;
    const IDLE_INTERVAL = 8000;
    const IDLE_THRESHOLD_S = 60;
    const MAX_BACKOFF = 30000;

    function getInterval() {
      if (consecutiveErrors > 0) {
        return Math.min(BASE_INTERVAL * 2 ** consecutiveErrors, MAX_BACKOFF);
      }
      return idleSeconds >= IDLE_THRESHOLD_S ? IDLE_INTERVAL : BASE_INTERVAL;
    }

    async function syncRideRequests() {
      if (cancelled || appStateRef.current !== 'active') return;
      try {
        const [requests, deliveries] = await Promise.all([
          listDriverRideRequests(token as string),
          listAvailableDriverDeliveries(token as string),
        ]);
        if (cancelled) return;
        consecutiveErrors = 0;
        const hadActivity = requests.length > 0 || deliveries.length > 0;
        idleSeconds = hadActivity ? 0 : idleSeconds + getInterval() / 1000;
        setRideRequests(requests);
        setDeliveryOffers(deliveries);
      } catch (err) {
        if (cancelled) return;
        consecutiveErrors = Math.min(consecutiveErrors + 1, 5);
        setRideFeedback(err instanceof Error ? err.message : 'Não foi possível buscar corridas e entregas.');
      }
      if (!cancelled) {
        timeoutId = setTimeout(syncRideRequests, getInterval());
      }
    }

    const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      const wasBackground = appStateRef.current !== 'active';
      appStateRef.current = state;
      if (wasBackground && state === 'active') {
        if (timeoutId) clearTimeout(timeoutId);
        consecutiveErrors = 0;
        idleSeconds = 0;
        syncRideRequests();
      }
    });

    syncRideRequests();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      appStateSub.remove();
    };
  }, [effectiveIsOnline, token]);

  useEffect(() => {
    const current = rideRequests.length;
    if (current > prevRideCountRef.current && effectiveIsOnline) {
      setNewRideAlert(true);
      const timeout = setTimeout(() => setNewRideAlert(false), 4500);
      prevRideCountRef.current = current;
      return () => clearTimeout(timeout);
    }
    prevRideCountRef.current = current;
  }, [rideRequests.length, effectiveIsOnline]);

  useEffect(() => {
    if (!effectiveIsOnline || !token) return;
    let cancelled = false;

    async function startLocationTracking() {
      if (Platform.OS === 'web') return;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!cancelled) setCurrentLocation(loc);

      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 15000 },
        (location) => {
          if (cancelled) return;
          setCurrentLocation(location);
          pingDriverLocation(token as string, {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy_meters: location.coords.accuracy ?? undefined,
          }).catch(() => {});
        },
      );

      return () => { sub.remove(); };
    }

    let cleanup: (() => void) | undefined;
    startLocationTracking().then((fn) => { cleanup = fn; });
    return () => { cancelled = true; cleanup?.(); };
  }, [effectiveIsOnline, token]);

  async function handleToggleOnline() {
    if (!token) { setError('Entre novamente para ficar online.'); return; }
    if (!hasApprovedVehicle) { setIsOnline(false); setError(''); return; }

    setIsSubmitting(true);
    setError('');
    try {
      if (effectiveIsOnline) {
        const availability = await setDriverOffline(token);
        setIsOnline(availability.is_online);
        setDriverProfile(availability.driver);
        setRideRequests([]);
        setDeliveryOffers([]);
      } else {
        const availability = await setDriverOnline(token);
        setIsOnline(availability.is_online);
        setDriverProfile(availability.driver);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar sua disponibilidade.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleRideAction = useCallback(async (rideId: string, action: 'accept' | 'decline') => {
    if (!token) { setRideFeedback('Entre novamente para responder a corrida.'); return; }
    setBusyRideId(rideId);
    setRideFeedback('');
    try {
      const updated = action === 'accept'
        ? await acceptDriverRideRequest(token, rideId)
        : await declineDriverRideRequest(token, rideId);
      setRideRequests((prev) => prev.filter((r) => r.id !== rideId));
      if (action === 'accept' && updated.status === 'ACEITA') {
        setActiveRide(updated);
        router.push('/ride-active');
      } else {
        setRideFeedback('Corrida recusada.');
      }
    } catch (err) {
      setRideFeedback(err instanceof Error ? err.message : 'Não foi possível responder a corrida.');
    } finally {
      setBusyRideId(null);
    }
  }, [token, setActiveRide]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <MapView
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton={false}
        style={styles.map}
        region={
          currentLocation
            ? {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                latitudeDelta: 0.012,
                longitudeDelta: 0.012,
              }
            : {
                latitude: -15.7942,
                longitude: -47.8822,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }
        }
      >
        {currentLocation ? (
          <Marker
            coordinate={{
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
            }}
            title="Você está aqui"
          />
        ) : null}
      </MapView>

      <View style={styles.mapControls}>
        <View style={styles.roundButton}><Feather color="#173447" name="plus" size={20} /></View>
        <View style={styles.roundButton}><Feather color="#173447" name="minus" size={20} /></View>
        <View style={styles.roundButton}><Feather color="#173447" name="navigation" size={20} /></View>
      </View>

      <Pressable
        accessibilityLabel="Abrir menu do motorista"
        onPress={() => setIsMenuOpen(true)}
        style={[styles.roundButton, styles.menuButton]}>
        <Feather color="#173447" name="menu" size={20} />
      </Pressable>

      <View style={styles.bottomSheet}>
        <View style={styles.handleRow}><View style={styles.handle} /></View>

        <View style={styles.locationCopy}>
          <Text style={styles.locationLabel}>{effectiveIsOnline ? 'Disponível em' : 'Localização atual'}</Text>
          <Text style={styles.locationValue}>
            {currentLocation
              ? `${currentLocation.coords.latitude.toFixed(4)}, ${currentLocation.coords.longitude.toFixed(4)}`
              : 'Localizando...'}
          </Text>
        </View>

        {newRideAlert ? (
          <View style={styles.newRideAlert}>
            <Feather color={SuwaveColors.black} name="bell" size={16} />
            <Text style={styles.newRideAlertText}>Nova corrida disponível!</Text>
          </View>
        ) : null}

        <FormToast message={shouldShowVehicleWaiting ? '' : error} />

        {rideFeedback ? <Text style={styles.rideFeedback}>{rideFeedback}</Text> : null}

        {shouldShowVehicleWaiting && pendingVehicle ? (
          <View style={styles.vehicleWaitingCard}>
            <Feather color={SuwaveColors.yellow} name="clock" size={18} />
            <View style={styles.vehicleWaitingCopy}>
              <Text style={styles.vehicleWaitingTitle}>Veículo em análise</Text>
              <Text style={styles.vehicleWaitingText}>{pendingVehicle.brand} {pendingVehicle.model} — aguardando aprovação.</Text>
            </View>
          </View>
        ) : null}

        {effectiveIsOnline && (rideRequests.length > 0 || deliveryOffers.length > 0) ? (
          <FlatList
            data={[
              ...rideRequests.map((r) => ({ kind: 'ride' as const, item: r })),
              ...deliveryOffers.slice(0, 2).map((d) => ({ kind: 'delivery' as const, item: d })),
            ]}
            keyExtractor={(entry) => entry.item.id}
            showsVerticalScrollIndicator={false}
            style={styles.cardsScroll}
            renderItem={({ item: entry }) => {
              if (entry.kind === 'ride') {
                const ride = entry.item;
                return (
                  <Pressable onPress={() => { setPendingRide(ride); router.push('/ride-available'); }} style={styles.rideCard}>
                    <Text style={styles.rideCardTag}>Nova corrida</Text>
                    <Text style={styles.rideCardOrigin}>{ride.origin_label ?? 'Origem'}</Text>
                    <Text style={styles.rideCardDestination}>{ride.destination_label ?? 'Destino'}</Text>
                    <View style={styles.rideCardMeta}>
                      <Text style={styles.rideCardMetaItem}>{ride.requested_seats} lugar(es)</Text>
                      {ride.distance_meters ? (
                        <Text style={styles.rideCardMetaItem}>{(ride.distance_meters / 1000).toFixed(1)} km</Text>
                      ) : null}
                    </View>
                    <View style={styles.rideCardActions}>
                      <Pressable
                        disabled={busyRideId === ride.id}
                        onPress={() => handleRideAction(ride.id, 'decline')}
                        style={styles.rideCardDecline}>
                        <Text style={styles.rideCardDeclineText}>Recusar</Text>
                      </Pressable>
                      <Pressable
                        disabled={busyRideId === ride.id}
                        onPress={() => handleRideAction(ride.id, 'accept')}
                        style={styles.rideCardAccept}>
                        <Text style={styles.rideCardAcceptText}>
                          {busyRideId === ride.id ? 'Enviando...' : 'Aceitar'}
                        </Text>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              }
              const delivery = entry.item;
              return (
                <Pressable onPress={() => { setPendingDelivery(delivery); router.push('/delivery-available'); }} style={styles.rideCard}>
                  <Text style={styles.rideCardTag}>Nova entrega</Text>
                  <Text style={styles.rideCardOrigin}>{delivery.seller}</Text>
                  <Text style={styles.rideCardDestination}>{delivery.address}</Text>
                  <View style={styles.rideCardMeta}>
                    <Text style={styles.rideCardMetaItem}>Pedido {delivery.short_id}</Text>
                    <Text style={styles.rideCardMetaItem}>{delivery.items_count} iten(s)</Text>
                    <Text style={styles.rideCardMetaItem}>{delivery.delivery_fee}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        ) : null}

        {driverProfile === null ? (
          <View style={styles.bottomSheetSkeleton}>
            <SkeletonBox height={48} />
            <SkeletonBox height={48} />
            <SkeletonBox height={48} />
          </View>
        ) : (
          <>
            <ActionButton
              iconDirection="none"
              loading={isSubmitting}
              onPress={handleToggleOnline}
              secondary={effectiveIsOnline}>
              {isSubmitting ? 'Atualizando...' : effectiveIsOnline ? 'Online' : 'Offline'}
            </ActionButton>

            {shouldShowAddVehicle ? (
              <ActionButton iconDirection="none" onPress={() => router.push('/vehicle-mode')} secondary>
                Adicionar veículo
              </ActionButton>
            ) : null}

            <View style={styles.benefits}>
              <Text style={styles.benefitItem}>▣ Ganhe dirigindo com segurança</Text>
              <Text style={styles.benefitItem}>☆ Você define seus horários</Text>
              <Text style={styles.benefitItem}>▤ Mais corridas, mais ganhos</Text>
            </View>
          </>
        )}
      </View>

      <Modal animationType="fade" onRequestClose={() => setIsMenuOpen(false)} transparent visible={isMenuOpen}>
        <Pressable onPress={() => setIsMenuOpen(false)} style={styles.drawerOverlay}>
          <Pressable style={styles.drawer}>
            <Pressable
              accessibilityLabel="Fechar menu"
              onPress={() => setIsMenuOpen(false)}
              style={styles.drawerClose}>
              <Feather color="#173447" name="x" size={18} />
            </Pressable>

            <DrawerItem icon="user" label="Perfil" onPress={() => { setIsMenuOpen(false); router.push('/profile'); }} />
            <DrawerItem icon="dollar-sign" label="Financeiro" onPress={() => { setIsMenuOpen(false); router.push('/finance'); }} />
            <DrawerItem icon="star" label="Avaliações" onPress={() => { setIsMenuOpen(false); router.push('/reviews'); }} />
            <DrawerItem icon="bell" label="Notificações" onPress={() => { setIsMenuOpen(false); router.push('/notifications'); }} />
            <DrawerItem icon="settings" label="Configurações" onPress={() => { setIsMenuOpen(false); router.push('/settings'); }} />
            <DrawerItem icon="map-pin" label="Registrar uma rota" onPress={() => { setIsMenuOpen(false); router.push('/register-trip'); }} />
            <DrawerItem icon="calendar" label="Histórico de viagens" onPress={() => { setIsMenuOpen(false); router.push('/trip-history'); }} />
            <DrawerItem icon="truck" label="Veículo" onPress={() => { setIsMenuOpen(false); router.push('/vehicle-list'); }} />
            <DrawerItem icon="help-circle" label="Ajuda" onPress={() => setIsMenuOpen(false)} />
            <DrawerItem
              icon="log-out"
              label="Sair"
              onPress={() => {
                setIsMenuOpen(false);
                logout().then(() => router.replace('/login'));
              }}
              tone="logout"
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function DrawerItem({
  icon,
  label,
  onPress,
  tone,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  tone?: 'logout';
}) {
  return (
    <Pressable onPress={onPress} style={[styles.drawerItem, tone === 'logout' && styles.drawerItemLogout]}>
      <Feather color={tone === 'logout' ? '#9f2f2f' : SuwaveColors.ink} name={icon} size={20} />
      <Text style={[styles.drawerItemLabel, tone === 'logout' && styles.drawerItemLabelLogout]}>{label}</Text>
    </Pressable>
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
  mapControls: {
    position: 'absolute',
    right: 16,
    top: 14,
    gap: 8,
  },
  menuButton: {
    position: 'absolute',
    left: 16,
    top: 14,
  },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(152, 170, 180, 0.42)',
    shadowColor: '#0c2a3a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 3,
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
  newRideAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SuwaveColors.yellow,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  newRideAlertText: {
    fontSize: 14,
    fontWeight: '900',
    color: SuwaveColors.black,
  },
  rideFeedback: {
    fontSize: 13,
    fontWeight: '600',
    color: '#395873',
    textAlign: 'center',
    marginBottom: 8,
  },
  vehicleWaitingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fffdf0',
    borderWidth: 1,
    borderColor: '#ffd762',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  vehicleWaitingCopy: {
    flex: 1,
    gap: 2,
  },
  vehicleWaitingTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: SuwaveColors.ink,
  },
  vehicleWaitingText: {
    fontSize: 13,
    color: '#395873',
    lineHeight: 18,
  },
  cardsScroll: {
    maxHeight: 220,
    marginBottom: 12,
  },
  rideCard: {
    borderWidth: 1,
    borderColor: SuwaveColors.line,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    gap: 6,
    backgroundColor: '#fff',
  },
  rideCardTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#607381',
    textTransform: 'uppercase',
  },
  rideCardOrigin: {
    fontSize: 16,
    fontWeight: '900',
    color: SuwaveColors.ink,
  },
  rideCardDestination: {
    fontSize: 14,
    fontWeight: '600',
    color: '#395873',
  },
  rideCardMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  rideCardMetaItem: {
    fontSize: 12,
    fontWeight: '700',
    color: '#607381',
  },
  rideCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  rideCardDecline: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SuwaveColors.line,
  },
  rideCardDeclineText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#395873',
  },
  rideCardAccept: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: SuwaveColors.yellow,
  },
  rideCardAcceptFull: {
    flex: 1,
  },
  rideCardAcceptText: {
    fontSize: 14,
    fontWeight: '900',
    color: SuwaveColors.black,
  },
  bottomSheetSkeleton: {
    gap: 12,
  },
  benefits: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  benefitItem: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#244b63',
    textAlign: 'center',
    lineHeight: 16,
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 24, 36, 0.2)',
    flexDirection: 'row',
  },
  drawer: {
    width: '78%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: '#fff',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 4,
  },
  drawerClose: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f2f7f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: SuwaveColors.yellow,
  },
  drawerItemLogout: {
    marginTop: 'auto',
    borderBottomWidth: 0,
  },
  drawerItemLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: SuwaveColors.ink,
  },
  drawerItemLabelLogout: {
    color: '#9f2f2f',
  },
});
