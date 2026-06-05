import type {
  LightingAnalysisResult,
  LightingCondition,
  LightingMetrics,
  ScreenLightIntensity,
  VisibilityMode,
} from '../types/visibility.types';
import { clamp } from './mathUtils';

export const LIGHTING_ANALYSIS_SAMPLE_WIDTH = 96;
export const LIGHTING_ANALYSIS_SAMPLE_HEIGHT = 54;
export const LIGHTING_ANALYSIS_INTERVAL_MS = 500;

const DARK_LUMA_THRESHOLD = 58;
const BRIGHT_LUMA_THRESHOLD = 215;
const METRIC_SMOOTHING_ALPHA = 0.35;

const LIGHTING_THRESHOLDS = {
  insufficientBrightness: 0.2,
  insufficientDarkRatio: 0.76,
  lowLightBrightness: 0.34,
  lowLightDarkRatio: 0.56,
  backlitBrightRatio: 0.12,
  backlitDarkRatio: 0.34,
  backlitContrast: 0.25,
} as const;

const initialLightingMetrics: LightingMetrics = {
  brightness: 0,
  contrast: 0,
  darkPixelRatio: 0,
  brightPixelRatio: 0,
};

export const initialLightingAnalysis: LightingAnalysisResult = {
  ...initialLightingMetrics,
  condition: 'normal',
  confidence: 0,
};

interface LightingClassification {
  condition: LightingCondition;
  confidence: number;
}

interface VisibilityFilterOptions {
  visibilityMode: VisibilityMode;
  condition: LightingCondition;
  enabled: boolean;
}

interface ScreenLightOptions {
  visibilityMode: VisibilityMode;
  lightingAnalysis: LightingAnalysisResult;
  intensity: ScreenLightIntensity;
  faceDetected: boolean;
  faceDetectionReady: boolean;
}

interface ScreenLightRenderOptions extends ScreenLightOptions {
  intensity: ScreenLightIntensity;
}

export interface ScreenLightRenderValues {
  edgeOpacity: number;
  centerOpacity: number;
  glowOpacity: number;
}

const conditionFilters: Record<LightingCondition, string> = {
  normal: 'none',
  'low-light': 'brightness(1.24) contrast(1.14) saturate(1.06)',
  backlit: 'brightness(1.16) contrast(1.16) saturate(1.04)',
  insufficient: 'brightness(1.36) contrast(1.2) saturate(1.08)',
};

const manualModeFilters: Record<Exclude<VisibilityMode, 'auto' | 'off'>, string> = {
  night: 'brightness(1.34) contrast(1.18) saturate(1.08)',
  backlight: 'brightness(1.2) contrast(1.17) saturate(1.04)',
};

const lightingLabels: Record<LightingCondition, string> = {
  normal: 'Normal',
  'low-light': 'Baja luz',
  backlit: 'Contraluz',
  insufficient: 'Luz insuficiente',
};

const lightingRecommendations: Record<Exclude<LightingCondition, 'normal'>, string> = {
  'low-light': 'Sube el brillo o activa luz de pantalla.',
  backlit: 'Evita luz fuerte detras del rostro.',
  insufficient: 'Deteccion limitada por iluminacion.',
};

const screenLightValues: Record<ScreenLightIntensity, ScreenLightRenderValues> = {
  off: {
    edgeOpacity: 0,
    centerOpacity: 0,
    glowOpacity: 0,
  },
  low: {
    edgeOpacity: 0.18,
    centerOpacity: 0.04,
    glowOpacity: 0.28,
  },
  medium: {
    edgeOpacity: 0.32,
    centerOpacity: 0.07,
    glowOpacity: 0.42,
  },
  high: {
    edgeOpacity: 0.46,
    centerOpacity: 0.1,
    glowOpacity: 0.58,
  },
};

const NIGHT_SCREEN_LIGHT_EDGE_BOOST = {
  edgeOpacity: 2.35,
  centerOpacity: 1.62,
  glowOpacity: 2.05,
} as const;

const SCREEN_LIGHT_ADAPTIVE_MAX_VALUES = {
  edgeOpacity: 1,
  centerOpacity: 0.3,
  glowOpacity: 1,
} as const;

const DARKNESS_SEVERITY_THRESHOLDS = {
  brightnessStart: 0.46,
  brightnessCritical: 0.12,
  darkRatioStart: 0.32,
  darkRatioCritical: 0.82,
  missingFaceBoost: 0.28,
} as const;

export function getLightingPixelThresholds(): {
  darkLumaThreshold: number;
  brightLumaThreshold: number;
} {
  return {
    darkLumaThreshold: DARK_LUMA_THRESHOLD,
    brightLumaThreshold: BRIGHT_LUMA_THRESHOLD,
  };
}

function confidenceFromScore(score: number): number {
  return clamp(0.45 + score * 0.55, 0.45, 0.98);
}

export function hasPotentialBacklight(metrics: LightingMetrics): boolean {
  return (
    metrics.brightPixelRatio >= LIGHTING_THRESHOLDS.backlitBrightRatio &&
    metrics.darkPixelRatio >= LIGHTING_THRESHOLDS.backlitDarkRatio &&
    metrics.contrast >= LIGHTING_THRESHOLDS.backlitContrast
  );
}

export function classifyLightingCondition(
  metrics: LightingMetrics,
): LightingClassification {
  const insufficientScore = Math.max(
    (LIGHTING_THRESHOLDS.insufficientBrightness - metrics.brightness) /
      LIGHTING_THRESHOLDS.insufficientBrightness,
    (metrics.darkPixelRatio - LIGHTING_THRESHOLDS.insufficientDarkRatio) /
      (1 - LIGHTING_THRESHOLDS.insufficientDarkRatio),
  );

  if (insufficientScore > 0) {
    return {
      condition: 'insufficient',
      confidence: confidenceFromScore(insufficientScore),
    };
  }

  if (hasPotentialBacklight(metrics)) {
    const backlightScore = Math.max(
      (metrics.brightPixelRatio - LIGHTING_THRESHOLDS.backlitBrightRatio) /
        (1 - LIGHTING_THRESHOLDS.backlitBrightRatio),
      (metrics.darkPixelRatio - LIGHTING_THRESHOLDS.backlitDarkRatio) /
        (1 - LIGHTING_THRESHOLDS.backlitDarkRatio),
      (metrics.contrast - LIGHTING_THRESHOLDS.backlitContrast) /
        (1 - LIGHTING_THRESHOLDS.backlitContrast),
    );

    return {
      condition: 'backlit',
      confidence: confidenceFromScore(backlightScore),
    };
  }

  const lowLightScore = Math.max(
    (LIGHTING_THRESHOLDS.lowLightBrightness - metrics.brightness) /
      LIGHTING_THRESHOLDS.lowLightBrightness,
    (metrics.darkPixelRatio - LIGHTING_THRESHOLDS.lowLightDarkRatio) /
      (1 - LIGHTING_THRESHOLDS.lowLightDarkRatio),
  );

  if (lowLightScore > 0) {
    return {
      condition: 'low-light',
      confidence: confidenceFromScore(lowLightScore),
    };
  }

  return {
    condition: 'normal',
    confidence: 0.8,
  };
}

export function smoothLightingMetrics(
  previous: LightingMetrics | null,
  current: LightingMetrics,
): LightingMetrics {
  if (!previous) {
    return current;
  }

  return {
    brightness:
      previous.brightness * (1 - METRIC_SMOOTHING_ALPHA) +
      current.brightness * METRIC_SMOOTHING_ALPHA,
    contrast:
      previous.contrast * (1 - METRIC_SMOOTHING_ALPHA) +
      current.contrast * METRIC_SMOOTHING_ALPHA,
    darkPixelRatio:
      previous.darkPixelRatio * (1 - METRIC_SMOOTHING_ALPHA) +
      current.darkPixelRatio * METRIC_SMOOTHING_ALPHA,
    brightPixelRatio:
      previous.brightPixelRatio * (1 - METRIC_SMOOTHING_ALPHA) +
      current.brightPixelRatio * METRIC_SMOOTHING_ALPHA,
  };
}

export function getVisibilityVideoFilter({
  visibilityMode,
  condition,
  enabled,
}: VisibilityFilterOptions): string {
  if (!enabled || visibilityMode === 'off') {
    return 'none';
  }

  if (visibilityMode === 'night' || visibilityMode === 'backlight') {
    return manualModeFilters[visibilityMode];
  }

  return conditionFilters[condition];
}

export function getLightingConditionLabel(condition: LightingCondition): string {
  return lightingLabels[condition];
}

export function getLightingRecommendation(
  condition: LightingCondition,
): string | null {
  if (condition === 'normal') {
    return null;
  }

  return lightingRecommendations[condition];
}

export function shouldUseScreenLight({
  visibilityMode,
  lightingAnalysis,
  intensity,
  faceDetected,
  faceDetectionReady,
}: ScreenLightOptions): boolean {
  if (visibilityMode === 'off' || intensity === 'off') {
    return false;
  }

  if (visibilityMode === 'night') {
    return true;
  }

  if (visibilityMode === 'backlight') {
    return (
      lightingAnalysis.condition === 'backlit' ||
      lightingAnalysis.condition === 'low-light'
    );
  }

  return (
    lightingAnalysis.condition === 'low-light' ||
    lightingAnalysis.condition === 'insufficient' ||
    (faceDetectionReady &&
      !faceDetected &&
      (lightingAnalysis.condition !== 'normal' ||
        lightingAnalysis.brightness < DARKNESS_SEVERITY_THRESHOLDS.brightnessStart))
  );
}

function interpolateLightValue(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function interpolateScreenLightValues(
  start: ScreenLightRenderValues,
  end: ScreenLightRenderValues,
  amount: number,
): ScreenLightRenderValues {
  return {
    edgeOpacity: interpolateLightValue(start.edgeOpacity, end.edgeOpacity, amount),
    centerOpacity: interpolateLightValue(
      start.centerOpacity,
      end.centerOpacity,
      amount,
    ),
    glowOpacity: interpolateLightValue(start.glowOpacity, end.glowOpacity, amount),
  };
}

function getBaseScreenLightValues(
  intensity: ScreenLightIntensity,
  visibilityMode: VisibilityMode,
): ScreenLightRenderValues {
  const values = screenLightValues[intensity];

  if (visibilityMode !== 'night' || intensity === 'off') {
    return values;
  }

  return {
    edgeOpacity: clamp(
      values.edgeOpacity * NIGHT_SCREEN_LIGHT_EDGE_BOOST.edgeOpacity,
      0,
      1,
    ),
    centerOpacity: clamp(
      values.centerOpacity * NIGHT_SCREEN_LIGHT_EDGE_BOOST.centerOpacity,
      0,
      0.3,
    ),
    glowOpacity: clamp(
      values.glowOpacity * NIGHT_SCREEN_LIGHT_EDGE_BOOST.glowOpacity,
      0,
      1,
    ),
  };
}

function getLightingDarknessSeverity({
  brightness,
  darkPixelRatio,
  condition,
}: LightingAnalysisResult): number {
  const brightnessSeverity =
    (DARKNESS_SEVERITY_THRESHOLDS.brightnessStart - brightness) /
    (DARKNESS_SEVERITY_THRESHOLDS.brightnessStart -
      DARKNESS_SEVERITY_THRESHOLDS.brightnessCritical);
  const darkPixelSeverity =
    (darkPixelRatio - DARKNESS_SEVERITY_THRESHOLDS.darkRatioStart) /
    (DARKNESS_SEVERITY_THRESHOLDS.darkRatioCritical -
      DARKNESS_SEVERITY_THRESHOLDS.darkRatioStart);
  const conditionSeverity =
    condition === 'insufficient' ? 1 : condition === 'low-light' ? 0.68 : 0;

  return clamp(
    Math.max(brightnessSeverity, darkPixelSeverity, conditionSeverity),
    0,
    1,
  );
}

export function getScreenLightRenderValues({
  intensity,
  visibilityMode,
  lightingAnalysis,
  faceDetected,
  faceDetectionReady,
}: ScreenLightRenderOptions): ScreenLightRenderValues {
  if (intensity === 'off') {
    return screenLightValues.off;
  }

  const baseValues = getBaseScreenLightValues(intensity, visibilityMode);
  const darknessSeverity = getLightingDarknessSeverity(lightingAnalysis);
  const missingFaceBoost =
    faceDetectionReady && !faceDetected
      ? DARKNESS_SEVERITY_THRESHOLDS.missingFaceBoost
      : 0;
  const adaptiveAmount = clamp(darknessSeverity + missingFaceBoost, 0, 1);

  return interpolateScreenLightValues(
    baseValues,
    SCREEN_LIGHT_ADAPTIVE_MAX_VALUES,
    adaptiveAmount,
  );
}
