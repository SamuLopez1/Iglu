import { Gauge, Volume2, VolumeX } from 'lucide-react';

import type {
  DetectionSensitivity,
  DrowsinessSettings,
} from '../types/settings.types';

interface SettingsPanelProps {
  settings: DrowsinessSettings;
  onSettingsChange: (settings: DrowsinessSettings) => void;
}

const sensitivityOptions: DetectionSensitivity[] = ['low', 'medium', 'high'];

export function SettingsPanel({
  settings,
  onSettingsChange,
}: SettingsPanelProps) {
  const updateSettings = (patch: Partial<DrowsinessSettings>) => {
    onSettingsChange({ ...settings, ...patch });
  };

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-2">
        <Gauge className="h-5 w-5 text-cyan-300" aria-hidden="true" />
        <h2 className="text-base font-semibold text-white">Settings</h2>
      </div>

      <div className="mt-4 space-y-5">
        <label className="block">
          <span className="flex items-center justify-between gap-3 text-sm text-zinc-300">
            Eye closure threshold
            <span className="font-mono text-zinc-100">
              {settings.eyeClosureThreshold.toFixed(2)}
            </span>
          </span>
          <input
            className="mt-2 h-2 w-full accent-cyan-300"
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
          <span className="flex items-center justify-between gap-3 text-sm text-zinc-300">
            Eye closure duration
            <span className="font-mono text-zinc-100">
              {(settings.eyeClosureDurationMs / 1000).toFixed(1)}s
            </span>
          </span>
          <input
            className="mt-2 h-2 w-full accent-cyan-300"
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
          <span className="flex items-center justify-between gap-3 text-sm text-zinc-300">
            Yawn sensitivity
            <span className="font-mono text-zinc-100">
              {settings.yawnThreshold.toFixed(2)}
            </span>
          </span>
          <input
            className="mt-2 h-2 w-full accent-cyan-300"
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
          <span className="flex items-center justify-between gap-3 text-sm text-zinc-300">
            Alert cooldown
            <span className="font-mono text-zinc-100">
              {(settings.alertCooldownMs / 1000).toFixed(0)}s
            </span>
          </span>
          <input
            className="mt-2 h-2 w-full accent-cyan-300"
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

        <label className="block text-sm text-zinc-300">
          Detection sensitivity
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-100 outline-none transition focus:border-cyan-300"
            value={settings.sensitivity}
            onChange={(event) =>
              updateSettings({
                sensitivity: event.target.value as DetectionSensitivity,
              })
            }
          >
            {sensitivityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

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
          {settings.soundEnabled ? 'Sound enabled' : 'Sound disabled'}
        </button>
      </div>
    </section>
  );
}
