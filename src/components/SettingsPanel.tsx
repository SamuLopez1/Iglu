import { Camera, Gauge, Sparkles, Volume2, VolumeX } from 'lucide-react';

import type {
  DetectionSensitivity,
  DrowsinessSettings,
} from '../types/settings.types';
import type {
  CameraEnhancementState,
  ScreenLightIntensity,
  VisibilityMode,
} from '../types/visibility.types';

interface SettingsPanelProps {
  settings: DrowsinessSettings;
  cameraEnhancement: CameraEnhancementState;
  onSettingsChange: (settings: DrowsinessSettings) => void;
}

const sensitivityOptions: DetectionSensitivity[] = ['low', 'medium', 'high'];
const sensitivityLabels: Record<DetectionSensitivity, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

const visibilityModeOptions: VisibilityMode[] = ['auto', 'night', 'backlight', 'off'];
const visibilityModeLabels: Record<VisibilityMode, string> = {
  auto: 'Auto',
  night: 'Noche',
  backlight: 'Contraluz',
  off: 'Off',
};

const screenLightOptions: ScreenLightIntensity[] = ['off', 'low', 'medium', 'high'];
const screenLightLabels: Record<ScreenLightIntensity, string> = {
  off: 'Off',
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

function getCameraEnhancementLabel(
  settings: DrowsinessSettings,
  cameraEnhancement: CameraEnhancementState,
): string {
  if (!settings.cameraEnhancementEnabled) {
    return 'Off';
  }

  if (cameraEnhancement.applied) {
    return 'Aplicada';
  }

  if (cameraEnhancement.supported) {
    return 'Disponible';
  }

  return 'Auto';
}

export function SettingsPanel({
  settings,
  cameraEnhancement,
  onSettingsChange,
}: SettingsPanelProps) {
  const updateSettings = (patch: Partial<DrowsinessSettings>) => {
    onSettingsChange({ ...settings, ...patch });
  };

  return (
    <section className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 p-3.5 sm:p-4">
      <div className="flex items-center gap-2">
        <Gauge className="h-5 w-5 text-cyan-300" aria-hidden="true" />
        <h2 className="text-base font-semibold text-white">Ajustes</h2>
      </div>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="flex min-w-0 items-center justify-between gap-3 text-sm text-zinc-300">
            Umbral de ojos
            <span className="shrink-0 font-mono text-zinc-100">
              {settings.eyeClosureThreshold.toFixed(2)}
            </span>
          </span>
          <input
            className="mt-2 block h-2 w-full min-w-0 accent-cyan-300"
            type="range"
            min="0.12"
            max="0.28"
            step="0.01"
            value={settings.eyeClosureThreshold}
            onChange={(event) =>
              updateSettings({ eyeClosureThreshold: Number(event.target.value) })
            }
          />
        </label>

        <label className="block">
          <span className="flex min-w-0 items-center justify-between gap-3 text-sm text-zinc-300">
            Tiempo de cierre
            <span className="shrink-0 font-mono text-zinc-100">
              {(settings.eyeClosureDurationMs / 1000).toFixed(1)}s
            </span>
          </span>
          <input
            className="mt-2 block h-2 w-full min-w-0 accent-cyan-300"
            type="range"
            min="600"
            max="3000"
            step="100"
            value={settings.eyeClosureDurationMs}
            onChange={(event) =>
              updateSettings({ eyeClosureDurationMs: Number(event.target.value) })
            }
          />
        </label>

        <label className="block">
          <span className="flex min-w-0 items-center justify-between gap-3 text-sm text-zinc-300">
            Sensibilidad de bostezo
            <span className="shrink-0 font-mono text-zinc-100">
              {settings.yawnThreshold.toFixed(2)}
            </span>
          </span>
          <input
            className="mt-2 block h-2 w-full min-w-0 accent-cyan-300"
            type="range"
            min="0.32"
            max="0.7"
            step="0.01"
            value={settings.yawnThreshold}
            onChange={(event) =>
              updateSettings({ yawnThreshold: Number(event.target.value) })
            }
          />
        </label>

        <label className="block">
          <span className="flex min-w-0 items-center justify-between gap-3 text-sm text-zinc-300">
            Pausa entre alertas
            <span className="shrink-0 font-mono text-zinc-100">
              {(settings.alertCooldownMs / 1000).toFixed(0)}s
            </span>
          </span>
          <input
            className="mt-2 block h-2 w-full min-w-0 accent-cyan-300"
            type="range"
            min="3000"
            max="30000"
            step="1000"
            value={settings.alertCooldownMs}
            onChange={(event) =>
              updateSettings({ alertCooldownMs: Number(event.target.value) })
            }
          />
        </label>

        <fieldset className="min-w-0">
          <legend className="text-sm text-zinc-300">Modo visibilidad</legend>
          <div className="mt-2 grid min-w-0 grid-cols-4 rounded-md border border-zinc-700 bg-zinc-950 p-1">
            {visibilityModeOptions.map((option) => {
              const isSelected = settings.visibilityMode === option;

              return (
                <button
                  key={option}
                  className={`min-h-10 min-w-0 rounded px-1 text-xs font-semibold transition sm:px-2 ${
                    isSelected
                      ? 'bg-cyan-300 text-zinc-950'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => updateSettings({ visibilityMode: option })}
                >
                  {visibilityModeLabels[option]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="text-sm text-zinc-300">Luz de pantalla</legend>
          <div className="mt-2 grid min-w-0 grid-cols-4 rounded-md border border-zinc-700 bg-zinc-950 p-1">
            {screenLightOptions.map((option) => {
              const isSelected = settings.screenLightIntensity === option;

              return (
                <button
                  key={option}
                  className={`min-h-10 min-w-0 rounded px-1 text-xs font-semibold transition sm:px-2 ${
                    isSelected
                      ? 'bg-cyan-300 text-zinc-950'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => updateSettings({ screenLightIntensity: option })}
                >
                  {screenLightLabels[option]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="text-sm text-zinc-300">Sensibilidad</legend>
          <div className="mt-2 grid min-w-0 grid-cols-3 rounded-md border border-zinc-700 bg-zinc-950 p-1">
            {sensitivityOptions.map((option) => {
              const isSelected = settings.sensitivity === option;

              return (
                <button
                  key={option}
                  className={`min-h-10 min-w-0 rounded px-2 text-sm font-semibold transition ${
                    isSelected
                      ? 'bg-cyan-300 text-zinc-950'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => updateSettings({ sensitivity: option })}
                >
                  {sensitivityLabels[option]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${
              settings.videoEnhancementEnabled
                ? 'border-cyan-300 bg-cyan-300 text-zinc-950'
                : 'border-zinc-700 bg-zinc-950 text-zinc-100 hover:border-cyan-300'
            }`}
            type="button"
            aria-pressed={settings.videoEnhancementEnabled}
            onClick={() =>
              updateSettings({
                videoEnhancementEnabled: !settings.videoEnhancementEnabled,
              })
            }
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Visual
            <span className="ml-auto text-[11px] opacity-80">
              {settings.videoEnhancementEnabled ? 'On' : 'Off'}
            </span>
          </button>

          <button
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${
              settings.cameraEnhancementEnabled
                ? 'border-cyan-300 bg-cyan-300 text-zinc-950'
                : 'border-zinc-700 bg-zinc-950 text-zinc-100 hover:border-cyan-300'
            }`}
            type="button"
            aria-pressed={settings.cameraEnhancementEnabled}
            onClick={() =>
              updateSettings({
                cameraEnhancementEnabled: !settings.cameraEnhancementEnabled,
              })
            }
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            Camara
            <span className="ml-auto text-[11px] opacity-80">
              {getCameraEnhancementLabel(settings, cameraEnhancement)}
            </span>
          </button>
        </div>

        <button
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-cyan-300"
          type="button"
          aria-pressed={settings.soundEnabled}
          onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
        >
          {settings.soundEnabled ? (
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <VolumeX className="h-4 w-4" aria-hidden="true" />
          )}
          {settings.soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}
        </button>
      </div>
    </section>
  );
}
