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
  eyeAspectRatio: number;
  mouthAspectRatio: number;
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

export interface DrowsinessAnalysis {
  status: DetectionStatus;
  fatigueScore: number;
  activeSignals: string[];
  signalDurations: DrowsinessSignalDurations;
  blinkCountLastWindow: number;
  shouldTriggerAlert: boolean;
}
