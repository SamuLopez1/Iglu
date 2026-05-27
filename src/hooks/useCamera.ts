import { useCallback, useEffect, useRef, useState } from 'react';

import type { CameraState } from '../types/detection.types';

interface UseCameraResult extends CameraState {
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

const getCameraErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'Camera permission was denied. Allow camera access to start detection.';
    }

    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'No camera was found on this device.';
    }

    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'The camera is already in use by another application.';
    }
  }

  return 'The camera could not be started.';
};

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
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
        errorMessage: 'This browser does not support camera access.',
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

  useEffect(() => stopCamera, [stopCamera]);

  return {
    ...state,
    stream,
    videoRef,
    startCamera,
    stopCamera,
  };
}
