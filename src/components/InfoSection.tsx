import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

interface InfoSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function InfoSection({ title, children, defaultOpen = false }: InfoSectionProps) {
  return (
    <details
      className="group w-full max-w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/95"
      open={defaultOpen}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white outline-none transition hover:bg-zinc-800/60 focus-visible:ring-2 focus-visible:ring-cyan-300">
        {title}
        <ChevronDown
          className="h-4 w-4 text-zinc-400 transition group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-zinc-800 px-4 py-4">{children}</div>
    </details>
  );
}
