import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { useEffect, useRef, useState, type RefObject } from 'react';

import {
  analyzeDrowsinessFrame,
  analyzeFacialMetrics,
  initialDrowsinessRuntimeState,
  type DrowsinessRuntimeState,
} from '../services/drowsinessAnalyzer';
import { FaceDetectionService } from '../services/faceDetectionService';
import type { DrowsinessAnalysis, FacialMetrics } from '../types/detection.types';
import type { DrowsinessSettings } from '../types/settings.types';

interface UseDrowsinessDetectionOptions {
  enabled: boolean;
  settings: DrowsinessSettings;
  videoRef: RefObject<HTMLVideoElement | null>;
}

interface DrowsinessDetectionState {
  isModelLoading: boolean;
  isRunning: boolean;
  errorMessage: string | null;
  faceDetected: boolean;
  metrics: FacialMetrics | null;
  analysis: DrowsinessAnalysis;
  lastFrameTimeMs: number | null;
}

const initialAnalysis: DrowsinessAnalysis = {
  status: 'camera-unavailable',
  fatigueScore: 0,
  activeSignals: [],
  signalDurations: {
    eyesClosedMs: 0,
    yawningMs: 0,
    headTiltMs: 0,
    stillnessMs: 0,
  },
  blinkCountLastWindow: 0,
  shouldTriggerAlert: false,
};

const initialState: DrowsinessDetectionState = {
  isModelLoading: false,
  isRunning: false,
  errorMessage: null,
  faceDetected: false,
  metrics: null,
  analysis: initialAnalysis,
  lastFrameTimeMs: null,
};

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return fallbackMessage;
  }
}

export function useDrowsinessDetection({
  enabled,
  settings,
  videoRef,
}: UseDrowsinessDetectionOptions): DrowsinessDetectionState {
  const serviceRef = useRef<FaceDetectionService | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previousLandmarksRef = useRef<readonly NormalizedLandmark[] | null>(null);
  const settingsRef = useRef(settings);
  const drowsinessRuntimeRef = useRef<DrowsinessRuntimeState>(
    initialDrowsinessRuntimeState,
  );
  const lastVideoTimeRef = useRef(-1);
  const [state, setState] = useState<DrowsinessDetectionState>(initialState);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!enabled) {
      setState(initialState);
      return;
    }

    let isCancelled = false;

    const stopLoop = () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    const runDetectionLoop = () => {
      const video = videoRef.current;

      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        animationFrameRef.current = window.requestAnimationFrame(runDetectionLoop);
        return;
      }

      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;

        try {
          const frameStartedAt = performance.now();
          const result = serviceRef.current?.detect(video, frameStartedAt);
          const hasFace = (result?.faceLandmarks.length ?? 0) > 0;
          const metrics = result
            ? analyzeFacialMetrics({
                result,
                previousLandmarks: previousLandmarksRef.current,
              })
            : null;
          const drowsinessResult = analyzeDrowsinessFrame({
            metrics,
            previousState: drowsinessRuntimeRef.current,
            settings: settingsRef.current,
            timestampMs: frameStartedAt,
          });

          previousLandmarksRef.current = result?.faceLandmarks[0] ?? null;
          drowsinessRuntimeRef.current = drowsinessResult.nextState;

          setState((currentState) => ({
            ...currentState,
            isRunning: true,
            errorMessage: null,
            faceDetected: hasFace,
            metrics,
            analysis: drowsinessResult.analysis,
            lastFrameTimeMs: performance.now() - frameStartedAt,
          }));
        } catch (error) {
          setState((currentState) => ({
            ...currentState,
            isRunning: false,
            errorMessage: getErrorMessage(error, 'Face detection failed.'),
          }));
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(runDetectionLoop);
    };

    const initializeAndStart = async () => {
      setState({
        ...initialState,
        isModelLoading: true,
      });

      try {
        const service = new FaceDetectionService();
        await service.initialize();

        if (isCancelled) {
          service.dispose();
          return;
        }

        serviceRef.current = service;
        setState((currentState) => ({
          ...currentState,
          isModelLoading: false,
          isRunning: true,
        }));

        animationFrameRef.current = window.requestAnimationFrame(runDetectionLoop);
      } catch (error) {
        setState({
          ...initialState,
          errorMessage: getErrorMessage(
            error,
            'MediaPipe Face Landmarker could not be loaded.',
          ),
        });
      }
    };

    void initializeAndStart();

    return () => {
      isCancelled = true;
      stopLoop();
      serviceRef.current?.dispose();
      serviceRef.current = null;
      previousLandmarksRef.current = null;
      drowsinessRuntimeRef.current = initialDrowsinessRuntimeState;
      lastVideoTimeRef.current = -1;
    };
  }, [enabled, videoRef]);

  return state;
}
