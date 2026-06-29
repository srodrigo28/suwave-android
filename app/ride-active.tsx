import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '@/components/motorista/native-map';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { FormToast } from '@/components/motorista/form-toast';
import { SuwaveAssets, SuwaveColors } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import {
  arrivedDriverDestination,
  arrivedDriverPickup,
  cancelDriverRideRequest,
  completeDriverRideRequest,
  confirmDriverDeliveryCode,
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

function calculateBearing(start: MapCoordinate, end: MapCoordinate) {
  const lat1 = (start.latitude * Math.PI) / 180;
  const lat2 = (end.latitude * Math.PI) / 180;
  const dLng = ((end.longitude - start.longitude) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
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

function interpolateCoordinate(from: MapCoordinate, to: MapCoordinate, factor: number): MapCoordinate {
  return {
    latitude: from.latitude + ((to.latitude - from.latitude) * factor),
    longitude: from.longitude + ((to.longitude - from.longitude) * factor),
  };
}

function findClosestCoordinateIndex(route: MapCoordinate[], current: MapCoordinate) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < route.length; index += 1) {
    const candidate = route[index];
    const distance = haversineMeters(current.latitude, current.longitude, candidate.latitude, candidate.longitude);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function getLookAheadPoint(route: MapCoordinate[], startIndex: number, lookAheadMeters: number) {
  if (route.length === 0) return null;
  if (route.length === 1 || startIndex >= route.length - 1) return route[route.length - 1];

  let accumulated = 0;
  for (let index = Math.max(0, startIndex); index < route.length - 1; index += 1) {
    const from = route[index];
    const to = route[index + 1];
    accumulated += haversineMeters(from.latitude, from.longitude, to.latitude, to.longitude);
    if (accumulated >= lookAheadMeters) {
      return to;
    }
  }

  return route[route.length - 1];
}

const MIN_ARRIVAL_RADIUS_METERS = 150;
const MAX_ARRIVAL_RADIUS_METERS = 300;
const NAVIGATION_LOOK_AHEAD_METERS = 200;
const NAVIGATION_CAMERA_PITCH = 0;
const NAVIGATION_CAMERA_ZOOM = 18.2;
const NAVIGATION_CAMERA_DURATION_MS = 750;

export default function RideActiveScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const { token } = useAuth();
  const ride = useDriverFlowStore((state) => state.activeRide);
  const setActiveRide = useDriverFlowStore((state) => state.setActiveRide);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const isDelivery = ride?.request_kind === 'delivery';
  const isInProgress = ride?.status === 'EM_ANDAMENTO';
  const arrivedPickup = Boolean(ride?.arrived_pickup_at);
  const pickupConfirmed = Boolean(ride?.pickup_confirmed_at);
  const arrivedDestination = Boolean(ride?.arrived_destination_at);

  const [driverLocation, setDriverLocation] = useState<Location.LocationObject | null>(null);
  const [simulatedLocation, setSimulatedLocation] = useState<MapCoordinate | null>(null);
  const [navigationCoords, setNavigationCoords] = useState<MapCoordinate[]>([]);
  const [routeSteps, setRouteSteps] = useState<DriverRouteStep[]>([]);
  const [routeMessage, setRouteMessage] = useState('');
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [isNavigationExpanded, setIsNavigationExpanded] = useState(false);
  const [deliveryCodeInput, setDeliveryCodeInput] = useState('');
  const [deliveryCodeError, setDeliveryCodeError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState('');
  const lastPingRef = useRef(0);
  const lastRouteOriginRef = useRef<MapCoordinate | null>(null);
  const lastRouteTargetRef = useRef<MapCoordinate | null>(null);
  const lastFitTargetRef = useRef<string | null>(null);
  const lastDemoAutoActionRef = useRef<string | null>(null);
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
  const sheetCollapsedHeight = Math.max(94, Math.min(108, Math.round(windowHeight * 0.115)));
  const sheetExpandedMaxHeight = Math.max(360, Math.round(windowHeight * 0.52));
  const mapControlsBottomOffset = (isSheetExpanded ? sheetExpandedMaxHeight : sheetCollapsedHeight) + 18;
  const showDeliveryCodeEntry = isInProgress && isDelivery && arrivedDestination;
  const compactStatusHint = message
    || routeMessage
    || (isAtNavigationTarget
      ? `No ponto de ${gateTargetLabel} · toque para abrir`
      : `Seguindo até ${gateTargetLabel}`);
  const sheetToggleLabel = isSheetExpanded
    ? 'Mapa cheio'
    : (isAtNavigationTarget ? 'Abrir ações' : 'Ver detalhes');
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
  const closestRouteIndex = useMemo(
    () => (currentCoordinate && displayRouteCoords.length > 0
      ? findClosestCoordinateIndex(displayRouteCoords, currentCoordinate)
      : 0),
    [currentCoordinate, displayRouteCoords],
  );
  const passedRouteCoords = useMemo(
    () => (displayRouteCoords.length > 1 ? displayRouteCoords.slice(0, Math.min(closestRouteIndex + 1, displayRouteCoords.length)) : []),
    [closestRouteIndex, displayRouteCoords],
  );
  const remainingRouteCoords = useMemo(
    () => (displayRouteCoords.length > 1 ? displayRouteCoords.slice(Math.max(closestRouteIndex, 0)) : []),
    [closestRouteIndex, displayRouteCoords],
  );
  const lookAheadPoint = useMemo(() => {
    if (!currentCoordinate || displayRouteCoords.length === 0) return null;
    return getLookAheadPoint(displayRouteCoords, closestRouteIndex, NAVIGATION_LOOK_AHEAD_METERS);
  }, [closestRouteIndex, currentCoordinate, displayRouteCoords]);
  const navigationHeading = useMemo(() => {
    if (!currentCoordinate) return 0;
    const sensorHeading = driverLocation?.coords.heading;
    if (!isDemoMode && sensorHeading != null && Number.isFinite(sensorHeading) && sensorHeading >= 0) {
      return sensorHeading;
    }
    if (lookAheadPoint) {
      return calculateBearing(currentCoordinate, lookAheadPoint);
    }
    if (remainingRouteCoords.length > 1) {
      return calculateBearing(remainingRouteCoords[0], remainingRouteCoords[1]);
    }
    return 0;
  }, [currentCoordinate, driverLocation?.coords.heading, isDemoMode, lookAheadPoint, remainingRouteCoords]);
  const cameraCenter = useMemo(() => {
    if (!currentCoordinate) return null;
    if (!lookAheadPoint) return currentCoordinate;
    return interpolateCoordinate(currentCoordinate, lookAheadPoint, 0.34);
  }, [currentCoordinate, lookAheadPoint]);
  const nextManeuverLabel = activeStep?.step.maneuver?.replaceAll('_', ' ') ?? null;
  const demoStageKey = `${ride?.id ?? 'sem-corrida'}:${ride?.status ?? 'sem-status'}:${arrivedPickup ? 'pickup' : 'no-pickup'}:${pickupConfirmed ? 'pickup-confirmed' : 'pickup-pending'}:${arrivedDestination ? 'destination' : 'no-destination'}`;
  const activeVehicleMarkerSource = useMemo(() => {
    switch (ride?.vehicle_type) {
      case 'bike':
        return SuwaveAssets.workmodeBike;
      case 'moto':
        return SuwaveAssets.workmodeMoto;
      case 'car':
      default:
        return SuwaveAssets.workmodeCar;
    }
  }, [ride?.vehicle_type]);

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

  // Seguir o motorista no mapa (modo navegacao). Desliga ao arrastar; volta no botão recentralizar.
  useEffect(() => {
    if (!currentCoordinate || !cameraCenter || !followingRef.current) return;
    try {
      mapRef.current?.animateCamera(
        {
          center: cameraCenter,
          heading: navigationHeading,
          pitch: NAVIGATION_CAMERA_PITCH,
          zoom: NAVIGATION_CAMERA_ZOOM,
        },
        { duration: NAVIGATION_CAMERA_DURATION_MS },
      );
    } catch {
      // Emulador pode falhar ao animar camera 3D — ignora silenciosamente.
    }
  }, [cameraCenter, currentCoordinate, navigationHeading]);

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
    setIsRouteLoading(true);

    fetchDriverRoute(
      { lat: origin.latitude, lng: origin.longitude },
      { lat: target.latitude, lng: target.longitude },
    )
      .then((summary) => {
        if (!active) return;
        setNavigationCoords(summary.geometry.map((pt) => ({ latitude: pt.lat, longitude: pt.lng })));
        setRouteSteps(summary.steps);
        setIsRouteLoading(false);
      })
      .catch(() => {
        if (!active) return;
        const fallback = [
          { latitude: currentCoordinate!.latitude, longitude: currentCoordinate!.longitude },
          { latitude: target.latitude, longitude: target.longitude },
        ];
        setNavigationCoords(fallback);
        setRouteSteps([]);
        setIsRouteLoading(false);
        setRouteMessage('Rota direta — siga pelo mapa.');
      });

    return () => {
      active = false;
      setIsRouteLoading(false);
    };
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

  useEffect(() => {
    lastDemoAutoActionRef.current = null;
  }, [demoStageKey]);

  useEffect(() => {
    if (!isDemoMode || !isAtNavigationTarget || !ride || isBusy) return;

    const actionKey = `${demoStageKey}:${gateTargetLabel}`;
    if (lastDemoAutoActionRef.current === actionKey) return;
    lastDemoAutoActionRef.current = actionKey;

    if (isDelivery && !isInProgress && !arrivedPickup) {
      if (!token) {
        setMessage('Entre novamente para registrar a chegada na coleta.');
        return;
      }
      setIsBusy(true);
      setMessage('Demo: registrando chegada na coleta...');
      void arrivedDriverPickup(token, ride.id)
        .then((updated) => {
          setActiveRide(updated);
          setMessage('Demo: cliente avisado que você chegou para a coleta.');
        })
        .catch((err) => {
          setMessage(err instanceof Error ? err.message : 'Não foi possível registrar a chegada.');
        })
        .finally(() => {
          setIsBusy(false);
        });
      return;
    }

    if (isDelivery && isInProgress && !arrivedDestination) {
      if (!token) {
        setMessage('Entre novamente para registrar a chegada no destino.');
        return;
      }
      setIsBusy(true);
      setMessage('Demo: registrando chegada no destino...');
      void arrivedDriverDestination(token, ride.id)
        .then((updated) => {
          setActiveRide(updated);
          setMessage('Demo: cliente avisado. Digite o código para confirmar entrega.');
        })
        .catch((err) => {
          setMessage(err instanceof Error ? err.message : 'Não foi possível registrar a chegada.');
        })
        .finally(() => {
          setIsBusy(false);
        });
      return;
    }

    if (isDelivery && !isInProgress && arrivedPickup && !pickupConfirmed) {
      setMessage('Demonstração chegou à coleta. O cliente foi avisado e precisa aprovar a coleta para liberar a entrega.');
      return;
    }

    if (isDelivery && !isInProgress && arrivedPickup && pickupConfirmed) {
      setMessage('Coleta aprovada pelo cliente. Agora confirme a coleta para seguir até o destino.');
      return;
    }

    if (!isDelivery && !isInProgress) {
      setMessage('Demonstração chegou ao embarque. Agora você já pode iniciar a corrida.');
      return;
    }

    if (!isDelivery && isInProgress) {
      setMessage('Demonstração chegou ao destino. Agora você já pode concluir a corrida.');
      return;
    }
  }, [
    arrivedDestination,
    arrivedPickup,
    demoStageKey,
    gateTargetLabel,
    isAtNavigationTarget,
    isBusy,
    isDelivery,
    isDemoMode,
    isInProgress,
    pickupConfirmed,
    ride,
    setActiveRide,
    token,
  ]);

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
        edgePadding: { bottom: sheetCollapsedHeight + 36, left: 42, right: 42, top: 92 },
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [currentCoordinate, displayRouteCoords, isInProgress, sheetCollapsedHeight, target]);

  // Envio aceito/em andamento: observar confirmação de coleta e conclusão.
  useEffect(() => {
    if (!isDelivery || !ride?.id) return;
    const rideId = ride.id;
    const currentRide = ride;
    let active = true;
    const check = async () => {
      try {
        const tracked = await trackDriverRideRequest(rideId);
        if (!active) return;
        if (tracked.status === 'CONCLUIDA') {
          setActiveRide({ ...currentRide, status: 'CONCLUIDA' });
          router.replace('/ride-payment');
          return;
        }
        if (tracked.status === 'ACEITA' || tracked.status === 'EM_ANDAMENTO') {
          setActiveRide({
            ...currentRide,
            status: tracked.status,
            arrived_pickup_at: tracked.arrived_pickup_at ?? currentRide.arrived_pickup_at ?? null,
            pickup_confirmed_at: tracked.pickup_confirmed_at ?? currentRide.pickup_confirmed_at ?? null,
            arrived_destination_at: tracked.arrived_destination_at ?? currentRide.arrived_destination_at ?? null,
          });
        }
      } catch { /* silencia falhas de poll */ }
    };
    void check();
    const interval = setInterval(check, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [isDelivery, ride, setActiveRide]);

  function recenterOnDriver() {
    followingRef.current = true;
    if (cameraCenter) {
      mapRef.current?.animateCamera(
        {
          center: cameraCenter,
          heading: navigationHeading,
          pitch: NAVIGATION_CAMERA_PITCH,
          zoom: NAVIGATION_CAMERA_ZOOM,
        },
        { duration: 500 },
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
    if (isRouteLoading) {
      setMessage('A rota ainda está carregando. Aguarde alguns segundos.');
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
      if (isDemoMode) {
        setNavigationCoords([]);
        setRouteSteps([]);
        lastRouteOriginRef.current = null;
        lastRouteTargetRef.current = null;
        lastFitTargetRef.current = null;
        setMessage(
          isDelivery
            ? 'Coleta confirmada. A demonstração foi atualizada para seguir até o destino.'
            : 'Corrida iniciada. A demonstração foi atualizada para seguir até o destino.',
        );
      }
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
      setMessage('Cliente avisado. Peça o código de entrega para finalizar a corrida.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível registrar a chegada.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleConfirmDeliveryCode() {
    if (!token || !ride) return;
    const code = deliveryCodeInput.replace(/\D/g, '').slice(0, 4);
    if (code.length !== 4) {
      setDeliveryCodeError('Digite o código de 4 dígitos informado pelo cliente.');
      return;
    }
    setIsBusy(true);
    setDeliveryCodeError('');
    setMessage('');
    try {
      const result = await confirmDriverDeliveryCode(token, ride.id, code);
      const grossFare = result.gross_fare ?? result.driver_fare ?? ride.gross_fare ?? ride.driver_fare;
      setActiveRide({
        ...ride,
        status: 'CONCLUIDA',
        driver_fare: result.driver_fare ?? ride.driver_fare,
        gross_fare: grossFare,
        net_fare: result.net_fare ?? ride.net_fare,
        platform_fee: result.platform_fee ?? ride.platform_fee,
        platform_fee_percent: result.platform_fee_percent ?? ride.platform_fee_percent,
      });
      setDeliveryCodeInput('');
      router.replace('/ride-payment');
    } catch (err) {
      setDeliveryCodeError(err instanceof Error ? err.message : 'Código inválido ou entrega ainda não liberada.');
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
    if (!cancelReason.trim()) {
      setCancelReasonError('Informe o motivo do cancelamento.');
      return;
    }
    if (!token || !ride) {
      setActiveRide(null);
      router.replace('/dashboard');
      return;
    }
    setIsBusy(true);
    setCancelReasonError('');
    try {
      await cancelDriverRideRequest(token, ride.id, cancelReason.trim());
      setActiveRide(null);
      router.replace('/dashboard');
    } catch (err) {
      setCancelReasonError(err instanceof Error ? err.message : `Não foi possível cancelar ${isDelivery ? 'o envio' : 'a corrida'}.`);
    } finally {
      setIsBusy(false);
      setShowCancelModal(false);
    }
  }

  function handleCancel() {
    setCancelReason('');
    setCancelReasonError('');
    setShowCancelModal(true);
  }

  const phaseLabel = isInProgress
    ? (isDelivery ? 'Indo para a entrega' : 'Em viagem')
    : (isDelivery ? 'Indo para a coleta' : 'Indo ao passageiro');

  const phaseDetail = isInProgress
    ? (isDelivery ? (ride?.destination_label ?? 'Endereço de entrega') : (ride?.destination_label ?? 'Destino'))
    : (ride?.origin_label ?? (isDelivery ? 'Ponto de coleta' : 'Ponto de embarque'));
  const upcomingStreetLabel = activeStep?.step.streetName
    ?? phaseDetail;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          pitchEnabled={false}
          rotateEnabled
          showsBuildings={false}
          showsCompass={false}
          showsIndoors={false}
          showsTraffic={false}
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
              anchor={{ x: 0.5, y: 0.5 }}
              title={isDemoMode ? 'Posição demonstrativa' : 'Sua posição'}
            >
              <View style={styles.driverMarkerWrap}>
                <View style={styles.driverMarkerShadow} />
                <View style={styles.driverMarkerCore}>
                  <Image
                    resizeMode="cover"
                    source={activeVehicleMarkerSource}
                    style={styles.driverMarkerImage}
                  />
                </View>
                <View style={styles.driverMarkerPulse} />
              </View>
            </Marker>
          ) : null}
          {target ? (
            <Marker
              coordinate={target}
              pinColor={isInProgress ? '#d94835' : '#00875a'}
              title={isInProgress ? 'Destino' : 'Coleta'}
            />
          ) : null}
          {hasRoute && displayRouteCoords.length > 1 ? (
            <Polyline coordinates={displayRouteCoords} lineCap="round" lineJoin="round" strokeColor="#1a1a2e" strokeWidth={8} />
          ) : null}
          {passedRouteCoords.length > 1 ? (
            <Polyline coordinates={passedRouteCoords} lineCap="round" lineJoin="round" strokeColor="#9ca3af" strokeWidth={5} />
          ) : null}
          {remainingRouteCoords.length > 1 ? (
            <Polyline coordinates={remainingRouteCoords} lineCap="round" lineJoin="round" strokeColor="#1a73e8" strokeWidth={6} />
          ) : null}
        </MapView>

        {activeStep?.step ? (
          <TouchableOpacity
            activeOpacity={0.94}
            onPress={() => setIsNavigationExpanded((value) => !value)}
            style={[
              styles.navigationPanel,
              isNavigationExpanded ? styles.navigationPanelExpanded : styles.navigationPanelCollapsed,
            ]}
          >
            <View style={styles.navigationIcon}>
              <Feather color="#101820" name="corner-up-right" size={22} />
            </View>
            <View style={styles.navigationCopy}>
              <Text style={styles.navigationDistance}>
                {maneuverDistanceLabel ? `Em ${maneuverDistanceLabel}` : 'Siga pela rota'}
              </Text>
              <Text numberOfLines={isNavigationExpanded ? 2 : 1} style={styles.navigationInstruction}>
                {activeStep.step.instruction}
              </Text>
              {(distanceLabel ?? eta) ? (
                <Text numberOfLines={1} style={styles.navigationRemaining}>
                  {[distanceLabel && `${distanceLabel} restantes`, eta].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {isNavigationExpanded ? (
                <View style={styles.navigationMetaRow}>
                  <Text numberOfLines={1} style={styles.navigationStreet}>
                    {upcomingStreetLabel}
                  </Text>
                  {nextManeuverLabel ? (
                    <Text numberOfLines={1} style={styles.navigationManeuver}>
                      {nextManeuverLabel}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
            <Feather
              color="rgba(255,255,255,0.78)"
              name={isNavigationExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
            />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          accessibilityLabel="Demonstrar rota"
          onPress={toggleRouteDemo}
          style={[styles.demoButton, { bottom: mapControlsBottomOffset }]}
        >
          <Feather color={SuwaveColors.black} name={isDemoMode ? 'pause-circle' : 'play-circle'} size={17} />
          <Text style={styles.demoButtonText}>
            {isDemoMode ? 'Parar demo' : (isRouteLoading ? 'Carregando rota...' : 'Demo rota')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel="Centralizar no motorista"
          onPress={recenterOnDriver}
          style={[styles.recenterButton, { bottom: mapControlsBottomOffset }]}
        >
          <Feather color={SuwaveColors.ink} name="navigation" size={20} />
        </TouchableOpacity>
        <View style={styles.bottomSheetDock}>
            <View
              style={[
                styles.bottomSheet,
                isSheetExpanded ? styles.bottomSheetExpanded : styles.bottomSheetCollapsed,
                {
                  maxHeight: isSheetExpanded ? sheetExpandedMaxHeight : sheetCollapsedHeight,
                  minHeight: sheetCollapsedHeight,
              },
            ]}
            >
              <TouchableOpacity
                accessibilityLabel={isSheetExpanded ? 'Ocultar ajuda da rota' : 'Abrir ajuda da rota'}
                onPress={() => setIsSheetExpanded((value) => !value)}
                style={styles.handleRow}
              >
                <View style={styles.handle} />
              </TouchableOpacity>

            <View style={styles.sheetSummary}>
              <View style={styles.sheetSummaryTop}>
                <View style={[styles.phaseTag, isInProgress ? styles.phaseTagActive : styles.phaseTagWaiting]}>
                  <Feather color={isInProgress ? '#15803d' : '#b45309'} name={isInProgress ? 'navigation' : 'clock'} size={12} />
                  <Text style={[styles.phaseTagText, isInProgress ? styles.phaseTagTextActive : styles.phaseTagTextWaiting]}>
                    {isDemoMode ? 'DEMONSTRAÇÃO DA ROTA' : (isInProgress ? (isDelivery ? 'INDO PARA A ENTREGA' : 'EM VIAGEM') : (isDelivery ? 'INDO PARA A COLETA' : 'A CAMINHO DO EMBARQUE'))}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setIsSheetExpanded((value) => !value)} style={styles.sheetToggleButton}>
                  <Text style={styles.sheetToggleLabel}>{sheetToggleLabel}</Text>
                </TouchableOpacity>
              </View>

              <Text numberOfLines={1} style={styles.sheetCompactAddress}>{phaseDetail}</Text>
              {eta || compactStatusHint ? (
                <View style={styles.sheetCompactMeta}>
                  <Text numberOfLines={1} style={styles.sheetCompactEta}>
                    {eta ? (distanceLabel ? `${distanceLabel} · ${eta}` : eta) : 'Aguardando ETA'}
                  </Text>
                  <Text numberOfLines={1} style={styles.sheetCompactHint}>
                    {compactStatusHint}
                  </Text>
                </View>
              ) : null}
            </View>

            {isSheetExpanded && showDeliveryCodeEntry ? (
              <View style={styles.deliveryCodeBoxSticky}>
                <View style={styles.deliveryCodeHeader}>
                  <Feather color="#15803d" name="shield" size={18} />
                  <Text style={styles.deliveryCodeTitle}>Finalizar com código</Text>
                </View>
                <Text style={styles.deliveryCodeText}>
                  Peça ao cliente o código de 4 dígitos exibido no acompanhamento do envio.
                </Text>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={(value) => {
                    setDeliveryCodeInput(value.replace(/\D/g, '').slice(0, 4));
                    setDeliveryCodeError('');
                  }}
                  placeholder="0000"
                  placeholderTextColor="#94a3b8"
                  style={styles.deliveryCodeInput}
                  textAlign="center"
                  value={deliveryCodeInput}
                />
                {deliveryCodeError ? <FormToast message={deliveryCodeError} /> : null}
                <ActionButton
                  disabled={isBusy || deliveryCodeInput.length !== 4}
                  loading={isBusy}
                  onPress={handleConfirmDeliveryCode}
                >
                  Finalizar entrega
                </ActionButton>
              </View>
            ) : null}

            {isSheetExpanded ? (
              <ScrollView
                contentContainerStyle={styles.sheetExpandedContent}
                showsVerticalScrollIndicator={false}
                style={styles.sheetExpandedScroll}
              >
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

                {isInProgress && isDelivery && arrivedDestination ? (
                  <View style={styles.deliveryCodeBox}>
                    <View style={styles.deliveryCodeHeader}>
                      <Feather color="#15803d" name="shield" size={18} />
                      <Text style={styles.deliveryCodeTitle}>Finalizar com código</Text>
                    </View>
                    <Text style={styles.deliveryCodeText}>
                      Peça ao cliente o código de 4 dígitos exibido no acompanhamento do envio.
                    </Text>
                    <TextInput
                      keyboardType="number-pad"
                      maxLength={4}
                      onChangeText={(value) => {
                        setDeliveryCodeInput(value.replace(/\D/g, '').slice(0, 4));
                        setDeliveryCodeError('');
                      }}
                      placeholder="0000"
                      placeholderTextColor="#94a3b8"
                      style={styles.deliveryCodeInput}
                      textAlign="center"
                      value={deliveryCodeInput}
                    />
                    {deliveryCodeError ? <FormToast message={deliveryCodeError} /> : null}
                    <ActionButton
                      disabled={isBusy || deliveryCodeInput.length !== 4}
                      loading={isBusy}
                      onPress={handleConfirmDeliveryCode}
                    >
                      Finalizar entrega
                    </ActionButton>
                  </View>
                ) : null}

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

                {!isInProgress ? (
                  isDelivery ? (
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
                  <>
                    {!arrivedDestination ? (
                      <ActionButton disabled={isBusy || !canArriveDestination} loading={isBusy} onPress={handleArrivedDestination}>
                        {canArriveDestination ? 'Cheguei no destino' : 'Aproxime-se do destino'}
                      </ActionButton>
                    ) : null}
                    <ActionButton disabled={isBusy} iconDirection="none" onPress={handleCancel} secondary>
                      Cancelar envio
                    </ActionButton>
                    <ActionButton iconDirection="none" onPress={() => router.replace('/dashboard')} secondary>
                      Voltar ao dashboard
                    </ActionButton>
                  </>
                ) : (
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
              </ScrollView>
            ) : null}
          </View>
        </View>
      </View>
      {/* Modal de cancelamento com motivo obrigatório */}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowCancelModal(false)}
        transparent
        visible={showCancelModal}
      >
        <Pressable onPress={() => setShowCancelModal(false)} style={cancelStyles.overlay}>
          <Pressable style={cancelStyles.sheet}>
            <View style={cancelStyles.handle} />
            <Text style={cancelStyles.title}>
              {isDelivery ? 'Cancelar envio' : 'Cancelar corrida'}
            </Text>
            <Text style={cancelStyles.subtitle}>
              {isDelivery
                ? 'O cliente será reembolsado. Informe o motivo obrigatoriamente.'
                : 'O passageiro será notificado. Informe o motivo obrigatoriamente.'}
            </Text>
            <TextInput
              maxLength={280}
              multiline
              numberOfLines={4}
              onChangeText={(text) => {
                setCancelReason(text);
                setCancelReasonError('');
              }}
              placeholder="Descreva o motivo do cancelamento..."
              placeholderTextColor="#9aabb8"
              style={cancelStyles.input}
              value={cancelReason}
            />
            <Text style={cancelStyles.counter}>{cancelReason.length}/280</Text>
            {cancelReasonError ? (
              <Text style={cancelStyles.error}>{cancelReasonError}</Text>
            ) : null}
            <View style={cancelStyles.actions}>
              <Pressable
                onPress={() => setShowCancelModal(false)}
                style={cancelStyles.btnSecondary}
              >
                <Text style={cancelStyles.btnSecondaryText}>Voltar</Text>
              </Pressable>
              <Pressable
                disabled={isBusy || !cancelReason.trim()}
                onPress={() => void cancelActiveRide()}
                style={[cancelStyles.btnDanger, (!cancelReason.trim() || isBusy) && cancelStyles.btnDisabled]}
              >
                <Text style={cancelStyles.btnDangerText}>
                  {isBusy ? 'Cancelando...' : 'Confirmar'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const cancelStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 24, 36, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#dce6ec',
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#071a36',
  },
  subtitle: {
    fontSize: 14,
    color: '#667f90',
    lineHeight: 20,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e0eaf0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#071a36',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: 11,
    color: '#9aabb8',
    textAlign: 'right',
    marginTop: -6,
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btnSecondary: {
    flex: 1,
    height: 50,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e0eaf0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#071a36',
  },
  btnDanger: {
    flex: 1,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDangerText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
  },
  btnDisabled: {
    opacity: 0.45,
  },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#edf4f4' },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  driverMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarkerShadow: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(2, 12, 19, 0.28)',
    transform: [{ scale: 1.35 }],
  },
  driverMarkerCore: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#9be5cf',
    overflow: 'hidden',
  },
  driverMarkerImage: {
    width: '100%',
    height: '100%',
  },
  driverMarkerPulse: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: 'rgba(99, 215, 180, 0.28)',
  },
  navigationPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 24, 32, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  navigationPanelCollapsed: {
    minHeight: 64,
    paddingVertical: 10,
  },
  navigationPanelExpanded: {
    minHeight: 86,
    paddingVertical: 12,
  },
  navigationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffc61a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationCopy: { flex: 1 },
  navigationDistance: { color: '#ffc61a', fontSize: 12, fontWeight: '900', marginBottom: 2 },
  navigationInstruction: { color: '#fff', fontSize: 16, fontWeight: '900', lineHeight: 20 },
  navigationRemaining: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', marginTop: 3 },
  navigationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  navigationStreet: {
    flex: 1,
    color: '#8ef2c6',
    fontSize: 12,
    fontWeight: '800',
  },
  navigationManeuver: {
    color: '#cfd7dd',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  demoButton: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: SuwaveColors.yellow,
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
  demoButtonText: { color: SuwaveColors.black, fontSize: 12, fontWeight: '900' },
  recenterButton: {
    position: 'absolute',
    right: 16,
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
  bottomSheetDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    shadowColor: '#02131f',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 14,
    overflow: 'hidden',
  },
  bottomSheetCollapsed: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  bottomSheetExpanded: {
    backgroundColor: '#ffffff',
  },
  handleRow: { alignItems: 'center', marginBottom: 6 },
  handle: { width: 56, height: 6, borderRadius: 999, backgroundColor: '#d8e0e5' },
  sheetSummary: {
    gap: 4,
  },
  sheetSummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sheetToggleButton: {
    minHeight: 30,
    borderRadius: 15,
    backgroundColor: '#eff4f7',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetToggleLabel: {
    color: '#173447',
    fontSize: 12,
    fontWeight: '800',
  },
  sheetCompactAddress: {
    color: SuwaveColors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  sheetCompactMeta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  sheetCompactEta: {
    color: '#0a6b4f',
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '900',
  },
  sheetCompactHint: {
    flex: 1,
    textAlign: 'right',
    color: '#607381',
    fontSize: 11,
    fontWeight: '600',
  },
  sheetExpandedScroll: {
    marginTop: 12,
  },
  sheetExpandedContent: {
    paddingBottom: 8,
  },
  phaseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
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
  deliveryCodeBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 10,
  },
  deliveryCodeBoxSticky: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
    gap: 10,
  },
  deliveryCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deliveryCodeTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#14532d',
    textAlign: 'center',
  },
  deliveryCodeText: {
    fontSize: 12,
    color: '#166534',
    textAlign: 'center',
    lineHeight: 17,
  },
  deliveryCodeInput: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#ffffff',
    color: '#14532d',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 8,
    paddingHorizontal: 16,
  },
});
