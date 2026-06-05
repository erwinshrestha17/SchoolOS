import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | 'default'
    | 'secondary'
    | 'outline'
    | 'destructive'
    | 'success'
    | 'warning'
    | 'info'
    | 'neutral'
    | 'phase2'
    | 'later';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const baseStyles =
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2';

  const variants = {
    default:
      'border-transparent bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)]',
    secondary:
      'border-transparent bg-secondary-500 text-white hover:bg-secondary-600',
    outline: 'border-slate-200 text-slate-700',
    destructive:
      'border-transparent bg-danger-500 text-white hover:bg-danger-600',
    success:
      'border-transparent bg-success-50 text-success-700 border-success-100',
    warning:
      'border-transparent bg-warning-50 text-warning-700 border-warning-100',
    info: 'border-transparent bg-info-50 text-info-700 border-info-100',
    neutral: 'border-transparent bg-slate-100 text-slate-700',
    phase2:
      'border-[var(--primary-soft)] bg-[var(--primary-soft)] text-[var(--primary-dark)] uppercase tracking-wide text-[0.6rem]',
    later:
      'border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wide text-[0.6rem]',
  };

  return (
    <div
      className={cn(baseStyles, variants[variant], className)}
      {...props}
    />
  );
}
