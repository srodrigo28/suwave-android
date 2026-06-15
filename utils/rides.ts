export type { DriverRideRequest } from '@/services/driver-client';

export function formatRideDistance(distance?: number | null) {
  if (distance == null) {
    return 'Distância não calculada';
  }
  if (distance < 1000) {
    return `${distance} m`;
  }
  return `${(distance / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatRideTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Agora';
  }
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const RIDE_FARE_PER_KM: Record<string, number> = {
  bike: 1.2,
  car: 2.8,
  moto: 2.0,
};

export function formatRideFare(distanceMeters?: number | null, vehicleType?: string | null) {
  if (!distanceMeters || distanceMeters <= 0) return null;
  const km = distanceMeters / 1000;
  const rate = RIDE_FARE_PER_KM[vehicleType ?? ''] ?? RIDE_FARE_PER_KM.car;
  return new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(km * rate);
}

export function formatDriverEta(distanceMeters?: number | null) {
  if (!distanceMeters || distanceMeters <= 0) return null;
  const mins = Math.max(1, Math.round((distanceMeters / 1000 / 40) * 60));
  return mins === 1 ? '~1 min' : `~${mins} min`;
}
