import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '@/components/motorista/native-map';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/motorista/action-button';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { createDriverTrip, type DriverRouteCoordinate } from '@/services/driver-client';
import {
  fetchDriverMapPlace,
  fetchDriverRoute,
  formatDriverMapPlace,
  formatDriverRoutePlace,
  searchDriverRoutePlaces,
  type DriverMapPlace,
  type DriverRoutePlace,
  type DriverRouteSummary,
} from '@/services/maps-client';
import { addDaysToInputDate, dateToLocalInputValue, formatISODateLabel, formatTripDistanceKm, formatTripDuration } from '@/utils/finance';

/**
 * Equivalente nativo da tela `register-trip` (`RegisterTrip`) em
 * app/motorista/src/app/page.tsx:4185-4569.
 *
 * Origem via GPS (`expo-location`) + reverse geocoding, busca de destino
 * (debounce) e calculo de rota via Google Maps Platform
 * (`@/services/maps-client`), mapa com `react-native-maps`.
 */
export default function RegisterTripScreen() {
  const { token } = useAuth();
  const todayInputValue = useMemo(() => dateToLocalInputValue(new Date()), []);

  const [originLocation, setOriginLocation] = useState<Location.LocationObject | null>(null);
  const [originPlace, setOriginPlace] = useState<DriverMapPlace | null>(null);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationSuggestions, setDestinationSuggestions] = useState<DriverRoutePlace[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<DriverRoutePlace | null>(null);
  const [departureDate, setDepartureDate] = useState(todayInputValue);
  const [returnDate, setReturnDate] = useState(addDaysToInputDate(todayInputValue, 1));
  const [routeSummary, setRouteSummary] = useState<DriverRouteSummary | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<DriverRouteCoordinate[]>([]);
  const [isLocating, setIsLocating] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const originLabel = originPlace
    ? formatDriverMapPlace(originPlace)
    : originLocation
      ? 'Localização atual'
      : 'Buscando sua localização...';
  const originDetail = originPlace?.label && originPlace.label !== originLabel ? originPlace.label : 'Origem obtida pelo GPS';

  const dateError = departureDate < todayInputValue
    ? 'A data de ida não pode ser menor que hoje.'
    : returnDate < departureDate
      ? 'A data de retorno não pode ser menor que a data de ida.'
      : '';

  const outboundDistanceKm = routeSummary?.distanceKm ?? null;
  const returnDistanceKm = routeSummary?.distanceKm ?? null;
  const totalDistanceKm = routeSummary ? routeSummary.distanceKm * 2 : null;
  const totalDurationSeconds = routeSummary ? routeSummary.durationSeconds * 2 : null;

  const summaryCards: [string, string, string][] = [
    ['Distância total', formatTripDistanceKm(totalDistanceKm), 'Ida e volta'],
    ['Distância de ida', formatTripDistanceKm(outboundDistanceKm), ''],
    ['Distância de retorno', formatTripDistanceKm(returnDistanceKm), ''],
    ['Duração estimada', formatTripDuration(totalDurationSeconds), 'Ida e volta'],
  ];

  useEffect(() => {
    let cancelled = false;

    async function loadOrigin() {
      setIsLocating(true);
      setError('');

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('permission_denied');
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          setOriginLocation(position);
        }
      } catch {
        if (!cancelled) {
          setError('Permita a localização para registrar sua viagem.');
        }
      } finally {
        if (!cancelled) {
          setIsLocating(false);
        }
      }
    }

    loadOrigin();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!originLocation) {
      return;
    }

    const activeOriginLocation = originLocation;
    let cancelled = false;

    async function loadOriginPlace() {
      try {
        const place = await fetchDriverMapPlace({
          latitude: activeOriginLocation.coords.latitude,
          longitude: activeOriginLocation.coords.longitude,
          accuracy_meters: activeOriginLocation.coords.accuracy,
        });
        if (!cancelled) {
          setOriginPlace(place);
        }
      } catch {
        if (!cancelled) {
          setOriginPlace(null);
        }
      }
    }

    loadOriginPlace();

    return () => {
      cancelled = true;
    };
  }, [originLocation]);

  useEffect(() => {
    const query = destinationQuery.trim();

    if (selectedDestination && destinationQuery === selectedDestination.label) {
      return;
    }

    if (query.length < 3) {
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const places = await searchDriverRoutePlaces(query);
        if (!cancelled) {
          setDestinationSuggestions(places);
        }
      } catch (err) {
        if (!cancelled) {
          setDestinationSuggestions([]);
          setError(err instanceof Error ? err.message : 'Não foi possível buscar destinos agora.');
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [destinationQuery, selectedDestination]);

  useEffect(() => {
    if (!originLocation || !selectedDestination) {
      return;
    }

    const activeOriginLocation = originLocation;
    const activeDestination = selectedDestination;
    let cancelled = false;

    async function loadRoute() {
      setIsRouting(true);
      setError('');

      try {
        const summary = await fetchDriverRoute(
          { lat: activeOriginLocation.coords.latitude, lng: activeOriginLocation.coords.longitude },
          { lat: activeDestination.lat, lng: activeDestination.lng },
        );

        if (!cancelled) {
          setRouteSummary(summary);
          setRouteGeometry(summary.geometry);
        }
      } catch (err) {
        if (!cancelled) {
          setRouteSummary(null);
          setRouteGeometry([]);
          setError(err instanceof Error ? err.message : 'Não foi possível calcular a rota agora.');
        }
      } finally {
        if (!cancelled) {
          setIsRouting(false);
        }
      }
    }

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [originLocation, selectedDestination]);

  function handleChangeDestinationQuery(nextQuery: string) {
    setDestinationQuery(nextQuery);
    setSelectedDestination(null);
    setRouteSummary(null);
    setRouteGeometry([]);
    if (nextQuery.trim().length < 3) {
      setDestinationSuggestions([]);
      setIsSearching(false);
    } else {
      setIsSearching(true);
    }
  }

  function handleSelectDestination(place: DriverRoutePlace) {
    setSelectedDestination(place);
    setDestinationQuery(place.label);
    setDestinationSuggestions([]);
    setRouteSummary(null);
    setRouteGeometry([]);
    setError('');
    setSuccessMessage('');
  }

  function handleDepartureStep(days: number) {
    const next = addDaysToInputDate(departureDate, days);
    if (next < todayInputValue) {
      return;
    }
    setDepartureDate(next);
    if (returnDate < next) {
      setReturnDate(next);
    }
  }

  function handleReturnStep(days: number) {
    const next = addDaysToInputDate(returnDate, days);
    if (next < departureDate) {
      return;
    }
    setReturnDate(next);
  }

  async function handleSubmitTrip() {
    setSuccessMessage('');

    if (!token) {
      setError('Entre novamente para registrar sua viagem.');
      return;
    }

    if (!originLocation) {
      setError('Permita a localização para registrar sua viagem.');
      return;
    }

    if (!selectedDestination) {
      setError('Selecione o destino da viagem.');
      return;
    }

    if (dateError) {
      setError(dateError);
      return;
    }

    if (!routeSummary || routeSummary.distanceKm <= 0) {
      setError('Aguarde o cálculo da rota para registrar sua viagem.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await createDriverTrip(token, {
        departure_date: departureDate,
        destination_label: selectedDestination.label,
        destination_latitude: selectedDestination.lat,
        destination_longitude: selectedDestination.lng,
        duration_seconds: routeSummary.durationSeconds * 2,
        origin_label: originLabel,
        origin_latitude: originLocation.coords.latitude,
        origin_longitude: originLocation.coords.longitude,
        outbound_distance_km: routeSummary.distanceKm,
        return_date: returnDate,
        return_distance_km: routeSummary.distanceKm,
        route_geometry: routeGeometry,
        total_distance_km: routeSummary.distanceKm * 2,
      });
      setSuccessMessage('Viagem registrada com sucesso.');
      setTimeout(() => router.replace('/dashboard'), 850);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar a viagem.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const routeCoords = routeGeometry.map((point) => ({ latitude: point.lat, longitude: point.lng }));
  const hasRoute = routeCoords.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityLabel="Voltar para o painel" onPress={() => router.replace('/dashboard')} style={styles.headerButton}>
            <Feather color="#071a36" name="arrow-left" size={22} />
          </Pressable>
          <Text style={styles.title}>Registrar nova viagem</Text>
          <Pressable accessibilityLabel="Fechar registro de viagem" onPress={() => router.replace('/dashboard')} style={styles.headerButton}>
            <Feather color="#071a36" name="x" size={22} />
          </Pressable>
        </View>

        <View style={styles.field}>
          <View style={styles.fieldIcon}>
            <Feather color="#071a36" name="navigation" size={18} />
          </View>
          <View style={styles.fieldCopy}>
            <Text style={styles.fieldSmall}>Local atual</Text>
            <Text style={styles.fieldStrong}>{isLocating ? 'Buscando sua localização...' : originLabel}</Text>
            <Text style={styles.fieldHint}>{originDetail}</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <View style={styles.field}>
            <View style={styles.fieldIcon}>
              <Feather color="#071a36" name="map-pin" size={18} />
            </View>
            <View style={styles.fieldCopy}>
              <Text style={styles.fieldSmall}>Destino da viagem</Text>
              <TextInput
                autoComplete="off"
                onChangeText={handleChangeDestinationQuery}
                placeholder="Digite o destino da viagem"
                placeholderTextColor="#9aabb8"
                style={styles.input}
                value={destinationQuery}
              />
            </View>
          </View>
          {isSearching ? <Text style={styles.searchStatus}>Buscando destinos...</Text> : null}
          {destinationSuggestions.length > 0 ? (
            <View style={styles.suggestions}>
              {destinationSuggestions.map((place) => (
                <Pressable key={place.id} onPress={() => handleSelectDestination(place)} style={styles.suggestionItem}>
                  <Feather color="#071a36" name="map-pin" size={16} />
                  <View style={styles.suggestionCopy}>
                    <Text style={styles.suggestionStrong}>{formatDriverRoutePlace(place)}</Text>
                    <Text style={styles.suggestionSmall}>{place.label}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.dateGrid}>
          <DateCard label="Data de ida" onStep={handleDepartureStep} value={departureDate} />
          <DateCard label="Data de retorno" onStep={handleReturnStep} value={returnDate} />
        </View>

        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={
            originLocation
              ? {
                  latitude: originLocation.coords.latitude,
                  longitude: originLocation.coords.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }
              : {
                  latitude: -15.7942,
                  longitude: -47.8822,
                  latitudeDelta: 0.1,
                  longitudeDelta: 0.1,
                }
          }
        >
          {originLocation ? (
            <Marker
              coordinate={{
                latitude: originLocation.coords.latitude,
                longitude: originLocation.coords.longitude,
              }}
              title="Origem"
            />
          ) : null}
          {selectedDestination ? (
            <Marker
              coordinate={{ latitude: selectedDestination.lat, longitude: selectedDestination.lng }}
              title="Destino"
              pinColor={SuwaveColors.yellow}
            />
          ) : null}
          {hasRoute ? <Polyline coordinates={routeCoords} strokeColor="#ffc61a" strokeWidth={4} /> : null}
        </MapView>

        <Text style={styles.sectionTitle}>Resumo da viagem</Text>
        <View style={styles.summaryGrid}>
          {summaryCards.map(([label, value, hint]) => (
            <View key={label} style={styles.summaryCard}>
              <Feather color="#071a36" name={label.includes('Duração') ? 'clock' : 'map'} size={18} />
              <Text style={styles.summarySmall}>{label}</Text>
              <Text style={styles.summaryValue}>{isRouting ? '...' : value}</Text>
              {hint ? <Text style={styles.summaryHint}>{hint}</Text> : null}
            </View>
          ))}
        </View>

        <View style={styles.infoRow}>
          <Feather color="#071a36" name="help-circle" size={18} />
          <Text style={styles.infoText}>
            {error || dateError || successMessage || (isRouting
              ? 'Calculando rota da viagem...'
              : selectedDestination
                ? 'Confira os dados e confirme para registrar sua viagem.'
                : 'Informe o destino para calcular a rota da viagem.')}
          </Text>
        </View>

        <ActionButton iconDirection="none" disabled={isRouting} loading={isSubmitting} onPress={handleSubmitTrip}>
          Registrar viagem
        </ActionButton>
      </ScrollView>
    </SafeAreaView>
  );
}

function DateCard({ label, value, onStep }: { label: string; value: string; onStep: (days: number) => void }) {
  return (
    <View style={styles.dateCard}>
      <View style={styles.dateCardHeader}>
        <Feather color="#071a36" name="calendar" size={16} />
        <Text style={styles.dateCardLabel}>{label}</Text>
      </View>
      <View style={styles.dateCardRow}>
        <Pressable accessibilityLabel="Dia anterior" onPress={() => onStep(-1)} style={styles.dateCardStep}>
          <Feather color="#071a36" name="chevron-left" size={18} />
        </Pressable>
        <Text style={styles.dateCardValue}>{formatISODateLabel(value)}</Text>
        <Pressable accessibilityLabel="Próximo dia" onPress={() => onStep(1)} style={styles.dateCardStep}>
          <Feather color="#071a36" name="chevron-right" size={18} />
        </Pressable>
      </View>
    </View>
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
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 2,
  },
  title: {
    flex: 1,
    fontSize: 19,
    fontWeight: '900',
    color: '#071a36',
    textAlign: 'center',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  fieldIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#eef2f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldCopy: {
    flex: 1,
    gap: 2,
  },
  fieldSmall: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9aabb8',
    textTransform: 'uppercase',
  },
  fieldStrong: {
    fontSize: 16,
    fontWeight: '900',
    color: '#071a36',
  },
  fieldHint: {
    fontSize: 12,
    color: '#667f90',
  },
  input: {
    fontSize: 16,
    fontWeight: '700',
    color: '#071a36',
    paddingVertical: 4,
  },
  searchWrap: {
    gap: 6,
  },
  searchStatus: {
    fontSize: 12,
    color: '#667f90',
    paddingHorizontal: 4,
  },
  suggestions: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f4f6',
  },
  suggestionCopy: {
    flex: 1,
    gap: 2,
  },
  suggestionStrong: {
    fontSize: 14,
    fontWeight: '800',
    color: '#071a36',
  },
  suggestionSmall: {
    fontSize: 12,
    color: '#667f90',
  },
  dateGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  dateCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  dateCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateCardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9aabb8',
    textTransform: 'uppercase',
  },
  dateCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateCardStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eef2f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCardValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#071a36',
  },
  map: {
    height: 160,
    borderRadius: 10,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#071a36',
    marginTop: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
    padding: 12,
    gap: 4,
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  summarySmall: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9aabb8',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#071a36',
  },
  summaryHint: {
    fontSize: 12,
    color: '#667f90',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#667f90',
  },
});
