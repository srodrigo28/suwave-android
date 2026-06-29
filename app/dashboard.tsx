import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, FlatList, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { FormToast } from '@/components/motorista/form-toast';
import { SkeletonBox } from '@/components/motorista/skeleton-box';
import { SuwaveAssets, SuwaveColors } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import MapView, { Marker, PROVIDER_GOOGLE } from '@/components/motorista/native-map';
import { snapDriverLocationToRoad } from '@/services/maps-client';

import {
  declineDriverRideRequest,
  DriverDelivery,
  DriverEarnings,
  DriverProfile,
  DriverRideRequest,
  getDriverEarnings,
  getDriverProfile,
  listAvailableDriverDeliveries,
  listDriverRideRequests,
  pingDriverLocation,
  setActiveVehicle,
  setDriverOffline,
  setDriverOnline,
} from '@/services/driver-client';
import { toISODate } from '@/utils/finance';
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
  const insets = useSafeAreaInsets();
  const { token, logout } = useAuth();
  const setPendingRide = useDriverFlowStore((state) => state.setPendingRide);
  const setPendingDelivery = useDriverFlowStore((state) => state.setPendingDelivery);
  const activeRide = useDriverFlowStore((state) => state.activeRide);
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
  const [offerAlertMessage, setOfferAlertMessage] = useState('Nova corrida disponível!');
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [displayCoords, setDisplayCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState('Localizando...');
  const [todayEarnings, setTodayEarnings] = useState<DriverEarnings | null>(null);
  const todayRideCount = todayEarnings?.viagens_count ?? 0;
  const todayTotal = todayEarnings?.period_total ?? 'R$ 0,00';
  const mapRef = useRef<MapView | null>(null);
  const seenRideIdsRef = useRef<Set<string>>(new Set());
  const seenDeliveryIdsRef = useRef<Set<string>>(new Set());
  const snapRequestIdRef = useRef(0);

  const registeredVehicles = useMemo(
    () => driverProfile?.vehicles ?? [],
    [driverProfile?.vehicles],
  );
  const approvedVehicle = registeredVehicles.find(isVehicleApproved);
  const pendingVehicle = registeredVehicles.find((v) => !isVehicleApproved(v));
  const hasApprovedVehicle = Boolean(approvedVehicle);
  const shouldShowAddVehicle = driverProfile ? registeredVehicles.length === 0 : false;
  const shouldShowVehicleWaiting = registeredVehicles.length > 0 && !hasApprovedVehicle && Boolean(pendingVehicle);
  const effectiveIsOnline = hasApprovedVehicle && isOnline;
  const fallbackCoords = useRef({ latitude: -11.8604, longitude: -55.5091 }).current;
  const activeVehicle = useMemo(
    () => registeredVehicles.find((vehicle) => vehicle.id === driverProfile?.active_vehicle_id)
      ?? registeredVehicles.find(isVehicleApproved)
      ?? null,
    [driverProfile?.active_vehicle_id, registeredVehicles],
  );
  const lastKnownCoords = useMemo(
    () => (
      driverProfile?.last_latitude != null && driverProfile?.last_longitude != null
        ? {
            latitude: driverProfile.last_latitude,
            longitude: driverProfile.last_longitude,
          }
        : null
    ),
    [driverProfile?.last_latitude, driverProfile?.last_longitude],
  );
  const mapCenter = currentLocation
    ? (displayCoords ?? {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      })
    : lastKnownCoords ?? fallbackCoords;
  const activeVehicleMarkerSource = useMemo(() => {
    if (activeVehicle?.front_photo_url) {
      return { uri: activeVehicle.front_photo_url };
    }

    switch (activeVehicle?.vehicle_type) {
      case 'bike':
        return SuwaveAssets.workmodeBike;
      case 'moto':
        return SuwaveAssets.workmodeMoto;
      case 'car':
      default:
        return SuwaveAssets.workmodeCar;
    }
  }, [activeVehicle?.front_photo_url, activeVehicle?.vehicle_type]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    getDriverProfile(token).then((profile) => {
      if (cancelled) return;
      setDriverProfile(profile);
      const hasApproved = (profile.vehicles ?? []).some(isVehicleApproved);
      setIsOnline(hasApproved && profile.is_online);
      if (!profile.active_vehicle_id) {
        const firstApprovedVehicle = (profile.vehicles ?? []).find(isVehicleApproved);
        if (firstApprovedVehicle) {
          void setActiveVehicle(token, firstApprovedVehicle.id)
            .then((availability) => {
              if (cancelled) return;
              setDriverProfile(availability.driver);
              setIsOnline(availability.driver.is_online && availability.driver.vehicles.some(isVehicleApproved));
            })
            .catch(() => undefined);
        }
      }
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar seu perfil.');
    });

    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    function loadToday() {
      const today = toISODate(new Date());
      getDriverEarnings(token!, { start: today, end: today })
        .then((data) => { if (!cancelled) setTodayEarnings(data); })
        .catch(() => { if (!cancelled) setTodayEarnings(null); });
    }
    loadToday();
    const id = setInterval(loadToday, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [token]);

  useEffect(() => {
    if (currentLocation) return;
    if (!lastKnownCoords) return;

    setLocationLabel('Última localização conhecida');
  }, [currentLocation, lastKnownCoords]);

  useEffect(() => {
    if (!currentLocation) {
      setDisplayCoords(null);
      return;
    }

    const requestId = snapRequestIdRef.current + 1;
    snapRequestIdRef.current = requestId;

    const rawPoint = {
      lat: currentLocation.coords.latitude,
      lng: currentLocation.coords.longitude,
    };

    snapDriverLocationToRoad(rawPoint)
      .then((snapped) => {
        if (snapRequestIdRef.current !== requestId) return;
        setDisplayCoords(
          snapped
            ? { latitude: snapped.lat, longitude: snapped.lng }
            : { latitude: rawPoint.lat, longitude: rawPoint.lng },
        );
      })
      .catch(() => {
        if (snapRequestIdRef.current !== requestId) return;
        setDisplayCoords({ latitude: rawPoint.lat, longitude: rawPoint.lng });
      });
  }, [currentLocation]);

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

  const openRideOffer = useCallback((ride: DriverRideRequest) => {
    setPendingRide(ride);
    router.push('/ride-available');
  }, [setPendingRide]);

  const openDeliveryOffer = useCallback((delivery: DriverDelivery) => {
    setPendingDelivery(delivery);
    router.push('/delivery-available');
  }, [setPendingDelivery]);

  const presentLocalOfferNotification = useCallback(
    async (input: {
      body: string;
      data: Record<string, string>;
      title: string;
    }) => {
      if (Platform.OS === 'web') return;

      try {
        const permissions = await Notifications.getPermissionsAsync();
        const status = permissions.status === 'granted'
          ? permissions.status
          : (await Notifications.requestPermissionsAsync()).status;

        if (status !== 'granted') {
          return;
        }

        await Notifications.scheduleNotificationAsync({
          content: {
            body: input.body,
            data: input.data,
            sound: true,
            title: input.title,
          },
          trigger: null,
        });
      } catch {
        // Melhor esforço: o fluxo da oferta continua mesmo sem a notificação local.
      }
    },
    [],
  );

  useEffect(() => {
    if (!effectiveIsOnline) {
      seenRideIdsRef.current.clear();
      seenDeliveryIdsRef.current.clear();
      return;
    }

    const activeRideIds = new Set(rideRequests.map((ride) => ride.id));
    const activeDeliveryIds = new Set(deliveryOffers.map((delivery) => delivery.id));

    const unseenRide = rideRequests.find((ride) => !seenRideIdsRef.current.has(ride.id));
    const unseenDelivery = deliveryOffers.find((delivery) => !seenDeliveryIdsRef.current.has(delivery.id));

    seenRideIdsRef.current.forEach((rideId) => {
      if (!activeRideIds.has(rideId)) {
        seenRideIdsRef.current.delete(rideId);
      }
    });
    seenDeliveryIdsRef.current.forEach((deliveryId) => {
      if (!activeDeliveryIds.has(deliveryId)) {
        seenDeliveryIdsRef.current.delete(deliveryId);
      }
    });

    rideRequests.forEach((ride) => {
      seenRideIdsRef.current.add(ride.id);
    });
    deliveryOffers.forEach((delivery) => {
      seenDeliveryIdsRef.current.add(delivery.id);
    });

    if (!unseenRide && !unseenDelivery) return;
    if (activeRide) return;

    setNewRideAlert(true);
    const timeout = setTimeout(() => setNewRideAlert(false), 4500);

    if (unseenRide) {
      void presentLocalOfferNotification({
        body: `${unseenRide.origin_label ?? 'Origem'} -> ${unseenRide.destination_label ?? 'Destino'}`,
        data: {
          ride_request_id: unseenRide.id,
          screen: 'ride-available',
          type: 'new_ride',
        },
        title: 'Nova corrida disponível',
      });
      setOfferAlertMessage('Nova corrida disponível!');
      openRideOffer(unseenRide);
    } else if (unseenDelivery) {
      void presentLocalOfferNotification({
        body: `${unseenDelivery.seller} -> ${unseenDelivery.address}`,
        data: {
          delivery_id: unseenDelivery.id,
          screen: 'delivery-available',
          type: 'new_delivery',
        },
        title: 'Nova entrega disponível',
      });
      setOfferAlertMessage('Nova entrega disponível!');
      openDeliveryOffer(unseenDelivery);
    }

    return () => clearTimeout(timeout);
  }, [deliveryOffers, effectiveIsOnline, openDeliveryOffer, openRideOffer, presentLocalOfferNotification, rideRequests]);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentLocation() {
      if (Platform.OS === 'web') return;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (status !== 'granted') {
        setLocationLabel(lastKnownCoords ? 'Última localização conhecida' : 'Permita a localização');
        return;
      }

      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setCurrentLocation(loc);
        setLocationLabel(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
      } catch {
        if (!cancelled) {
          setLocationLabel(lastKnownCoords ? 'Última localização conhecida' : 'Localização indisponível');
        }
      }
    }

    loadCurrentLocation();
    return () => { cancelled = true; };
  }, [lastKnownCoords]);

  useEffect(() => {
    if (!effectiveIsOnline || !token) return;
    let cancelled = false;

    async function startLocationTracking() {
      if (Platform.OS === 'web') return;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!cancelled) {
        setCurrentLocation(loc);
        setLocationLabel(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
      }

      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 15000 },
        (location) => {
          if (cancelled) return;
          setCurrentLocation(location);
          setLocationLabel(`${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`);
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

  useEffect(() => {
    const target = currentLocation
      ? (displayCoords ?? {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        })
      : lastKnownCoords;

    if (!target) return;

    const timeout = setTimeout(() => {
      mapRef.current?.animateCamera(
        {
          center: target,
          pitch: 0,
          zoom: currentLocation ? 17 : 15,
        },
        { duration: 450 },
      );
    }, 180);

    return () => clearTimeout(timeout);
  }, [currentLocation, displayCoords, lastKnownCoords]);

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

  const handleRideDecline = useCallback(async (rideId: string) => {
    if (!token) { setRideFeedback('Entre novamente para responder a corrida.'); return; }
    setBusyRideId(rideId);
    setRideFeedback('');
    try {
      await declineDriverRideRequest(token, rideId);
      setRideRequests((prev) => prev.filter((r) => r.id !== rideId));
      setRideFeedback('Corrida recusada.');
    } catch (err) {
      setRideFeedback(err instanceof Error ? err.message : 'Não foi possível responder a corrida.');
    } finally {
      setBusyRideId(null);
    }
  }, [token]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: mapCenter.latitude,
          longitude: mapCenter.longitude,
          latitudeDelta: currentLocation ? 0.012 : 0.02,
          longitudeDelta: currentLocation ? 0.012 : 0.02,
        }}
        pitchEnabled={false}
        rotateEnabled={false}
        showsBuildings
        showsCompass={false}
        showsTraffic={false}
        showsUserLocation
        showsMyLocationButton={false}
        style={styles.map}
      >
        {currentLocation ? (
          <Marker
            coordinate={{
              latitude: displayCoords?.latitude ?? currentLocation.coords.latitude,
              longitude: displayCoords?.longitude ?? currentLocation.coords.longitude,
            }}
            title="Você está aqui"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.vehicleMarkerWrap}>
              <View style={styles.vehicleMarkerShadow} />
              <View style={styles.vehicleMarkerBadge}>
                <Image
                  resizeMode="cover"
                  source={activeVehicleMarkerSource}
                  style={styles.vehicleMarkerImage}
                />
              </View>
            </View>
          </Marker>
        ) : lastKnownCoords ? (
          <Marker coordinate={lastKnownCoords} title="Última posição conhecida">
            <View style={styles.vehicleMarkerWrap}>
              <View style={styles.vehicleMarkerShadow} />
              <View style={[styles.vehicleMarkerBadge, styles.vehicleMarkerBadgeMuted]}>
                <Image
                  resizeMode="cover"
                  source={activeVehicleMarkerSource}
                  style={styles.vehicleMarkerImage}
                />
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>

      {/* Resumo diário flutuante */}
      <View style={[styles.todaySummary, { top: insets.top + 10 }]}>
        <View style={styles.todaySummaryItem}>
          <Text style={styles.todaySummaryLabel}>Viagens{'\n'}hoje</Text>
          <Text style={styles.todaySummaryValue}>{todayRideCount}</Text>
        </View>
        <View style={styles.todaySummaryDivider} />
        <View style={styles.todaySummaryItem}>
          <Text style={styles.todaySummaryLabel}>Total do dia</Text>
          <Text style={styles.todaySummaryValue}>{todayTotal}</Text>
        </View>
      </View>

      <View style={[styles.mapControls, { top: insets.top + 10 }]}>
        <Pressable
          accessibilityLabel="Aproximar mapa"
          onPress={() => mapRef.current?.animateCamera({ zoom: 18 }, { duration: 180 })}
          style={styles.roundButton}
        >
          <Feather color="#173447" name="plus" size={20} />
        </Pressable>
        <Pressable
          accessibilityLabel="Afastar mapa"
          onPress={() => mapRef.current?.animateCamera({ zoom: 14 }, { duration: 180 })}
          style={styles.roundButton}
        >
          <Feather color="#173447" name="minus" size={20} />
        </Pressable>
        <Pressable
          accessibilityLabel="Centralizar no motorista"
          onPress={() => {
            const target = currentLocation
              ? (displayCoords ?? {
                  latitude: currentLocation.coords.latitude,
                  longitude: currentLocation.coords.longitude,
                })
              : lastKnownCoords;
            if (!target) return;
            mapRef.current?.animateCamera({ center: target, zoom: currentLocation ? 17 : 15 }, { duration: 240 });
          }}
          style={styles.roundButton}
        >
          <Feather color="#173447" name="navigation" size={20} />
        </Pressable>
      </View>

      <Pressable
        accessibilityLabel="Abrir menu do motorista"
        onPress={() => setIsMenuOpen(true)}
        style={[styles.roundButton, styles.menuButton, { top: insets.top + 10 }]}>
        <Feather color="#173447" name="menu" size={20} />
      </Pressable>

      <View style={styles.bottomSheet}>
        <View style={styles.handleRow}><View style={styles.handle} /></View>

        <View style={styles.locationCopy}>
          <Text style={styles.locationLabel}>{effectiveIsOnline ? 'Disponível em' : 'Localização atual'}</Text>
          <Text numberOfLines={2} style={styles.locationValue}>{locationLabel}</Text>
        </View>

        {newRideAlert ? (
          <View style={styles.newRideAlert}>
            <Feather color={SuwaveColors.black} name="bell" size={16} />
            <Text style={styles.newRideAlertText}>{offerAlertMessage}</Text>
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
                  <Pressable onPress={() => openRideOffer(ride)} style={styles.rideCard}>
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
                        onPress={() => handleRideDecline(ride.id)}
                        style={styles.rideCardDecline}>
                        <Text style={styles.rideCardDeclineText}>Recusar</Text>
                      </Pressable>
                      <Pressable
                        disabled={busyRideId === ride.id}
                        onPress={() => openRideOffer(ride)}
                        style={styles.rideCardAccept}>
                        <Text style={styles.rideCardAcceptText}>
                          {busyRideId === ride.id ? 'Enviando...' : 'Ver oferta'}
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
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={handleToggleOnline}
              style={({ pressed }) => [
                styles.availabilityButton,
                effectiveIsOnline ? styles.availabilityButtonOnline : styles.availabilityButtonOffline,
                pressed && !isSubmitting ? styles.availabilityButtonPressed : null,
                isSubmitting ? styles.availabilityButtonDisabled : null,
              ]}
            >
              <View
                style={[
                  styles.availabilityDot,
                  effectiveIsOnline ? styles.availabilityDotOnline : styles.availabilityDotOffline,
                ]}
              />
              <Text
                style={[
                  styles.availabilityButtonLabel,
                  effectiveIsOnline ? styles.availabilityButtonLabelOnline : styles.availabilityButtonLabelOffline,
                ]}
              >
                {isSubmitting ? 'Atualizando...' : effectiveIsOnline ? 'Pesquisando...' : 'Offline'}
              </Text>
            </Pressable>

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
  todaySummary: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffde6',
    borderWidth: 1.5,
    borderColor: '#fdd835',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 12,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  todaySummaryItem: {
    alignItems: 'center',
    gap: 2,
  },
  todaySummaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#444',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  todaySummaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#071a36',
  },
  todaySummaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e0d68a',
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
  vehicleMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleMarkerShadow: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(7, 52, 73, 0.18)',
    transform: [{ scale: 1.28 }],
  },
  vehicleMarkerBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ffc400',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  vehicleMarkerBadgeMuted: {
    opacity: 0.82,
  },
  vehicleMarkerImage: {
    width: '100%',
    height: '100%',
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
  availabilityButton: {
    width: '100%',
    minHeight: 58,
    borderRadius: 14,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.4,
  },
  availabilityButtonOnline: {
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    borderColor: 'rgba(22, 163, 74, 0.42)',
  },
  availabilityButtonOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  availabilityButtonPressed: {
    opacity: 0.84,
  },
  availabilityButtonDisabled: {
    opacity: 0.62,
  },
  availabilityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  availabilityDotOnline: {
    backgroundColor: '#16a34a',
  },
  availabilityDotOffline: {
    backgroundColor: '#dc2626',
  },
  availabilityButtonLabel: {
    fontSize: 20,
    fontWeight: '900',
  },
  availabilityButtonLabelOnline: {
    color: '#166534',
  },
  availabilityButtonLabelOffline: {
    color: '#b91c1c',
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
