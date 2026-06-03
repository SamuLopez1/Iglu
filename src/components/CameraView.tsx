import { Camera, CameraOff, Maximize2, Minimize2, Play } from 'lucide-react';
import { useMemo, useRef, type CSSProperties, type RefObject } from 'react';

import { useFullscreen } from '../hooks/useFullscreen';
import type { CameraStatus } from '../types/detection.types';
import type {
  LightingAnalysisResult,
  LightingCondition,
  ScreenLightIntensity,
  VisibilityMode,
} from '../types/visibility.types';
import {
  getLightingConditionLabel,
  getLightingRecommendation,
  getScreenLightRenderValues,
  getVisibilityVideoFilter,
  shouldUseScreenLight,
} from '../utils/visibilityUtils';

interface CameraViewProps {
  status: CameraStatus;
  errorMessage: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  lightingAnalysis: LightingAnalysisResult;
  visibilityMode: VisibilityMode;
  screenLightIntensity: ScreenLightIntensity;
  videoEnhancementEnabled: boolean;
  onStartCamera: () => void;
}

const lightingBadgeClassNames: Record<LightingCondition, string> = {
  normal: 'border-emerald-300/30 bg-emerald-950/80 text-emerald-100',
  'low-light': 'border-amber-300/40 bg-amber-950/85 text-amber-100',
  backlit: 'border-sky-300/40 bg-sky-950/85 text-sky-100',
  insufficient: 'border-rose-300/45 bg-rose-950/85 text-rose-100',
};

export function CameraView({
  status,
  errorMessage,
  videoRef,
  lightingAnalysis,
  visibilityMode,
  screenLightIntensity,
  videoEnhancementEnabled,
  onStartCamera,
}: CameraViewProps) {
  const cameraShellRef = useRef<HTMLElement | null>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen(cameraShellRef);
  const isCameraReady = status === 'ready';
  const isRequesting = status === 'requesting';
  const FullscreenIcon = isFullscreen ? Minimize2 : Maximize2;
  const fullscreenLabel = isFullscreen
    ? 'Salir de pantalla completa'
    : 'Pantalla completa';
  const lightingRecommendation = getLightingRecommendation(lightingAnalysis.condition);
  const showLightingBadge = isCameraReady && visibilityMode !== 'off';
  const screenLightActive = shouldUseScreenLight({
    visibilityMode,
    condition: lightingAnalysis.condition,
    intensity: screenLightIntensity,
  });
  const screenLightValues = getScreenLightRenderValues(
    screenLightIntensity,
    visibilityMode,
  );
  const videoStyle = useMemo<CSSProperties>(
    () => ({
      filter: getVisibilityVideoFilter({
        visibilityMode,
        condition: lightingAnalysis.condition,
        enabled: videoEnhancementEnabled,
      }),
      transition: 'filter 360ms ease',
    }),
    [lightingAnalysis.condition, videoEnhancementEnabled, visibilityMode],
  );

  const edgeLightStyle = {
    background: `rgba(255, 255, 245, ${screenLightValues.edgeOpacity})`,
  };
  const softLightStyle = {
    background: `rgba(255, 255, 245, ${screenLightValues.centerOpacity})`,
    boxShadow: `inset 0 0 56px 22px rgba(255, 255, 245, ${screenLightValues.glowOpacity})`,
  };

  return (
    <section
      ref={cameraShellRef}
      className={`w-full max-w-full overflow-hidden border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/20 ${
        isFullscreen ? 'fixed inset-0 z-50 h-dvh rounded-none border-0' : 'rounded-lg'
      }`}
    >
      <div
        className={`relative bg-black ${
          isFullscreen
            ? 'h-[calc(100dvh-44px)]'
            : 'aspect-[9/16] max-h-[72dvh] sm:aspect-video sm:max-h-none'
        }`}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          style={videoStyle}
          muted
          playsInline
          autoPlay
        />

        {screenLightActive && (
          <div
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
            aria-hidden="true"
          >
            <div className="absolute inset-0" style={softLightStyle} />
            <div className="absolute inset-x-0 top-0 h-8 sm:h-12" style={edgeLightStyle} />
            <div
              className="absolute inset-x-0 bottom-0 h-8 sm:h-12"
              style={edgeLightStyle}
            />
            <div className="absolute inset-y-0 left-0 w-5 sm:w-8" style={edgeLightStyle} />
            <div
              className="absolute inset-y-0 right-0 w-5 sm:w-8"
              style={edgeLightStyle}
            />
          </div>
        )}

        <button
          className="absolute left-2 top-2 z-20 inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-white/15 bg-zinc-950/80 text-zinc-100 shadow-lg shadow-black/30 backdrop-blur transition hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          type="button"
          aria-label={fullscreenLabel}
          title={fullscreenLabel}
          onClick={() => {
            void toggleFullscreen();
          }}
        >
          <FullscreenIcon className="h-4 w-4" aria-hidden="true" />
        </button>

        {showLightingBadge && (
          <div
            className={`absolute right-2 top-2 z-20 max-w-[calc(100%-4rem)] rounded-md border px-2.5 py-2 text-xs shadow-lg shadow-black/30 backdrop-blur ${lightingBadgeClassNames[lightingAnalysis.condition]}`}
            aria-live="polite"
          >
            <p className="font-semibold leading-none">
              {getLightingConditionLabel(lightingAnalysis.condition)}
            </p>
            {lightingRecommendation && (
              <p className="mt-1 max-w-56 leading-4 opacity-85">
                {lightingRecommendation}
              </p>
            )}
          </div>
        )}

        {!isCameraReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/95 px-5 text-center sm:gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 sm:h-14 sm:w-14">
              {status === 'error' ? (
                <CameraOff
                  className="h-6 w-6 text-rose-300 sm:h-7 sm:w-7"
                  aria-hidden="true"
                />
              ) : (
                <Camera
                  className="h-6 w-6 text-cyan-300 sm:h-7 sm:w-7"
                  aria-hidden="true"
                />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white sm:text-lg">
                {status === 'error' ? 'Camara no disponible' : 'Permiso de camara'}
              </h2>
              <p className="mt-1 max-w-md text-xs leading-5 text-zinc-300 sm:mt-2 sm:text-sm sm:leading-6">
                {errorMessage ??
                  'Activa la camara para iniciar la deteccion facial local.'}
              </p>
            </div>
            <button
              className="inline-flex min-h-11 w-full max-w-56 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              type="button"
              onClick={onStartCamera}
              disabled={isRequesting}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              {isRequesting ? 'Solicitando permiso' : 'Iniciar camara'}
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-3 py-2.5 text-xs text-zinc-300 sm:px-4 sm:py-3 sm:text-sm">
        <span>{isCameraReady ? 'Camara activa' : 'Camara inactiva'}</span>
        <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-[11px] font-medium text-emerald-200 sm:text-xs">
          Local
        </span>
      </div>
    </section>
  );
}
