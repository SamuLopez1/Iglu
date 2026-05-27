import type { FacialMetrics } from '../types/detection.types';

interface MetricsPanelProps {
  metrics: FacialMetrics | null;
}

const formatMetric = (value: number | undefined, digits = 3): string =>
  value === undefined ? '-' : value.toFixed(digits);

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="text-base font-semibold text-white">Live metrics</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-zinc-500">Eye openness</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {formatMetric(metrics?.eyeAspectRatio)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Mouth opening</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {formatMetric(metrics?.mouthAspectRatio)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Pitch</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {formatMetric(metrics?.headPitchDegrees, 1)} deg
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Roll</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {formatMetric(metrics?.headRollDegrees, 1)} deg
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Yaw</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {formatMetric(metrics?.headYawDegrees, 1)} deg
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Movement</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {formatMetric(metrics?.movementAmount)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
