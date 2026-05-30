import { useCallback, useEffect, useState, type RefObject } from 'react';

interface UseFullscreenResult {
  isFullscreen: boolean;
  toggleFullscreen: () => Promise<void>;
}

export function useFullscreen(
  targetRef: RefObject<HTMLElement | null>,
): UseFullscreenResult {
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(false);

  const syncNativeFullscreen = useCallback(() => {
    setIsNativeFullscreen(document.fullscreenElement === targetRef.current);
  }, [targetRef]);

  const enterFullscreen = useCallback(async () => {
    const target = targetRef.current;

    if (!target) {
      return;
    }

    if (target.requestFullscreen) {
      try {
        await target.requestFullscreen();
        return;
      } catch {
        setIsFallbackFullscreen(true);
        return;
      }
    }

    setIsFallbackFullscreen(true);
  }, [targetRef]);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        setIsNativeFullscreen(false);
      }
    }

    setIsFallbackFullscreen(false);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (isNativeFullscreen || isFallbackFullscreen) {
      await exitFullscreen();
      return;
    }

    await enterFullscreen();
  }, [enterFullscreen, exitFullscreen, isFallbackFullscreen, isNativeFullscreen]);

  useEffect(() => {
    document.addEventListener('fullscreenchange', syncNativeFullscreen);

    return () => {
      document.removeEventListener('fullscreenchange', syncNativeFullscreen);
    };
  }, [syncNativeFullscreen]);

  useEffect(() => {
    if (!isFallbackFullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFallbackFullscreen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFallbackFullscreen]);

  return {
    isFullscreen: isNativeFullscreen || isFallbackFullscreen,
    toggleFullscreen,
  };
}
