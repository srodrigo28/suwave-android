import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { DriverRideRequest } from '@/services/driver-client';
import { useDriverFlowStore } from '@/stores/driver-flow-store';

const demoRide: DriverRideRequest = {
  id: 'dev-map-demo',
  status: 'ACEITA',
  request_kind: 'delivery',
  requested_at: new Date().toISOString(),
  requested_seats: 1,
  vehicle_type: 'moto',
  passenger_name: 'Cliente demonstração',
  passenger_phone: '66999990000',
  origin_label: 'Av. das Figueiras, Centro, Sinop - MT',
  origin_latitude: -11.85894,
  origin_longitude: -55.5089,
  destination_label: 'Rua das Primaveras, Jardim das Palmeiras, Sinop - MT',
  destination_latitude: -11.85172,
  destination_longitude: -55.51816,
  distance_meters: 2300,
  duration_seconds: 540,
  gross_fare: 670,
  net_fare: 670,
  payment_method: 'dinheiro',
  route_geometry: [
    { lat: -11.85894, lng: -55.5089 },
    { lat: -11.85685, lng: -55.51161 },
    { lat: -11.85462, lng: -55.51421 },
    { lat: -11.85172, lng: -55.51816 },
  ],
};

export default function DevMapDemoScreen() {
  const setActiveRide = useDriverFlowStore((state) => state.setActiveRide);

  useEffect(() => {
    if (!__DEV__) {
      router.replace('/login');
      return;
    }
    setActiveRide(demoRide);
    router.replace('/ride-active');
  }, [setActiveRide]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#ffc400" size="large" />
      <Text style={styles.text}>Abrindo rota demonstrativa...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    gap: 16,
  },
  text: {
    color: '#073449',
    fontSize: 16,
    fontWeight: '700',
  },
});
