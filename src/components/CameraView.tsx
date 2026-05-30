import { Camera, CameraOff, Maximize2, Minimize2, Play } from 'lucide-react';
import { useRef } from 'react';

import { useFullscreen } from '../hooks/useFullscreen';
import type { CameraStatus } from '../types/detection.types';

interface CameraViewProps {
  status: CameraStatus;
  errorMessage: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onStartCamera: () => void;
}

export function CameraView({
  status,
  errorMessage,
  videoRef,
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

  return (
    <section
      ref={cameraShellRef}
      className={`w-full max-w-full overflow-hidden border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/20 ${
        isFullscreen ? 'fixed inset-0 z-50 h-dvh rounded-none border-0' : 'rounded-lg'
      }`}
    >
      <div
        className={`relative bg-black ${
          isFullscreen ? 'h-[calc(100dvh-44px)]' : 'aspect-video'
        }`}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          autoPlay
        />

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
                {status === 'error' ? 'Cámara no disponible' : 'Permiso de cámara'}
              </h2>
              <p className="mt-1 max-w-md text-xs leading-5 text-zinc-300 sm:mt-2 sm:text-sm sm:leading-6">
                {errorMessage ??
                  'Activa la cámara para iniciar la detección facial local.'}
              </p>
            </div>
            <button
              className="inline-flex min-h-11 w-full max-w-56 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              type="button"
              onClick={onStartCamera}
              disabled={isRequesting}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              {isRequesting ? 'Solicitando permiso' : 'Iniciar cámara'}
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-3 py-2.5 text-xs text-zinc-300 sm:px-4 sm:py-3 sm:text-sm">
        <span>{isCameraReady ? 'Cámara activa' : 'Cámara inactiva'}</span>
        <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-[11px] font-medium text-emerald-200 sm:text-xs">
          Local
        </span>
      </div>
    </section>
  );
}
