'use client';

import { cn } from '../../lib/utils';

export type StatusTone =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'draft'
  | 'published'
  | 'locked'
  | 'paid'
  | 'partial'
  | 'unpaid'
  | 'overdue'
  | 'waived'
  | 'refunded'
  | 'conflict'
  | 'info';

const statusToneMap: Record<string, StatusTone> = {
  ACTIVE: 'active',
  OPEN: 'active',
  RESOLVED: 'approved',
  INACTIVE: 'inactive',
  CLOSED: 'locked',
  CANCELLED: 'inactive',
  PENDING: 'pending',
  QUEUED: 'pending',
  RETRYING: 'pending',
  SUBMITTED: 'pending',
  APPROVED: 'approved',
  REVIEWED: 'approved',
  ACTION_TAKEN: 'approved',
  REJECTED: 'rejected',
  DISMISSED: 'rejected',
  FAILED: 'rejected',
  SKIPPED: 'inactive',
  DRAFT: 'draft',
  SENT: 'published',
  DELIVERED: 'published',
  PUBLISHED: 'published',
  READ: 'approved',
  LOCKED: 'locked',
  POSTED: 'locked',
  PAID: 'paid',
  PARTIAL: 'partial',
  UNPAID: 'unpaid',
  OVERDUE: 'overdue',
  WAIVED: 'waived',
  REFUNDED: 'refunded',
  CONFLICT: 'conflict',
  ESCALATED: 'conflict',
  TRANSFERRED: 'pending',
  ALUMNI: 'published',
  GRADUATED: 'published',
  DEACTIVATED: 'inactive',
  WITHDRAWN: 'inactive',
  PRESENT: 'approved',
  ABSENT: 'rejected',
  LATE: 'partial',
  SICK_LEAVE: 'info',
  EXCUSED_LEAVE: 'info',
  UNEXCUSED_LEAVE: 'partial',
};

const toneClasses: Record<StatusTone, string> = {
  active: 'border-success-100 bg-success-50 text-success-700',
  inactive: 'border-slate-200 bg-slate-50 text-slate-500',
  pending: 'border-warning-100 bg-warning-50 text-warning-700',
  approved: 'border-success-100 bg-success-50 text-success-700',
  rejected: 'border-danger-100 bg-danger-50 text-danger-700',
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  published: 'border-[var(--primary-soft)] bg-[var(--primary-soft)] text-[var(--primary-dark)]',
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

export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const normalized = status.trim().toUpperCase();
  const resolvedTone = tone ?? statusToneMap[normalized] ?? 'info';
  const displayLabel = label ?? normalized.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide',
        toneClasses[resolvedTone],
        className,
      )}
    >
      {displayLabel}
    </span>
  );
}
