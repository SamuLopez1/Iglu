import type {
  ScreenLightIntensity,
  VisibilityMode,
} from './visibility.types';

export type DetectionSensitivity = 'low' | 'medium' | 'high';
export type AdaptiveDetectionIntensity = 'relaxed' | 'balanced' | 'intense';

export interface DrowsinessSettings {
  adaptiveDetectionEnabled: boolean;
  adaptiveIntensity: AdaptiveDetectionIntensity;
  eyeClosureThreshold: number;
  eyeClosureDurationMs: number;
  yawnThreshold: number;
  headTiltThresholdDegrees: number;
  stillnessThreshold: number;
  stillnessDurationMs: number;
  alertCooldownMs: number;
  soundEnabled: boolean;
  sensitivity: DetectionSensitivity;
  visibilityMode: VisibilityMode;
  screenLightIntensity: ScreenLightIntensity;
  videoEnhancementEnabled: boolean;
  cameraEnhancementEnabled: boolean;
}

export const defaultDrowsinessSettings: DrowsinessSettings = {
  adaptiveDetectionEnabled: true,
  adaptiveIntensity: 'intense',
  eyeClosureThreshold: 0.19,
  eyeClosureDurationMs: 1300,
  yawnThreshold: 0.48,
  headTiltThresholdDegrees: 24,
  stillnessThreshold: 0.0018,
  stillnessDurationMs: 12000,
  alertCooldownMs: 8000,
  soundEnabled: true,
  sensitivity: 'medium',
  visibilityMode: 'auto',
  screenLightIntensity: 'medium',
  videoEnhancementEnabled: true,
  cameraEnhancementEnabled: true,
};
