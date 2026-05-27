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
    label: 'Awake',
    description: 'Camera is ready. Detection starts after landmarks are connected.',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    icon: CheckCircle2,
  },
  'possible-fatigue': {
    label: 'Possible fatigue',
    description: 'Some fatigue signals are building, but no alert is active.',
    className: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
    icon: AlertTriangle,
  },
  'drowsiness-detected': {
    label: 'Drowsiness detected',
    description: 'Fatigue threshold exceeded. Alert is active.',
    className: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
    icon: AlertTriangle,
  },
  'no-face': {
    label: 'No face detected',
    description: 'Keep your face visible and well-lit for detection.',
    className: 'border-sky-400/40 bg-sky-500/10 text-sky-100',
    icon: EyeOff,
  },
  'camera-unavailable': {
    label: 'Camera unavailable',
    description: 'Camera access is required to run detection.',
    className: 'border-zinc-600 bg-zinc-800 text-zinc-100',
    icon: VideoOff,
  },
};

export function DetectionStatus({ status, detail }: DetectionStatusProps) {
  const statusDetails = statusCopy[status];
  const Icon = statusDetails.icon;

  return (
    <section className={`rounded-lg border p-4 ${statusDetails.className}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold">{statusDetails.label}</h2>
          <p className="mt-1 text-sm leading-6 opacity-80">
            {detail ?? statusDetails.description}
          </p>
        </div>
      </div>
    </section>
  );
}
