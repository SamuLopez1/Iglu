import { Camera, CameraOff, Play } from 'lucide-react';

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
  const isCameraReady = status === 'ready';
  const isRequesting = status === 'requesting';

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          autoPlay
        />

        {!isCameraReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/95 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900">
              {status === 'error' ? (
                <CameraOff className="h-7 w-7 text-rose-300" aria-hidden="true" />
              ) : (
                <Camera className="h-7 w-7 text-cyan-300" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {status === 'error' ? 'Camera unavailable' : 'Camera access required'}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-300">
                {errorMessage ??
                  'Start the camera to run facial landmark detection locally in this browser.'}
              </p>
            </div>
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={onStartCamera}
              disabled={isRequesting}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              {isRequesting ? 'Requesting access' : 'Start camera'}
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-4 py-3 text-sm text-zinc-300">
        <span>{isCameraReady ? 'Camera active' : 'Camera inactive'}</span>
        <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs font-medium text-emerald-200">
          Local processing only
        </span>
      </div>
    </section>
  );
}
