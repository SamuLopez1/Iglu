import type { Matrix, NormalizedLandmark } from '@mediapipe/tasks-vision';

import { average, distance, radiansToDegrees, type Point2D } from './mathUtils';

const LEFT_EYE = {
  outer: 33,
  inner: 133,
  upperOuter: 160,
  lowerOuter: 144,
  upperInner: 158,
  lowerInner: 153,
} as const;

const RIGHT_EYE = {
  outer: 362,
  inner: 263,
  upperOuter: 385,
  lowerOuter: 380,
  upperInner: 387,
  lowerInner: 373,
} as const;

const MOUTH = {
  leftCorner: 61,
  rightCorner: 291,
  upperLip: 13,
  lowerLip: 14,
} as const;

const MOVEMENT_SAMPLE_INDICES = [1, 33, 61, 133, 152, 263, 291, 362] as const;

function getPoint(landmarks: readonly NormalizedLandmark[], index: number): Point2D {
  const landmark = landmarks[index];

  if (!landmark) {
    throw new Error(`Missing face landmark at index ${index}.`);
  }

  return { x: landmark.x, y: landmark.y };
}

function getSamplePoints(landmarks: readonly NormalizedLandmark[]): Point2D[] {
  return MOVEMENT_SAMPLE_INDICES.map((index) => getPoint(landmarks, index));
}

export function calculateEyeAspectRatio(
  landmarks: readonly NormalizedLandmark[],
  side: 'left' | 'right',
): number {
  const eye = side === 'left' ? LEFT_EYE : RIGHT_EYE;
  const horizontal = distance(
    getPoint(landmarks, eye.outer),
    getPoint(landmarks, eye.inner),
  );

  if (horizontal === 0) {
    return 0;
  }

  const verticalOuter = distance(
    getPoint(landmarks, eye.upperOuter),
    getPoint(landmarks, eye.lowerOuter),
  );
  const verticalInner = distance(
    getPoint(landmarks, eye.upperInner),
    getPoint(landmarks, eye.lowerInner),
  );

  return (verticalOuter + verticalInner) / (2 * horizontal);
}

export function calculateMouthAspectRatio(
  landmarks: readonly NormalizedLandmark[],
): number {
  const horizontal = distance(
    getPoint(landmarks, MOUTH.leftCorner),
    getPoint(landmarks, MOUTH.rightCorner),
  );

  if (horizontal === 0) {
    return 0;
  }

  const vertical = distance(
    getPoint(landmarks, MOUTH.upperLip),
    getPoint(landmarks, MOUTH.lowerLip),
  );

  return vertical / horizontal;
}

export function calculateLandmarkMovement(
  currentLandmarks: readonly NormalizedLandmark[],
  previousLandmarks: readonly NormalizedLandmark[] | null,
): number {
  if (!previousLandmarks) {
    return 1;
  }

  const currentSample = getSamplePoints(currentLandmarks);
  const previousSample = getSamplePoints(previousLandmarks);
  const pointDeltas = currentSample.map((point, index) =>
    distance(point, previousSample[index] ?? point),
  );

  return average(pointDeltas);
}

export function getHeadEulerAngles(matrix: Matrix | undefined): {
  pitchDegrees: number;
  yawDegrees: number;
  rollDegrees: number;
} {
  if (!matrix || matrix.data.length < 16) {
    return {
      pitchDegrees: 0,
      yawDegrees: 0,
      rollDegrees: 0,
    };
  }

  const [r00, , , , r10, , , , r20, r21, r22] = matrix.data;
  const safeR00 = r00 ?? 1;
  const safeR10 = r10 ?? 0;
  const safeR20 = r20 ?? 0;
  const safeR21 = r21 ?? 0;
  const safeR22 = r22 ?? 1;
  const sy = Math.sqrt(safeR00 * safeR00 + safeR10 * safeR10);

  return {
    pitchDegrees: radiansToDegrees(Math.atan2(safeR21, safeR22)),
    yawDegrees: radiansToDegrees(Math.atan2(-safeR20, sy)),
    rollDegrees: radiansToDegrees(Math.atan2(safeR10, safeR00 || 1)),
  };
}
