import type { DrowsinessAnalysis } from '../types/detection.types';

interface FatiguePanelProps {
  analysis: DrowsinessAnalysis;
}

const formatDuration = (durationMs: number): string =>
  `${(durationMs / 1000).toFixed(1)}s`;

export function FatiguePanel({ analysis }: FatiguePanelProps) {
  return (
    <section className="w-full max-w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Fatiga</h2>
        <span className="font-mono text-xl font-semibold text-cyan-200">
          {Math.round(analysis.fatigueScore)}
        </span>
      </div>
      <div className="mt-3 h-2.5 rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-cyan-300 transition-[width]"
          style={{ width: `${analysis.fatigueScore}%` }}
        />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2.5 text-sm sm:gap-3">
        <div className="rounded-md bg-zinc-950/70 p-3">
          <dt className="text-zinc-500">Ojos</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {formatDuration(analysis.signalDurations.eyesClosedMs)}
          </dd>
        </div>
        <div className="rounded-md bg-zinc-950/70 p-3">
          <dt className="text-zinc-500">Bostezo</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {formatDuration(analysis.signalDurations.yawningMs)}
          </dd>
        </div>
        <div className="rounded-md bg-zinc-950/70 p-3">
          <dt className="text-zinc-500">Cabeza</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {formatDuration(analysis.signalDurations.headTiltMs)}
          </dd>
        </div>
        <div className="rounded-md bg-zinc-950/70 p-3">
          <dt className="text-zinc-500">Parpadeos</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {analysis.blinkCountLastWindow}
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <h3 className="text-sm font-medium text-zinc-300">Señales activas</h3>
        <p className="mt-1.5 text-sm leading-5 text-zinc-400 sm:leading-6">
          {analysis.activeSignals.length > 0
            ? analysis.activeSignals.join(', ')
            : 'Sin señales sobre el umbral.'}
        </p>
      </div>
    </section>
  );
}
