'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Phase 3C canonical QueueWorkspace (SCHOOLOS_WEB_DESIGN_ASTRA §11.3).
 *
 *   Queue title + total + aging summary
 *   Filters: severity / owner / age / status
 *   ───────────────────────────────────────────
 *   Queue list                   Inspector (evidence, history, decision)
 *
 * The queue list is a DataWorkspace/PaginatedDataTable or a list the caller
 * renders; decision controls live in the Inspector and are shown only when
 * the item's server projection allows the action (isActionAllowed). Totals
 * are server counts: pass `null` when unavailable — never a guessed 0.
 */
export type QueueAgingBucket = {
  id: string;
  label: string;
  /** Server count; null means unavailable and is rendered as "—". */
  count: number | null;
  tone?: 'neutral' | 'warning' | 'danger';
};

export function QueueWorkspace({
  title,
  description,
  total,
  aging = [],
  filters,
  primaryAction,
  list,
  inspector,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  total: number | null;
  aging?: readonly QueueAgingBucket[];
  filters?: ReactNode;
  primaryAction?: ReactNode;
  list: ReactNode;
  inspector?: ReactNode;
  className?: string;
}) {
  return (
    <section
      data-schoolos-ui="queue-workspace"
      className={cn('space-y-4', className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-section text-[var(--ink)]">
            {title}{' '}
            <span className="text-base font-medium text-[var(--muted)]">
              ({total === null ? '—' : total.toLocaleString('en-IN')})
            </span>
          </h2>
          {description ? (
            <p className="mt-0.5 text-helper text-[var(--muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {primaryAction}
      </header>

      {aging.length > 0 ? (
        <dl className="flex flex-wrap gap-2" aria-label="Queue aging">
          {aging.map((bucket) => (
            <div
              key={bucket.id}
              className={cn(
                'rounded-chip border px-3 py-1.5 text-sm',
                bucket.tone === 'danger'
                  ? 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-text)]'
                  : bucket.tone === 'warning'
                    ? 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning-text)]'
                    : 'border-[var(--line)] bg-white text-[var(--ink)]',
              )}
            >
              <dt className="inline">{bucket.label}: </dt>
              <dd className="inline font-semibold">
                {bucket.count === null
                  ? '—'
                  : bucket.count.toLocaleString('en-IN')}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {filters ? (
        <div
          role="search"
          aria-label="Filter queue"
          className="flex flex-wrap gap-2"
        >
          {filters}
        </div>
      ) : null}

      {list}
      {inspector}
    </section>
  );
}
