export interface RoutePoint {
  lat: number;
  lng: number;
}

export type GpsQuality = 'good' | 'weak' | 'unavailable';
export type GpsTrackingStatus = 'idle' | 'requesting' | 'tracking' | 'error' | 'demo';

export interface GpsReading extends RoutePoint {
  accuracyMeters: number | null;
  headingDegrees: number | null;
  speedKph: number | null;
  timestamp: number;
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  maneuverType: string;
  maneuverModifier: string | null;
  location: RoutePoint;
}

export interface RouteData {
  points: RoutePoint[];
  steps: RouteStep[];
  distanceMeters: number;
  durationSeconds: number;
}

export interface DestinationSearchResult {
  id: string;
  name: string;
  fullAddress: string;
  point: RoutePoint;
}

export type CurveSeverity = 'moderate' | 'sharp';
export type CurveDirection = 'left' | 'right';

export interface UpcomingCurve {
  distanceMeters: number;
  severity: CurveSeverity;
  angleDegrees: number;
  direction: CurveDirection;
  point: RoutePoint;
}

export interface RouteProgress {
  currentPoint: RoutePoint | null;
  speedKph: number | null;
  headingDegrees: number | null;
  remainingMeters: number | null;
  distanceToRouteMeters: number | null;
  nextStep: RouteStep | null;
  distanceToNextStepMeters: number | null;
  upcomingCurve: UpcomingCurve | null;
  isOffRoute: boolean;
}

export interface NavigationSettings {
  curveWarningDistanceMeters: number;
  sharpCurveAngleDegrees: number;
  offRouteThresholdMeters: number;
}

export type RouteLoadingReason = 'destination' | 'route' | 'reroute';

export const defaultNavigationSettings: NavigationSettings = {
  curveWarningDistanceMeters: 120,
  sharpCurveAngleDegrees: 55,
  offRouteThresholdMeters: 45,
};
