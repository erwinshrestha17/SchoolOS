'use client';

import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

type AuditInfoProps = {
  children: ReactNode;
  tone?: 'default' | 'warning' | 'danger';
  className?: string;
};

export function AuditInfo({ children, tone = 'default', className }: AuditInfoProps) {
  const toneClass =
    tone === 'danger'
      ? 'border-danger-100 bg-danger-50 text-danger-800'
      : tone === 'warning'
        ? 'border-warning-100 bg-warning-50 text-warning-800'
        : 'border-info-100 bg-info-50 text-info-800';

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border p-4 text-sm font-medium',
        toneClass,
        className,
      )}
    >
      <ShieldCheck className="mt-0.5 shrink-0" size={18} />
      <div>{children}</div>
    </div>
  );
}
