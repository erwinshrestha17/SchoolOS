'use client';

import { HOME_PERSONA_LABELS, type HomePersona } from '@schoolos/core';
import { cn } from '../../lib/utils';

/**
 * Lets a person who holds more than one home (e.g. a Principal who also
 * teaches) choose which one to open. Presentation only: each home's data is
 * fetched and re-authorized by its own server endpoint.
 */
export function HomePersonaSwitcher({
  homes,
  active,
  onChange,
}: {
  homes: HomePersona[];
  active: HomePersona;
  onChange: (home: HomePersona) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Choose your home"
      className="inline-flex flex-wrap gap-1 rounded-control border border-slate-200 bg-white p-1"
    >
      {homes.map((home) => {
        const selected = home === active;
        return (
          <button
            key={home}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(home)}
            className={cn(
              'h-control-compact rounded-chip px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]',
              selected
                ? 'bg-[var(--primary)] text-white'
                : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            {HOME_PERSONA_LABELS[home]}
          </button>
        );
      })}
    </div>
  );
}
