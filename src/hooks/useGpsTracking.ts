import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  GpsQuality,
  GpsReading,
  GpsTrackingStatus,
  RoutePoint,
} from '../types/navigation.types';
import { getBearingDegrees, getDistanceMeters } from '../utils/routeGeometryUtils';

interface UseGpsTrackingResult {
  status: GpsTrackingStatus;
  quality: GpsQuality;
  reading: GpsReading | null;
  errorMessage: string | null;
  isSupported: boolean;
  startTracking: () => void;
  startDemoTracking: (point: RoutePoint) => void;
  stopTracking: () => void;
}

const MAX_RECENT_READINGS = 5;
const MIN_DISTANCE_FOR_DERIVED_HEADING_METERS = 3;
const MIN_DISTANCE_FOR_DERIVED_SPEED_METERS = 1;
const MAX_DERIVED_SAMPLE_AGE_MS = 12_000;
const HIGH_ACCURACY_WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 2000,
  timeout: 10_000,
};
const APPROXIMATE_WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 30_000,
  timeout: 15_000,
};

function getGpsErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Permiso de ubicacion denegado. Activalo en el navegador.';
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'Ubicacion GPS no disponible. En web prueba HTTPS, localhost o GPS demo.';
  }

  if (error.code === error.TIMEOUT) {
    return 'El GPS tardo demasiado en responder. En desktop prueba GPS demo.';
  }

  return 'No se pudo leer la ubicacion GPS.';
}

function getGeolocationUnavailableMessage(): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Abre la demo en HTTPS o localhost para usar GPS real.';
  }

  return 'Este navegador no soporta geolocalizacion.';
}

function canUseGeolocation(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.geolocation) &&
    (typeof window === 'undefined' || window.isSecureContext)
  );
}

function shouldRetryWithApproximatePosition(error: GeolocationPositionError): boolean {
  return error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT;
}

function getQuality(reading: GpsReading | null): GpsQuality {
  if (!reading) {
    return 'unavailable';
  }

  if (reading.accuracyMeters !== null && reading.accuracyMeters <= 25) {
    return 'good';
  }

  return 'weak';
}

function readFiniteNumber(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function deriveSpeedKph(
  currentPoint: RoutePoint,
  currentTimestamp: number,
  previousReadings: GpsReading[],
): number | null {
  const previous = [...previousReadings]
    .reverse()
    .find((reading) => currentTimestamp - reading.timestamp <= MAX_DERIVED_SAMPLE_AGE_MS);

  if (!previous) {
    return null;
  }

  const distanceMeters = getDistanceMeters(previous, currentPoint);
  const elapsedSeconds = (currentTimestamp - previous.timestamp) / 1000;

  if (elapsedSeconds <= 0 || distanceMeters < MIN_DISTANCE_FOR_DERIVED_SPEED_METERS) {
    return null;
  }

  return (distanceMeters / elapsedSeconds) * 3.6;
}

function deriveHeadingDegrees(
  currentPoint: RoutePoint,
  previousReadings: GpsReading[],
): number | null {
  const previous = [...previousReadings]
    .reverse()
    .find(
      (reading) =>
        getDistanceMeters(reading, currentPoint) >=
        MIN_DISTANCE_FOR_DERIVED_HEADING_METERS,
    );

  if (!previous) {
    return null;
  }

  return getBearingDegrees(previous, currentPoint);
}

function createGpsReadingFromPosition(
  position: GeolocationPosition,
  previousReadings: GpsReading[],
): GpsReading {
  const point = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
  const speedFromGps = readFiniteNumber(position.coords.speed);
  const headingFromGps = readFiniteNumber(position.coords.heading);
  const speedKph =
    speedFromGps !== null
      ? Math.max(0, speedFromGps * 3.6)
      : deriveSpeedKph(point, position.timestamp, previousReadings);
  const headingDegrees =
    headingFromGps !== null
      ? headingFromGps
      : deriveHeadingDegrees(point, previousReadings);

  return {
    ...point,
    accuracyMeters: readFiniteNumber(position.coords.accuracy),
    headingDegrees,
    speedKph,
    timestamp: position.timestamp,
  };
}

export function useGpsTracking(): UseGpsTrackingResult {
  const watchIdRef = useRef<number | null>(null);
  const recentReadingsRef = useRef<GpsReading[]>([]);
  const receivedRealReadingRef = useRef(false);
  const [status, setStatus] = useState<GpsTrackingStatus>('idle');
  const [reading, setReading] = useState<GpsReading | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSupported = canUseGeolocation();

  const stopTracking = useCallback(() => {
    if (
      watchIdRef.current !== null &&
      typeof navigator !== 'undefined' &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = null;
    receivedRealReadingRef.current = false;
    setStatus((currentStatus) => (currentStatus === 'error' ? currentStatus : 'idle'));
  }, []);

  const startTracking = useCallback(() => {
    if (!isSupported) {
      setStatus('error');
      setErrorMessage(getGeolocationUnavailableMessage());
      return;
    }

    if (watchIdRef.current !== null) {
      return;
    }

    const geolocation = navigator.geolocation;

    setStatus('requesting');
    setErrorMessage(null);
    setReading(null);
    recentReadingsRef.current = [];
    receivedRealReadingRef.current = false;

    const handlePosition = (position: GeolocationPosition) => {
      const nextReading = createGpsReadingFromPosition(
        position,
        recentReadingsRef.current,
      );

      recentReadingsRef.current = [...recentReadingsRef.current, nextReading].slice(
        -MAX_RECENT_READINGS,
      );

      receivedRealReadingRef.current = true;
      setReading(nextReading);
      setStatus('tracking');
      setErrorMessage(null);
    };

    const startWatch = (options: PositionOptions, isApproximate: boolean) => {
      watchIdRef.current = geolocation.watchPosition(
        handlePosition,
        (error) => {
          if (
            !isApproximate &&
            !receivedRealReadingRef.current &&
            shouldRetryWithApproximatePosition(error)
          ) {
            if (watchIdRef.current !== null) {
              geolocation.clearWatch(watchIdRef.current);
            }
            watchIdRef.current = null;
            setErrorMessage(
              'GPS de alta precision sin respuesta. Intentando ubicacion aproximada.',
            );
            startWatch(APPROXIMATE_WATCH_OPTIONS, true);
            return;
          }

          if (watchIdRef.current !== null) {
            geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }

          setStatus('error');
          setErrorMessage(getGpsErrorMessage(error));
        },
        options,
      );
    };

    startWatch(HIGH_ACCURACY_WATCH_OPTIONS, false);
  }, [isSupported]);

  const startDemoTracking = useCallback((point: RoutePoint) => {
    if (
      watchIdRef.current !== null &&
      typeof navigator !== 'undefined' &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    const demoReading: GpsReading = {
      ...point,
      accuracyMeters: 8,
      headingDegrees: 240,
      speedKph: 0,
      timestamp: Date.now(),
    };

    watchIdRef.current = null;
    receivedRealReadingRef.current = false;
    recentReadingsRef.current = [demoReading];
    setReading(demoReading);
    setStatus('demo');
    setErrorMessage(null);
  }, []);

  useEffect(() => stopTracking, [stopTracking]);

  return {
    status,
    quality: getQuality(reading),
    reading,
    errorMessage,
    isSupported,
    startTracking,
    startDemoTracking,
    stopTracking,
  };
}
