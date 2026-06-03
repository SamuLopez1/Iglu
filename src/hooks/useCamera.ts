import { useCallback, useEffect, useRef, useState } from 'react';

import type { CameraState } from '../types/detection.types';
import type { CameraEnhancementState } from '../types/visibility.types';
import {
  applyCameraEnhancements,
  initialCameraEnhancementState,
} from '../utils/cameraEnhancements';

interface UseCameraOptions {
  cameraEnhancementEnabled?: boolean;
}

interface UseCameraResult extends CameraState {
  stream: MediaStream | null;
  cameraEnhancement: CameraEnhancementState;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

const getCameraErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'El permiso de cámara fue denegado. Actívalo para iniciar la detección.';
    }

    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'No se encontró una cámara en este dispositivo.';
    }

    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'La cámara ya está siendo usada por otra aplicación.';
    }
  }

  return 'No se pudo iniciar la cámara.';
};

export function useCamera({
  cameraEnhancementEnabled = true,
}: UseCameraOptions = {}): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraEnhancement, setCameraEnhancement] =
    useState<CameraEnhancementState>(initialCameraEnhancementState);
  const [state, setState] = useState<CameraState>({
    status: 'idle',
    errorMessage: null,
  });

  const stopCamera = useCallback(() => {
    setStream((currentStream) => {
      currentStream?.getTracks().forEach((track) => {
        track.stop();
      });
      return null;
    });

    setState((currentState) => ({
      status: currentState.status === 'error' ? 'error' : 'idle',
      errorMessage: currentState.errorMessage,
    }));
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState({
        status: 'error',
        errorMessage: 'Este navegador no soporta acceso a la cámara.',
      });
      return;
    }

    setState({ status: 'requesting', errorMessage: null });

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });

      setStream(mediaStream);
      setState({ status: 'ready', errorMessage: null });
    } catch (error) {
      setStream(null);
      setState({
        status: 'error',
        errorMessage: getCameraErrorMessage(error),
      });
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    const videoTrack = stream?.getVideoTracks()[0];

    if (!videoTrack || !cameraEnhancementEnabled) {
      setCameraEnhancement(initialCameraEnhancementState);
      return;
    }

    let isCancelled = false;

    const enhanceCamera = async () => {
      const nextCameraEnhancement = await applyCameraEnhancements(videoTrack);

      if (!isCancelled) {
        setCameraEnhancement(nextCameraEnhancement);
      }
    };

    void enhanceCamera();

    return () => {
      isCancelled = true;
    };
  }, [cameraEnhancementEnabled, stream]);

  useEffect(() => stopCamera, [stopCamera]);

  return {
    ...state,
    stream,
    cameraEnhancement,
    videoRef,
    startCamera,
    stopCamera,
  };
}
