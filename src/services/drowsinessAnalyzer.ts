import type { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

import type {
  DrowsinessAnalysis,
  DrowsinessSignalDurations,
  FacialMetrics,
} from '../types/detection.types';
import type { DrowsinessSettings } from '../types/settings.types';
import {
  calculateEyeAspectRatio,
  calculateLandmarkMovement,
  calculateMouthAspectRatio,
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
  const headAngles = getHeadEulerAngles(result.facialTransformationMatrixes[0]);

  return {
    leftEyeAspectRatio,
    rightEyeAspectRatio,
    eyeAspectRatio: average([leftEyeAspectRatio, rightEyeAspectRatio]),
    mouthAspectRatio: calculateMouthAspectRatio(landmarks),
    headPitchDegrees: headAngles.pitchDegrees,
    headYawDegrees: headAngles.yawDegrees,
    headRollDegrees: headAngles.rollDegrees,
    movementAmount: calculateLandmarkMovement(landmarks, previousLandmarks),
  };
}

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

const sensitivityMultiplier: Record<DrowsinessSettings['sensitivity'], number> = {
  low: 1.16,
  medium: 1,
  high: 0.86,
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
    eyeAspectRatio:
      previous.eyeAspectRatio * (1 - alpha) + current.eyeAspectRatio * alpha,
    mouthAspectRatio:
      previous.mouthAspectRatio * (1 - alpha) + current.mouthAspectRatio * alpha,
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
  if (!metrics) {
    return {
      analysis: {
        status: 'no-face',
        fatigueScore: previousState.fatigueScore,
        activeSignals: ['No face detected'],
        signalDurations: {
          eyesClosedMs: 0,
          yawningMs: 0,
          headTiltMs: 0,
          stillnessMs: 0,
        },
        blinkCountLastWindow: previousState.blinkTimestampsMs.length,
        shouldTriggerAlert: false,
      },
      nextState: {
        ...previousState,
        lastTimestampMs: timestampMs,
        smoothedMetrics: null,
      },
    };
  }

  const multiplier = sensitivityMultiplier[settings.sensitivity];
  const smoothedMetrics = smoothMetrics(previousState.smoothedMetrics, metrics);
  const elapsedMs =
    previousState.lastTimestampMs === null
      ? 16
      : Math.min(timestampMs - previousState.lastTimestampMs, 250);
  const elapsedSeconds = elapsedMs / 1000;

  const eyeClosedThreshold = settings.eyeClosureThreshold * multiplier;
  const yawnThreshold = settings.yawnThreshold * multiplier;
  const headTiltThreshold = settings.headTiltThresholdDegrees * multiplier;
  const eyeClosed = smoothedMetrics.eyeAspectRatio < eyeClosedThreshold;
  const yawning = smoothedMetrics.mouthAspectRatio > yawnThreshold;
  const headTilted =
    Math.abs(smoothedMetrics.headPitchDegrees) > headTiltThreshold ||
    Math.abs(smoothedMetrics.headRollDegrees) > headTiltThreshold;
  const unusuallyStill = smoothedMetrics.movementAmount < settings.stillnessThreshold;

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
    !eyeClosed && previousState.wasEyeClosed
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
  let fatigueScore = Math.max(0, previousState.fatigueScore - elapsedSeconds * 10);

  if (eyeClosed) {
    activeSignals.push('Eyes closed');
    fatigueScore += elapsedSeconds * 34;
  }

  if (signalDurations.eyesClosedMs >= settings.eyeClosureDurationMs) {
    fatigueScore += elapsedSeconds * 46;
  }

  if (yawning) {
    activeSignals.push('Yawning');
    fatigueScore += elapsedSeconds * 18;
  }

  if (signalDurations.yawningMs >= 1400) {
    fatigueScore += elapsedSeconds * 26;
  }

  if (headTilted) {
    activeSignals.push('Head tilt');
    fatigueScore += elapsedSeconds * 18;
  }

  if (signalDurations.headTiltMs >= 1200) {
    fatigueScore += elapsedSeconds * 22;
  }

  if (signalDurations.stillnessMs >= settings.stillnessDurationMs) {
    activeSignals.push('Low facial movement');
    fatigueScore += elapsedSeconds * 12;
  }

  if (nextBlinkTimestamps.length >= 5) {
    activeSignals.push('Repeated blinking');
    fatigueScore += elapsedSeconds * 20;
  }

  fatigueScore = clamp(fatigueScore, 0, 100);

  const shouldTriggerAlert =
    fatigueScore >= DROWSY_SCORE_THRESHOLD ||
    signalDurations.eyesClosedMs >= settings.eyeClosureDurationMs * 1.35;

  return {
    analysis: {
      status: getStatus(fatigueScore, shouldTriggerAlert),
      fatigueScore,
      activeSignals,
      signalDurations,
      blinkCountLastWindow: nextBlinkTimestamps.length,
      shouldTriggerAlert,
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
    },
  };
}
