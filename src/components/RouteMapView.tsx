import maplibregl, {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type LngLatLike,
  type Map as MapLibreMap,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef } from 'react';

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

const osmRasterStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: 'OpenStreetMap',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
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
  const bounds = new maplibregl.LngLatBounds(
    toLngLat(firstPoint),
    toLngLat(firstPoint),
  );

  route.points.forEach((point) => {
    bounds.extend(toLngLat(point));
  });

  return bounds;
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
  const initialCenterRef = useRef<LngLatLike>(
    getInitialCenter(gpsReading, destination),
  );
  const destinationData = useMemo(
    () => createPointData(destination),
    [destination],
  );
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

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: osmRasterStyle,
      center: initialCenterRef.current,
      zoom: 13,
      pitch: 38,
      attributionControl: false,
    });

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
    });

    mapRef.current = map;

    return () => {
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
        <div ref={containerRef} className="absolute inset-0" />
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-zinc-700 bg-zinc-950/85 px-3 py-2 text-xs text-zinc-200 shadow-lg shadow-black/30 backdrop-blur">
          <p className="font-semibold text-white">
            {route ? 'Ruta activa' : 'Sin ruta'}
          </p>
          <p className="mt-1 text-zinc-400">
            {gpsReading ? 'GPS enlazado' : 'Esperando GPS'}
          </p>
        </div>
      </div>
    </section>
  );
}
