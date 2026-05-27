import { useEffect, useState } from 'react';

import { AlertBanner } from './components/AlertBanner';
import { CameraView } from './components/CameraView';
import { DetectionStatus } from './components/DetectionStatus';
import { FatiguePanel } from './components/FatiguePanel';
import { MetricsPanel } from './components/MetricsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { useAudioAlert } from './hooks/useAudioAlert';
import { useCamera } from './hooks/useCamera';
import { useDrowsinessDetection } from './hooks/useDrowsinessDetection';
import type { DetectionStatus as DetectionStatusValue } from './types/detection.types';
import {
  defaultDrowsinessSettings,
  type DrowsinessSettings,
} from './types/settings.types';

function App() {
  const [settings, setSettings] = useState<DrowsinessSettings>(
    defaultDrowsinessSettings,
  );
  const camera = useCamera();
  const detection = useDrowsinessDetection({
    enabled: camera.status === 'ready',
    settings,
    videoRef: camera.videoRef,
  });
  const {
    isAlertActive,
    cooldownRemainingMs,
    triggerAlert,
    silenceAlert,
  } = useAudioAlert({
    cooldownMs: settings.alertCooldownMs,
    soundEnabled: settings.soundEnabled,
  });

  const detectionStatus: DetectionStatusValue =
    camera.status !== 'ready'
      ? 'camera-unavailable'
      : isAlertActive
        ? 'drowsiness-detected'
        : detection.faceDetected
          ? detection.analysis.status
          : detection.isModelLoading
            ? 'awake'
            : 'no-face';

  useEffect(() => {
    if (detection.analysis.shouldTriggerAlert) {
      triggerAlert();
    }
  }, [detection.analysis.shouldTriggerAlert, triggerAlert]);

  const detectionDetail =
    camera.status !== 'ready'
      ? undefined
      : isAlertActive
        ? 'Audible and visual alert is active. Press Silence to stop the current alarm.'
        : detection.isModelLoading
          ? 'Loading MediaPipe Face Landmarker model.'
          : detection.errorMessage
            ? detection.errorMessage
            : detection.faceDetected
              ? `Score ${Math.round(
                  detection.analysis.fatigueScore,
                )}/100. Last frame analyzed in ${
                  detection.lastFrameTimeMs?.toFixed(1) ?? '0.0'
                } ms.`
              : 'No face landmarks are visible yet. Keep your face centered and well-lit.';

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 lg:px-6">
        <header className="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-cyan-300">
              Local drowsiness detection
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white md:text-4xl">
              Facial Fatigue Monitor
            </h1>
          </div>
          <p className="max-w-xl text-sm leading-6 text-zinc-300">
            Video stays on this device. Frames are analyzed in your browser and are not
            uploaded or stored.
          </p>
        </header>

        <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <AlertBanner
              isActive={isAlertActive}
              cooldownRemainingMs={cooldownRemainingMs}
              onSilence={silenceAlert}
            />
            <CameraView
              status={camera.status}
              errorMessage={camera.errorMessage}
              videoRef={camera.videoRef}
              onStartCamera={() => {
                void camera.startCamera();
              }}
            />
          </div>

          <aside className="space-y-5">
            <DetectionStatus status={detectionStatus} detail={detectionDetail} />
            <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="text-base font-semibold text-white">Detection engine</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-zinc-500">Model</dt>
                  <dd className="mt-1 text-zinc-100">
                    {detection.isModelLoading ? 'Loading' : 'Face Landmarker'}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Runtime</dt>
                  <dd className="mt-1 text-zinc-100">
                    {detection.isRunning ? 'Running' : 'Idle'}
                  </dd>
                </div>
              </dl>
            </section>
            <FatiguePanel analysis={detection.analysis} />
            <SettingsPanel settings={settings} onSettingsChange={setSettings} />
            <MetricsPanel metrics={detection.metrics} />
            <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="text-base font-semibold text-white">Privacy</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                This MVP uses WebRTC camera access and local browser inference. No backend
                endpoint exists in this project, and no face data is persisted.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default App;
