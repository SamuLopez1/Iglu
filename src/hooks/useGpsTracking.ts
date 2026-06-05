import { useCallback, useEffect, useRef, useState } from 'react';

import type { GpsQuality, GpsReading, RoutePoint } from '../types/navigation.types';
import { getBearingDegrees, getDistanceMeters } from '../utils/routeGeometryUtils';

type GpsTrackingStatus = 'idle' | 'requesting' | 'tracking' | 'error';

interface UseGpsTrackingResult {
  status: GpsTrackingStatus;
  quality: GpsQuality;
  reading: GpsReading | null;
  errorMessage: string | null;
  isSupported: boolean;
  startTracking: () => void;
  stopTracking: () => void;
}

const MAX_RECENT_READINGS = 5;
const MIN_DISTANCE_FOR_DERIVED_HEADING_METERS = 3;
const MIN_DISTANCE_FOR_DERIVED_SPEED_METERS = 1;
const MAX_DERIVED_SAMPLE_AGE_MS = 12_000;

function getGpsErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Permiso de ubicacion denegado.';
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'Ubicacion GPS no disponible.';
  }

  if (error.code === error.TIMEOUT) {
    return 'El GPS tardo demasiado en responder.';
  }

  return 'No se pudo leer la ubicacion GPS.';
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

  if (
    elapsedSeconds <= 0 ||
    distanceMeters < MIN_DISTANCE_FOR_DERIVED_SPEED_METERS
  ) {
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

export function useGpsTracking(): UseGpsTrackingResult {
  const watchIdRef = useRef<number | null>(null);
  const recentReadingsRef = useRef<GpsReading[]>([]);
  const [status, setStatus] = useState<GpsTrackingStatus>('idle');
  const [reading, setReading] = useState<GpsReading | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSupported =
    typeof navigator !== 'undefined' && Boolean(navigator.geolocation);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = null;
    setStatus((currentStatus) =>
      currentStatus === 'error' ? currentStatus : 'idle',
    );
  }, []);

  const startTracking = useCallback(() => {
    if (!isSupported) {
      setStatus('error');
      setErrorMessage('Este navegador no soporta geolocalizacion.');
      return;
    }

    if (watchIdRef.current !== null) {
      return;
    }

    setStatus('requesting');
    setErrorMessage(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const speedFromGps = readFiniteNumber(position.coords.speed);
        const headingFromGps = readFiniteNumber(position.coords.heading);
        const speedKph =
          speedFromGps !== null
            ? Math.max(0, speedFromGps * 3.6)
            : deriveSpeedKph(
                point,
                position.timestamp,
                recentReadingsRef.current,
              );
        const headingDegrees =
          headingFromGps !== null
            ? headingFromGps
            : deriveHeadingDegrees(point, recentReadingsRef.current);
        const nextReading: GpsReading = {
          ...point,
          accuracyMeters: readFiniteNumber(position.coords.accuracy),
          headingDegrees,
          speedKph,
          timestamp: position.timestamp,
        };

        recentReadingsRef.current = [
          ...recentReadingsRef.current,
          nextReading,
        ].slice(-MAX_RECENT_READINGS);

        setReading(nextReading);
        setStatus('tracking');
        setErrorMessage(null);
      },
      (error) => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }

        setStatus('error');
        setErrorMessage(getGpsErrorMessage(error));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10_000,
      },
    );
  }, [isSupported]);

  useEffect(() => stopTracking, [stopTracking]);

  return {
    status,
    quality: getQuality(reading),
    reading,
    errorMessage,
    isSupported,
    startTracking,
    stopTracking,
  };
}
