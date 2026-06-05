import maplibregl, {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type LngLatLike,
  type Map as MapLibreMap,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  GpsReading,
  RouteData,
  RoutePoint,
  RouteProgress,
} from '../types/navigation.types';
import {
  AlertTriangle,
  Gauge,
  Navigation2,
  Volume2,
} from 'lucide-react';
import {
  formatDistance,
  formatDuration,
  formatEtaFromNow,
  formatSpeed,
  getEstimatedRemainingDurationSeconds,
} from '../utils/routeGeometryUtils';

interface RouteMapViewProps {
  route: RouteData | null;
  gpsReading: GpsReading | null;
  destination: RoutePoint | null;
  destinationLabel: string | null;
  progress: RouteProgress;
  routeStatusText: string;
  isRouteLoading: boolean;
}

const DEFAULT_CENTER: RoutePoint = {
  lat: 4.711,
  lng: -74.0721,
};
const PREVIEW_WIDTH = 1000;
const PREVIEW_HEIGHT = 700;
const PREVIEW_PADDING = 96;

const rasterMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: 'OpenStreetMap, CARTO',
    },
  },
  layers: [
    {
      id: 'carto',
      type: 'raster',
      source: 'carto',
      paint: {
        'raster-saturation': -0.15,
        'raster-contrast': 0.08,
      },
    },
  ],
};

function toLngLat(point: RoutePoint): [number, number] {
  return [point.lng, point.lat];
}

function getInitialCenter(
  gpsReading: GpsReading | null,
  destination: RoutePoint | null,
): LngLatLike {
  return toLngLat(gpsReading ?? destination ?? DEFAULT_CENTER);
}

function getPreviewRoutePoints({
  route,
  gpsReading,
  destination,
}: {
  route: RouteData | null;
  gpsReading: GpsReading | null;
  destination: RoutePoint | null;
}): RoutePoint[] {
  if (route && route.points.length >= 2) {
    return route.points;
  }

  const origin = gpsReading ?? DEFAULT_CENTER;

  if (!destination) {
    return [origin];
  }

  const latDelta = destination.lat - origin.lat;
  const lngDelta = destination.lng - origin.lng;

  return [
    origin,
    {
      lat: origin.lat + latDelta * 0.28 + 0.012,
      lng: origin.lng + lngDelta * 0.22 - 0.014,
    },
    {
      lat: origin.lat + latDelta * 0.58 - 0.01,
      lng: origin.lng + lngDelta * 0.54 + 0.018,
    },
    {
      lat: origin.lat + latDelta * 0.78 + 0.006,
      lng: origin.lng + lngDelta * 0.82 - 0.012,
    },
    destination,
  ];
}

function getProjectedPreviewPoints(points: RoutePoint[]): Array<[number, number]> {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(maxLat - minLat, 0.08);
  const lngRange = Math.max(maxLng - minLng, 0.08);
  const latCenter = (minLat + maxLat) / 2;
  const lngCenter = (minLng + maxLng) / 2;
  const adjustedMinLat = latCenter - latRange / 2;
  const adjustedMinLng = lngCenter - lngRange / 2;
  const drawableWidth = PREVIEW_WIDTH - PREVIEW_PADDING * 2;
  const drawableHeight = PREVIEW_HEIGHT - PREVIEW_PADDING * 2;

  return points.map((point) => [
    PREVIEW_PADDING + ((point.lng - adjustedMinLng) / lngRange) * drawableWidth,
    PREVIEW_HEIGHT -
      PREVIEW_PADDING -
      ((point.lat - adjustedMinLat) / latRange) * drawableHeight,
  ]);
}

function getPathFromPoints(points: Array<[number, number]>): string {
  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');
}

function createLineData(points: RoutePoint[]): GeoJSON.FeatureCollection {
  if (points.length === 0) {
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: points.map(toLngLat),
        },
      },
    ],
  };
}

function createPointData(point: RoutePoint | null): GeoJSON.FeatureCollection {
  if (!point) {
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: toLngLat(point),
        },
      },
    ],
  };
}

function updateSource(
  map: MapLibreMap,
  sourceId: string,
  data: GeoJSON.FeatureCollection,
): void {
  const source = map.getSource(sourceId);

  if (!source) {
    return;
  }

  (source as GeoJSONSource).setData(data);
}

function addRouteLayers(map: MapLibreMap): void {
  map.addSource('route-line', {
    type: 'geojson',
    data: createLineData([]),
  });
  map.addSource('vehicle-point', {
    type: 'geojson',
    data: createPointData(null),
  });
  map.addSource('destination-point', {
    type: 'geojson',
    data: createPointData(null),
  });
  map.addSource('curve-point', {
    type: 'geojson',
    data: createPointData(null),
  });

  map.addLayer({
    id: 'route-line-outline',
    type: 'line',
    source: 'route-line',
    paint: {
      'line-color': '#3b0764',
      'line-width': 12,
      'line-opacity': 0.9,
    },
  });
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route-line',
    paint: {
      'line-color': '#7c3aed',
      'line-width': 8,
      'line-opacity': 0.95,
    },
  });
  map.addLayer({
    id: 'destination-point',
    type: 'circle',
    source: 'destination-point',
    paint: {
      'circle-color': '#34d399',
      'circle-radius': 8,
      'circle-stroke-color': '#052e16',
      'circle-stroke-width': 3,
    },
  });
  map.addLayer({
    id: 'curve-point',
    type: 'circle',
    source: 'curve-point',
    paint: {
      'circle-color': '#f59e0b',
      'circle-radius': 10,
      'circle-stroke-color': '#451a03',
      'circle-stroke-width': 4,
    },
  });
  map.addLayer({
    id: 'vehicle-point-accuracy',
    type: 'circle',
    source: 'vehicle-point',
    paint: {
      'circle-color': '#38bdf8',
      'circle-opacity': 0.16,
      'circle-radius': 24,
    },
  });
  map.addLayer({
    id: 'vehicle-point',
    type: 'circle',
    source: 'vehicle-point',
    paint: {
      'circle-color': '#22d3ee',
      'circle-radius': 9,
      'circle-stroke-color': '#ecfeff',
      'circle-stroke-width': 3,
    },
  });
}

function getRouteBounds(route: RouteData): LngLatBoundsLike | null {
  if (route.points.length === 0) {
    return null;
  }

  const firstPoint = route.points[0]!;
  const bounds = new maplibregl.LngLatBounds(toLngLat(firstPoint), toLngLat(firstPoint));

  route.points.forEach((point) => {
    bounds.extend(toLngLat(point));
  });

  return bounds;
}

function NavigationPreviewMap({
  route,
  gpsReading,
  destination,
}: {
  route: RouteData | null;
  gpsReading: GpsReading | null;
  destination: RoutePoint | null;
}) {
  const routePoints = getPreviewRoutePoints({
    route,
    gpsReading,
    destination,
  });
  const projectedRoutePoints = getProjectedPreviewPoints(routePoints);
  const routePath = getPathFromPoints(projectedRoutePoints);
  const originPoint = projectedRoutePoints[0] ?? [180, 380];
  const destinationPoint = destination
    ? projectedRoutePoints[projectedRoutePoints.length - 1] ?? [820, 250]
    : null;
  const vehiclePoint = gpsReading ? originPoint : null;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#101418]">
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="navigation-preview-bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#f5f7f7" />
            <stop offset="55%" stopColor="#e5ebec" />
            <stop offset="100%" stopColor="#d6dedf" />
          </linearGradient>
          <pattern
            id="navigation-preview-grid"
            width="82"
            height="82"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 82 0 L 0 0 0 82" fill="none" stroke="#cbd5d8" strokeWidth="1" />
          </pattern>
          <filter id="navigation-route-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          width={PREVIEW_WIDTH}
          height={PREVIEW_HEIGHT}
          fill="url(#navigation-preview-bg)"
        />
        <rect
          width={PREVIEW_WIDTH}
          height={PREVIEW_HEIGHT}
          fill="url(#navigation-preview-grid)"
          opacity="0.34"
        />

        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M -80 208 C 96 188 188 262 330 238 S 586 124 780 158 1020 124 1110 80"
            stroke="#9aa3aa"
            strokeWidth="28"
          />
          <path
            d="M -20 572 C 120 430 260 486 410 392 S 686 304 818 350 1010 300 1100 214"
            stroke="#9aa3aa"
            strokeWidth="26"
          />
          <path
            d="M 132 -70 C 164 88 132 196 218 318 S 380 506 314 770"
            stroke="#aeb6bb"
            strokeWidth="24"
          />
          <path
            d="M 658 -40 C 610 104 690 216 628 356 S 540 560 610 760"
            stroke="#aeb6bb"
            strokeWidth="22"
          />
          <path
            d="M -80 208 C 96 188 188 262 330 238 S 586 124 780 158 1020 124 1110 80"
            stroke="#f8fafc"
            strokeWidth="3"
            opacity="0.66"
          />
          <path
            d="M -20 572 C 120 430 260 486 410 392 S 686 304 818 350 1010 300 1100 214"
            stroke="#f8fafc"
            strokeWidth="3"
            opacity="0.66"
          />
          <path
            d="M 132 -70 C 164 88 132 196 218 318 S 380 506 314 770"
            stroke="#f8fafc"
            strokeWidth="3"
            opacity="0.62"
          />
          <path
            d="M 658 -40 C 610 104 690 216 628 356 S 540 560 610 760"
            stroke="#f8fafc"
            strokeWidth="3"
            opacity="0.62"
          />
        </g>

        <g filter="url(#navigation-route-glow)">
          <path
            d={routePath}
            fill="none"
            stroke="#3b0764"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="34"
          />
          <path
            d={routePath}
            fill="none"
            stroke="#7c3aed"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="16"
          />
          <path
            d={routePath}
            fill="none"
            stroke="#f5f3ff"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
            strokeDasharray="18 22"
            opacity="0.6"
          />
        </g>

        <g>
          {destinationPoint ? (
            <>
              <circle
                cx={destinationPoint[0]}
                cy={destinationPoint[1]}
                r="21"
                fill="#052e16"
                stroke="#34d399"
                strokeWidth="7"
              />
              <circle
                cx={destinationPoint[0]}
                cy={destinationPoint[1]}
                r="7"
                fill="#d1fae5"
              />
            </>
          ) : null}
          {vehiclePoint ? (
            <>
              <circle
                cx={vehiclePoint[0]}
                cy={vehiclePoint[1]}
                r="34"
                fill="#0e7490"
                opacity="0.18"
              />
              <path
                d={`M ${vehiclePoint[0]} ${vehiclePoint[1] - 28} L ${
                  vehiclePoint[0] + 24
                } ${vehiclePoint[1] + 18} Q ${vehiclePoint[0]} ${
                  vehiclePoint[1] + 30
                } ${vehiclePoint[0] - 24} ${vehiclePoint[1] + 18} Z`}
                fill="#22d3ee"
                stroke="#ecfeff"
                strokeWidth="7"
                strokeLinejoin="round"
              />
            </>
          ) : null}
        </g>
      </svg>
    </div>
  );
}

export function RouteMapView({
  route,
  gpsReading,
  destination,
  destinationLabel,
  progress,
  routeStatusText,
  isRouteLoading,
}: RouteMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapLoadedRef = useRef(false);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const initialCenterRef = useRef<LngLatLike>(getInitialCenter(gpsReading, destination));
  const destinationData = useMemo(() => createPointData(destination), [destination]);
  const remainingMeters = progress.remainingMeters ?? route?.distanceMeters ?? null;
  const remainingDurationSeconds = getEstimatedRemainingDurationSeconds(
    route,
    progress.remainingMeters,
  );
  const nextInstruction =
    progress.nextStep?.instruction ??
    (route
      ? 'Continua por la ruta'
      : destination
        ? 'Calcula la ruta para iniciar'
        : 'Busca un destino');
  const distanceToNextInstruction = progress.nextStep
    ? formatDistance(progress.distanceToNextStepMeters)
    : '--';
  const speedLabel = formatSpeed(progress.speedKph ?? gpsReading?.speedKph ?? 0);
  const streetLabel =
    progress.nextStep?.instruction ??
    destinationLabel ??
    (destination ? 'Ruta seleccionada' : 'Busca un destino');
  const latestStateRef = useRef({
    route,
    gpsReading,
    destinationData,
  });

  latestStateRef.current = {
    route,
    gpsReading,
    destinationData,
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const mapContainer = containerRef.current;
    const map = new maplibregl.Map({
      container: mapContainer,
      style: rasterMapStyle,
      center: initialCenterRef.current,
      zoom: 13,
      pitch: 38,
      attributionControl: false,
      canvasContextAttributes: {
        antialias: true,
      },
    });
    const resizeMap = () => {
      map.resize();
    };
    const resizeObserver = new ResizeObserver(resizeMap);
    const resizeTimeout = window.setTimeout(resizeMap, 250);

    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
      }),
      'bottom-right',
    );
    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
      }),
      'bottom-left',
    );

    map.on('load', () => {
      mapLoadedRef.current = true;
      setMapStatus('ready');
      addRouteLayers(map);
      updateSource(map, 'destination-point', latestStateRef.current.destinationData);

      if (latestStateRef.current.route) {
        updateSource(
          map,
          'route-line',
          createLineData(latestStateRef.current.route.points),
        );
      }

      if (latestStateRef.current.gpsReading) {
        updateSource(
          map,
          'vehicle-point',
          createPointData(latestStateRef.current.gpsReading),
        );
      }

      window.requestAnimationFrame(resizeMap);
    });
    map.on('error', () => {
      setMapStatus('error');
    });

    mapRef.current = map;
    resizeObserver.observe(mapContainer);
    window.requestAnimationFrame(resizeMap);

    return () => {
      window.clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      mapLoadedRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapLoadedRef.current) {
      return;
    }

    updateSource(map, 'destination-point', destinationData);
  }, [destinationData]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapLoadedRef.current) {
      return;
    }

    updateSource(map, 'route-line', createLineData(route?.points ?? []));

    if (!route) {
      return;
    }

    const bounds = getRouteBounds(route);

    if (bounds) {
      map.fitBounds(bounds, {
        padding: 56,
        maxZoom: 16,
        duration: 700,
      });
    }
  }, [route]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapLoadedRef.current) {
      return;
    }

    updateSource(map, 'vehicle-point', createPointData(gpsReading));

    if (!gpsReading) {
      return;
    }

    map.easeTo({
      center: toLngLat(gpsReading),
      bearing: gpsReading.headingDegrees ?? map.getBearing(),
      duration: 650,
      zoom: Math.max(map.getZoom(), route ? 15 : 13),
    });
  }, [gpsReading, route]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapLoadedRef.current) {
      return;
    }

    updateSource(
      map,
      'curve-point',
      createPointData(progress.upcomingCurve?.point ?? null),
    );
  }, [progress.upcomingCurve]);

  return (
    <section className="absolute inset-0 overflow-hidden bg-zinc-950">
      <div className="relative h-full min-h-[720px] w-full bg-zinc-950">
        <NavigationPreviewMap
          route={route}
          gpsReading={gpsReading}
          destination={destination}
        />
        <div
          ref={containerRef}
          className={`absolute inset-0 transition-opacity duration-500 ${
            mapStatus === 'ready' ? 'opacity-95' : 'opacity-0'
          }`}
        />
        {mapStatus !== 'ready' && (
          <div className="pointer-events-none absolute left-5 top-28 rounded-full border border-zinc-200 bg-white/90 px-4 py-2 text-xs font-semibold text-zinc-700 shadow-lg shadow-black/20 backdrop-blur">
            {mapStatus === 'error' ? 'Mapa remoto sin respuesta' : 'Cargando mapa'}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-black px-5 pb-8 pt-8 text-center shadow-2xl shadow-black/25 sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {routeStatusText}
          </p>
          <p className="mt-4 text-3xl font-bold leading-tight text-cyan-300 sm:text-4xl">
            {isRouteLoading ? 'Calculando ruta' : nextInstruction}
          </p>
          <p className="mt-3 text-sm font-medium text-zinc-400">
            {distanceToNextInstruction === '--'
              ? gpsReading
                ? 'Sigue la ruta destacada'
                : 'Activa GPS para iniciar'
              : `${distanceToNextInstruction} hasta la siguiente indicacion`}
          </p>
        </div>

        <div className="pointer-events-none absolute bottom-[11.5rem] left-5 z-20 flex h-20 w-20 flex-col items-center justify-center rounded-full bg-zinc-900/88 text-white shadow-xl shadow-black/25 ring-4 ring-zinc-950/10 backdrop-blur md:bottom-[10.75rem]">
          <Gauge className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          <p className="mt-1 text-2xl font-bold leading-none">{speedLabel.split(' ')[0]}</p>
          <p className="text-xs text-zinc-300">km/h</p>
        </div>

        <div className="pointer-events-none absolute bottom-[11.75rem] left-1/2 z-20 max-w-[54%] -translate-x-1/2 rounded-full bg-white px-5 py-3 text-center text-base font-bold text-zinc-900 shadow-xl shadow-black/20 md:bottom-[11rem]">
          <p className="truncate">{streetLabel}</p>
        </div>

        <button
          className="absolute bottom-[11.5rem] right-5 z-20 inline-flex h-20 w-20 items-center justify-center rounded-full bg-white text-zinc-900 shadow-xl shadow-black/20 transition hover:scale-[1.02] md:bottom-[10.75rem]"
          type="button"
          aria-label="Estado de alerta de ruta"
        >
          {progress.upcomingCurve ? (
            <AlertTriangle className="h-10 w-10 text-amber-500" aria-hidden="true" />
          ) : (
            <Navigation2 className="h-10 w-10 text-cyan-500" aria-hidden="true" />
          )}
        </button>

        <button
          className="absolute right-5 top-32 z-20 inline-flex h-16 w-16 items-center justify-center rounded-full bg-pink-500 text-white shadow-xl shadow-black/20 transition hover:scale-[1.02]"
          type="button"
          aria-label="Audio de navegacion"
        >
          <Volume2 className="h-8 w-8" aria-hidden="true" />
        </button>

        <div className="pointer-events-none absolute bottom-[5.5rem] left-5 right-5 z-20 hidden grid-cols-3 gap-2 text-center text-xs font-semibold text-zinc-700 md:grid">
          <div className="rounded-full bg-white/92 px-3 py-2 shadow-lg shadow-black/10">
            ETA {formatEtaFromNow(remainingDurationSeconds)}
          </div>
          <div className="rounded-full bg-white/92 px-3 py-2 shadow-lg shadow-black/10">
            {formatDuration(remainingDurationSeconds)}
          </div>
          <div className="rounded-full bg-white/92 px-3 py-2 shadow-lg shadow-black/10">
            {formatDistance(remainingMeters)}
          </div>
        </div>
      </div>
    </section>
  );
}
