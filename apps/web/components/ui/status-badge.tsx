'use client';

import { resolveStatusTone, type StatusTone } from '@schoolos/core';
import { cn } from '../../lib/utils';

export type { StatusTone };

const toneClasses: Record<StatusTone, string> = {
  active: 'border-success-100 bg-success-50 text-success-700',
  inactive: 'border-slate-200 bg-slate-50 text-slate-500',
  pending: 'border-warning-100 bg-warning-50 text-warning-700',
  approved: 'border-success-100 bg-success-50 text-success-700',
  rejected: 'border-danger-100 bg-danger-50 text-danger-700',
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  published:
    'border-[var(--primary-soft)] bg-[var(--primary-soft)] text-[var(--primary-dark)]',
  locked: 'border-slate-200 bg-slate-100 text-slate-700',
  paid: 'border-success-100 bg-success-50 text-success-700',
  partial: 'border-warning-100 bg-warning-50 text-warning-700',
  unpaid: 'border-danger-100 bg-danger-50 text-danger-700',
  overdue: 'border-danger-100 bg-danger-50 text-danger-700',
  waived: 'border-info-100 bg-info-50 text-info-700',
  refunded: 'border-slate-200 bg-slate-50 text-slate-600',
  conflict: 'border-danger-100 bg-danger-50 text-danger-700',
  info: 'border-info-100 bg-info-50 text-info-700',
};

type StatusBadgeProps = {
  status: string;
  label?: string;
  tone?: StatusTone;
  className?: string;
};

export function StatusBadge({
  status,
  label,
  tone,
  className,
}: StatusBadgeProps) {
  const normalized = status.trim().toUpperCase();
  const resolvedTone = tone ?? resolveStatusTone(normalized);
  const displayLabel = label ?? normalized.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5',
        toneClasses[resolvedTone],
        className,
      )}
    >
      {displayLabel}
    </span>
  );
}
