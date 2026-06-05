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
        aria-busy="true"
        aria-live="polite"
        role="status"
      >
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[var(--primary-soft)] border-t-[var(--primary)]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-700">{label}</p>
          <p className="mt-1 text-xs font-medium text-slate-400">
            Keeping this workspace synced with the latest school data.
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div className={cn('animate-pulse space-y-5', className)} aria-busy="true">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-56 rounded-lg bg-slate-200" />
            <div className="h-4 w-80 max-w-full rounded bg-slate-100" />
          </div>
          <div className="hidden h-10 w-32 rounded-xl bg-slate-100 sm:block" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-slate-100" />
            <div className="h-4 w-11/12 rounded bg-slate-100" />
            <div className="h-4 w-4/5 rounded bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center justify-center p-4 gap-3', className)}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary-soft)] border-t-[var(--primary)]" />
      {label && <p className="text-sm text-slate-500">{label}</p>}
    </div>
  );
}
