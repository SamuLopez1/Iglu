import type { CameraEnhancementState } from '../types/visibility.types';

interface NumericCameraCapability {
  min: number;
  max: number;
  step?: number;
}

interface EnhancedMediaTrackCapabilities extends MediaTrackCapabilities {
  exposureCompensation?: NumericCameraCapability;
  torch?: boolean;
}

interface EnhancedMediaTrackConstraintSet extends MediaTrackConstraintSet {
  exposureCompensation?: number;
  torch?: boolean;
}

export const initialCameraEnhancementState: CameraEnhancementState = {
  supported: false,
  applied: false,
  torchAvailable: false,
  exposureCompensationAvailable: false,
  appliedConstraints: [],
  errorMessage: null,
};

const PREFERRED_EXPOSURE_COMPENSATION = 0.7;
const PREFERRED_FRAME_RATE = 30;
const MIN_STABLE_FRAME_RATE = 24;
const PREFERRED_STABLE_WIDTH = 1280;
const PREFERRED_STABLE_HEIGHT = 720;
const MIN_STABLE_WIDTH = 640;
const MIN_STABLE_HEIGHT = 480;

function isNumericCameraCapability(
  capability: unknown,
): capability is NumericCameraCapability {
  if (typeof capability !== 'object' || capability === null) {
    return false;
  }

  const range = capability as Partial<NumericCameraCapability>;

  return typeof range.min === 'number' && typeof range.max === 'number';
}

function getExposureCompensationTarget(
  capability: NumericCameraCapability | undefined,
): number | null {
  if (!capability || capability.max <= 0) {
    return null;
  }

  const target = Math.min(capability.max, PREFERRED_EXPOSURE_COMPENSATION);

  return Math.max(capability.min, target);
}

function getFrameRateTarget(capability: MediaSettingsRange | undefined): number | null {
  if (
    !capability ||
    typeof capability.min !== 'number' ||
    typeof capability.max !== 'number' ||
    capability.max < MIN_STABLE_FRAME_RATE
  ) {
    return null;
  }

  const target = Math.min(capability.max, PREFERRED_FRAME_RATE);

  return target >= capability.min ? target : null;
}

function getDimensionTarget(
  capability: MediaSettingsRange | undefined,
  currentValue: number | undefined,
  preferredValue: number,
  minimumValue: number,
): number | null {
  if (
    !capability ||
    typeof capability.min !== 'number' ||
    typeof capability.max !== 'number' ||
    capability.max < minimumValue ||
    (currentValue !== undefined && currentValue >= minimumValue)
  ) {
    return null;
  }

  const target = Math.min(capability.max, preferredValue);

  return target >= capability.min ? target : null;
}

async function applySingleConstraint(
  track: MediaStreamTrack,
  constraint: EnhancedMediaTrackConstraintSet,
): Promise<boolean> {
  try {
    await track.applyConstraints({
      advanced: [constraint],
    });
    return true;
  } catch {
    return false;
  }
}

export async function applyCameraEnhancements(
  track: MediaStreamTrack,
): Promise<CameraEnhancementState> {
  if (
    track.kind !== 'video' ||
    typeof track.getCapabilities !== 'function' ||
    typeof track.getSettings !== 'function' ||
    typeof track.applyConstraints !== 'function'
  ) {
    return initialCameraEnhancementState;
  }

  const capabilities = track.getCapabilities() as EnhancedMediaTrackCapabilities;
  const settings = track.getSettings();
  const appliedConstraints: string[] = [];
  const exposureCompensationAvailable = isNumericCameraCapability(
    capabilities.exposureCompensation,
  );
  const torchAvailable = capabilities.torch === true;
  const exposureTarget = getExposureCompensationTarget(
    exposureCompensationAvailable ? capabilities.exposureCompensation : undefined,
  );
  const frameRateTarget = getFrameRateTarget(capabilities.frameRate);
  const widthTarget = getDimensionTarget(
    capabilities.width,
    settings.width,
    PREFERRED_STABLE_WIDTH,
    MIN_STABLE_WIDTH,
  );
  const heightTarget = getDimensionTarget(
    capabilities.height,
    settings.height,
    PREFERRED_STABLE_HEIGHT,
    MIN_STABLE_HEIGHT,
  );
  const isUserFacingCamera =
    settings.facingMode === 'user' || settings.facingMode === undefined;

  if (exposureTarget !== null) {
    const didApply = await applySingleConstraint(track, {
      exposureCompensation: exposureTarget,
    });

    if (didApply) {
      appliedConstraints.push('exposureCompensation');
    }
  }

  if (frameRateTarget !== null) {
    const didApply = await applySingleConstraint(track, {
      frameRate: frameRateTarget,
    });

    if (didApply) {
      appliedConstraints.push('frameRate');
    }
  }

  if (widthTarget !== null && heightTarget !== null) {
    const didApply = await applySingleConstraint(track, {
      width: widthTarget,
      height: heightTarget,
    });

    if (didApply) {
      appliedConstraints.push('resolution');
    }
  }

  if (torchAvailable && !isUserFacingCamera) {
    const didApply = await applySingleConstraint(track, {
      torch: true,
    });

    if (didApply) {
      appliedConstraints.push('torch');
    }
  }

  return {
    supported:
      exposureCompensationAvailable ||
      Boolean(capabilities.frameRate) ||
      torchAvailable,
    applied: appliedConstraints.length > 0,
    torchAvailable,
    exposureCompensationAvailable,
    appliedConstraints,
    errorMessage: null,
  };
}
