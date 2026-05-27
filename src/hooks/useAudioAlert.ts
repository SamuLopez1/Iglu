import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAudioAlertOptions {
  cooldownMs: number;
  soundEnabled: boolean;
}

interface UseAudioAlertResult {
  isAlertActive: boolean;
  cooldownRemainingMs: number;
  triggerAlert: () => boolean;
  silenceAlert: () => void;
}

type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function createAudioContext(): AudioContext {
  const AudioContextConstructor =
    window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error('Web Audio API is not supported in this browser.');
  }

  return new AudioContextConstructor();
}

export function useAudioAlert({
  cooldownMs,
  soundEnabled,
}: UseAudioAlertOptions): UseAudioAlertResult {
  const audioContextRef = useRef<AudioContext | null>(null);
  const beepIntervalRef = useRef<number | null>(null);
  const lastTriggeredAtRef = useRef<number | null>(null);
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);

  const stopSound = useCallback(() => {
    if (beepIntervalRef.current !== null) {
      window.clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
  }, []);

  const playBeep = useCallback(() => {
    if (!soundEnabled) {
      return;
    }

    const audioContext = audioContextRef.current ?? createAudioContext();
    audioContextRef.current = audioContext;

    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.5, audioContext.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.28);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
  }, [soundEnabled]);

  const startSound = useCallback(() => {
    stopSound();

    if (!soundEnabled) {
      return;
    }

    playBeep();
    beepIntervalRef.current = window.setInterval(playBeep, 650);
  }, [playBeep, soundEnabled, stopSound]);

  const silenceAlert = useCallback(() => {
    setIsAlertActive(false);
    stopSound();
  }, [stopSound]);

  const triggerAlert = useCallback(() => {
    const now = performance.now();
    const lastTriggeredAt = lastTriggeredAtRef.current;

    if (lastTriggeredAt !== null && now - lastTriggeredAt < cooldownMs) {
      return false;
    }

    lastTriggeredAtRef.current = now;
    setIsAlertActive(true);
    setCooldownRemainingMs(cooldownMs);
    startSound();

    return true;
  }, [cooldownMs, startSound]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const lastTriggeredAt = lastTriggeredAtRef.current;

      if (lastTriggeredAt === null) {
        setCooldownRemainingMs(0);
        return;
      }

      setCooldownRemainingMs(
        Math.max(0, cooldownMs - (performance.now() - lastTriggeredAt)),
      );
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [cooldownMs]);

  useEffect(() => stopSound, [stopSound]);

  return {
    isAlertActive,
    cooldownRemainingMs,
    triggerAlert,
    silenceAlert,
  };
}
