'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

/**
 * Phase 7.12: close blockers on a LOCKED period's card, so the grid shows
 * which locked periods can close without opening each dialog. Only locked
 * periods load a preview (an open period must be locked first; a closed one
 * has nothing to close). It reads the same server preview, under the same
 * query key, as the close dialog — the dialog still re-reads it on open and
 * the close stays bound to the fingerprint the user reviews there.
 */
export function FiscalPeriodCloseBadge({ periodId }: { periodId: string }) {
  const previewQuery = useQuery({
    queryKey: ['fiscal-period-close-preview', periodId],
    queryFn: () => api.getFiscalPeriodClosePreview(periodId),
  });
  const preview = previewQuery.data;

  if (previewQuery.isError) {
    return (
      <span
        className="text-[10px] font-semibold text-slate-500"
        data-testid={`fiscal-period-close-badge-${periodId}`}
      >
        Close check unavailable
      </span>
    );
  }
  if (!preview) {
    return (
      <span
        className="text-[10px] font-semibold text-slate-400"
        data-testid={`fiscal-period-close-badge-${periodId}`}
      >
        Checking close…
      </span>
    );
  }

  const blockers = preview.blockers.length;
  const warnings = preview.warnings.length;
  return (
    <span
      data-testid={`fiscal-period-close-badge-${periodId}`}
      title={[...preview.blockers, ...preview.warnings]
        .map((item) => item.message)
        .join('\n')}
      className={cn(
        'w-fit rounded-full px-2 py-0.5 text-[10px] font-bold',
        blockers > 0
          ? 'bg-rose-50 text-rose-700'
          : warnings > 0
            ? 'bg-amber-50 text-amber-800'
            : 'bg-emerald-50 text-emerald-700',
      )}
    >
      {blockers > 0
        ? `${blockers} blocker${blockers === 1 ? '' : 's'}`
        : 'Ready to close'}
      {warnings > 0 ? ` · ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}
    </span>
  );
}
