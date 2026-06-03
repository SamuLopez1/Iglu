import type { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

import {
  defaultAdaptiveDrowsinessProfile,
  type AdaptiveDrowsinessProfile,
  type AdaptiveDrowsinessThresholds,
  type DrowsinessAnalysis,
  type DrowsinessSignalDurations,
  type FacialMetrics,
} from '../types/detection.types';
import type { DrowsinessSettings } from '../types/settings.types';
import {
  calculateEyeAspectRatio,
  calculateEyeHorizontalSpan,
  calculateLandmarkMovement,
  calculateMouthAspectRatio,
  calculateMouthOpeningRatio,
  getHeadEulerAngles,
} from '../utils/landmarkUtils';
import { average, clamp } from '../utils/mathUtils';

interface AnalyzeFacialMetricsOptions {
  result: FaceLandmarkerResult;
  previousLandmarks: readonly NormalizedLandmark[] | null;
}

export function analyzeFacialMetrics({
  result,
  previousLandmarks,
}: AnalyzeFacialMetricsOptions): FacialMetrics | null {
  const landmarks = result.faceLandmarks[0];

  if (!landmarks) {
    return null;
  }

  const leftEyeAspectRatio = calculateEyeAspectRatio(landmarks, 'left');
  const rightEyeAspectRatio = calculateEyeAspectRatio(landmarks, 'right');
  const leftEyeHorizontalSpan = calculateEyeHorizontalSpan(landmarks, 'left');
  const rightEyeHorizontalSpan = calculateEyeHorizontalSpan(landmarks, 'right');
  const headAngles = getHeadEulerAngles(result.facialTransformationMatrixes[0]);
  const isProfileLike =
    Math.abs(headAngles.yawDegrees) >= PROFILE_EYE_SELECTION_YAW_DEGREES;
  const eyeAspectRatio = isProfileLike
    ? leftEyeHorizontalSpan > rightEyeHorizontalSpan
      ? leftEyeAspectRatio
      : rightEyeAspectRatio
    : average([leftEyeAspectRatio, rightEyeAspectRatio]);

  return {
    leftEyeAspectRatio,
    rightEyeAspectRatio,
    leftEyeHorizontalSpan,
    rightEyeHorizontalSpan,
    eyeAspectRatio,
    mouthAspectRatio: calculateMouthAspectRatio(landmarks),
    mouthOpeningRatio: calculateMouthOpeningRatio(landmarks),
    headPitchDegrees: headAngles.pitchDegrees,
    headYawDegrees: headAngles.yawDegrees,
    headRollDegrees: headAngles.rollDegrees,
    movementAmount: calculateLandmarkMovement(landmarks, previousLandmarks),
  };
}

interface AdaptiveBaseline {
  sampleCount: number;
  eyeAspectRatio: number | null;
  mouthAspectRatio: number | null;
  headPitchDegrees: number | null;
  headYawDegrees: number | null;
  headRollDegrees: number | null;
  movementAmount: number | null;
}

const initialAdaptiveBaseline: AdaptiveBaseline = {
  sampleCount: 0,
  eyeAspectRatio: null,
  mouthAspectRatio: null,
  headPitchDegrees: null,
  headYawDegrees: null,
  headRollDegrees: null,
  movementAmount: null,
};

export interface DrowsinessRuntimeState {
  fatigueScore: number;
  lastTimestampMs: number | null;
  eyesClosedStartedAtMs: number | null;
  yawnStartedAtMs: number | null;
  headTiltStartedAtMs: number | null;
  stillnessStartedAtMs: number | null;
  eyeClosureStartedAtMs: number | null;
  wasEyeClosed: boolean;
  blinkTimestampsMs: number[];
  smoothedMetrics: FacialMetrics | null;
  adaptiveBaseline: AdaptiveBaseline;
}

export const initialDrowsinessRuntimeState: DrowsinessRuntimeState = {
  fatigueScore: 0,
  lastTimestampMs: null,
  eyesClosedStartedAtMs: null,
  yawnStartedAtMs: null,
  headTiltStartedAtMs: null,
  stillnessStartedAtMs: null,
  eyeClosureStartedAtMs: null,
  wasEyeClosed: false,
  blinkTimestampsMs: [],
  smoothedMetrics: null,
  adaptiveBaseline: initialAdaptiveBaseline,
};

interface AnalyzeDrowsinessFrameOptions {
  metrics: FacialMetrics | null;
  previousState: DrowsinessRuntimeState;
  settings: DrowsinessSettings;
  timestampMs: number;
}

interface AnalyzeDrowsinessFrameResult {
  analysis: DrowsinessAnalysis;
  nextState: DrowsinessRuntimeState;
}

const BLINK_WINDOW_MS = 20000;
const MIN_BLINK_DURATION_MS = 80;
const MAX_BLINK_DURATION_MS = 900;
const DROWSY_SCORE_THRESHOLD = 70;
const POSSIBLE_FATIGUE_SCORE_THRESHOLD = 38;
const ADAPTIVE_WARMUP_SAMPLE_COUNT = 24;
const ADAPTIVE_READY_SAMPLE_COUNT = 90;
const PROFILE_EYE_SELECTION_YAW_DEGREES = 18;
const PROFILE_YAW_LIMIT_DEGREES = 54;
const PROFILE_EYE_WIDTH_DOMINANCE_RATIO = 1.16;
const PROFILE_YAWN_MOUTH_OPENING_RATIO = 0.085;
const PROFILE_YAWN_THRESHOLD_SCALE = 1.12;

interface SensitivityTuning {
  eyeThresholdScale: number;
  yawnThresholdScale: number;
  headTiltThresholdScale: number;
  stillnessThresholdScale: number;
  durationScale: number;
  scoreScale: number;
}

const sensitivityTuning: Record<
  DrowsinessSettings['sensitivity'],
  SensitivityTuning
> = {
  low: {
    eyeThresholdScale: 0.92,
    yawnThresholdScale: 1.12,
    headTiltThresholdScale: 1.14,
    stillnessThresholdScale: 0.82,
    durationScale: 1.18,
    scoreScale: 0.9,
  },
  medium: {
    eyeThresholdScale: 1,
    yawnThresholdScale: 1,
    headTiltThresholdScale: 1,
    stillnessThresholdScale: 1,
    durationScale: 1,
    scoreScale: 1,
  },
  high: {
    eyeThresholdScale: 1.08,
    yawnThresholdScale: 0.9,
    headTiltThresholdScale: 0.88,
    stillnessThresholdScale: 1.18,
    durationScale: 0.84,
    scoreScale: 1.12,
  },
};

interface AdaptiveIntensityTuning {
  eyeClosureRatio: number;
  yawnFloorScale: number;
  yawnOffset: number;
  headTiltDegrees: number;
  lookAwayDegrees: number;
  profileDegrees: number;
  stillnessManualScale: number;
  stillnessBaselineRatio: number;
  eyeClosureDurationScale: number;
  scoreScale: number;
}

const adaptiveIntensityTuning: Record<
  DrowsinessSettings['adaptiveIntensity'],
  AdaptiveIntensityTuning
> = {
  relaxed: {
    eyeClosureRatio: 0.62,
    yawnFloorScale: 0.98,
    yawnOffset: 0.22,
    headTiltDegrees: 21,
    lookAwayDegrees: 30,
    profileDegrees: 40,
    stillnessManualScale: 0.82,
    stillnessBaselineRatio: 0.38,
    eyeClosureDurationScale: 1.08,
    scoreScale: 0.9,
  },
  balanced: {
    eyeClosureRatio: 0.68,
    yawnFloorScale: 0.9,
    yawnOffset: 0.18,
    headTiltDegrees: 18,
    lookAwayDegrees: 27,
    profileDegrees: 36,
    stillnessManualScale: 1,
    stillnessBaselineRatio: 0.48,
    eyeClosureDurationScale: 0.9,
    scoreScale: 1,
  },
  intense: {
    eyeClosureRatio: 0.74,
    yawnFloorScale: 0.78,
    yawnOffset: 0.14,
    headTiltDegrees: 14.5,
    lookAwayDegrees: 24,
    profileDegrees: 32,
    stillnessManualScale: 1.18,
    stillnessBaselineRatio: 0.62,
    eyeClosureDurationScale: 0.72,
    scoreScale: 1.16,
  },
};

function smoothMetrics(
  previous: FacialMetrics | null,
  current: FacialMetrics,
): FacialMetrics {
  if (!previous) {
    return current;
  }

  const alpha = 0.35;

  return {
    leftEyeAspectRatio:
      previous.leftEyeAspectRatio * (1 - alpha) + current.leftEyeAspectRatio * alpha,
    rightEyeAspectRatio:
      previous.rightEyeAspectRatio * (1 - alpha) + current.rightEyeAspectRatio * alpha,
    leftEyeHorizontalSpan:
      previous.leftEyeHorizontalSpan * (1 - alpha) +
      current.leftEyeHorizontalSpan * alpha,
    rightEyeHorizontalSpan:
      previous.rightEyeHorizontalSpan * (1 - alpha) +
      current.rightEyeHorizontalSpan * alpha,
    eyeAspectRatio:
      previous.eyeAspectRatio * (1 - alpha) + current.eyeAspectRatio * alpha,
    mouthAspectRatio:
      previous.mouthAspectRatio * (1 - alpha) + current.mouthAspectRatio * alpha,
    mouthOpeningRatio:
      previous.mouthOpeningRatio * (1 - alpha) + current.mouthOpeningRatio * alpha,
    headPitchDegrees:
      previous.headPitchDegrees * (1 - alpha) + current.headPitchDegrees * alpha,
    headYawDegrees:
      previous.headYawDegrees * (1 - alpha) + current.headYawDegrees * alpha,
    headRollDegrees:
      previous.headRollDegrees * (1 - alpha) + current.headRollDegrees * alpha,
    movementAmount:
      previous.movementAmount * (1 - alpha) + current.movementAmount * alpha,
  };
}

function interpolate(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function weightedAverage(
  previous: number | null,
  current: number,
  alpha: number,
): number {
  if (previous === null) {
    return current;
  }

  return previous * (1 - alpha) + current * alpha;
}

function getManualThresholds(
  settings: DrowsinessSettings,
): AdaptiveDrowsinessThresholds {
  const tuning = sensitivityTuning[settings.sensitivity];

  return {
    eyeClosureThreshold: clamp(
      settings.eyeClosureThreshold * tuning.eyeThresholdScale,
      0.1,
      0.36,
    ),
    eyeClosureDurationMs: clamp(
      settings.eyeClosureDurationMs * tuning.durationScale,
      450,
      4000,
    ),
    yawnThreshold: clamp(settings.yawnThreshold * tuning.yawnThresholdScale, 0.24, 0.9),
    headTiltThresholdDegrees: clamp(
      settings.headTiltThresholdDegrees * tuning.headTiltThresholdScale,
      9,
      50,
    ),
    stillnessThreshold: clamp(
      settings.stillnessThreshold * tuning.stillnessThresholdScale,
      0.0004,
      0.008,
    ),
  };
}

function getCalibrationConfidence(baseline: AdaptiveBaseline): number {
  return clamp(baseline.sampleCount / ADAPTIVE_READY_SAMPLE_COUNT, 0, 1);
}

function getEffectiveThresholds(
  settings: DrowsinessSettings,
  baseline: AdaptiveBaseline,
  manualThresholds: AdaptiveDrowsinessThresholds,
): AdaptiveDrowsinessThresholds {
  if (!settings.adaptiveDetectionEnabled) {
    return manualThresholds;
  }

  const intensity = adaptiveIntensityTuning[settings.adaptiveIntensity];
  const confidence = getCalibrationConfidence(baseline);

  const adaptiveEyeThreshold =
    baseline.eyeAspectRatio === null
      ? manualThresholds.eyeClosureThreshold
      : clamp(
          baseline.eyeAspectRatio * intensity.eyeClosureRatio,
          manualThresholds.eyeClosureThreshold * 0.78,
          manualThresholds.eyeClosureThreshold * 1.35,
        );
  const adaptiveYawnThreshold =
    baseline.mouthAspectRatio === null
      ? manualThresholds.yawnThreshold
      : clamp(
          baseline.mouthAspectRatio + intensity.yawnOffset,
          manualThresholds.yawnThreshold * intensity.yawnFloorScale,
          manualThresholds.yawnThreshold * 1.12,
        );
  const adaptiveHeadTiltThreshold = clamp(
    intensity.headTiltDegrees,
    manualThresholds.headTiltThresholdDegrees * 0.5,
    manualThresholds.headTiltThresholdDegrees * 1.05,
  );
  const adaptiveStillnessThreshold =
    baseline.movementAmount === null
      ? manualThresholds.stillnessThreshold
      : clamp(
          Math.max(
            manualThresholds.stillnessThreshold * intensity.stillnessManualScale,
            baseline.movementAmount * intensity.stillnessBaselineRatio,
          ),
          0.0004,
          0.008,
        );
  const adaptiveEyeClosureDurationMs = clamp(
    manualThresholds.eyeClosureDurationMs * intensity.eyeClosureDurationScale,
    450,
    4000,
  );

  return {
    eyeClosureThreshold: interpolate(
      manualThresholds.eyeClosureThreshold,
      adaptiveEyeThreshold,
      confidence,
    ),
    eyeClosureDurationMs: interpolate(
      manualThresholds.eyeClosureDurationMs,
      adaptiveEyeClosureDurationMs,
      confidence,
    ),
    yawnThreshold: interpolate(
      manualThresholds.yawnThreshold,
      adaptiveYawnThreshold,
      confidence,
    ),
    headTiltThresholdDegrees: interpolate(
      manualThresholds.headTiltThresholdDegrees,
      adaptiveHeadTiltThreshold,
      confidence,
    ),
    stillnessThreshold: interpolate(
      manualThresholds.stillnessThreshold,
      adaptiveStillnessThreshold,
      confidence,
    ),
  };
}

function getAdaptiveProfile(
  settings: DrowsinessSettings,
  baseline: AdaptiveBaseline,
  effectiveThresholds: AdaptiveDrowsinessThresholds,
): AdaptiveDrowsinessProfile {
  if (!settings.adaptiveDetectionEnabled) {
    return {
      ...defaultAdaptiveDrowsinessProfile,
      effectiveThresholds,
    };
  }

  const confidence = getCalibrationConfidence(baseline);
  const status =
    baseline.sampleCount < ADAPTIVE_WARMUP_SAMPLE_COUNT
      ? 'warming-up'
      : confidence < 1
        ? 'learning'
        : 'ready';

  return {
    enabled: true,
    status,
    confidence,
    sampleCount: baseline.sampleCount,
    baselineEyeAspectRatio: baseline.eyeAspectRatio,
    baselineMouthAspectRatio: baseline.mouthAspectRatio,
    baselineHeadPitchDegrees: baseline.headPitchDegrees,
    baselineHeadYawDegrees: baseline.headYawDegrees,
    baselineHeadRollDegrees: baseline.headRollDegrees,
    baselineMovementAmount: baseline.movementAmount,
    effectiveThresholds,
  };
}

function getHeadDeviation(
  metrics: FacialMetrics,
  baseline: AdaptiveBaseline,
  settings: DrowsinessSettings,
): { pitchDegrees: number; yawDegrees: number; rollDegrees: number } {
  const baselinePitch =
    settings.adaptiveDetectionEnabled && baseline.headPitchDegrees !== null
      ? baseline.headPitchDegrees
      : 0;
  const baselineYaw =
    settings.adaptiveDetectionEnabled && baseline.headYawDegrees !== null
      ? baseline.headYawDegrees
      : 0;
  const baselineRoll =
    settings.adaptiveDetectionEnabled && baseline.headRollDegrees !== null
      ? baseline.headRollDegrees
      : 0;

  return {
    pitchDegrees: Math.abs(metrics.headPitchDegrees - baselinePitch),
    yawDegrees: Math.abs(metrics.headYawDegrees - baselineYaw),
    rollDegrees: Math.abs(metrics.headRollDegrees - baselineRoll),
  };
}

function getFaceReliability({
  metrics,
  settings,
  headDeviation,
  eyeClosureThreshold,
}: {
  metrics: FacialMetrics;
  settings: DrowsinessSettings;
  headDeviation: { pitchDegrees: number; yawDegrees: number; rollDegrees: number };
  eyeClosureThreshold: number;
}): {
  drowsinessSignalsReliable: boolean;
  eyeSignalsReliable: boolean;
  yawnSignalsReliable: boolean;
  lookAwayOrProfile: boolean;
  profileMode: boolean;
  severeProfile: boolean;
} {
  const intensity = adaptiveIntensityTuning[settings.adaptiveIntensity];
  const lookAwayOrProfile = settings.adaptiveDetectionEnabled
    ? headDeviation.yawDegrees >= intensity.lookAwayDegrees
    : headDeviation.yawDegrees >= 30;
  const profileAngle = settings.adaptiveDetectionEnabled
    ? headDeviation.yawDegrees >= intensity.profileDegrees
    : headDeviation.yawDegrees >= 40;
  const profileMode =
    headDeviation.yawDegrees >= PROFILE_EYE_SELECTION_YAW_DEGREES || profileAngle;
  const severeProfile = headDeviation.yawDegrees >= PROFILE_YAW_LIMIT_DEGREES;
  const eyeAverage = Math.max(metrics.eyeAspectRatio, 0.001);
  const eyeAsymmetryRatio =
    Math.abs(metrics.leftEyeAspectRatio - metrics.rightEyeAspectRatio) / eyeAverage;
  const oneEyeClearlyOpen =
    Math.max(metrics.leftEyeAspectRatio, metrics.rightEyeAspectRatio) >
    eyeClosureThreshold * 1.32;
  const visibleEyeDominance =
    Math.max(metrics.leftEyeHorizontalSpan, metrics.rightEyeHorizontalSpan) /
    Math.max(
      Math.min(metrics.leftEyeHorizontalSpan, metrics.rightEyeHorizontalSpan),
      0.0001,
    );
  const hasDominantVisibleEye =
    profileMode && visibleEyeDominance >= PROFILE_EYE_WIDTH_DOMINANCE_RATIO;
  const asymmetricEyeRead =
    eyeAsymmetryRatio > 0.46 && oneEyeClearlyOpen && !hasDominantVisibleEye;
  const eyeSignalsReliable = !severeProfile && !asymmetricEyeRead;
  const yawnSignalsReliable = !severeProfile;

  return {
    drowsinessSignalsReliable: !severeProfile,
    eyeSignalsReliable,
    yawnSignalsReliable,
    lookAwayOrProfile,
    profileMode,
    severeProfile,
  };
}

function updateAdaptiveBaseline({
  previousBaseline,
  metrics,
  settings,
  effectiveThresholds,
  fatigueScore,
  headDeviation,
}: {
  previousBaseline: AdaptiveBaseline;
  metrics: FacialMetrics;
  settings: DrowsinessSettings;
  effectiveThresholds: AdaptiveDrowsinessThresholds;
  fatigueScore: number;
  headDeviation: { pitchDegrees: number; yawDegrees: number; rollDegrees: number };
}): AdaptiveBaseline {
  if (!settings.adaptiveDetectionEnabled) {
    return previousBaseline;
  }

  const isWarmup = previousBaseline.sampleCount < ADAPTIVE_WARMUP_SAMPLE_COUNT;
  const eyesUsable =
    metrics.eyeAspectRatio >
    effectiveThresholds.eyeClosureThreshold * (isWarmup ? 0.95 : 1.12);
  const mouthUsable =
    metrics.mouthAspectRatio <
    effectiveThresholds.yawnThreshold * (isWarmup ? 1.05 : 0.9);
  const headUsable =
    Math.max(
      headDeviation.pitchDegrees,
      headDeviation.yawDegrees,
      headDeviation.rollDegrees,
    ) <
    effectiveThresholds.headTiltThresholdDegrees * (isWarmup ? 1.25 : 0.72);
  const fatigueUsable = fatigueScore < (isWarmup ? 68 : 38);

  if (!isWarmup && (!eyesUsable || !mouthUsable || !headUsable || !fatigueUsable)) {
    return previousBaseline;
  }

  const sampleCount = previousBaseline.sampleCount + 1;
  const fastAlpha = sampleCount < 36 ? 0.16 : 0.04;
  const slowAlpha = sampleCount < 36 ? 0.05 : 0.012;
  const poseAlpha = sampleCount < 36 ? 0.1 : 0.025;
  const movementAlpha = sampleCount < 36 ? 0.12 : 0.04;

  return {
    sampleCount,
    eyeAspectRatio: weightedAverage(
      previousBaseline.eyeAspectRatio,
      metrics.eyeAspectRatio,
      previousBaseline.eyeAspectRatio !== null &&
        metrics.eyeAspectRatio < previousBaseline.eyeAspectRatio
        ? slowAlpha
        : fastAlpha,
    ),
    mouthAspectRatio: weightedAverage(
      previousBaseline.mouthAspectRatio,
      metrics.mouthAspectRatio,
      previousBaseline.mouthAspectRatio !== null &&
        metrics.mouthAspectRatio > previousBaseline.mouthAspectRatio
        ? slowAlpha
        : fastAlpha,
    ),
    headPitchDegrees: weightedAverage(
      previousBaseline.headPitchDegrees,
      metrics.headPitchDegrees,
      poseAlpha,
    ),
    headYawDegrees: weightedAverage(
      previousBaseline.headYawDegrees,
      metrics.headYawDegrees,
      poseAlpha,
    ),
    headRollDegrees: weightedAverage(
      previousBaseline.headRollDegrees,
      metrics.headRollDegrees,
      poseAlpha,
    ),
    movementAmount: weightedAverage(
      previousBaseline.movementAmount,
      metrics.movementAmount,
      movementAlpha,
    ),
  };
}

function getDuration(startedAtMs: number | null, timestampMs: number): number {
  return startedAtMs === null ? 0 : timestampMs - startedAtMs;
}

function getStatus(
  fatigueScore: number,
  shouldTriggerAlert: boolean,
): DrowsinessAnalysis['status'] {
  if (shouldTriggerAlert || fatigueScore >= DROWSY_SCORE_THRESHOLD) {
    return 'drowsiness-detected';
  }

  if (fatigueScore >= POSSIBLE_FATIGUE_SCORE_THRESHOLD) {
    return 'possible-fatigue';
  }

  return 'awake';
}

export function analyzeDrowsinessFrame({
  metrics,
  previousState,
  settings,
  timestampMs,
}: AnalyzeDrowsinessFrameOptions): AnalyzeDrowsinessFrameResult {
  const manualThresholds = getManualThresholds(settings);
  const effectiveThresholds = getEffectiveThresholds(
    settings,
    previousState.adaptiveBaseline,
    manualThresholds,
  );
  const adaptiveProfile = getAdaptiveProfile(
    settings,
    previousState.adaptiveBaseline,
    effectiveThresholds,
  );

  if (!metrics) {
    return {
      analysis: {
        status: 'no-face',
        fatigueScore: previousState.fatigueScore,
        activeSignals: ['Rostro no detectado'],
        signalDurations: {
          eyesClosedMs: 0,
          yawningMs: 0,
          headTiltMs: 0,
          stillnessMs: 0,
        },
        blinkCountLastWindow: previousState.blinkTimestampsMs.length,
        shouldTriggerAlert: false,
        adaptiveProfile,
      },
      nextState: {
        ...previousState,
        lastTimestampMs: timestampMs,
        smoothedMetrics: null,
      },
    };
  }

  const smoothedMetrics = smoothMetrics(previousState.smoothedMetrics, metrics);
  const elapsedMs =
    previousState.lastTimestampMs === null
      ? 16
      : Math.min(timestampMs - previousState.lastTimestampMs, 250);
  const elapsedSeconds = elapsedMs / 1000;
  const headDeviation = getHeadDeviation(
    smoothedMetrics,
    previousState.adaptiveBaseline,
    settings,
  );
  const faceReliability = getFaceReliability({
    metrics: smoothedMetrics,
    settings,
    headDeviation,
    eyeClosureThreshold: effectiveThresholds.eyeClosureThreshold,
  });

  const bothEyesClosed =
    smoothedMetrics.leftEyeAspectRatio < effectiveThresholds.eyeClosureThreshold &&
    smoothedMetrics.rightEyeAspectRatio < effectiveThresholds.eyeClosureThreshold;
  const averageEyesClosed =
    !faceReliability.profileMode &&
    smoothedMetrics.eyeAspectRatio < effectiveThresholds.eyeClosureThreshold &&
    Math.max(smoothedMetrics.leftEyeAspectRatio, smoothedMetrics.rightEyeAspectRatio) <
      effectiveThresholds.eyeClosureThreshold * 1.28;
  const profileVisibleEyeClosed =
    faceReliability.profileMode &&
    smoothedMetrics.eyeAspectRatio < effectiveThresholds.eyeClosureThreshold;
  const eyeClosed =
    faceReliability.drowsinessSignalsReliable &&
    faceReliability.eyeSignalsReliable &&
    (bothEyesClosed || averageEyesClosed || profileVisibleEyeClosed);
  const frontalYawn = smoothedMetrics.mouthAspectRatio > effectiveThresholds.yawnThreshold;
  const profileYawn =
    faceReliability.profileMode &&
    smoothedMetrics.mouthAspectRatio >
      effectiveThresholds.yawnThreshold * PROFILE_YAWN_THRESHOLD_SCALE &&
    smoothedMetrics.mouthOpeningRatio > PROFILE_YAWN_MOUTH_OPENING_RATIO;
  const yawning =
    faceReliability.drowsinessSignalsReliable &&
    faceReliability.yawnSignalsReliable &&
    (faceReliability.profileMode ? profileYawn : frontalYawn);
  const headTilted =
    faceReliability.drowsinessSignalsReliable &&
    (headDeviation.pitchDegrees > effectiveThresholds.headTiltThresholdDegrees ||
      headDeviation.rollDegrees > effectiveThresholds.headTiltThresholdDegrees);
  const unusuallyStill =
    faceReliability.drowsinessSignalsReliable &&
    smoothedMetrics.movementAmount < effectiveThresholds.stillnessThreshold;

  const eyesClosedStartedAtMs =
    eyeClosed && previousState.eyesClosedStartedAtMs === null
      ? timestampMs
      : eyeClosed
        ? previousState.eyesClosedStartedAtMs
        : null;
  const yawnStartedAtMs =
    yawning && previousState.yawnStartedAtMs === null
      ? timestampMs
      : yawning
        ? previousState.yawnStartedAtMs
        : null;
  const headTiltStartedAtMs =
    headTilted && previousState.headTiltStartedAtMs === null
      ? timestampMs
      : headTilted
        ? previousState.headTiltStartedAtMs
        : null;
  const stillnessStartedAtMs =
    unusuallyStill && previousState.stillnessStartedAtMs === null
      ? timestampMs
      : unusuallyStill
        ? previousState.stillnessStartedAtMs
        : null;

  const eyeClosureStartedAtMs =
    eyeClosed && previousState.eyeClosureStartedAtMs === null
      ? timestampMs
      : eyeClosed
        ? previousState.eyeClosureStartedAtMs
        : null;

  const closedBlinkDurationMs =
    faceReliability.drowsinessSignalsReliable &&
    faceReliability.eyeSignalsReliable &&
    !eyeClosed &&
    previousState.wasEyeClosed
      ? getDuration(previousState.eyeClosureStartedAtMs, timestampMs)
      : 0;
  const nextBlinkTimestamps = previousState.blinkTimestampsMs.filter(
    (blinkTimestampMs) => timestampMs - blinkTimestampMs <= BLINK_WINDOW_MS,
  );

  if (
    closedBlinkDurationMs >= MIN_BLINK_DURATION_MS &&
    closedBlinkDurationMs <= MAX_BLINK_DURATION_MS
  ) {
    nextBlinkTimestamps.push(timestampMs);
  }

  const signalDurations: DrowsinessSignalDurations = {
    eyesClosedMs: getDuration(eyesClosedStartedAtMs, timestampMs),
    yawningMs: getDuration(yawnStartedAtMs, timestampMs),
    headTiltMs: getDuration(headTiltStartedAtMs, timestampMs),
    stillnessMs: getDuration(stillnessStartedAtMs, timestampMs),
  };

  const activeSignals: string[] = [];
  if (faceReliability.lookAwayOrProfile) {
    activeSignals.push('Rostro fuera de angulo');
  }

  const adaptiveScoreScale = settings.adaptiveDetectionEnabled
    ? interpolate(
        1,
        adaptiveIntensityTuning[settings.adaptiveIntensity].scoreScale,
        adaptiveProfile.confidence,
      )
    : 1;
  const scoreScale = sensitivityTuning[settings.sensitivity].scoreScale * adaptiveScoreScale;
  const addScore = (amount: number) => {
    fatigueScore += elapsedSeconds * amount * scoreScale;
  };
  let fatigueScore = Math.max(
    0,
    previousState.fatigueScore -
      elapsedSeconds * (faceReliability.drowsinessSignalsReliable ? 10 : 18),
  );

  if (eyeClosed) {
    activeSignals.push('Ojos cerrados');
    addScore(34);
  }

  if (signalDurations.eyesClosedMs >= effectiveThresholds.eyeClosureDurationMs) {
    addScore(46);
  }

  if (yawning) {
    activeSignals.push('Bostezo');
    addScore(18);
  }

  if (signalDurations.yawningMs >= 1400) {
    addScore(26);
  }

  if (headTilted) {
    activeSignals.push('Cabeza inclinada');
    addScore(18);
  }

  if (signalDurations.headTiltMs >= 1200) {
    addScore(22);
  }

  if (signalDurations.stillnessMs >= settings.stillnessDurationMs) {
    activeSignals.push('Bajo movimiento facial');
    addScore(12);
  }

  if (nextBlinkTimestamps.length >= 5) {
    activeSignals.push('Parpadeo repetido');
    addScore(20);
  }

  fatigueScore = clamp(fatigueScore, 0, 100);

  const shouldTriggerAlert =
    faceReliability.drowsinessSignalsReliable &&
    (fatigueScore >= DROWSY_SCORE_THRESHOLD ||
      signalDurations.eyesClosedMs >= effectiveThresholds.eyeClosureDurationMs * 1.35);
  const nextAdaptiveBaseline = updateAdaptiveBaseline({
    previousBaseline: previousState.adaptiveBaseline,
    metrics: smoothedMetrics,
    settings,
    effectiveThresholds,
    fatigueScore,
    headDeviation,
  });
  const nextEffectiveThresholds = getEffectiveThresholds(
    settings,
    nextAdaptiveBaseline,
    manualThresholds,
  );
  const nextAdaptiveProfile = getAdaptiveProfile(
    settings,
    nextAdaptiveBaseline,
    nextEffectiveThresholds,
  );

  return {
    analysis: {
      status: faceReliability.drowsinessSignalsReliable
        ? getStatus(fatigueScore, shouldTriggerAlert)
        : 'awake',
      fatigueScore,
      activeSignals,
      signalDurations,
      blinkCountLastWindow: nextBlinkTimestamps.length,
      shouldTriggerAlert,
      adaptiveProfile: nextAdaptiveProfile,
    },
    nextState: {
      fatigueScore,
      lastTimestampMs: timestampMs,
      eyesClosedStartedAtMs,
      yawnStartedAtMs,
      headTiltStartedAtMs,
      stillnessStartedAtMs,
      eyeClosureStartedAtMs,
      wasEyeClosed: eyeClosed,
      blinkTimestampsMs: nextBlinkTimestamps,
      smoothedMetrics,
      adaptiveBaseline: nextAdaptiveBaseline,
    },
  };
}
