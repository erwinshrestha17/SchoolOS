'use client';

import { cn } from '../../lib/utils';

interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton' | 'page';
  className?: string;
  label?: string;
}

export function LoadingState({
  variant = 'spinner',
  className,
  label = 'Loading...',
}: LoadingStateProps) {
  if (variant === 'page') {
    return (
      <div
        className={cn(
          'flex min-h-[400px] w-full flex-col items-center justify-center gap-4',
          className
        )}
      >
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary-500" />
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div className={cn('animate-pulse space-y-4', className)}>
        <div className="h-8 w-1/3 rounded-lg bg-slate-200" />
        <div className="h-32 w-full rounded-2xl bg-slate-100" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-slate-100" />
          <div className="h-4 w-5/6 rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center justify-center p-4 gap-3', className)}
    >
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-100 border-t-primary-500" />
      {label && <p className="text-sm text-slate-500">{label}</p>}
    </div>
  );
}
