import {
  AlertTriangle,
  Compass,
  Gauge,
  LocateFixed,
  MapPin,
  Navigation,
  Route,
  Search,
  Timer,
  X,
} from 'lucide-react';

import type {
  DestinationSearchResult,
  GpsQuality,
  GpsReading,
  GpsTrackingStatus,
  RouteData,
  RouteLoadingReason,
  RoutePoint,
  RouteProgress,
} from '../types/navigation.types';
import {
  formatDistance,
  formatDuration,
  formatEtaFromNow,
  formatSpeed,
  getCurveLabel,
  getEstimatedRemainingDurationSeconds,
} from '../utils/routeGeometryUtils';

interface RouteAssistantPanelProps {
  gpsStatus: GpsTrackingStatus;
  gpsQuality: GpsQuality;
  gpsReading: GpsReading | null;
  gpsErrorMessage: string | null;
  isGpsSupported: boolean;
  route: RouteData | null;
  routeProgress: RouteProgress;
  routeErrorMessage: string | null;
  routeLoadingReason: RouteLoadingReason | null;
  routeStatusText: string;
  destinationQuery: string;
  destinationDraft: RoutePoint;
  destinationResults: DestinationSearchResult[];
  selectedDestination: DestinationSearchResult | null;
  mapboxReady: boolean;
  onDestinationQueryChange: (query: string) => void;
  onDestinationPointChange: (destination: RoutePoint) => void;
  onDestinationSearch: () => void;
  onDestinationSelect: (destination: DestinationSearchResult) => void;
  onClearDestination: () => void;
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
    return 'GPS';
  }

  if (gpsStatus === 'tracking' || gpsStatus === 'demo') {
    return 'Detener';
  }

  return 'GPS';
}

function getRouteButtonLabel(routeLoadingReason: RouteLoadingReason | null): string {
  if (routeLoadingReason === 'destination') {
    return 'Buscando';
  }

  if (routeLoadingReason === 'reroute') {
    return 'Recalculando';
  }

  if (routeLoadingReason === 'route') {
    return 'Calculando';
  }

  return 'Ruta';
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
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
  routeLoadingReason,
  routeStatusText,
  destinationQuery,
  destinationDraft,
  destinationResults,
  selectedDestination,
  mapboxReady,
  onDestinationQueryChange,
  onDestinationPointChange,
  onDestinationSearch,
  onDestinationSelect,
  onClearDestination,
  onStartGps,
  onStartDemoGps,
  onStopGps,
  onBuildRoute,
}: RouteAssistantPanelProps) {
  const isGpsTracking =
    gpsStatus === 'tracking' || gpsStatus === 'requesting' || gpsStatus === 'demo';
  const isRouteLoading = routeLoadingReason !== null;
  const remainingMeters = routeProgress.remainingMeters ?? route?.distanceMeters ?? null;
  const remainingDurationSeconds = getEstimatedRemainingDurationSeconds(
    route,
    routeProgress.remainingMeters,
  );
  const hasDestinationQuery = destinationQuery.trim().length > 0;
  const canSearchDestination = mapboxReady && hasDestinationQuery && !isRouteLoading;
  const canBuildRoute = mapboxReady && !isRouteLoading && Boolean(selectedDestination);
  const nextInstruction =
    routeProgress.nextStep?.instruction ??
    (route ? 'Continua por la ruta' : 'Sin instruccion activa');
  const errorMessage =
    gpsErrorMessage ??
    routeErrorMessage ??
    (!isGpsSupported ? 'Geolocalizacion no soportada en este navegador.' : null);

  return (
    <section className="absolute inset-x-0 bottom-0 z-30 rounded-t-[1.35rem] bg-white px-4 pb-4 pt-3 text-zinc-950 shadow-2xl shadow-black/25 sm:left-1/2 sm:w-[min(720px,calc(100%-2rem))] sm:-translate-x-1/2 sm:px-6">
      <div className="mx-auto mb-3 h-1.5 w-20 rounded-full bg-zinc-300" />

      {destinationResults.length > 0 && (
        <div className="absolute bottom-[calc(100%-0.75rem)] left-4 right-4 overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/20 ring-1 ring-zinc-200 sm:left-6 sm:right-6">
          {destinationResults.map((result) => (
            <button
              key={result.id}
              className="block min-h-14 w-full border-b border-zinc-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-zinc-50 disabled:opacity-60"
              type="button"
              disabled={isRouteLoading}
              onClick={() => {
                onDestinationSelect(result);
              }}
            >
              <span className="block truncate text-sm font-bold text-zinc-950">
                {result.name}
              </span>
              <span className="mt-1 block truncate text-xs text-zinc-500">
                {result.fullAddress}
              </span>
            </button>
          ))}
        </div>
      )}

      <form
        className="grid grid-cols-[1fr_auto] gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onDestinationSearch();
        }}
      >
        <label className="min-w-0">
          <span className="sr-only">Buscar destino</span>
          <div className="flex min-h-12 items-center rounded-full bg-zinc-100 px-4 ring-1 ring-zinc-200 focus-within:ring-cyan-400">
            <Search className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
            <input
              className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-zinc-950 outline-none placeholder:text-zinc-500"
              type="search"
              placeholder="¿A dónde vamos?"
              value={destinationQuery}
              onChange={(event) => {
                onDestinationQueryChange(event.target.value);
              }}
            />
            {(destinationQuery || selectedDestination || route) && (
              <button
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900"
                type="button"
                aria-label="Limpiar destino"
                onClick={onClearDestination}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </label>
        <button
          className="inline-flex h-12 min-w-12 items-center justify-center rounded-full bg-cyan-400 px-4 font-bold text-zinc-950 shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={!canSearchDestination}
        >
          <Navigation className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>

      <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <button
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200"
          type="button"
          aria-label="Buscar destino"
          disabled={!canSearchDestination}
          onClick={onDestinationSearch}
        >
          <Search className="h-6 w-6" aria-hidden="true" />
        </button>

        <div className="min-w-0 text-center">
          <p className="text-4xl font-black leading-none tracking-normal">
            {formatEtaFromNow(remainingDurationSeconds)}
          </p>
          <p className="mt-1 truncate text-base font-bold text-zinc-700">
            {formatDuration(remainingDurationSeconds)} · {formatDistance(remainingMeters)}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-zinc-500">
            {selectedDestination?.name ?? routeStatusText}
          </p>
        </div>

        <button
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          aria-label="Calcular ruta"
          disabled={!canBuildRoute}
          onClick={onBuildRoute}
        >
          <Route className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2 text-center text-[11px] font-bold text-zinc-600">
        <div className="min-w-0 rounded-2xl bg-zinc-100 px-2 py-2">
          <Gauge className="mx-auto h-4 w-4 text-cyan-600" aria-hidden="true" />
          <p className="mt-1 truncate">{formatSpeed(routeProgress.speedKph ?? gpsReading?.speedKph ?? null)}</p>
        </div>
        <div className="min-w-0 rounded-2xl bg-zinc-100 px-2 py-2">
          <Compass className="mx-auto h-4 w-4 text-cyan-600" aria-hidden="true" />
          <p className="mt-1 truncate">
            {getHeadingLabel(routeProgress.headingDegrees ?? gpsReading?.headingDegrees ?? null)}
          </p>
        </div>
        <div className="min-w-0 rounded-2xl bg-zinc-100 px-2 py-2">
          <LocateFixed className="mx-auto h-4 w-4 text-cyan-600" aria-hidden="true" />
          <p className="mt-1 truncate">{getAccuracyLabel(gpsReading)}</p>
        </div>
        <div className="min-w-0 rounded-2xl bg-zinc-100 px-2 py-2">
          <Timer className="mx-auto h-4 w-4 text-cyan-600" aria-hidden="true" />
          <p className="mt-1 truncate">{formatDistance(routeProgress.distanceToNextStepMeters)}</p>
        </div>
        <div className="min-w-0 rounded-2xl bg-zinc-100 px-2 py-2">
          <AlertTriangle
            className={`mx-auto h-4 w-4 ${
              routeProgress.upcomingCurve ? 'text-amber-500' : 'text-cyan-600'
            }`}
            aria-hidden="true"
          />
          <p className="mt-1 truncate">
            {routeProgress.upcomingCurve ? getCurveLabel(routeProgress.upcomingCurve) : gpsQualityLabels[gpsQuality]}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-zinc-950 px-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-zinc-100 px-3 text-sm font-bold text-zinc-800 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={onStartDemoGps}
          disabled={gpsStatus === 'requesting' || gpsStatus === 'demo'}
        >
          <MapPin className="h-4 w-4" aria-hidden="true" />
          Demo
        </button>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-violet-600 px-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={onBuildRoute}
          disabled={!canBuildRoute}
        >
          <Navigation className="h-4 w-4" aria-hidden="true" />
          {getRouteButtonLabel(routeLoadingReason)}
        </button>
      </div>

      <details className="mt-3 rounded-2xl bg-zinc-100 px-4 py-3 text-xs text-zinc-600">
        <summary className="cursor-pointer font-bold text-zinc-800">
          {nextInstruction}
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="min-w-0">
            Lat
            <input
              className="mt-1 min-h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-950 outline-none transition focus:border-cyan-400"
              inputMode="decimal"
              type="number"
              step="0.000001"
              value={destinationDraft.lat}
              onChange={(event) => {
                onDestinationPointChange({
                  ...destinationDraft,
                  lat: Number(event.target.value),
                });
              }}
            />
          </label>
          <label className="min-w-0">
            Lng
            <input
              className="mt-1 min-h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-950 outline-none transition focus:border-cyan-400"
              inputMode="decimal"
              type="number"
              step="0.000001"
              value={destinationDraft.lng}
              onChange={(event) => {
                onDestinationPointChange({
                  ...destinationDraft,
                  lng: Number(event.target.value),
                });
              }}
            />
          </label>
        </div>
        <p className="mt-2">
          {formatCoordinate(destinationDraft.lat)}, {formatCoordinate(destinationDraft.lng)}
        </p>
      </details>

      {errorMessage && (
        <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-semibold leading-5 text-rose-700 ring-1 ring-rose-200">
          {errorMessage}
        </div>
      )}
    </section>
  );
}
