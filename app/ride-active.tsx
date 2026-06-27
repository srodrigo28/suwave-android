import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '@/components/motorista/native-map';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { FormToast } from '@/components/motorista/form-toast';
import { SuwaveColors } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import {
  arrivedDriverDestination,
  arrivedDriverPickup,
  cancelDriverRideRequest,
  completeDriverRideRequest,
  pingDriverLocation,
  startDriverRideRequest,
  trackDriverRideRequest,
} from '@/services/driver-client';
import { fetchDriverRoute, type DriverRouteStep } from '@/services/maps-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';
import { formatDriverEta, formatRideFare } from '@/utils/rides';

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatRemainingDistance(meters: number | null): string | null {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return null;
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

type MapCoordinate = {
  latitude: number;
  longitude: number;
};

const MIN_ARRIVAL_RADIUS_METERS = 150;
const MAX_ARRIVAL_RADIUS_METERS = 300;

export default function RideActiveScreen() {
  const { token } = useAuth();
  const ride = useDriverFlowStore((state) => state.activeRide);
  const setActiveRide = useDriverFlowStore((state) => state.setActiveRide);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const isDelivery = ride?.request_kind === 'delivery';
  const isInProgress = ride?.status === 'EM_ANDAMENTO';
  const arrivedPickup = Boolean(ride?.arrived_pickup_at);
  const arrivedDestination = Boolean(ride?.arrived_destination_at);

  const [driverLocation, setDriverLocation] = useState<Location.LocationObject | null>(null);
  const [simulatedLocation, setSimulatedLocation] = useState<MapCoordinate | null>(null);
  const [navigationCoords, setNavigationCoords] = useState<MapCoordinate[]>([]);
  const [routeSteps, setRouteSteps] = useState<DriverRouteStep[]>([]);
  const [routeMessage, setRouteMessage] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const lastPingRef = useRef(0);
  const lastRouteOriginRef = useRef<MapCoordinate | null>(null);
  const lastRouteTargetRef = useRef<MapCoordinate | null>(null);
  const lastFitTargetRef = useRef<string | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const followingRef = useRef(true);

  const routeCoords = useMemo(
    () => (ride?.route_geometry ?? []).map((pt) => ({ latitude: pt.lat, longitude: pt.lng })),
    [ride?.route_geometry],
  );

  // Alvo de navegação: coleta (ACEITA) ou destino (EM_ANDAMENTO = fim da rota salva).
  const target = useMemo(() => {
    if (isInProgress && ride?.destination_latitude != null && ride?.destination_longitude != null) {
      return { latitude: ride.destination_latitude, longitude: ride.destination_longitude };
    }
    if (isInProgress) {
      return routeCoords.length ? routeCoords[routeCoords.length - 1] : null;
    }
    if (ride?.origin_latitude != null && ride?.origin_longitude != null) {
      return { latitude: ride.origin_latitude, longitude: ride.origin_longitude };
    }
    return null;
  }, [
    isInProgress,
    ride?.destination_latitude,
    ride?.destination_longitude,
    ride?.origin_latitude,
    ride?.origin_longitude,
    routeCoords,
  ]);

  const displayRouteCoords = useMemo(
    () => (navigationCoords.length > 1 ? navigationCoords : (isInProgress ? routeCoords : [])),
    [isInProgress, navigationCoords, routeCoords],
  );
  const hasRoute = displayRouteCoords.length > 1;
  const currentCoordinate = useMemo(
    () => simulatedLocation
      ?? (driverLocation
        ? { latitude: driverLocation.coords.latitude, longitude: driverLocation.coords.longitude }
        : null),
    [driverLocation, simulatedLocation],
  );

  const liveRemainingMeters =
    currentCoordinate && target
      ? haversineMeters(currentCoordinate.latitude, currentCoordinate.longitude, target.latitude, target.longitude)
      : null;
  const arrivalRadiusMeters = Math.min(
    MAX_ARRIVAL_RADIUS_METERS,
    Math.max(MIN_ARRIVAL_RADIUS_METERS, Math.round((isDemoMode ? 10 : (driverLocation?.coords.accuracy ?? 0)) * 2 + 30)),
  );
  const isAtNavigationTarget = liveRemainingMeters != null && liveRemainingMeters <= arrivalRadiusMeters;
  const canArrivePickup = Boolean(isDelivery && !isInProgress && !arrivedPickup && isAtNavigationTarget);
  const canStartDelivery = Boolean(isDelivery && !isInProgress && arrivedPickup && isAtNavigationTarget);
  const canStartRide = Boolean(!isDelivery && !isInProgress && isAtNavigationTarget);
  const canArriveDestination = Boolean(isDelivery && isInProgress && !arrivedDestination && isAtNavigationTarget);
  const canCompleteRide = Boolean(!isDelivery && isInProgress && isAtNavigationTarget);

  const eta = formatDriverEta(liveRemainingMeters ?? ride?.distance_meters);
  const distanceLabel = formatRemainingDistance(liveRemainingMeters);
  const fare = formatRideFare(ride?.distance_meters, ride?.vehicle_type);
  const gateTargetLabel = isInProgress ? 'destino' : (isDelivery ? 'coleta' : 'passageiro');
  const gateMessage = !currentCoordinate
    ? 'Ative a localização para liberar as etapas da corrida.'
    : !target
      ? 'Aguardando o endereço da etapa atual.'
      : isAtNavigationTarget
        ? `Você está no ponto de ${gateTargetLabel}. A próxima etapa foi liberada.`
        : `Aproxime-se do ponto de ${gateTargetLabel} para liberar a próxima etapa.`;
  const activeStep = useMemo(() => {
    if (!currentCoordinate || routeSteps.length === 0) return null;
    const index = routeSteps.findIndex((step) => {
      if (!step.endLocation) return true;
      return haversineMeters(
        currentCoordinate.latitude,
        currentCoordinate.longitude,
        step.endLocation.lat,
        step.endLocation.lng,
      ) > 35;
    });
    const stepIndex = index >= 0 ? index : routeSteps.length - 1;
    const step = routeSteps[stepIndex];
    const distanceToManeuver = step?.endLocation
      ? haversineMeters(currentCoordinate.latitude, currentCoordinate.longitude, step.endLocation.lat, step.endLocation.lng)
      : null;
    return { distanceToManeuver, step };
  }, [currentCoordinate, routeSteps]);
  const maneuverDistanceLabel = formatRemainingDistance(activeStep?.distanceToManeuver ?? null);

  useEffect(() => {
    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;

    const updateLocation = (loc: Location.LocationObject) => {
      if (cancelled) return;
      setDriverLocation(loc);
      if (!token) return;
      const now = Date.now();
      if (now - lastPingRef.current < 15000) return;
      lastPingRef.current = now;
      pingDriverLocation(token as string, {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy_meters: loc.coords.accuracy ?? undefined,
      }).catch(() => {});
    };

    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (cancelled) return;
      if (status !== 'granted') {
        setMessage('Permita o acesso à localização para abrir a rota e liberar as etapas.');
        return;
      }
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        .then(updateLocation)
        .catch(() => setMessage('Não foi possível obter sua localização atual.'));
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 20, timeInterval: 8000 },
        updateLocation,
      ).then((s) => { sub = s; });
    });

    return () => { cancelled = true; sub?.remove(); };
  }, [token]);

  // Seguir o motorista no mapa (suave). Desliga ao arrastar; volta no botão recentralizar.
  useEffect(() => {
    if (!currentCoordinate || !followingRef.current) return;
    mapRef.current?.animateToRegion(
      {
        latitude: currentCoordinate.latitude,
        longitude: currentCoordinate.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      },
      600,
    );
  }, [currentCoordinate]);

  // Rota real do motorista ate o alvo atual. A route_geometry do pedido e coleta -> destino;
  // antes da coleta ela nao serve para orientar o motorista ate o cliente/coleta.
  useEffect(() => {
    if (!currentCoordinate || !target) {
      setNavigationCoords([]);
      setRouteSteps([]);
      lastRouteOriginRef.current = null;
      lastRouteTargetRef.current = null;
      return;
    }
    if (isDemoMode && navigationCoords.length > 1) {
      return;
    }

    const origin = {
      latitude: currentCoordinate.latitude,
      longitude: currentCoordinate.longitude,
    };
    const lastOrigin = lastRouteOriginRef.current;
    const lastTarget = lastRouteTargetRef.current;
    const movedMeters = lastOrigin
      ? haversineMeters(origin.latitude, origin.longitude, lastOrigin.latitude, lastOrigin.longitude)
      : Infinity;
    const targetChanged = !lastTarget
      || haversineMeters(target.latitude, target.longitude, lastTarget.latitude, lastTarget.longitude) > 25;

    if (!targetChanged && movedMeters < 80 && navigationCoords.length > 1) {
      return;
    }

    let active = true;
    lastRouteOriginRef.current = origin;
    lastRouteTargetRef.current = target;
    setRouteMessage('');

    fetchDriverRoute(
      { lat: origin.latitude, lng: origin.longitude },
      { lat: target.latitude, lng: target.longitude },
    )
      .then((summary) => {
        if (!active) return;
        setNavigationCoords(summary.geometry.map((pt) => ({ latitude: pt.lat, longitude: pt.lng })));
        setRouteSteps(summary.steps);
      })
      .catch(() => {
        if (!active) return;
        setNavigationCoords([]);
        setRouteSteps([]);
        setRouteMessage('Não foi possível calcular a rota agora. Confira a chave/API do Google Maps.');
      });

    return () => { active = false; };
  }, [currentCoordinate, isDemoMode, navigationCoords.length, target]);

  useEffect(() => {
    if (!isDemoMode || displayRouteCoords.length < 2) return;
    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex = Math.min(currentIndex + 2, displayRouteCoords.length - 1);
      setSimulatedLocation(displayRouteCoords[currentIndex]);
      if (currentIndex >= displayRouteCoords.length - 1) {
        clearInterval(interval);
        setMessage(`Demonstração chegou ao ponto de ${gateTargetLabel}.`);
      }
    }, 900);
    return () => clearInterval(interval);
  }, [displayRouteCoords, gateTargetLabel, isDemoMode]);

  // Ao abrir/trocar etapa, enquadra a rota completa uma vez: motorista + caminho + alvo.
  useEffect(() => {
    if (!currentCoordinate || !target || displayRouteCoords.length < 2) return;
    const targetKey = `${isInProgress ? 'destination' : 'pickup'}:${target.latitude.toFixed(6)},${target.longitude.toFixed(6)}`;
    if (lastFitTargetRef.current === targetKey) return;
    lastFitTargetRef.current = targetKey;
    const coordinates = [
      currentCoordinate,
      ...displayRouteCoords,
      target,
    ];
    const timeout = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coordinates, {
        animated: true,
        edgePadding: { bottom: 260, left: 42, right: 42, top: 80 },
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [currentCoordinate, displayRouteCoords, isInProgress, target]);

  // Envio em andamento: observar status; quando o CLIENTE confirma o recebimento → CONCLUIDA.
  useEffect(() => {
    if (!isDelivery || !isInProgress || !ride?.id) return;
    const rideId = ride.id;
    const currentRide = ride;
    let active = true;
    const check = async () => {
      try {
        const tracked = await trackDriverRideRequest(rideId);
        if (active && tracked.status === 'CONCLUIDA') {
          setActiveRide({ ...currentRide, status: 'CONCLUIDA' });
          router.replace('/ride-payment');
        }
      } catch { /* silencia falhas de poll */ }
    };
    const interval = setInterval(check, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [isDelivery, isInProgress, ride, setActiveRide]);

  function recenterOnDriver() {
    followingRef.current = true;
    if (currentCoordinate) {
      mapRef.current?.animateToRegion(
        {
          latitude: currentCoordinate.latitude,
          longitude: currentCoordinate.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        500,
      );
    }
  }

  function toggleRouteDemo() {
    if (isDemoMode) {
      setIsDemoMode(false);
      setSimulatedLocation(null);
      setMessage('Demonstração encerrada. Voltando ao GPS real.');
      return;
    }
    if (displayRouteCoords.length < 2) {
      setMessage('A rota precisa carregar antes de iniciar a demonstração.');
      return;
    }
    followingRef.current = true;
    setSimulatedLocation(displayRouteCoords[0]);
    setIsDemoMode(true);
    setMessage('Demonstração iniciada: simulando o motorista pela rota atual.');
  }

  /* Cheguei na coleta → avisa o cliente (status continua ACEITA) */
  async function handleArrivedPickup() {
    if (!token || !ride) return;
    if (!canArrivePickup) {
      setMessage(`Você precisa estar a até ${arrivalRadiusMeters} m da coleta para avisar que chegou.`);
      return;
    }
    setIsBusy(true);
    setMessage('');
    try {
      const updated = await arrivedDriverPickup(token, ride.id);
      setActiveRide(updated);
      setMessage('Cliente avisado de que você chegou para a coleta.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível registrar a chegada.');
    } finally {
      setIsBusy(false);
    }
  }

  /* Confirmar coleta → inicia a viagem (ACEITA → EM_ANDAMENTO) */
  async function handleStart() {
    if (!token || !ride) return;
    if (isDelivery && !canStartDelivery) {
      setMessage(`A coleta só pode iniciar quando você estiver a até ${arrivalRadiusMeters} m do cliente.`);
      return;
    }
    if (!isDelivery && !canStartRide) {
      setMessage(`A corrida só pode iniciar quando você estiver a até ${arrivalRadiusMeters} m do passageiro.`);
      return;
    }
    setIsBusy(true);
    setMessage('');
    try {
      const updated = await startDriverRideRequest(token, ride.id);
      setActiveRide(updated);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível iniciar a corrida.');
    } finally {
      setIsBusy(false);
    }
  }

  /* Cheguei no destino → avisa o cliente para confirmar o recebimento */
  async function handleArrivedDestination() {
    if (!token || !ride) return;
    if (!canArriveDestination) {
      setMessage(`Você precisa estar a até ${arrivalRadiusMeters} m do destino para avisar a chegada.`);
      return;
    }
    setIsBusy(true);
    setMessage('');
    try {
      const updated = await arrivedDriverDestination(token, ride.id);
      setActiveRide(updated);
      setMessage('Cliente avisado. Aguarde a confirmação de recebimento.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível registrar a chegada.');
    } finally {
      setIsBusy(false);
    }
  }

  /* Corrida (não envio): concluir e ir para pagamento */
  async function handleComplete() {
    if (!token || !ride) {
      router.push('/ride-payment');
      return;
    }
    if (!canCompleteRide) {
      setMessage(`A corrida só pode ser concluída quando você estiver a até ${arrivalRadiusMeters} m do destino.`);
      return;
    }
    setIsBusy(true);
    setMessage('');
    try {
      const completed = await completeDriverRideRequest(token, ride.id);
      setActiveRide(completed);
      router.push('/ride-payment');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível concluir a corrida.');
    } finally {
      setIsBusy(false);
    }
  }

  async function cancelActiveRide() {
    if (!token || !ride) {
      setActiveRide(null);
      router.replace('/dashboard');
      return;
    }
    setIsBusy(true);
    setMessage('');
    try {
      await cancelDriverRideRequest(token, ride.id);
      setActiveRide(null);
      router.replace('/dashboard');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `Não foi possível cancelar ${isDelivery ? 'o envio' : 'a corrida'}.`);
    } finally {
      setIsBusy(false);
    }
  }

  function handleCancel() {
    Alert.alert(
      isDelivery ? 'Cancelar envio?' : 'Cancelar corrida?',
      isDelivery
        ? 'O envio será cancelado, o cliente será reembolsado quando houver valor reservado e você ficará offline.'
        : 'A corrida será cancelada, o passageiro será reembolsado quando houver valor reservado e você ficará offline.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: isDelivery ? 'Cancelar envio' : 'Cancelar corrida',
          style: 'destructive',
          onPress: () => void cancelActiveRide(),
        },
      ],
    );
  }

  const phaseLabel = isInProgress
    ? (isDelivery ? 'Indo para a entrega' : 'Em viagem')
    : (isDelivery ? 'Indo para a coleta' : 'Indo ao passageiro');

  const phaseDetail = isInProgress
    ? (isDelivery ? (ride?.destination_label ?? 'Endereço de entrega') : (ride?.destination_label ?? 'Destino'))
    : (ride?.origin_label ?? (isDelivery ? 'Ponto de coleta' : 'Ponto de embarque'));

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          showsUserLocation={false}
          style={styles.map}
          initialRegion={
            driverLocation
              ? {
                  latitude: driverLocation.coords.latitude,
                  longitude: driverLocation.coords.longitude,
                  latitudeDelta: 0.012,
                  longitudeDelta: 0.012,
                }
              : { latitude: -15.7942, longitude: -47.8822, latitudeDelta: 0.05, longitudeDelta: 0.05 }
          }
          onPanDrag={() => { followingRef.current = false; }}
        >
          {currentCoordinate ? (
            <Marker
              coordinate={currentCoordinate}
              title={isDemoMode ? 'Posição demonstrativa' : 'Sua posição'}
            />
          ) : null}
          {target ? (
            <Marker
              coordinate={target}
              pinColor={isInProgress ? '#d94835' : '#00875a'}
              title={isInProgress ? 'Destino' : 'Coleta'}
            />
          ) : null}
          {hasRoute ? (
            <Polyline coordinates={displayRouteCoords} strokeColor="#ffc61a" strokeWidth={4} />
          ) : null}
        </MapView>

        {activeStep?.step ? (
          <View style={styles.navigationPanel}>
            <View style={styles.navigationIcon}>
              <Feather color="#101820" name="corner-up-right" size={22} />
            </View>
            <View style={styles.navigationCopy}>
              <Text style={styles.navigationDistance}>
                {maneuverDistanceLabel ? `Em ${maneuverDistanceLabel}` : 'Siga pela rota'}
              </Text>
              <Text numberOfLines={2} style={styles.navigationInstruction}>
                {activeStep.step.instruction}
              </Text>
            </View>
          </View>
        ) : null}

        <TouchableOpacity accessibilityLabel="Demonstrar rota" onPress={toggleRouteDemo} style={styles.demoButton}>
          <Feather color="#fff" name={isDemoMode ? 'pause-circle' : 'play-circle'} size={17} />
          <Text style={styles.demoButtonText}>{isDemoMode ? 'Parar demo' : 'Demo rota'}</Text>
        </TouchableOpacity>

        <TouchableOpacity accessibilityLabel="Centralizar no motorista" onPress={recenterOnDriver} style={styles.recenterButton}>
          <Feather color={SuwaveColors.ink} name="navigation" size={20} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.bottomSheet}>
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        {/* Fase indicator */}
        <View style={[styles.phaseTag, isInProgress ? styles.phaseTagActive : styles.phaseTagWaiting]}>
          <Feather color={isInProgress ? '#15803d' : '#b45309'} name={isInProgress ? 'navigation' : 'clock'} size={12} />
          <Text style={[styles.phaseTagText, isInProgress ? styles.phaseTagTextActive : styles.phaseTagTextWaiting]}>
            {isDemoMode ? 'DEMONSTRAÇÃO DA ROTA' : (isInProgress ? (isDelivery ? 'INDO PARA A ENTREGA' : 'EM VIAGEM') : (isDelivery ? 'INDO PARA A COLETA' : 'A CAMINHO DO EMBARQUE'))}
          </Text>
        </View>

        <View style={styles.locationCopy}>
          <Text style={styles.locationLabel}>{phaseLabel}</Text>
          <Text style={styles.locationValue} numberOfLines={2}>{phaseDetail}</Text>
        </View>

        {eta ? (
          <View style={styles.etaRow}>
            <Feather color="#0a6b4f" name="navigation" size={18} />
            <View>
              <Text style={styles.etaValue}>{distanceLabel ? `${distanceLabel} · ${eta}` : eta}</Text>
              <Text style={styles.etaLabel}>
                {isInProgress ? 'até o destino' : 'até a coleta'} · {isInProgress ? (ride?.destination_label ?? '') : (ride?.origin_label ?? '')}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.gateBox, isAtNavigationTarget ? styles.gateBoxReady : styles.gateBoxLocked]}>
          <Feather color={isAtNavigationTarget ? '#15803d' : '#b45309'} name={isAtNavigationTarget ? 'check-circle' : 'lock'} size={16} />
          <Text style={[styles.gateText, isAtNavigationTarget ? styles.gateTextReady : styles.gateTextLocked]}>
            {gateMessage}
          </Text>
        </View>

        {routeMessage ? <FormToast message={routeMessage} /> : null}

        <View style={styles.checklist}>
          <View style={styles.checklistRow}>
            <View style={styles.checklistIcon}>
              <Feather color="#fff" name={isDelivery ? 'package' : 'user'} size={11} />
            </View>
            <Text style={styles.checklistLabel}>
              {isDelivery ? `Envio: ${ride?.origin_label ?? 'Coleta'}` : (ride?.passenger_name ?? 'Passageiro SUWAVE')}
            </Text>
          </View>
          {ride?.destination_label ? (
            <View style={[styles.checklistRow, styles.checklistRowBorder]}>
              <View style={styles.checklistIcon}>
                <Feather color="#fff" name="map-pin" size={11} />
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

        {/* Ações conforme a fase do fluxo */}
        {!isInProgress ? (
          isDelivery ? (
            /* ACEITA (envio): Cheguei na coleta → Confirmar coleta */
            <>
              {!arrivedPickup ? (
                <ActionButton disabled={isBusy || !canArrivePickup} loading={isBusy} onPress={handleArrivedPickup}>
                  {canArrivePickup ? 'Cheguei na coleta' : 'Aproxime-se da coleta'}
                </ActionButton>
              ) : (
                <ActionButton disabled={isBusy || !canStartDelivery} loading={isBusy} onPress={handleStart}>
                  {canStartDelivery ? 'Confirmar coleta' : 'Volte à coleta'}
                </ActionButton>
              )}
              <ActionButton disabled={isBusy} iconDirection="none" onPress={handleCancel} secondary>
                Cancelar envio
              </ActionButton>
              <ActionButton iconDirection="none" onPress={() => router.replace('/dashboard')} secondary>
                Voltar ao dashboard
              </ActionButton>
            </>
          ) : (
            /* ACEITA (corrida): iniciar */
            <>
              <ActionButton disabled={isBusy || !canStartRide} loading={isBusy} onPress={handleStart}>
                {canStartRide ? 'Cheguei — Iniciar corrida' : 'Aproxime-se do passageiro'}
              </ActionButton>
              <ActionButton disabled={isBusy} iconDirection="none" onPress={handleCancel} secondary>
                Cancelar corrida
              </ActionButton>
              <ActionButton iconDirection="none" onPress={() => router.replace('/dashboard')} secondary>
                Voltar ao dashboard
              </ActionButton>
            </>
          )
        ) : isDelivery ? (
          /* EM_ANDAMENTO (envio): Cheguei no destino → aguardar cliente confirmar */
          <>
            {!arrivedDestination ? (
              <ActionButton disabled={isBusy || !canArriveDestination} loading={isBusy} onPress={handleArrivedDestination}>
                {canArriveDestination ? 'Cheguei no destino' : 'Aproxime-se do destino'}
              </ActionButton>
            ) : (
              <View style={styles.waitingBox}>
                <Text style={styles.waitingTitle}>Aguardando o cliente confirmar o recebimento</Text>
                <Text style={styles.waitingText}>Assim que o cliente confirmar, a entrega é finalizada e o pagamento liberado.</Text>
              </View>
            )}
            <ActionButton disabled={isBusy} iconDirection="none" onPress={handleCancel} secondary>
              Cancelar envio
            </ActionButton>
            <ActionButton iconDirection="none" onPress={() => router.replace('/dashboard')} secondary>
              Voltar ao dashboard
            </ActionButton>
          </>
        ) : (
          /* EM_ANDAMENTO (corrida): concluir */
          <>
            <ActionButton disabled={isBusy || !canCompleteRide} loading={isBusy} onPress={handleComplete}>
              {canCompleteRide ? 'Concluir corrida' : 'Aproxime-se do destino'}
            </ActionButton>
            <ActionButton disabled={isBusy} iconDirection="none" onPress={handleCancel} secondary>
              Cancelar corrida
            </ActionButton>
            <ActionButton iconDirection="none" onPress={() => router.replace('/dashboard')} secondary>
              Voltar ao dashboard
            </ActionButton>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#edf4f4' },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  navigationPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    minHeight: 78,
    borderRadius: 12,
    backgroundColor: '#101820',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  navigationIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffc61a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationCopy: { flex: 1 },
  navigationDistance: { color: '#ffc61a', fontSize: 13, fontWeight: '900', marginBottom: 2 },
  navigationInstruction: { color: '#fff', fontSize: 17, fontWeight: '900', lineHeight: 22 },
  demoButton: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: '#101820',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    shadowColor: '#073449',
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  demoButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#073449',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 20,
  },
  handleRow: { alignItems: 'center', marginBottom: 12 },
  handle: { width: 56, height: 6, borderRadius: 999, backgroundColor: '#d8e0e5' },
  phaseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,
  },
  phaseTagWaiting: { backgroundColor: '#fef3c7' },
  phaseTagActive: { backgroundColor: '#dcfce7' },
  phaseTagText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  phaseTagTextWaiting: { color: '#b45309' },
  phaseTagTextActive: { color: '#15803d' },
  locationCopy: { gap: 3, marginBottom: 10 },
  locationLabel: { fontSize: 11, fontWeight: '800', color: '#607381', textTransform: 'uppercase' },
  locationValue: { fontSize: 18, fontWeight: '900', color: SuwaveColors.ink },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e8f8ef',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  etaValue: { fontSize: 17, fontWeight: '900', color: '#0a6b4f' },
  etaLabel: { fontSize: 12, fontWeight: '400', color: '#607381' },
  gateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  gateBoxLocked: {
    backgroundColor: '#fff7e0',
    borderColor: '#ffe09a',
  },
  gateBoxReady: {
    backgroundColor: '#ecfdf3',
    borderColor: '#bbf7d0',
  },
  gateText: { flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 16 },
  gateTextLocked: { color: '#8a5a04' },
  gateTextReady: { color: '#15803d' },
  checklist: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8edf1',
    borderRadius: 14,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  checklistRowBorder: { borderTopWidth: 1, borderTopColor: SuwaveColors.line },
  checklistIcon: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#ffc61a', alignItems: 'center', justifyContent: 'center',
  },
  checklistLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#243949', lineHeight: 20 },
  waitingBox: {
    backgroundColor: '#fff7e0',
    borderWidth: 1,
    borderColor: '#ffe09a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 4,
  },
  waitingTitle: { fontSize: 15, fontWeight: '900', color: SuwaveColors.ink, textAlign: 'center' },
  waitingText: { fontSize: 12, color: '#6b6450', textAlign: 'center', lineHeight: 17 },
});
