import { Camera, Route as RouteIcon } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';

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
import { useLightingAnalysis } from './hooks/useLightingAnalysis';
import type { DetectionStatus as DetectionStatusValue } from './types/detection.types';
import {
  defaultDrowsinessSettings,
  type DrowsinessSettings,
} from './types/settings.types';

type AppView = 'camera' | 'route';

const NavigationView = lazy(async () => {
  const module = await import('./components/NavigationView');

  return {
    default: module.NavigationView,
  };
});

function App() {
  const [activeView, setActiveView] = useState<AppView>('camera');
  const [settings, setSettings] = useState<DrowsinessSettings>(defaultDrowsinessSettings);
  const camera = useCamera({
    cameraEnhancementEnabled: settings.cameraEnhancementEnabled,
  });
  const lightingAnalysis = useLightingAnalysis({
    enabled: camera.status === 'ready' && settings.visibilityMode !== 'off',
    videoRef: camera.videoRef,
  });
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

  const hasLimitedLighting =
    settings.visibilityMode !== 'off' && lightingAnalysis.condition !== 'normal';
  const detectionDetail =
    camera.status !== 'ready'
      ? undefined
      : isAlertActive
        ? 'Alerta activa. Puedes silenciarla desde el boton superior.'
        : detection.isModelLoading
          ? 'Cargando modelo de deteccion facial.'
          : detection.errorMessage
            ? detection.errorMessage
            : detection.faceDetected
              ? `Puntuacion ${Math.round(
                  detection.analysis.fatigueScore,
                )}/100. Ultimo frame en ${
                  detection.lastFrameTimeMs?.toFixed(1) ?? '0.0'
                } ms.`
              : hasLimitedLighting
                ? 'Centra tu rostro y mejora la iluminacion.'
                : 'Centra tu rostro y manten buena iluminacion.';
  const alertBanner = (
    <AlertBanner
      isActive={isAlertActive}
      cooldownRemainingMs={cooldownRemainingMs}
      onSilence={silenceAlert}
    />
  );
  const routeCompanionPanels = (
    <>
      <DetectionStatus status={detectionStatus} detail={detectionDetail} />
      <FatiguePanel analysis={detection.analysis} />
      <InfoSection title="Monitor facial">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-zinc-500">Camara</dt>
            <dd className="mt-1 text-zinc-100">
              {camera.status === 'ready' ? 'Activa' : 'Inactiva'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Fatiga</dt>
            <dd className="mt-1 text-zinc-100">
              {Math.round(detection.analysis.fatigueScore)}/100
            </dd>
          </div>
        </dl>
      </InfoSection>
    </>
  );

  if (activeView === 'route') {
    return (
      <main className="min-h-screen w-full overflow-x-hidden bg-black text-zinc-50">
        <button
          className="fixed left-4 top-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-zinc-950 shadow-xl shadow-black/20 backdrop-blur transition hover:bg-white"
          type="button"
          aria-label="Volver a camara"
          onClick={() => {
            setActiveView('camera');
          }}
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
        </button>
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-black px-4 text-sm font-semibold text-zinc-300">
              Cargando ruta GPS...
            </div>
          }
        >
          <NavigationView
            alertBanner={alertBanner}
            companionPanels={routeCompanionPanels}
            onCurveAlert={triggerAlert}
          />
        </Suspense>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 overflow-x-hidden py-4 pl-3 pr-5 sm:px-4 sm:py-5 lg:px-6">
        <header className="flex flex-col justify-between gap-3 border-b border-zinc-800 pb-4 md:flex-row md:items-end md:pb-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300 sm:text-sm">
              Deteccion local + GPS
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-white sm:text-3xl md:text-4xl">
              Monitor de Fatiga Facial
            </h1>
          </div>
          <p className="w-full min-w-0 max-w-xl rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs leading-5 text-emerald-100 sm:text-sm sm:leading-6">
            Procesamiento local. No se guardan frames.
          </p>
        </header>

        <nav
          className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 p-1 sm:w-fit"
          aria-label="Vista principal"
        >
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition"
            type="button"
            onClick={() => {
              setActiveView('camera');
            }}
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            Camara
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
            type="button"
            onClick={() => {
              setActiveView('route');
            }}
          >
            <RouteIcon className="h-4 w-4" aria-hidden="true" />
            Ruta
          </button>
        </nav>

        <div className="grid min-w-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-5">
          <div className="min-w-0 space-y-4">
            {alertBanner}
            <CameraView
              status={camera.status}
              errorMessage={camera.errorMessage}
              videoRef={camera.videoRef}
              lightingAnalysis={lightingAnalysis}
              visibilityMode={settings.visibilityMode}
              screenLightIntensity={settings.screenLightIntensity}
              videoEnhancementEnabled={settings.videoEnhancementEnabled}
              faceDetected={detection.faceDetected}
              faceDetectionReady={!detection.isModelLoading && !detection.errorMessage}
              onStartCamera={() => {
                void camera.startCamera();
              }}
            />
          </div>

          <aside className="min-w-0 space-y-4">
            <DetectionStatus status={detectionStatus} detail={detectionDetail} />
            <FatiguePanel analysis={detection.analysis} />
            <SettingsPanel
              settings={settings}
              cameraEnhancement={camera.cameraEnhancement}
              adaptiveProfile={detection.analysis.adaptiveProfile}
              onSettingsChange={setSettings}
            />
            <InfoSection title="Motor de deteccion">
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
            <InfoSection title="Metricas en vivo">
              <MetricsPanel metrics={detection.metrics} variant="embedded" />
            </InfoSection>
            <InfoSection title="Privacidad">
              <p className="text-sm leading-6 text-zinc-300">
                Esta app usa WebRTC y deteccion local en el navegador. No hay backend y no
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
