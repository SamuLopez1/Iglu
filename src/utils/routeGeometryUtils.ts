import type {
  CurveDirection,
  CurveSeverity,
  RouteData,
  RoutePoint,
  RouteStep,
  UpcomingCurve,
} from '../types/navigation.types';

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_PER_DEGREE_LATITUDE = 111_320;

interface IndexedRoutePoint extends RoutePoint {
  distanceFromStartMeters: number;
}

export interface RouteProjection {
  point: RoutePoint;
  segmentIndex: number;
  distanceFromStartMeters: number;
  distanceToRouteMeters: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function getDistanceMeters(a: RoutePoint, b: RoutePoint): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);

  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return (
    EARTH_RADIUS_METERS *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function getBearingDegrees(from: RoutePoint, to: RoutePoint): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function getSignedAngleDifferenceDegrees(
  fromDegrees: number,
  toDegreesValue: number,
): number {
  return ((((toDegreesValue - fromDegrees) % 360) + 540) % 360) - 180;
}

export function getRouteDistanceMeters(points: RoutePoint[]): number {
  return points.reduce((distance, point, index) => {
    if (index === 0) {
      return distance;
    }

    return distance + getDistanceMeters(points[index - 1]!, point);
  }, 0);
}

function getIndexedRoutePoints(points: RoutePoint[]): IndexedRoutePoint[] {
  let distanceFromStartMeters = 0;

  return points.map((point, index) => {
    if (index > 0) {
      distanceFromStartMeters += getDistanceMeters(points[index - 1]!, point);
    }

    return {
      ...point,
      distanceFromStartMeters,
    };
  });
}

function toLocalXY(point: RoutePoint, origin: RoutePoint): { x: number; y: number } {
  const latScale = METERS_PER_DEGREE_LATITUDE;
  const lngScale = latScale * Math.cos(toRadians(origin.lat));

  return {
    x: (point.lng - origin.lng) * lngScale,
    y: (point.lat - origin.lat) * latScale,
  };
}

function fromLocalXY(
  point: { x: number; y: number },
  origin: RoutePoint,
): RoutePoint {
  const latScale = METERS_PER_DEGREE_LATITUDE;
  const lngScale = latScale * Math.cos(toRadians(origin.lat));

  return {
    lat: origin.lat + point.y / latScale,
    lng: origin.lng + point.x / lngScale,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function projectPointOntoRoute(
  point: RoutePoint,
  routePoints: RoutePoint[],
): RouteProjection | null {
  if (routePoints.length === 0) {
    return null;
  }

  if (routePoints.length === 1) {
    const onlyPoint = routePoints[0]!;

    return {
      point: onlyPoint,
      segmentIndex: 0,
      distanceFromStartMeters: 0,
      distanceToRouteMeters: getDistanceMeters(point, onlyPoint),
    };
  }

  const indexedPoints = getIndexedRoutePoints(routePoints);
  const localPoint = toLocalXY(point, point);
  let bestProjection: RouteProjection | null = null;

  for (let index = 0; index < indexedPoints.length - 1; index += 1) {
    const segmentStart = indexedPoints[index]!;
    const segmentEnd = indexedPoints[index + 1]!;
    const localStart = toLocalXY(segmentStart, point);
    const localEnd = toLocalXY(segmentEnd, point);
    const segmentX = localEnd.x - localStart.x;
    const segmentY = localEnd.y - localStart.y;
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

    if (segmentLengthSquared === 0) {
      continue;
    }

    const amount = clamp(
      ((localPoint.x - localStart.x) * segmentX +
        (localPoint.y - localStart.y) * segmentY) /
        segmentLengthSquared,
      0,
      1,
    );
    const projectedLocalPoint = {
      x: localStart.x + segmentX * amount,
      y: localStart.y + segmentY * amount,
    };
    const projectedPoint = fromLocalXY(projectedLocalPoint, point);
    const distanceToRouteMeters = getDistanceMeters(point, projectedPoint);
    const segmentDistanceMeters = getDistanceMeters(segmentStart, segmentEnd);
    const distanceFromStartMeters =
      segmentStart.distanceFromStartMeters + segmentDistanceMeters * amount;

    if (
      !bestProjection ||
      distanceToRouteMeters < bestProjection.distanceToRouteMeters
    ) {
      bestProjection = {
        point: projectedPoint,
        segmentIndex: index,
        distanceFromStartMeters,
        distanceToRouteMeters,
      };
    }
  }

  return bestProjection;
}

export function findNextRouteStep(
  steps: RouteStep[],
  routePoints: RoutePoint[],
  distanceFromStartMeters: number,
): { step: RouteStep | null; distanceMeters: number | null } {
  if (steps.length === 0 || routePoints.length === 0) {
    return {
      step: null,
      distanceMeters: null,
    };
  }

  const stepCandidates = steps
    .map((step) => {
      const projection = projectPointOntoRoute(step.location, routePoints);

      return {
        step,
        distanceFromStartMeters: projection?.distanceFromStartMeters ?? 0,
      };
    })
    .filter((candidate) => candidate.distanceFromStartMeters >= distanceFromStartMeters)
    .sort((a, b) => a.distanceFromStartMeters - b.distanceFromStartMeters);

  const nextStep = stepCandidates[0];

  if (!nextStep) {
    return {
      step: null,
      distanceMeters: null,
    };
  }

  return {
    step: nextStep.step,
    distanceMeters: Math.max(
      0,
      nextStep.distanceFromStartMeters - distanceFromStartMeters,
    ),
  };
}

function getRoutePointAtDistance(
  indexedPoints: IndexedRoutePoint[],
  targetDistanceMeters: number,
): RoutePoint | null {
  if (indexedPoints.length === 0) {
    return null;
  }

  if (targetDistanceMeters <= 0) {
    return indexedPoints[0]!;
  }

  const lastPoint = indexedPoints[indexedPoints.length - 1]!;

  if (targetDistanceMeters >= lastPoint.distanceFromStartMeters) {
    return lastPoint;
  }

  for (let index = 0; index < indexedPoints.length - 1; index += 1) {
    const start = indexedPoints[index]!;
    const end = indexedPoints[index + 1]!;

    if (
      targetDistanceMeters < start.distanceFromStartMeters ||
      targetDistanceMeters > end.distanceFromStartMeters
    ) {
      continue;
    }

    const segmentDistance = end.distanceFromStartMeters - start.distanceFromStartMeters;
    const amount =
      segmentDistance === 0
        ? 0
        : (targetDistanceMeters - start.distanceFromStartMeters) / segmentDistance;

    return {
      lat: start.lat + (end.lat - start.lat) * amount,
      lng: start.lng + (end.lng - start.lng) * amount,
    };
  }

  return lastPoint;
}

function getCurveSeverity(
  angleDegrees: number,
  sharpCurveAngleDegrees: number,
): CurveSeverity {
  return angleDegrees >= sharpCurveAngleDegrees + 20 ? 'sharp' : 'moderate';
}

export function findUpcomingCurve({
  routePoints,
  distanceFromStartMeters,
  warningDistanceMeters,
  sharpCurveAngleDegrees,
}: {
  routePoints: RoutePoint[];
  distanceFromStartMeters: number;
  warningDistanceMeters: number;
  sharpCurveAngleDegrees: number;
}): UpcomingCurve | null {
  if (routePoints.length < 3) {
    return null;
  }

  const indexedPoints = getIndexedRoutePoints(routePoints);
  const scanStartMeters = Math.max(0, distanceFromStartMeters);
  const scanEndMeters = scanStartMeters + warningDistanceMeters;
  const lookBehindMeters = 28;
  const lookAheadMeters = 28;

  for (let distance = scanStartMeters; distance <= scanEndMeters; distance += 12) {
    const before = getRoutePointAtDistance(indexedPoints, distance - lookBehindMeters);
    const center = getRoutePointAtDistance(indexedPoints, distance);
    const after = getRoutePointAtDistance(indexedPoints, distance + lookAheadMeters);

    if (!before || !center || !after) {
      continue;
    }

    const inboundBearing = getBearingDegrees(before, center);
    const outboundBearing = getBearingDegrees(center, after);
    const signedAngle = getSignedAngleDifferenceDegrees(
      inboundBearing,
      outboundBearing,
    );
    const angleDegrees = Math.abs(signedAngle);

    if (angleDegrees < sharpCurveAngleDegrees) {
      continue;
    }

    return {
      distanceMeters: Math.max(0, distance - distanceFromStartMeters),
      severity: getCurveSeverity(angleDegrees, sharpCurveAngleDegrees),
      angleDegrees,
      direction: signedAngle < 0 ? 'left' : 'right',
      point: center,
    };
  }

  return null;
}

export function getRemainingDistanceMeters(
  routePoints: RoutePoint[],
  distanceFromStartMeters: number,
): number {
  return Math.max(0, getRouteDistanceMeters(routePoints) - distanceFromStartMeters);
}

export function formatDistance(meters: number | null): string {
  if (meters === null || Number.isNaN(meters)) {
    return '--';
  }

  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(meters >= 10_000 ? 0 : 1)} km`;
  }

  return `${Math.round(meters)} m`;
}

export function formatSpeed(speedKph: number | null): string {
  if (speedKph === null || Number.isNaN(speedKph)) {
    return '--';
  }

  return `${Math.round(speedKph)} km/h`;
}

export function getEstimatedRemainingDurationSeconds(
  route: RouteData | null,
  remainingMeters: number | null,
): number | null {
  if (!route) {
    return null;
  }

  if (
    remainingMeters === null ||
    Number.isNaN(remainingMeters) ||
    route.distanceMeters <= 0
  ) {
    return route.durationSeconds;
  }

  const progressRatio = Math.min(Math.max(remainingMeters / route.distanceMeters, 0), 1);

  return route.durationSeconds * progressRatio;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) {
    return '--';
  }

  const minutes = Math.max(1, Math.round(seconds / 60));

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours} h ${remainingMinutes} min`
    : `${hours} h`;
}

export function formatEtaFromNow(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) {
    return '--';
  }

  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(Date.now() + seconds * 1000));
}

export function getCurveLabel(curve: UpcomingCurve | null): string {
  if (!curve) {
    return 'Sin curva proxima';
  }

  const directionLabel: Record<CurveDirection, string> = {
    left: 'izquierda',
    right: 'derecha',
  };

  return `${curve.severity === 'sharp' ? 'Curva fuerte' : 'Curva'} a la ${
    directionLabel[curve.direction]
  }`;
}
