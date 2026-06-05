import type {
  DestinationSearchResult,
  RouteData,
  RoutePoint,
  RouteStep,
} from '../types/navigation.types';

interface MapboxManeuver {
  instruction?: string;
  type?: string;
  modifier?: string;
  location?: [number, number];
}

interface MapboxLegStep {
  distance?: number;
  maneuver?: MapboxManeuver;
}

interface MapboxLeg {
  steps?: MapboxLegStep[];
}

interface MapboxRoute {
  distance?: number;
  duration?: number;
  geometry?: {
    coordinates?: [number, number][];
  };
  legs?: MapboxLeg[];
}

interface MapboxDirectionsResponse {
  routes?: MapboxRoute[];
  message?: string;
}

interface MapboxGeocodingFeature {
  id?: string;
  text?: string;
  place_name?: string;
  center?: [number, number];
}

interface MapboxGeocodingResponse {
  features?: MapboxGeocodingFeature[];
  message?: string;
}

export class RouteServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RouteServiceError';
  }
}

const MAPBOX_DIRECTIONS_URL =
  'https://api.mapbox.com/directions/v5/mapbox/driving';
const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

function getMapboxAccessToken(): string {
  return (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? '').trim();
}

function toRoutePoint([lng, lat]: [number, number]): RoutePoint {
  return {
    lat,
    lng,
  };
}

function getFallbackInstruction(maneuver: MapboxManeuver | undefined): string {
  if (maneuver?.type === 'arrive') {
    return 'Llegaste al destino';
  }

  const modifierInstruction: Record<string, string> = {
    left: 'Gira a la izquierda',
    right: 'Gira a la derecha',
    straight: 'Continua recto',
    slight_left: 'Mantente ligeramente a la izquierda',
    slight_right: 'Mantente ligeramente a la derecha',
    sharp_left: 'Gira fuerte a la izquierda',
    sharp_right: 'Gira fuerte a la derecha',
    uturn: 'Haz un retorno',
  };

  return maneuver?.modifier
    ? modifierInstruction[maneuver.modifier] ?? 'Continua'
    : 'Continua';
}

function toRouteStep(step: MapboxLegStep): RouteStep | null {
  const maneuver = step.maneuver;

  if (!maneuver?.location) {
    return null;
  }

  return {
    instruction: maneuver.instruction ?? getFallbackInstruction(maneuver),
    distanceMeters: step.distance ?? 0,
    maneuverType: maneuver.type ?? 'continue',
    maneuverModifier: maneuver.modifier ?? null,
    location: toRoutePoint(maneuver.location),
  };
}

function toDestinationSearchResult(
  feature: MapboxGeocodingFeature,
  index: number,
): DestinationSearchResult | null {
  if (!feature.center) {
    return null;
  }

  const fallbackName = feature.place_name ?? `Destino ${index + 1}`;

  return {
    id: feature.id ?? `${fallbackName}-${index}`,
    name: feature.text ?? fallbackName,
    fullAddress: feature.place_name ?? fallbackName,
    point: toRoutePoint(feature.center),
  };
}

export function hasMapboxAccessToken(): boolean {
  const accessToken = getMapboxAccessToken();

  return accessToken.startsWith('pk.') || accessToken.startsWith('sk.');
}

function assertMapboxAccessToken(): string {
  const accessToken = getMapboxAccessToken();

  if (!hasMapboxAccessToken()) {
    throw new RouteServiceError(
      'Configura VITE_MAPBOX_ACCESS_TOKEN con un token Mapbox valido.',
    );
  }

  return accessToken;
}

export async function searchDestinations({
  query,
  proximity,
}: {
  query: string;
  proximity?: RoutePoint | null;
}): Promise<DestinationSearchResult[]> {
  const accessToken = assertMapboxAccessToken();
  const cleanedQuery = query.trim();

  if (!cleanedQuery) {
    throw new RouteServiceError('Escribe un destino para buscar.');
  }

  const url = new URL(
    `${MAPBOX_GEOCODING_URL}/${encodeURIComponent(cleanedQuery)}.json`,
  );
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('autocomplete', 'true');
  url.searchParams.set('language', 'es');
  url.searchParams.set('limit', '5');

  if (proximity) {
    url.searchParams.set('proximity', `${proximity.lng},${proximity.lat}`);
  }

  const response = await fetch(url);
  const data = (await response.json()) as MapboxGeocodingResponse;

  if (!response.ok) {
    throw new RouteServiceError(
      data.message ?? 'No se pudo buscar el destino con Mapbox.',
    );
  }

  return (
    data.features
      ?.map(toDestinationSearchResult)
      .filter((result): result is DestinationSearchResult => Boolean(result)) ?? []
  );
}

export async function fetchDrivingRoute({
  origin,
  destination,
}: {
  origin: RoutePoint;
  destination: RoutePoint;
}): Promise<RouteData> {
  const accessToken = assertMapboxAccessToken();

  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = new URL(`${MAPBOX_DIRECTIONS_URL}/${coordinates}`);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('steps', 'true');
  url.searchParams.set('language', 'es');

  const response = await fetch(url);
  const data = (await response.json()) as MapboxDirectionsResponse;

  if (!response.ok) {
    throw new RouteServiceError(
      data.message ?? 'No se pudo calcular la ruta con Mapbox.',
    );
  }

  const route = data.routes?.[0];
  const routeCoordinates = route?.geometry?.coordinates;

  if (!route || !routeCoordinates || routeCoordinates.length === 0) {
    throw new RouteServiceError('Mapbox no devolvio una ruta util.');
  }

  const steps =
    route.legs?.flatMap((leg) =>
      leg.steps?.map(toRouteStep).filter((step): step is RouteStep => Boolean(step)) ??
      [],
    ) ?? [];

  return {
    points: routeCoordinates.map(toRoutePoint),
    steps,
    distanceMeters: route.distance ?? 0,
    durationSeconds: route.duration ?? 0,
  };
}
