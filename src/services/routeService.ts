import type { RouteData, RoutePoint, RouteStep } from '../types/navigation.types';

interface MapboxManeuver {
  instruction?: string;
  type?: string;
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

export class RouteServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RouteServiceError';
  }
}

const MAPBOX_DIRECTIONS_URL =
  'https://api.mapbox.com/directions/v5/mapbox/driving';

function getMapboxAccessToken(): string {
  return import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? '';
}

function toRoutePoint([lng, lat]: [number, number]): RoutePoint {
  return {
    lat,
    lng,
  };
}

function toRouteStep(step: MapboxLegStep): RouteStep | null {
  const maneuver = step.maneuver;

  if (!maneuver?.location) {
    return null;
  }

  return {
    instruction: maneuver.instruction ?? 'Continua',
    distanceMeters: step.distance ?? 0,
    maneuverType: maneuver.type ?? 'continue',
    location: toRoutePoint(maneuver.location),
  };
}

export function hasMapboxAccessToken(): boolean {
  return getMapboxAccessToken().trim().length > 0;
}

export async function fetchDrivingRoute({
  origin,
  destination,
}: {
  origin: RoutePoint;
  destination: RoutePoint;
}): Promise<RouteData> {
  const accessToken = getMapboxAccessToken();

  if (!accessToken) {
    throw new RouteServiceError(
      'Configura VITE_MAPBOX_ACCESS_TOKEN para calcular rutas.',
    );
  }

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
