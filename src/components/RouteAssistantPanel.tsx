import {
  AlertTriangle,
  Compass,
  Gauge,
  LocateFixed,
  MapPin,
  Navigation,
  Route,
} from 'lucide-react';

import type {
  GpsQuality,
  GpsReading,
  GpsTrackingStatus,
  RouteData,
  RoutePoint,
  RouteProgress,
} from '../types/navigation.types';
import { formatDistance, formatSpeed, getCurveLabel } from '../utils/routeGeometryUtils';

interface RouteAssistantPanelProps {
  gpsStatus: GpsTrackingStatus;
  gpsQuality: GpsQuality;
  gpsReading: GpsReading | null;
  gpsErrorMessage: string | null;
  isGpsSupported: boolean;
  route: RouteData | null;
  routeProgress: RouteProgress;
  routeErrorMessage: string | null;
  isRouteLoading: boolean;
  destinationDraft: RoutePoint;
  mapboxReady: boolean;
  onDestinationChange: (destination: RoutePoint) => void;
  onStartGps: () => void;
  onStartDemoGps: () => void;
  onStopGps: () => void;
  onBuildRoute: () => void;
}

const gpsQualityLabels: Record<GpsQuality, string> = {
  good: 'GPS bueno',
  weak: 'GPS debil',
  unavailable: 'GPS no disponible',
};

const gpsQualityClassNames: Record<GpsQuality, string> = {
  good: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100',
  weak: 'border-amber-300/35 bg-amber-400/10 text-amber-100',
  unavailable: 'border-zinc-700 bg-zinc-800 text-zinc-300',
};

function getGpsQualityLabel(
  gpsQuality: GpsQuality,
  gpsStatus: GpsTrackingStatus,
): string {
  if (gpsStatus === 'demo') {
    return 'GPS demo';
  }

  return gpsQualityLabels[gpsQuality];
}

function getGpsQualityClassName(
  gpsQuality: GpsQuality,
  gpsStatus: GpsTrackingStatus,
): string {
  if (gpsStatus === 'demo') {
    return 'border-sky-300/30 bg-sky-400/10 text-sky-100';
  }

  return gpsQualityClassNames[gpsQuality];
}

function getHeadingLabel(headingDegrees: number | null): string {
  if (headingDegrees === null || Number.isNaN(headingDegrees)) {
    return '--';
  }

  return `${Math.round(headingDegrees)}°`;
}

function getAccuracyLabel(gpsReading: GpsReading | null): string {
  if (!gpsReading?.accuracyMeters && gpsReading?.accuracyMeters !== 0) {
    return '--';
  }

  return `${Math.round(gpsReading.accuracyMeters)} m`;
}

function getGpsButtonLabel(gpsStatus: RouteAssistantPanelProps['gpsStatus']): string {
  if (gpsStatus === 'requesting') {
    return 'Solicitando GPS';
  }

  if (gpsStatus === 'tracking') {
    return 'Detener GPS';
  }

  if (gpsStatus === 'demo') {
    return 'Detener demo';
  }

  return 'Iniciar GPS';
}

function getRouteStatusText({
  route,
  mapboxReady,
}: {
  route: RouteData | null;
  mapboxReady: boolean;
}): string {
  if (route) {
    return 'Ruta calculada';
  }

  if (!mapboxReady) {
    return 'Token Mapbox pendiente';
  }

  return 'Sin ruta activa';
}

export function RouteAssistantPanel({
  gpsStatus,
  gpsQuality,
  gpsReading,
  gpsErrorMessage,
  isGpsSupported,
  route,
  routeProgress,
  routeErrorMessage,
  isRouteLoading,
  destinationDraft,
  mapboxReady,
  onDestinationChange,
  onStartGps,
  onStartDemoGps,
  onStopGps,
  onBuildRoute,
}: RouteAssistantPanelProps) {
  const isGpsTracking =
    gpsStatus === 'tracking' || gpsStatus === 'requesting' || gpsStatus === 'demo';
  const hasCurve = Boolean(routeProgress.upcomingCurve);

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/95">
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Asistente GPS</h2>
          <span
            className={`rounded-md border px-2 py-1 text-[11px] font-medium ${getGpsQualityClassName(
              gpsQuality,
              gpsStatus,
            )}`}
          >
            {getGpsQualityLabel(gpsQuality, gpsStatus)}
          </span>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="flex items-center gap-2 text-zinc-400">
              <Gauge className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              <p className="text-xs">Velocidad</p>
            </div>
            <p className="mt-2 text-xl font-semibold text-white">
              {formatSpeed(routeProgress.speedKph ?? gpsReading?.speedKph ?? null)}
            </p>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="flex items-center gap-2 text-zinc-400">
              <Compass className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              <p className="text-xs">Rumbo</p>
            </div>
            <p className="mt-2 text-xl font-semibold text-white">
              {getHeadingLabel(
                routeProgress.headingDegrees ?? gpsReading?.headingDegrees ?? null,
              )}
            </p>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="flex items-center gap-2 text-zinc-400">
              <LocateFixed className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              <p className="text-xs">Precision</p>
            </div>
            <p className="mt-2 text-xl font-semibold text-white">
              {getAccuracyLabel(gpsReading)}
            </p>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="flex items-center gap-2 text-zinc-400">
              <Route className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              <p className="text-xs">Restante</p>
            </div>
            <p className="mt-2 text-xl font-semibold text-white">
              {formatDistance(routeProgress.remainingMeters)}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={isGpsTracking ? onStopGps : onStartGps}
            disabled={
              (gpsStatus !== 'demo' && !isGpsSupported) || gpsStatus === 'requesting'
            }
          >
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            {getGpsButtonLabel(gpsStatus)}
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-sky-300/25 bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onStartDemoGps}
            disabled={gpsStatus === 'requesting' || gpsStatus === 'demo'}
          >
            <MapPin className="h-4 w-4" aria-hidden="true" />
            GPS demo
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onBuildRoute}
            disabled={isRouteLoading}
          >
            <Navigation className="h-4 w-4" aria-hidden="true" />
            {isRouteLoading ? 'Calculando' : 'Calcular ruta'}
          </button>
        </div>

        <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-zinc-300">
              <MapPin className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-white">Destino</p>
            </div>
            <span className="text-xs text-zinc-500">
              {getRouteStatusText({ route, mapboxReady })}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="min-w-0 text-xs text-zinc-400">
              Lat
              <input
                className="mt-1 min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300"
                inputMode="decimal"
                type="number"
                step="0.000001"
                value={destinationDraft.lat}
                onChange={(event) => {
                  onDestinationChange({
                    ...destinationDraft,
                    lat: Number(event.target.value),
                  });
                }}
              />
            </label>
            <label className="min-w-0 text-xs text-zinc-400">
              Lng
              <input
                className="mt-1 min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300"
                inputMode="decimal"
                type="number"
                step="0.000001"
                value={destinationDraft.lng}
                onChange={(event) => {
                  onDestinationChange({
                    ...destinationDraft,
                    lng: Number(event.target.value),
                  });
                }}
              />
            </label>
          </div>
        </div>

        <div
          className={`rounded-md border p-3 ${
            hasCurve
              ? 'border-amber-300/35 bg-amber-400/10 text-amber-100'
              : 'border-zinc-800 bg-zinc-950/60 text-zinc-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`h-4 w-4 ${hasCurve ? 'text-amber-200' : 'text-zinc-500'}`}
              aria-hidden="true"
            />
            <p className="text-sm font-semibold">
              {getCurveLabel(routeProgress.upcomingCurve)}
            </p>
          </div>
          <p className="mt-2 text-xs leading-5 opacity-85">
            {routeProgress.upcomingCurve
              ? `${formatDistance(
                  routeProgress.upcomingCurve.distanceMeters,
                )} · ${Math.round(routeProgress.upcomingCurve.angleDegrees)}°`
              : routeProgress.isOffRoute
                ? 'Fuera de ruta'
                : 'Trayecto estable'}
          </p>
        </div>

        <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
            Proximo giro
          </p>
          <p className="mt-2 text-sm leading-5 text-zinc-100">
            {routeProgress.nextStep?.instruction ?? 'Sin instruccion activa'}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            {formatDistance(routeProgress.distanceToNextStepMeters)}
          </p>
        </div>

        {(gpsErrorMessage || routeErrorMessage || !isGpsSupported) && (
          <div className="rounded-md border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-100">
            {gpsErrorMessage ??
              routeErrorMessage ??
              'Geolocalizacion no soportada en este navegador.'}
          </div>
        )}
      </div>
    </section>
  );
}
