import { useState } from 'react';
import {
  Activity,
  Camera,
  Gauge,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';

import type { AdaptiveDrowsinessProfile } from '../types/detection.types';
import type {
  AdaptiveDetectionIntensity,
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
  adaptiveProfile: AdaptiveDrowsinessProfile;
  onSettingsChange: (settings: DrowsinessSettings) => void;
}

type SettingsTab = 'auto' | 'manual' | 'camera';

interface RangeControlProps {
  label: string;
  value: number;
  displayValue: string;
  min: string;
  max: string;
  step: string;
  onChange: (value: number) => void;
}

const tabOptions: Array<{ value: SettingsTab; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'manual', label: 'Manual' },
  { value: 'camera', label: 'Camara' },
];

const sensitivityOptions: DetectionSensitivity[] = ['low', 'medium', 'high'];
const sensitivityLabels: Record<DetectionSensitivity, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

const adaptiveIntensityOptions: AdaptiveDetectionIntensity[] = [
  'relaxed',
  'balanced',
  'intense',
];
const adaptiveIntensityLabels: Record<AdaptiveDetectionIntensity, string> = {
  relaxed: 'Suave',
  balanced: 'Balanceada',
  intense: 'Intensa',
};

const calibrationStatusLabels: Record<AdaptiveDrowsinessProfile['status'], string> = {
  disabled: 'Off',
  'warming-up': 'Calibrando',
  learning: 'Aprendiendo',
  ready: 'Lista',
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

const formatMetric = (
  value: number | null | undefined,
  digits = 2,
  suffix = '',
): string => (value === null || value === undefined ? '-' : `${value.toFixed(digits)}${suffix}`);

function RangeControl({
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onChange,
}: RangeControlProps) {
  return (
    <label className="block">
      <span className="flex min-w-0 items-center justify-between gap-3 text-sm text-zinc-300">
        {label}
        <span className="shrink-0 font-mono text-zinc-100">{displayValue}</span>
      </span>
      <input
        className="mt-2 block h-2 w-full min-w-0 accent-cyan-300"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function SettingsPanel({
  settings,
  cameraEnhancement,
  adaptiveProfile,
  onSettingsChange,
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('auto');
  const updateSettings = (patch: Partial<DrowsinessSettings>) => {
    onSettingsChange({ ...settings, ...patch });
  };
  const confidencePercent = Math.round(adaptiveProfile.confidence * 100);
  const calibrationStatusLabel =
    settings.adaptiveDetectionEnabled && adaptiveProfile.status === 'disabled'
      ? 'En espera'
      : calibrationStatusLabels[adaptiveProfile.status];

  return (
    <section className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 p-3.5 sm:p-4">
      <div className="flex items-center gap-2">
        <Gauge className="h-5 w-5 text-cyan-300" aria-hidden="true" />
        <h2 className="text-base font-semibold text-white">Ajustes</h2>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-3 rounded-md border border-zinc-700 bg-zinc-950 p-1">
        {tabOptions.map((tab) => {
          const isSelected = activeTab === tab.value;

          return (
            <button
              key={tab.value}
              className={`min-h-10 min-w-0 rounded px-2 text-sm font-semibold transition ${
                isSelected
                  ? 'bg-cyan-300 text-zinc-950'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'auto' && (
        <div className="mt-4 space-y-4">
          <button
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${
              settings.adaptiveDetectionEnabled
                ? 'border-cyan-300 bg-cyan-300 text-zinc-950'
                : 'border-zinc-700 bg-zinc-950 text-zinc-100 hover:border-cyan-300'
            }`}
            type="button"
            aria-pressed={settings.adaptiveDetectionEnabled}
            onClick={() =>
              updateSettings({
                adaptiveDetectionEnabled: !settings.adaptiveDetectionEnabled,
              })
            }
          >
            <Activity className="h-4 w-4" aria-hidden="true" />
            Deteccion adaptativa
            <span className="ml-auto text-[11px] opacity-80">
              {settings.adaptiveDetectionEnabled ? 'On' : 'Off'}
            </span>
          </button>

          <fieldset className="min-w-0">
            <legend className="text-sm text-zinc-300">Intensidad automatica</legend>
            <div className="mt-2 grid min-w-0 grid-cols-3 rounded-md border border-zinc-700 bg-zinc-950 p-1">
              {adaptiveIntensityOptions.map((option) => {
                const isSelected = settings.adaptiveIntensity === option;

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
                    onClick={() => updateSettings({ adaptiveIntensity: option })}
                  >
                    {adaptiveIntensityLabels[option]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-zinc-400">Perfil</span>
              <span className="font-mono text-zinc-100">
                {calibrationStatusLabel} {confidencePercent}%
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-cyan-300 transition-[width]"
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-zinc-500">Ojos base</dt>
                <dd className="mt-1 font-mono text-zinc-100">
                  {formatMetric(adaptiveProfile.baselineEyeAspectRatio, 3)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Boca base</dt>
                <dd className="mt-1 font-mono text-zinc-100">
                  {formatMetric(adaptiveProfile.baselineMouthAspectRatio, 3)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Cabeza base</dt>
                <dd className="mt-1 font-mono text-zinc-100">
                  {formatMetric(adaptiveProfile.baselineHeadPitchDegrees, 1, ' deg')}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Roll base</dt>
                <dd className="mt-1 font-mono text-zinc-100">
                  {formatMetric(adaptiveProfile.baselineHeadRollDegrees, 1, ' deg')}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Movimiento</dt>
                <dd className="mt-1 font-mono text-zinc-100">
                  {formatMetric(adaptiveProfile.baselineMovementAmount, 4)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Muestras</dt>
                <dd className="mt-1 font-mono text-zinc-100">
                  {adaptiveProfile.sampleCount}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <SlidersHorizontal className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              Umbrales activos
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-zinc-500">Ojos</dt>
                <dd className="mt-1 font-mono text-zinc-100">
                  {adaptiveProfile.effectiveThresholds.eyeClosureThreshold.toFixed(3)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Cierre</dt>
                <dd className="mt-1 font-mono text-zinc-100">
                  {(
                    adaptiveProfile.effectiveThresholds.eyeClosureDurationMs / 1000
                  ).toFixed(1)}
                  s
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Boca</dt>
                <dd className="mt-1 font-mono text-zinc-100">
                  {adaptiveProfile.effectiveThresholds.yawnThreshold.toFixed(3)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Cabeza</dt>
                <dd className="mt-1 font-mono text-zinc-100">
                  {adaptiveProfile.effectiveThresholds.headTiltThresholdDegrees.toFixed(1)}
                  {' '}deg
                </dd>
              </div>
            </dl>
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
      )}

      {activeTab === 'manual' && (
        <div className="mt-4 space-y-4">
          <RangeControl
            label="Umbral de ojos"
            value={settings.eyeClosureThreshold}
            displayValue={settings.eyeClosureThreshold.toFixed(2)}
            min="0.12"
            max="0.28"
            step="0.01"
            onChange={(value) => updateSettings({ eyeClosureThreshold: value })}
          />

          <RangeControl
            label="Tiempo de cierre"
            value={settings.eyeClosureDurationMs}
            displayValue={`${(settings.eyeClosureDurationMs / 1000).toFixed(1)}s`}
            min="500"
            max="3000"
            step="100"
            onChange={(value) => updateSettings({ eyeClosureDurationMs: value })}
          />

          <RangeControl
            label="Sensibilidad de bostezo"
            value={settings.yawnThreshold}
            displayValue={settings.yawnThreshold.toFixed(2)}
            min="0.32"
            max="0.7"
            step="0.01"
            onChange={(value) => updateSettings({ yawnThreshold: value })}
          />

          <RangeControl
            label="Inclinacion de cabeza"
            value={settings.headTiltThresholdDegrees}
            displayValue={`${settings.headTiltThresholdDegrees.toFixed(0)} deg`}
            min="10"
            max="40"
            step="1"
            onChange={(value) => updateSettings({ headTiltThresholdDegrees: value })}
          />

          <RangeControl
            label="Movimiento minimo"
            value={settings.stillnessThreshold}
            displayValue={settings.stillnessThreshold.toFixed(4)}
            min="0.0005"
            max="0.005"
            step="0.0001"
            onChange={(value) => updateSettings({ stillnessThreshold: value })}
          />

          <RangeControl
            label="Tiempo inmovil"
            value={settings.stillnessDurationMs}
            displayValue={`${(settings.stillnessDurationMs / 1000).toFixed(0)}s`}
            min="4000"
            max="20000"
            step="1000"
            onChange={(value) => updateSettings({ stillnessDurationMs: value })}
          />

          <RangeControl
            label="Pausa entre alertas"
            value={settings.alertCooldownMs}
            displayValue={`${(settings.alertCooldownMs / 1000).toFixed(0)}s`}
            min="3000"
            max="30000"
            step="1000"
            onChange={(value) => updateSettings({ alertCooldownMs: value })}
          />

          <fieldset className="min-w-0">
            <legend className="text-sm text-zinc-300">Sensibilidad manual</legend>
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
        </div>
      )}

      {activeTab === 'camera' && (
        <div className="mt-4 space-y-4">
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
        </div>
      )}
    </section>
  );
}
