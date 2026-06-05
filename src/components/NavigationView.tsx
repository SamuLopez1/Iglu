import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { useGpsTracking } from '../hooks/useGpsTracking';
import { useRouteProgress } from '../hooks/useRouteProgress';
import { fetchDrivingRoute, hasMapboxAccessToken } from '../services/routeService';
import {
  defaultNavigationSettings,
  type RouteData,
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
const DEMO_ORIGIN: RoutePoint = {
  lat: 4.711,
  lng: -74.0721,
};

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

export function NavigationView({
  alertBanner,
  companionPanels,
  onCurveAlert,
}: NavigationViewProps) {
  const gps = useGpsTracking();
  const [destination, setDestination] = useState<RoutePoint>(DEFAULT_DESTINATION);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeErrorMessage, setRouteErrorMessage] = useState<string | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const lastCurveAlertRef = useRef<string | null>(null);
  const routeProgress = useRouteProgress({
    gpsReading: gps.reading,
    route,
    settings: defaultNavigationSettings,
  });
  const mapboxReady = hasMapboxAccessToken();
  const secureContextWarning = getSecureContextWarning();
  const gpsMessage =
    gps.errorMessage ?? (gps.status === 'demo' ? null : secureContextWarning);

  const handleBuildRoute = useCallback(async () => {
    if (!gps.reading) {
      setRouteErrorMessage('Inicia GPS antes de calcular la ruta.');
      return;
    }

    if (!isValidCoordinate(destination)) {
      setRouteErrorMessage('Destino invalido.');
      return;
    }

    setIsRouteLoading(true);
    setRouteErrorMessage(null);

    try {
      const nextRoute = await fetchDrivingRoute({
        origin: gps.reading,
        destination,
      });

      setRoute(nextRoute);
    } catch (error) {
      setRoute(null);
      setRouteErrorMessage(
        error instanceof Error ? error.message : 'No se pudo calcular la ruta.',
      );
    } finally {
      setIsRouteLoading(false);
    }
  }, [destination, gps.reading]);

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
    <div className="grid min-w-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-5">
      <div className="min-w-0 space-y-4">
        {alertBanner}
        <RouteMapView
          route={route}
          gpsReading={gps.reading}
          destination={destination}
          progress={routeProgress}
        />
      </div>

      <aside className="min-w-0 space-y-4">
        <RouteAssistantPanel
          gpsStatus={gps.status}
          gpsQuality={gps.quality}
          gpsReading={gps.reading}
          gpsErrorMessage={gpsMessage}
          isGpsSupported={gps.isSupported}
          route={route}
          routeProgress={routeProgress}
          routeErrorMessage={routeErrorMessage}
          isRouteLoading={isRouteLoading}
          destinationDraft={destination}
          mapboxReady={mapboxReady}
          onDestinationChange={setDestination}
          onStartGps={gps.startTracking}
          onStartDemoGps={() => {
            gps.startDemoTracking(DEMO_ORIGIN);
          }}
          onStopGps={gps.stopTracking}
          onBuildRoute={() => {
            void handleBuildRoute();
          }}
        />
        {companionPanels}
      </aside>
    </div>
  );
}
