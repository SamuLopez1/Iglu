import { AlertTriangle, CheckCircle2, EyeOff, VideoOff } from 'lucide-react';

import type { DetectionStatus as DetectionStatusValue } from '../types/detection.types';

interface DetectionStatusProps {
  status: DetectionStatusValue;
  detail?: string | undefined;
}

const statusCopy: Record<
  DetectionStatusValue,
  {
    label: string;
    description: string;
    className: string;
    icon: typeof CheckCircle2;
  }
> = {
  awake: {
    label: 'Despierto',
    description: 'La cámara está lista y el rostro se analiza localmente.',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    icon: CheckCircle2,
  },
  'possible-fatigue': {
    label: 'Posible fatiga',
    description: 'Hay señales de cansancio, pero todavía no hay alerta.',
    className: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
    icon: AlertTriangle,
  },
  'drowsiness-detected': {
    label: 'Somnolencia detectada',
    description: 'La puntuación de fatiga superó el umbral.',
    className: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
    icon: AlertTriangle,
  },
  'no-face': {
    label: 'Sin rostro',
    description: 'Mantén el rostro visible y con buena iluminación.',
    className: 'border-sky-400/40 bg-sky-500/10 text-sky-100',
    icon: EyeOff,
  },
  'camera-unavailable': {
    label: 'Sin cámara',
    description: 'Se necesita acceso a la cámara para detectar fatiga.',
    className: 'border-zinc-600 bg-zinc-800 text-zinc-100',
    icon: VideoOff,
  },
};

export function DetectionStatus({ status, detail }: DetectionStatusProps) {
  const statusDetails = statusCopy[status];
  const Icon = statusDetails.icon;

  return (
    <section
      className={`w-full max-w-full rounded-lg border p-3.5 sm:p-4 ${statusDetails.className}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold">{statusDetails.label}</h2>
          <p className="mt-1 text-sm leading-5 opacity-80 sm:leading-6">
            {detail ?? statusDetails.description}
          </p>
        </div>
      </div>
    </section>
  );
}
