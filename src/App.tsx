import { useEffect, useState } from 'react';

import { AlertBanner } from './components/AlertBanner';
import { CameraView } from './components/CameraView';
import { DetectionStatus } from './components/DetectionStatus';
import { FatiguePanel } from './components/FatiguePanel';
import { InfoSection } from './components/InfoSection';
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
  const [settings, setSettings] = useState<DrowsinessSettings>(defaultDrowsinessSettings);
  const camera = useCamera();
  const detection = useDrowsinessDetection({
    enabled: camera.status === 'ready',
    settings,
    videoRef: camera.videoRef,
  });
  const { isAlertActive, cooldownRemainingMs, triggerAlert, silenceAlert } =
    useAudioAlert({
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
        ? 'Alerta activa. Puedes silenciarla desde el botón superior.'
        : detection.isModelLoading
          ? 'Cargando modelo de detección facial.'
          : detection.errorMessage
            ? detection.errorMessage
            : detection.faceDetected
              ? `Puntuación ${Math.round(
                  detection.analysis.fatigueScore,
                )}/100. Último frame en ${
                  detection.lastFrameTimeMs?.toFixed(1) ?? '0.0'
                } ms.`
              : 'Centra tu rostro y mantén buena iluminación.';

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 overflow-x-hidden py-4 pl-3 pr-5 sm:px-4 sm:py-5 lg:px-6">
        <header className="flex flex-col justify-between gap-3 border-b border-zinc-800 pb-4 md:flex-row md:items-end md:pb-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300 sm:text-sm">
              Detección local
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-white sm:text-3xl md:text-4xl">
              Monitor de Fatiga Facial
            </h1>
          </div>
          <p className="w-full min-w-0 max-w-xl rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs leading-5 text-emerald-100 sm:text-sm sm:leading-6">
            Procesamiento local. No se guardan frames.
          </p>
        </header>

        <div className="grid min-w-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-5">
          <div className="min-w-0 space-y-4">
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

          <aside className="min-w-0 space-y-4">
            <DetectionStatus status={detectionStatus} detail={detectionDetail} />
            <FatiguePanel analysis={detection.analysis} />
            <SettingsPanel settings={settings} onSettingsChange={setSettings} />
            <InfoSection title="Motor de detección">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-zinc-500">Modelo</dt>
                  <dd className="mt-1 text-zinc-100">
                    {detection.isModelLoading ? 'Cargando' : 'Face Landmarker'}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Runtime</dt>
                  <dd className="mt-1 text-zinc-100">
                    {detection.isRunning ? 'Activo' : 'En espera'}
                  </dd>
                </div>
              </dl>
            </InfoSection>
            <InfoSection title="Métricas en vivo">
              <MetricsPanel metrics={detection.metrics} variant="embedded" />
            </InfoSection>
            <InfoSection title="Privacidad">
              <p className="text-sm leading-6 text-zinc-300">
                Esta app usa WebRTC y detección local en el navegador. No hay backend y no
                se persisten datos faciales.
              </p>
            </InfoSection>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default App;
