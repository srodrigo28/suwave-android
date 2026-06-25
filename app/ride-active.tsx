import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '@/components/motorista/native-map';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { FormToast } from '@/components/motorista/form-toast';
import { SuwaveColors } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import {
  cancelDriverRideRequest,
  completeDriverRideRequest,
  confirmDriverDeliveryCode,
  pingDriverLocation,
  startDriverRideRequest,
} from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';
import { formatDriverEta, formatRideFare } from '@/utils/rides';

export default function RideActiveScreen() {
  const { token } = useAuth();
  const ride = useDriverFlowStore((state) => state.activeRide);
  const setActiveRide = useDriverFlowStore((state) => state.setActiveRide);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [deliveryCode, setDeliveryCode] = useState('');

  const isDelivery = ride?.request_kind === 'delivery';
  const isInProgress = ride?.status === 'EM_ANDAMENTO';

  const eta = formatDriverEta(ride?.distance_meters);
  const fare = formatRideFare(ride?.distance_meters, ride?.vehicle_type);
  const [driverLocation, setDriverLocation] = useState<Location.LocationObject | null>(null);
  const lastPingRef = useRef(0);

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
          const now = Date.now();
          if (now - lastPingRef.current < 15000) return;
          lastPingRef.current = now;
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

  /* Fase A → B: motorista chegou ao embarque e inicia a viagem */
  async function handleStart() {
    if (!token || !ride) return;
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

  /* Fase B corrida: concluir e ir para pagamento */
  async function handleComplete() {
    if (!token || !ride) {
      router.push('/ride-payment');
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

  /* Fase B entrega: confirmar com código do destinatário */
  async function handleConfirmDelivery() {
    if (!token || !ride) return;
    const code = deliveryCode.trim();
    if (code.length !== 4) {
      setMessage('Digite o código de 4 dígitos fornecido pelo destinatário.');
      return;
    }
    setIsBusy(true);
    setMessage('');
    try {
      await confirmDriverDeliveryCode(token, ride.id, code);
      // após confirmar, concluir para obter dados de pagamento
      const completed = await completeDriverRideRequest(token, ride.id);
      setActiveRide(completed);
      router.push('/ride-payment');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Código inválido ou corrida não pode ser confirmada.');
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
    ? (isDelivery ? 'Entregando pacote' : 'Em viagem')
    : (isDelivery ? 'Indo buscar o pacote' : 'Indo ao passageiro');

  const phaseDetail = isInProgress
    ? (isDelivery ? (ride?.destination_label ?? 'Endereço de entrega') : (ride?.destination_label ?? 'Destino'))
    : (ride?.origin_label ?? (isDelivery ? 'Ponto de coleta' : 'Ponto de embarque'));

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
                latitudeDelta: 0.012,
                longitudeDelta: 0.012,
              }
            : { latitude: -15.7942, longitude: -47.8822, latitudeDelta: 0.05, longitudeDelta: 0.05 }
        }
      >
        {driverLocation ? (
          <Marker
            coordinate={{ latitude: driverLocation.coords.latitude, longitude: driverLocation.coords.longitude }}
            title="Sua posição"
          />
        ) : null}
        {hasRoute ? (
          <Polyline coordinates={routeCoords} strokeColor="#ffc61a" strokeWidth={4} />
        ) : null}
      </MapView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.bottomSheet}>
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        {/* Fase indicator */}
        <View style={[styles.phaseTag, isInProgress ? styles.phaseTagActive : styles.phaseTagWaiting]}>
          <Feather color={isInProgress ? '#15803d' : '#b45309'} name={isInProgress ? 'navigation' : 'clock'} size={12} />
          <Text style={[styles.phaseTagText, isInProgress ? styles.phaseTagTextActive : styles.phaseTagTextWaiting]}>
            {isInProgress ? 'EM VIAGEM' : 'A CAMINHO DO EMBARQUE'}
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
              <Text style={styles.etaValue}>{eta}</Text>
              <Text style={styles.etaLabel}>
                {isInProgress ? 'até o destino' : 'até o embarque'} · {isInProgress ? (ride?.destination_label ?? '') : (ride?.origin_label ?? '')}
              </Text>
            </View>
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

        {/* Input de código de entrega — só em Fase B para deliveries */}
        {isInProgress && isDelivery ? (
          <View style={styles.codeSection}>
            <Text style={styles.codeLabel}>Código de confirmação (destinatário)</Text>
            <TextInput
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={setDeliveryCode}
              placeholder="0000"
              placeholderTextColor="#9ca3af"
              style={styles.codeInput}
              value={deliveryCode}
            />
          </View>
        ) : null}

        <FormToast message={message} />

        {/* Fase A: botão iniciar */}
        {!isInProgress ? (
          <>
            <ActionButton disabled={isBusy} loading={isBusy} onPress={handleStart}>
              {`Cheguei — Iniciar ${isDelivery ? 'entrega' : 'corrida'}`}
            </ActionButton>
            <ActionButton disabled={isBusy} iconDirection="none" onPress={handleCancel} secondary>
              {isDelivery ? 'Cancelar envio' : 'Cancelar corrida'}
            </ActionButton>
            <ActionButton iconDirection="none" onPress={() => router.replace('/dashboard')} secondary>
              Voltar ao dashboard
            </ActionButton>
          </>
        ) : isDelivery ? (
          /* Fase B entrega: confirmar código */
          <>
            <ActionButton disabled={isBusy || deliveryCode.trim().length !== 4} loading={isBusy} onPress={handleConfirmDelivery}>
              Confirmar entrega
            </ActionButton>
            <ActionButton disabled={isBusy} iconDirection="none" onPress={handleCancel} secondary>
              Cancelar envio
            </ActionButton>
            <ActionButton iconDirection="none" onPress={() => router.replace('/dashboard')} secondary>
              Voltar ao dashboard
            </ActionButton>
          </>
        ) : (
          /* Fase B corrida: concluir */
          <>
            <ActionButton disabled={isBusy} loading={isBusy} onPress={handleComplete}>
              Concluir corrida
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
  map: { flex: 1 },
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
  codeSection: { marginBottom: 10, gap: 6 },
  codeLabel: { fontSize: 12, fontWeight: '700', color: '#607381' },
  codeInput: {
    borderWidth: 2,
    borderColor: '#ffc61a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: '900',
    color: SuwaveColors.ink,
    textAlign: 'center',
    letterSpacing: 10,
    backgroundColor: '#fffbeb',
  },
});
