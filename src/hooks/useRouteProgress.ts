import { useMemo } from 'react';

import type {
  GpsReading,
  NavigationSettings,
  RouteData,
  RouteProgress,
} from '../types/navigation.types';
import {
  findNextRouteStep,
  findUpcomingCurve,
  getRemainingDistanceMeters,
  projectPointOntoRoute,
} from '../utils/routeGeometryUtils';

interface UseRouteProgressOptions {
  gpsReading: GpsReading | null;
  route: RouteData | null;
  settings: NavigationSettings;
}

const emptyRouteProgress: RouteProgress = {
  currentPoint: null,
  speedKph: null,
  headingDegrees: null,
  remainingMeters: null,
  distanceToRouteMeters: null,
  nextStep: null,
  distanceToNextStepMeters: null,
  upcomingCurve: null,
  isOffRoute: false,
};

export function useRouteProgress({
  gpsReading,
  route,
  settings,
}: UseRouteProgressOptions): RouteProgress {
  return useMemo(() => {
    if (!gpsReading || !route || route.points.length === 0) {
      return emptyRouteProgress;
    }

    const projection = projectPointOntoRoute(gpsReading, route.points);

    if (!projection) {
      return {
        ...emptyRouteProgress,
        currentPoint: gpsReading,
        speedKph: gpsReading.speedKph,
        headingDegrees: gpsReading.headingDegrees,
      };
    }

    const nextStep = findNextRouteStep(
      route.steps,
      route.points,
      projection.distanceFromStartMeters,
    );

    return {
      currentPoint: gpsReading,
      speedKph: gpsReading.speedKph,
      headingDegrees: gpsReading.headingDegrees,
      remainingMeters: getRemainingDistanceMeters(
        route.points,
        projection.distanceFromStartMeters,
      ),
      distanceToRouteMeters: projection.distanceToRouteMeters,
      nextStep: nextStep.step,
      distanceToNextStepMeters: nextStep.distanceMeters,
      upcomingCurve: findUpcomingCurve({
        routePoints: route.points,
        distanceFromStartMeters: projection.distanceFromStartMeters,
        warningDistanceMeters: settings.curveWarningDistanceMeters,
        sharpCurveAngleDegrees: settings.sharpCurveAngleDegrees,
      }),
      isOffRoute:
        projection.distanceToRouteMeters > settings.offRouteThresholdMeters,
    };
  }, [gpsReading, route, settings]);
}
