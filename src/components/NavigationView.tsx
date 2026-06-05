import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { useGpsTracking } from '../hooks/useGpsTracking';
import { useRouteProgress } from '../hooks/useRouteProgress';
import {
  fetchDrivingRoute,
  hasMapboxAccessToken,
  searchDestinations,
} from '../services/routeService';
import {
  defaultNavigationSettings,
  type DestinationSearchResult,
  type RouteData,
  type RouteLoadingReason,
  type RoutePoint,
} from '../types/navigation.types';
import { RouteAssistantPanel } from './RouteAssistantPanel';
import { RouteMapView } from './RouteMapView';

interface NavigationViewProps {
  alertBanner: ReactNode;
  companionPanels: ReactNode;
  onCurveAlert: () => void;
}

const DEFAULT_DESTINATION: RoutePoint = {
  lat: 4.6486,
  lng: -74.2479,
};
const DEFAULT_DESTINATION_RESULT: DestinationSearchResult = {
  id: 'demo-destination',
  name: 'Destino demo',
  fullAddress: 'Punto de prueba al occidente de Bogota',
  point: DEFAULT_DESTINATION,
};
const DEMO_ORIGIN: RoutePoint = {
  lat: 4.711,
  lng: -74.0721,
};
const ARRIVAL_DISTANCE_METERS = 35;
const OFF_ROUTE_RECALCULATE_COOLDOWN_MS = 12_000;

function isValidCoordinate(point: RoutePoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

function getSecureContextWarning(): string | null {
  if (typeof window === 'undefined' || window.isSecureContext) {
    return null;
  }

  return 'GPS y camara requieren HTTPS fuera de localhost.';
}

function getManualDestination(point: RoutePoint): DestinationSearchResult {
  return {
    id: 'manual-destination',
    name: 'Destino manual',
    fullAddress: `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`,
    point,
  };
}

function getRouteStatusText({
  route,
  routeLoadingReason,
  routeProgress,
  selectedDestination,
  routeErrorMessage,
}: {
  route: RouteData | null;
  routeLoadingReason: RouteLoadingReason | null;
  routeProgress: ReturnType<typeof useRouteProgress>;
  selectedDestination: DestinationSearchResult | null;
  routeErrorMessage: string | null;
}): string {
  if (routeLoadingReason === 'destination') {
    return 'Buscando destino';
  }

  if (routeLoadingReason === 'reroute') {
    return 'Recalculando';
  }

  if (routeLoadingReason === 'route') {
    return 'Calculando ruta';
  }

  if (routeErrorMessage && !route) {
    return 'Error de ruta';
  }

  if (routeProgress.isOffRoute) {
    return 'Fuera de ruta';
  }

  if (
    route &&
    routeProgress.remainingMeters !== null &&
    routeProgress.remainingMeters <= ARRIVAL_DISTANCE_METERS
  ) {
    return 'Llegando';
  }

  if (route) {
    return 'Navegando';
  }

  if (selectedDestination) {
    return 'Destino listo';
  }

  return 'Sin destino';
}

export function NavigationView({
  alertBanner,
  companionPanels,
  onCurveAlert,
}: NavigationViewProps) {
  const gps = useGpsTracking();
  const [destinationDraft, setDestinationDraft] =
    useState<RoutePoint>(DEFAULT_DESTINATION);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationResults, setDestinationResults] = useState<
    DestinationSearchResult[]
  >([]);
  const [selectedDestination, setSelectedDestination] =
    useState<DestinationSearchResult | null>(DEFAULT_DESTINATION_RESULT);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeErrorMessage, setRouteErrorMessage] = useState<string | null>(null);
  const [routeLoadingReason, setRouteLoadingReason] =
    useState<RouteLoadingReason | null>(null);
  const lastCurveAlertRef = useRef<string | null>(null);
  const lastRerouteAtRef = useRef(0);
  const routeRequestIdRef = useRef(0);
  const routeProgress = useRouteProgress({
    gpsReading: gps.reading,
    route,
    settings: defaultNavigationSettings,
  });
  const mapboxReady = hasMapboxAccessToken();
  const secureContextWarning = getSecureContextWarning();
  const gpsMessage =
    gps.errorMessage ?? (gps.status === 'demo' ? null : secureContextWarning);
  const routeStatusText = getRouteStatusText({
    route,
    routeLoadingReason,
    routeProgress,
    selectedDestination,
    routeErrorMessage,
  });

  const calculateRouteForDestination = useCallback(async (
    nextDestination: DestinationSearchResult,
    loadingReason: RouteLoadingReason,
  ) => {
    if (!gps.reading) {
      setRouteErrorMessage(
        'No se pudo obtener la ubicacion actual. Inicia GPS o usa GPS demo.',
      );
      return;
    }

    if (!isValidCoordinate(nextDestination.point)) {
      setRouteErrorMessage('Destino invalido.');
      return;
    }

    const requestId = routeRequestIdRef.current + 1;

    routeRequestIdRef.current = requestId;
    setRouteLoadingReason(loadingReason);
    setRouteErrorMessage(null);

    try {
      const nextRoute = await fetchDrivingRoute({
        origin: gps.reading,
        destination: nextDestination.point,
      });

      if (routeRequestIdRef.current !== requestId) {
        return;
      }

      setSelectedDestination(nextDestination);
      setDestinationDraft(nextDestination.point);
      setDestinationResults([]);
      setRoute(nextRoute);
    } catch (error) {
      if (routeRequestIdRef.current !== requestId) {
        return;
      }

      if (loadingReason !== 'reroute') {
        setRoute(null);
      }

      setRouteErrorMessage(
        error instanceof Error ? error.message : 'No se pudo calcular la ruta.',
      );
    } finally {
      if (routeRequestIdRef.current === requestId) {
        setRouteLoadingReason(null);
      }
    }
  }, [gps.reading]);

  const handleDestinationSearch = useCallback(async () => {
    const cleanedQuery = destinationQuery.trim();

    if (!cleanedQuery) {
      setRouteErrorMessage('Escribe un destino para buscar.');
      return;
    }

    if (!gps.reading) {
      setRouteErrorMessage(
        'No se pudo obtener la ubicacion actual. Inicia GPS o usa GPS demo.',
      );
      return;
    }

    const requestId = routeRequestIdRef.current + 1;

    routeRequestIdRef.current = requestId;
    setRouteLoadingReason('destination');
    setRouteErrorMessage(null);

    try {
      const results = await searchDestinations({
        query: cleanedQuery,
        proximity: gps.reading,
      });

      if (routeRequestIdRef.current !== requestId) {
        return;
      }

      setDestinationResults(results);

      const firstResult = results[0];

      if (!firstResult) {
        setRoute(null);
        setSelectedDestination(null);
        setRouteErrorMessage('Destino no encontrado.');
        return;
      }

      setSelectedDestination(firstResult);
      setDestinationDraft(firstResult.point);
      setDestinationQuery(firstResult.fullAddress);
      await calculateRouteForDestination(firstResult, 'destination');
    } catch (error) {
      if (routeRequestIdRef.current !== requestId) {
        return;
      }

      setRoute(null);
      setRouteErrorMessage(
        error instanceof Error ? error.message : 'No se pudo buscar el destino.',
      );
    } finally {
      if (routeRequestIdRef.current === requestId) {
        setRouteLoadingReason(null);
      }
    }
  }, [calculateRouteForDestination, destinationQuery, gps.reading]);

  const handleDestinationSelect = useCallback(
    (nextDestination: DestinationSearchResult) => {
      setSelectedDestination(nextDestination);
      setDestinationDraft(nextDestination.point);
      setDestinationQuery(nextDestination.fullAddress);
      setDestinationResults([]);
      void calculateRouteForDestination(nextDestination, 'route');
    },
    [calculateRouteForDestination],
  );

  const handleDestinationPointChange = useCallback((nextDestination: RoutePoint) => {
    setDestinationDraft(nextDestination);
    setDestinationQuery('');
    setDestinationResults([]);
    setRoute(null);
    setRouteErrorMessage(null);
    setSelectedDestination(getManualDestination(nextDestination));
  }, []);

  const handleClearDestination = useCallback(() => {
    routeRequestIdRef.current += 1;
    setDestinationQuery('');
    setDestinationResults([]);
    setSelectedDestination(null);
    setRoute(null);
    setRouteErrorMessage(null);
    setRouteLoadingReason(null);
  }, []);

  const handleBuildRoute = useCallback(() => {
    if (selectedDestination) {
      void calculateRouteForDestination(selectedDestination, 'route');
      return;
    }

    const manualDestination = getManualDestination(destinationDraft);

    void calculateRouteForDestination(manualDestination, 'route');
  }, [calculateRouteForDestination, destinationDraft, selectedDestination]);

  useEffect(() => {
    if (
      !route ||
      !selectedDestination ||
      !gps.reading ||
      !routeProgress.isOffRoute ||
      routeLoadingReason !== null ||
      !mapboxReady
    ) {
      return;
    }

    const now = Date.now();

    if (now - lastRerouteAtRef.current < OFF_ROUTE_RECALCULATE_COOLDOWN_MS) {
      return;
    }

    lastRerouteAtRef.current = now;
    void calculateRouteForDestination(selectedDestination, 'reroute');
  }, [
    calculateRouteForDestination,
    gps.reading,
    mapboxReady,
    route,
    routeLoadingReason,
    routeProgress.isOffRoute,
    selectedDestination,
  ]);

  useEffect(() => {
    const curve = routeProgress.upcomingCurve;

    if (!curve) {
      lastCurveAlertRef.current = null;
      return;
    }

    const curveKey = `${curve.point.lat.toFixed(5)}:${curve.point.lng.toFixed(5)}:${
      curve.severity
    }`;

    if (lastCurveAlertRef.current === curveKey) {
      return;
    }

    lastCurveAlertRef.current = curveKey;
    onCurveAlert();
  }, [onCurveAlert, routeProgress.upcomingCurve]);

  return (
    <div className="min-w-0 flex-1 space-y-4">
      {alertBanner}
      <div className="relative min-h-screen overflow-hidden bg-zinc-950 shadow-2xl shadow-black/30 lg:min-h-[860px] lg:rounded-[1.75rem] lg:border lg:border-zinc-800">
        <RouteMapView
          route={route}
          gpsReading={gps.reading}
          destination={selectedDestination?.point ?? null}
          destinationLabel={selectedDestination?.name ?? null}
          progress={routeProgress}
          routeStatusText={routeStatusText}
          isRouteLoading={routeLoadingReason !== null}
        />
        <RouteAssistantPanel
          gpsStatus={gps.status}
          gpsQuality={gps.quality}
          gpsReading={gps.reading}
          gpsErrorMessage={gpsMessage}
          isGpsSupported={gps.isSupported}
          route={route}
          routeProgress={routeProgress}
          routeErrorMessage={routeErrorMessage}
          routeLoadingReason={routeLoadingReason}
          routeStatusText={routeStatusText}
          destinationQuery={destinationQuery}
          destinationDraft={destinationDraft}
          destinationResults={destinationResults}
          selectedDestination={selectedDestination}
          mapboxReady={mapboxReady}
          onDestinationQueryChange={setDestinationQuery}
          onDestinationPointChange={handleDestinationPointChange}
          onDestinationSearch={() => {
            void handleDestinationSearch();
          }}
          onDestinationSelect={handleDestinationSelect}
          onClearDestination={handleClearDestination}
          onStartGps={gps.startTracking}
          onStartDemoGps={() => {
            gps.startDemoTracking(DEMO_ORIGIN);
          }}
          onStopGps={gps.stopTracking}
          onBuildRoute={handleBuildRoute}
        />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">{companionPanels}</div>
    </div>
  );
}
