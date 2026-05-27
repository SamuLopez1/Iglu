import type { DrowsinessAnalysis } from '../types/detection.types';

interface FatiguePanelProps {
  analysis: DrowsinessAnalysis;
}

const formatDuration = (durationMs: number): string =>
  `${(durationMs / 1000).toFixed(1)}s`;

export function FatiguePanel({ analysis }: FatiguePanelProps) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Fatigue score</h2>
        <span className="font-mono text-lg font-semibold text-cyan-200">
          {Math.round(analysis.fatigueScore)}
        </span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-cyan-300 transition-[width]"
          style={{ width: `${analysis.fatigueScore}%` }}
        />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-zinc-500">Eyes closed</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {formatDuration(analysis.signalDurations.eyesClosedMs)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Yawning</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {formatDuration(analysis.signalDurations.yawningMs)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Head tilt</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {formatDuration(analysis.signalDurations.headTiltMs)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Blink window</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {analysis.blinkCountLastWindow}
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <h3 className="text-sm font-medium text-zinc-300">Active signals</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          {analysis.activeSignals.length > 0
            ? analysis.activeSignals.join(', ')
            : 'No fatigue signal above threshold.'}
        </p>
      </div>
    </section>
  );
}
