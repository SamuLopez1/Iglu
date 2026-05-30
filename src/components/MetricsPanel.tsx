import type { FacialMetrics } from '../types/detection.types';

interface MetricsPanelProps {
  metrics: FacialMetrics | null;
  variant?: 'card' | 'embedded';
}

const formatMetric = (value: number | undefined, digits = 3): string =>
  value === undefined ? '-' : value.toFixed(digits);

export function MetricsPanel({ metrics, variant = 'card' }: MetricsPanelProps) {
  const content = (
    <>
      {variant === 'card' && (
        <h2 className="text-base font-semibold text-white">Métricas en vivo</h2>
      )}
      <dl
        className={`${variant === 'card' ? 'mt-3' : ''} grid grid-cols-2 gap-3 text-sm`}
      >
        <div>
          <dt className="text-zinc-500">Ojos</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {formatMetric(metrics?.eyeAspectRatio)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Boca</dt>
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
          <dt className="text-zinc-500">Movimiento</dt>
          <dd className="mt-1 font-mono text-zinc-100">
            {formatMetric(metrics?.movementAmount)}
          </dd>
        </div>
      </dl>
    </>
  );

  if (variant === 'embedded') {
    return content;
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      {content}
    </section>
  );
}
