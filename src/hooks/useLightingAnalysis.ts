import { useEffect, useState, type RefObject } from 'react';

import type { LightingAnalysisResult, LightingMetrics } from '../types/visibility.types';
import {
  classifyLightingCondition,
  getLightingPixelThresholds,
  initialLightingAnalysis,
  LIGHTING_ANALYSIS_INTERVAL_MS,
  LIGHTING_ANALYSIS_SAMPLE_HEIGHT,
  LIGHTING_ANALYSIS_SAMPLE_WIDTH,
  smoothLightingMetrics,
} from '../utils/visibilityUtils';

interface UseLightingAnalysisOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
}

function calculateLightingMetrics(data: Uint8ClampedArray): LightingMetrics {
  const pixelCount = data.length / 4;

  if (pixelCount === 0) {
    return {
      brightness: 0,
      contrast: 0,
      darkPixelRatio: 0,
      brightPixelRatio: 0,
    };
  }

  const { darkLumaThreshold, brightLumaThreshold } = getLightingPixelThresholds();
  let lumaSum = 0;
  let lumaSquareSum = 0;
  let darkPixels = 0;
  let brightPixels = 0;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const luma = red * 0.299 + green * 0.587 + blue * 0.114;

    lumaSum += luma;
    lumaSquareSum += luma * luma;

    if (luma <= darkLumaThreshold) {
      darkPixels += 1;
    }

    if (luma >= brightLumaThreshold) {
      brightPixels += 1;
    }
  }

  const averageLuma = lumaSum / pixelCount;
  const lumaVariance = Math.max(0, lumaSquareSum / pixelCount - averageLuma ** 2);

  return {
    brightness: averageLuma / 255,
    contrast: Math.sqrt(lumaVariance) / 255,
    darkPixelRatio: darkPixels / pixelCount,
    brightPixelRatio: brightPixels / pixelCount,
  };
}

export function useLightingAnalysis({
  videoRef,
  enabled,
}: UseLightingAnalysisOptions): LightingAnalysisResult {
  const [analysis, setAnalysis] =
    useState<LightingAnalysisResult>(initialLightingAnalysis);

  useEffect(() => {
    if (!enabled) {
      setAnalysis(initialLightingAnalysis);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = LIGHTING_ANALYSIS_SAMPLE_WIDTH;
    canvas.height = LIGHTING_ANALYSIS_SAMPLE_HEIGHT;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    let timeoutId: number | null = null;
    let previousMetrics: LightingMetrics | null = null;

    const clearAnalysisTimer = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const scheduleAnalysis = () => {
      clearAnalysisTimer();
      timeoutId = window.setTimeout(analyzeFrame, LIGHTING_ANALYSIS_INTERVAL_MS);
    };

    const analyzeFrame = () => {
      const video = videoRef.current;

      if (
        !context ||
        !video ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        scheduleAnalysis();
        return;
      }

      try {
        context.drawImage(
          video,
          0,
          0,
          LIGHTING_ANALYSIS_SAMPLE_WIDTH,
          LIGHTING_ANALYSIS_SAMPLE_HEIGHT,
        );

        const imageData = context.getImageData(
          0,
          0,
          LIGHTING_ANALYSIS_SAMPLE_WIDTH,
          LIGHTING_ANALYSIS_SAMPLE_HEIGHT,
        );
        const currentMetrics = calculateLightingMetrics(imageData.data);
        const smoothedMetrics = smoothLightingMetrics(previousMetrics, currentMetrics);
        const classification = classifyLightingCondition(smoothedMetrics);

        previousMetrics = smoothedMetrics;
        setAnalysis({
          ...smoothedMetrics,
          ...classification,
        });
      } catch {
        setAnalysis(initialLightingAnalysis);
      }

      scheduleAnalysis();
    };

    analyzeFrame();

    return () => {
      clearAnalysisTimer();
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [enabled, videoRef]);

  return analysis;
}
