import { BellOff, OctagonAlert } from 'lucide-react';

interface AlertBannerProps {
  isActive: boolean;
  cooldownRemainingMs: number;
  onSilence: () => void;
}

export function AlertBanner({
  isActive,
  cooldownRemainingMs,
  onSilence,
}: AlertBannerProps) {
  if (!isActive) {
    return null;
  }

  return (
    <section className="w-full max-w-full rounded-lg border border-rose-300 bg-rose-500 p-3.5 text-white shadow-lg shadow-rose-950/30 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-start gap-3">
          <OctagonAlert className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-base font-bold sm:text-lg">Somnolencia detectada</h2>
            <p className="mt-1 text-sm leading-5 text-rose-50 sm:leading-6">
              Alerta activa. Cooldown: {Math.ceil(cooldownRemainingMs / 1000)}s.
            </p>
          </div>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
          type="button"
          onClick={onSilence}
        >
          <BellOff className="h-4 w-4" aria-hidden="true" />
          Silenciar
        </button>
      </div>
    </section>
  );
}
