export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'error';

export type DetectionStatus =
  | 'awake'
  | 'possible-fatigue'
  | 'drowsiness-detected'
  | 'no-face'
  | 'camera-unavailable';

export interface CameraState {
  status: CameraStatus;
  errorMessage: string | null;
}

export interface FacialMetrics {
  leftEyeAspectRatio: number;
  rightEyeAspectRatio: number;
  leftEyeHorizontalSpan: number;
  rightEyeHorizontalSpan: number;
  eyeAspectRatio: number;
  mouthAspectRatio: number;
  mouthOpeningRatio: number;
  headPitchDegrees: number;
  headYawDegrees: number;
  headRollDegrees: number;
  movementAmount: number;
}

export interface DrowsinessSignalDurations {
  eyesClosedMs: number;
  yawningMs: number;
  headTiltMs: number;
  stillnessMs: number;
}

export type AdaptiveCalibrationStatus =
  | 'disabled'
  | 'warming-up'
  | 'learning'
  | 'ready';

export interface AdaptiveDrowsinessThresholds {
  eyeClosureThreshold: number;
  eyeClosureDurationMs: number;
  yawnThreshold: number;
  headTiltThresholdDegrees: number;
  stillnessThreshold: number;
}

export interface AdaptiveDrowsinessProfile {
  enabled: boolean;
  status: AdaptiveCalibrationStatus;
  confidence: number;
  sampleCount: number;
  baselineEyeAspectRatio: number | null;
  baselineMouthAspectRatio: number | null;
  baselineHeadPitchDegrees: number | null;
  baselineHeadYawDegrees: number | null;
  baselineHeadRollDegrees: number | null;
  baselineMovementAmount: number | null;
  effectiveThresholds: AdaptiveDrowsinessThresholds;
}

export const defaultAdaptiveDrowsinessThresholds: AdaptiveDrowsinessThresholds = {
  eyeClosureThreshold: 0.19,
  eyeClosureDurationMs: 1300,
  yawnThreshold: 0.48,
  headTiltThresholdDegrees: 24,
  stillnessThreshold: 0.0018,
};

export const defaultAdaptiveDrowsinessProfile: AdaptiveDrowsinessProfile = {
  enabled: false,
  status: 'disabled',
  confidence: 0,
  sampleCount: 0,
  baselineEyeAspectRatio: null,
  baselineMouthAspectRatio: null,
  baselineHeadPitchDegrees: null,
  baselineHeadYawDegrees: null,
  baselineHeadRollDegrees: null,
  baselineMovementAmount: null,
  effectiveThresholds: defaultAdaptiveDrowsinessThresholds,
};

export interface DrowsinessAnalysis {
  status: DetectionStatus;
  fatigueScore: number;
  activeSignals: string[];
  signalDurations: DrowsinessSignalDurations;
  blinkCountLastWindow: number;
  shouldTriggerAlert: boolean;
  adaptiveProfile: AdaptiveDrowsinessProfile;
}
