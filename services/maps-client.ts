/**
 * Cliente de mapas para `app/android`, equivalente as rotas
 * `app/motorista/src/app/api/maps/*`, porem chamando a Google Maps
 * Platform (Places, Directions, Geocoding) diretamente do dispositivo
 * com `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (sem proxy via Next.js).
 */

export type RouteCoordinate = {
  lat: number;
  lng: number;
};

export type DriverMapLocation = {
  latitude: number;
  longitude: number;
  accuracy_meters?: number | null;
};

export type DriverMapPlace = {
  label: string | null;
  locality: string | null;
  region: string | null;
  provider: string;
};

export type DriverRoutePlace = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  locality?: string;
  region?: string;
};

export type DriverRouteSummary = {
  distanceKm: number;
  distanceLabel: string;
  durationLabel: string;
  durationSeconds: number;
  geometry: RouteCoordinate[];
  provider: string;
  steps: DriverRouteStep[];
};

export type DriverRouteStep = {
  distanceMeters: number;
  distanceLabel: string;
  durationSeconds: number;
  durationLabel: string;
  instruction: string;
  maneuver?: string | null;
  streetName?: string | null;
  geometry: RouteCoordinate[];
  startLocation?: RouteCoordinate | null;
  endLocation?: RouteCoordinate | null;
};

type GoogleNearestRoadsResponse = {
  snappedPoints?: Array<{
    location?: {
      latitude?: number;
      longitude?: number;
    };
  }>;
};

const BRAZIL_BOUNDS = {
  east: -28.8,
  north: 5.3,
  south: -33.8,
  west: -73.9,
};

function isInsideBrazilBounds(point: RouteCoordinate) {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat <= BRAZIL_BOUNDS.north &&
    point.lat >= BRAZIL_BOUNDS.south &&
    point.lng <= BRAZIL_BOUNDS.east &&
    point.lng >= BRAZIL_BOUNDS.west
  );
}

function formatDuration(seconds: number) {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
}

function decodePolyline(encoded: string): RouteCoordinate[] {
  const points: RouteCoordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

function getApiKey() {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('Chave do Google Maps não configurada.');
  }

  return apiKey;
}

type GooglePlaceResult = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
};

type GooglePlacesResponse = {
  status?: string;
  results?: GooglePlaceResult[];
};

type GeocodeAddressComponent = {
  long_name?: string;
  types?: string[];
};

type GeocodeResult = {
  formatted_address?: string;
  address_components?: GeocodeAddressComponent[];
};

type GeocodeResponse = {
  status?: string;
  results?: GeocodeResult[];
};

type GoogleDirectionsResponse = {
  error_message?: string;
  status?: string;
  routes?: {
    overview_polyline?: { points?: string };
    legs?: {
      distance?: { text?: string; value?: number };
      duration?: { text?: string; value?: number };
      steps?: {
        distance?: { text?: string; value?: number };
        duration?: { text?: string; value?: number };
        end_location?: { lat?: number; lng?: number };
        html_instructions?: string;
        maneuver?: string;
        polyline?: { points?: string };
        start_location?: { lat?: number; lng?: number };
      }[];
    }[];
  }[];
};

const ROUTE_REQUEST_TIMEOUT_MS = 25000;

function findComponent(components: GeocodeAddressComponent[], type: string) {
  return components.find((component) => component.types?.includes(type))?.long_name;
}

function stripHtml(value?: string) {
  return (value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractStreetName(instruction: string) {
  const match = instruction.match(/\b(?:na|no|para|pela|pelo)\s+(.+)$/i);
  return match?.[1]?.replace(/[.,;:]$/, '').trim() ?? null;
}

function normalizePoint(point?: { lat?: number; lng?: number }): RouteCoordinate | null {
  if (typeof point?.lat !== 'number' || typeof point.lng !== 'number') {
    return null;
  }
  return { lat: point.lat, lng: point.lng };
}

export async function fetchDriverMapPlace(location: DriverMapLocation): Promise<DriverMapPlace> {
  const apiKey = getApiKey();
  const providerUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  providerUrl.searchParams.set('latlng', `${location.latitude},${location.longitude}`);
  providerUrl.searchParams.set('language', 'pt-BR');
  providerUrl.searchParams.set('result_type', 'street_address|route|premise|locality');
  providerUrl.searchParams.set('key', apiKey);

  const response = await fetch(providerUrl.toString());

  if (!response.ok) {
    throw new Error('Não foi possível consultar o mapa agora.');
  }

  const data = (await response.json()) as GeocodeResponse;
  const result = data.results?.[0];
  const components = result?.address_components ?? [];

  return {
    label: result?.formatted_address ?? null,
    locality:
      findComponent(components, 'administrative_area_level_2') ??
      findComponent(components, 'locality') ??
      null,
    provider: 'google-geocoding',
    region: findComponent(components, 'administrative_area_level_1') ?? null,
  };
}

export async function searchDriverRoutePlaces(
  query: string,
  origin?: RouteCoordinate,
): Promise<DriverRoutePlace[]> {
  const apiKey = getApiKey();
  const providerUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  providerUrl.searchParams.set('query', query);
  providerUrl.searchParams.set('region', 'br');
  providerUrl.searchParams.set('language', 'pt-BR');
  providerUrl.searchParams.set('key', apiKey);

  if (origin) {
    providerUrl.searchParams.set('location', `${origin.lat},${origin.lng}`);
    providerUrl.searchParams.set('radius', '50000');
  }

  const response = await fetch(providerUrl.toString());

  if (!response.ok) {
    throw new Error('Não foi possível buscar destinos agora.');
  }

  const data = (await response.json()) as GooglePlacesResponse;

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error('Não foi possível buscar destinos agora.');
  }

  return (data.results ?? [])
    .slice(0, 6)
    .map((result, index): DriverRoutePlace | null => {
      const point = {
        lat: Number(result.geometry?.location?.lat),
        lng: Number(result.geometry?.location?.lng),
      };

      if (!isInsideBrazilBounds(point)) {
        return null;
      }

      return {
        id: result.place_id ?? `${point.lat},${point.lng},${index}`,
        label: result.formatted_address ?? result.name ?? query,
        lat: point.lat,
        lng: point.lng,
      };
    })
    .filter((place): place is DriverRoutePlace => place !== null);
}

const WEB_ROUTE_PROXY = 'https://suwave.vercel.app/api/maps/route';

type WebRouteProxyResponse = {
  distanceKm?: number;
  distanceLabel?: string;
  durationLabel?: string;
  durationSeconds?: number;
  geometry?: RouteCoordinate[];
  steps?: DriverRouteStep[];
};

async function fetchRouteViaProxy(
  origin: RouteCoordinate,
  destination: RouteCoordinate,
): Promise<DriverRouteSummary> {
  const response = await fetch(WEB_ROUTE_PROXY, {
    body: JSON.stringify({ origin, destination }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw new Error('Proxy de rota indisponível.');
  const data = (await response.json()) as WebRouteProxyResponse;
  if (!data.geometry?.length || !data.distanceKm) throw new Error('Rota vazia.');
  return {
    distanceKm: data.distanceKm,
    distanceLabel: data.distanceLabel ?? `${data.distanceKm} km`,
    durationLabel: data.durationLabel ?? '—',
    durationSeconds: data.durationSeconds ?? 0,
    geometry: data.geometry,
    provider: 'web-proxy',
    steps: data.steps ?? [],
  };
}

export async function fetchDriverRoute(
  origin: RouteCoordinate,
  destination: RouteCoordinate,
): Promise<DriverRouteSummary> {
  if (!isInsideBrazilBounds(origin) || !isInsideBrazilBounds(destination)) {
    throw new Error('A rota precisa ter origem e destino no Brasil.');
  }

  // Proxy via servidor web (confiavel); fallback para Google direto
  try {
    return await fetchRouteViaProxy(origin, destination);
  } catch {
    return await fetchDriverRouteGoogle(origin, destination);
  }
}

async function fetchDriverRouteGoogle(
  origin: RouteCoordinate,
  destination: RouteCoordinate,
): Promise<DriverRouteSummary> {
  const apiKey = getApiKey();
  const providerUrl = new URL('https://maps.googleapis.com/maps/api/directions/json');
  providerUrl.searchParams.set('origin', `${origin.lat},${origin.lng}`);
  providerUrl.searchParams.set('destination', `${destination.lat},${destination.lng}`);
  providerUrl.searchParams.set('mode', 'driving');
  providerUrl.searchParams.set('language', 'pt-BR');
  providerUrl.searchParams.set('region', 'br');
  providerUrl.searchParams.set('key', apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROUTE_REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(providerUrl.toString(), { signal: controller.signal });
  } catch (error) {
    clearTimeout(timeout);
    if ((error as Error).name === 'AbortError') {
      throw new Error('Timeout Google Directions.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Não foi possível calcular a rota agora. HTTP ${response.status}.`);
  }

  const data = (await response.json()) as GoogleDirectionsResponse;
  const route = data.routes?.[0];
  const points = route?.overview_polyline?.points;

  if (data.status !== 'OK' || !route || !points) {
    const details = [data.status, data.error_message].filter(Boolean).join(' - ');
    throw new Error(details ? `Não foi possível calcular a rota agora. ${details}` : 'Não foi possível calcular a rota agora.');
  }

  const distanceMeters = route.legs?.reduce((total, leg) => total + (leg.distance?.value ?? 0), 0) ?? 0;
  const durationSeconds = route.legs?.reduce((total, leg) => total + (leg.duration?.value ?? 0), 0) ?? 0;
  const steps = (route.legs ?? []).flatMap((leg) => (leg.steps ?? []).map((step): DriverRouteStep => {
    const instruction = stripHtml(step.html_instructions);
    const stepDistanceMeters = step.distance?.value ?? 0;
    const stepDurationSeconds = step.duration?.value ?? 0;

    return {
      distanceLabel: step.distance?.text ?? `${Math.round(stepDistanceMeters)} m`,
      distanceMeters: stepDistanceMeters,
      durationLabel: step.duration?.text ?? formatDuration(stepDurationSeconds),
      durationSeconds: stepDurationSeconds,
      endLocation: normalizePoint(step.end_location),
      geometry: step.polyline?.points ? decodePolyline(step.polyline.points) : [],
      instruction: instruction || 'Siga em frente',
      maneuver: step.maneuver ?? null,
      startLocation: normalizePoint(step.start_location),
      streetName: extractStreetName(instruction),
    };
  }));

  if (!distanceMeters || !durationSeconds) {
    throw new Error('Não foi possível calcular a rota agora.');
  }

  const distanceKm = Number((distanceMeters / 1000).toFixed(1));

  return {
    distanceKm,
    distanceLabel: `${distanceKm.toLocaleString('pt-BR')} km`,
    durationLabel: formatDuration(durationSeconds),
    durationSeconds: Math.round(durationSeconds),
    geometry: decodePolyline(points),
    provider: 'google-directions',
    steps,
  };
}

export async function snapDriverLocationToRoad(point: RouteCoordinate): Promise<RouteCoordinate | null> {
  if (!isInsideBrazilBounds(point)) {
    return null;
  }

  const apiKey = getApiKey();
  const providerUrl = new URL('https://roads.googleapis.com/v1/nearestRoads');
  providerUrl.searchParams.set('points', `${point.lat},${point.lng}`);
  providerUrl.searchParams.set('key', apiKey);

  const response = await fetch(providerUrl.toString());

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as GoogleNearestRoadsResponse;
  const snappedPoint = data.snappedPoints?.[0]?.location;

  if (
    typeof snappedPoint?.latitude !== 'number'
    || typeof snappedPoint?.longitude !== 'number'
  ) {
    return null;
  }

  const normalized = { lat: snappedPoint.latitude, lng: snappedPoint.longitude };
  return isInsideBrazilBounds(normalized) ? normalized : null;
}

export function formatDriverMapPlace(place: DriverMapPlace | null) {
  if (!place) {
    return 'Brasil';
  }

  if (place.locality && place.region) {
    return `${place.locality}, ${place.region}`;
  }

  return place.label ?? place.locality ?? place.region ?? 'Brasil';
}

export function formatDriverRoutePlace(place: DriverRoutePlace) {
  if (place.locality && place.region) {
    return `${place.locality}, ${place.region}`;
  }

  return place.label;
}
