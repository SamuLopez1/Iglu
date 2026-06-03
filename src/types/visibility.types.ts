export type LightingCondition = 'normal' | 'low-light' | 'backlit' | 'insufficient';

export type VisibilityMode = 'auto' | 'night' | 'backlight' | 'off';

export type ScreenLightIntensity = 'off' | 'low' | 'medium' | 'high';

export interface LightingMetrics {
  brightness: number;
  contrast: number;
  darkPixelRatio: number;
  brightPixelRatio: number;
}

export interface LightingAnalysisResult extends LightingMetrics {
  condition: LightingCondition;
  confidence: number;
}

export interface CameraEnhancementState {
  supported: boolean;
  applied: boolean;
  torchAvailable: boolean;
  exposureCompensationAvailable: boolean;
  appliedConstraints: string[];
  errorMessage: string | null;
}
