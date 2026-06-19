'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

export type MetricTrendProps = {
  direction?: 'up' | 'down' | 'neutral';
  value: string;
  label?: string;
  positive?: boolean;
  className?: string;
};

export function MetricTrend({
  direction = 'neutral',
  value,
  label,
  positive,
  className,
}: MetricTrendProps) {
  const favorable = positive ?? direction === 'up';
  const Icon =
    direction === 'up'
      ? ArrowUpRight
      : direction === 'down'
        ? ArrowDownRight
        : Minus;

  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-1 text-xs',
        favorable ? 'text-success-700' : 'text-danger-700',
        direction === 'neutral' && 'text-slate-500',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="font-semibold">{value}</span>
      {label ? <span className="text-slate-500">{label}</span> : null}
    </p>
  );
}
