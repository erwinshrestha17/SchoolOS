'use client';

import { StatusBadge, StatusTone } from '../ui/status-badge';
import { cn } from '../../lib/utils';

interface StatusChipProps {
  status: string;
  label?: string;
  tone?: StatusTone;
  className?: string;
}

export function StatusChip({ status, label, tone, className }: StatusChipProps) {
  return (
    <StatusBadge
      status={status}
      label={label}
      tone={tone}
      className={cn("px-3 py-1 font-extrabold text-[0.65rem] tracking-wider rounded-lg shadow-sm border", className)}
    />
  );
}
