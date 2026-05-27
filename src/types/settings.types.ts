export type DetectionSensitivity = 'low' | 'medium' | 'high';

export interface DrowsinessSettings {
  eyeClosureThreshold: number;
  eyeClosureDurationMs: number;
  yawnThreshold: number;
  headTiltThresholdDegrees: number;
  stillnessThreshold: number;
  stillnessDurationMs: number;
  alertCooldownMs: number;
  soundEnabled: boolean;
  sensitivity: DetectionSensitivity;
}

export const defaultDrowsinessSettings: DrowsinessSettings = {
  eyeClosureThreshold: 0.19,
  eyeClosureDurationMs: 1500,
  yawnThreshold: 0.48,
  headTiltThresholdDegrees: 24,
  stillnessThreshold: 0.0018,
  stillnessDurationMs: 12000,
  alertCooldownMs: 8000,
  soundEnabled: true,
  sensitivity: 'medium',
};
