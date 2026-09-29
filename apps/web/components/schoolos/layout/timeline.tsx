import type { ReactNode } from 'react';
import { CheckCircle2, Circle, CircleDot, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 3C canonical Timeline / AuditTrail (SCHOOLOS_WEB_DESIGN_ASTRA §5.1).
 *
 * Chronological state/history. Entries are rendered in the order given; the
 * caller supplies server-authored events and must not synthesize history.
 * Semantic tones map to the shared status meanings (success/danger/current),
 * never to module colours.
 */
export type TimelineTone = 'done' | 'current' | 'rejected' | 'pending';

export type TimelineEntry = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** Pre-formatted (BS/AD per caller) timestamp text. */
  timestamp?: ReactNode;
  /** Machine-readable ISO timestamp for <time dateTime>. */
  dateTime?: string;
  actor?: ReactNode;
  tone?: TimelineTone;
};

const ICONS: Record<TimelineTone, typeof Circle> = {
  done: CheckCircle2,
  current: CircleDot,
  rejected: XCircle,
  pending: Circle,
};

export function Timeline({
  entries,
  label = 'History',
  emptyLabel = 'No history recorded yet.',
  className,
}: {
  entries: readonly TimelineEntry[];
  label?: string;
  emptyLabel?: string;
  className?: string;
}) {
  if (entries.length === 0) {
    return <p className="text-helper text-[var(--muted)]">{emptyLabel}</p>;
  }
  return (
    <ol
      aria-label={label}
      data-schoolos-ui="timeline"
      className={cn('space-y-4', className)}
    >
      {entries.map((entry, index) => {
        const tone = entry.tone ?? 'done';
        const Icon = ICONS[tone];
        const last = index === entries.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-3">
            {!last ? (
              <span
                aria-hidden="true"
                className="absolute left-[9px] top-6 h-[calc(100%-4px)] w-px bg-[var(--line)]"
              />
            ) : null}
            <Icon
              size={20}
              aria-hidden="true"
              className={cn(
                'relative mt-0.5 shrink-0 bg-white',
                tone === 'done' && 'text-success-600',
                tone === 'current' && 'text-[var(--primary)]',
                tone === 'rejected' && 'text-danger-600',
                tone === 'pending' && 'text-slate-300',
              )}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--ink)]">
                {entry.title}
                {tone === 'current' ? (
                  <span className="sr-only"> (current)</span>
                ) : tone === 'rejected' ? (
                  <span className="sr-only"> (rejected)</span>
                ) : tone === 'pending' ? (
                  <span className="sr-only"> (pending)</span>
                ) : null}
              </p>
              {entry.description ? (
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  {entry.description}
                </p>
              ) : null}
              {entry.timestamp || entry.actor ? (
                <p className="mt-0.5 text-helper text-[var(--faint)]">
                  {entry.timestamp ? (
                    <time dateTime={entry.dateTime}>{entry.timestamp}</time>
                  ) : null}
                  {entry.timestamp && entry.actor ? ' · ' : null}
                  {entry.actor}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
