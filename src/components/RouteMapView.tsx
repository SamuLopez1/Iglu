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

interface RouteMapViewProps {
  route: RouteData | null;
  gpsReading: GpsReading | null;
  destination: RoutePoint;
  progress: RouteProgress;
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
  destination: RoutePoint,
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
  destination: RoutePoint;
}): RoutePoint[] {
  if (route && route.points.length >= 2) {
    return route.points;
  }

  const origin = gpsReading ?? DEFAULT_CENTER;
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
      'line-color': '#042f2e',
      'line-width': 9,
      'line-opacity': 0.9,
    },
  });
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route-line',
    paint: {
      'line-color': '#22d3ee',
      'line-width': 5,
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
      'circle-color': '#e0f2fe',
      'circle-radius': 7,
      'circle-stroke-color': '#0284c7',
      'circle-stroke-width': 4,
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
  destination: RoutePoint;
}) {
  const routePoints = getPreviewRoutePoints({
    route,
    gpsReading,
    destination,
  });
  const projectedRoutePoints = getProjectedPreviewPoints(routePoints);
  const routePath = getPathFromPoints(projectedRoutePoints);
  const originPoint = projectedRoutePoints[0] ?? [180, 380];
  const destinationPoint = projectedRoutePoints[projectedRoutePoints.length - 1] ?? [
    820, 250,
  ];
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
            <stop offset="0%" stopColor="#141a1f" />
            <stop offset="55%" stopColor="#101820" />
            <stop offset="100%" stopColor="#0f1715" />
          </linearGradient>
          <pattern
            id="navigation-preview-grid"
            width="82"
            height="82"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 82 0 L 0 0 0 82" fill="none" stroke="#25303a" strokeWidth="1" />
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
            stroke="#2b3540"
            strokeWidth="28"
          />
          <path
            d="M -20 572 C 120 430 260 486 410 392 S 686 304 818 350 1010 300 1100 214"
            stroke="#2b3540"
            strokeWidth="26"
          />
          <path
            d="M 132 -70 C 164 88 132 196 218 318 S 380 506 314 770"
            stroke="#26313b"
            strokeWidth="24"
          />
          <path
            d="M 658 -40 C 610 104 690 216 628 356 S 540 560 610 760"
            stroke="#26313b"
            strokeWidth="22"
          />
          <path
            d="M -80 208 C 96 188 188 262 330 238 S 586 124 780 158 1020 124 1110 80"
            stroke="#48515d"
            strokeWidth="3"
            opacity="0.66"
          />
          <path
            d="M -20 572 C 120 430 260 486 410 392 S 686 304 818 350 1010 300 1100 214"
            stroke="#48515d"
            strokeWidth="3"
            opacity="0.66"
          />
          <path
            d="M 132 -70 C 164 88 132 196 218 318 S 380 506 314 770"
            stroke="#3f4a55"
            strokeWidth="3"
            opacity="0.62"
          />
          <path
            d="M 658 -40 C 610 104 690 216 628 356 S 540 560 610 760"
            stroke="#3f4a55"
            strokeWidth="3"
            opacity="0.62"
          />
        </g>

        <g filter="url(#navigation-route-glow)">
          <path
            d={routePath}
            fill="none"
            stroke="#073042"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="34"
          />
          <path
            d={routePath}
            fill="none"
            stroke="#22d3ee"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="16"
          />
          <path
            d={routePath}
            fill="none"
            stroke="#ecfeff"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
            strokeDasharray="18 22"
            opacity="0.6"
          />
        </g>

        <g>
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
          {vehiclePoint ? (
            <>
              <circle
                cx={vehiclePoint[0]}
                cy={vehiclePoint[1]}
                r="34"
                fill="#38bdf8"
                opacity="0.18"
              />
              <circle
                cx={vehiclePoint[0]}
                cy={vehiclePoint[1]}
                r="18"
                fill="#e0f2fe"
                stroke="#0284c7"
                strokeWidth="7"
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
  progress,
}: RouteMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapLoadedRef = useRef(false);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const initialCenterRef = useRef<LngLatLike>(getInitialCenter(gpsReading, destination));
  const destinationData = useMemo(() => createPointData(destination), [destination]);
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
    <section className="min-h-[420px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/20">
      <div className="relative h-[64dvh] min-h-[420px] w-full bg-zinc-950 sm:h-[620px]">
        <NavigationPreviewMap
          route={route}
          gpsReading={gpsReading}
          destination={destination}
        />
        <div
          ref={containerRef}
          className={`absolute inset-0 transition-opacity duration-500 ${
            mapStatus === 'ready' ? 'opacity-80' : 'opacity-0'
          }`}
        />
        {mapStatus !== 'ready' && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-300 shadow-lg shadow-black/30 backdrop-blur">
            {mapStatus === 'error' ? 'Mapa remoto sin respuesta' : 'Cargando mapa'}
          </div>
        )}
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-zinc-700 bg-zinc-950/85 px-3 py-2 text-xs text-zinc-200 shadow-lg shadow-black/30 backdrop-blur">
          <p className="font-semibold text-white">{route ? 'Ruta activa' : 'Sin ruta'}</p>
          <p className="mt-1 text-zinc-400">
            {gpsReading ? 'GPS enlazado' : 'Esperando GPS'}
          </p>
        </div>
      </div>
    </section>
  );
}
