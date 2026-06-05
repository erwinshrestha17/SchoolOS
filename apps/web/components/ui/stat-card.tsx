'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '../../lib/utils';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

type StatTone = 'dashboard' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
    isUp: boolean;
  };
  description?: string;
  className?: string;
  loading?: boolean;
  href?: string;
  tone?: StatTone;
}

const toneStyles: Record<StatTone, string> = {
  dashboard: 'border-primary-100 bg-primary-50 text-primary-600',
  success: 'border-success-100 bg-success-50 text-success-700',
  warning: 'border-warning-100 bg-warning-50 text-warning-700',
  danger: 'border-danger-100 bg-danger-50 text-danger-700',
  info: 'border-info-100 bg-info-50 text-info-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
};

export function StatCard({
  title,
  value,
  icon,
  trend,
  description,
  className,
  loading = false,
  href,
  tone = 'dashboard',
}: StatCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {title}
        </p>
        {icon && (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
              toneStyles[tone],
            )}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2">
        <h3 className="break-words text-[30px] font-extrabold leading-[38px] text-slate-950 tabular-nums">
          {value}
        </h3>
        {trend && (
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold',
                trend.isUp
                  ? 'bg-success-50 text-success-700'
                  : 'bg-danger-50 text-danger-700',
              )}
            >
              {trend.isUp ? (
                <ArrowUpRight size={12} />
              ) : (
                <ArrowDownRight size={12} />
              )}
              {trend.value}%
            </span>
            <span className="text-xs text-slate-400">{trend.label}</span>
          </div>
        )}
        {description && (
          <p className="mt-1 text-xs leading-[18px] text-slate-500">
            {description}
          </p>
        )}
      </div>
    </>
  );

  if (loading) {
    return (
      <div className={cn('shell-card animate-pulse p-5 lg:p-6', className)}>
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-gray-200" />
          <div className="h-10 w-10 rounded-xl bg-gray-100" />
        </div>
        <div className="mt-4 h-8 w-16 rounded bg-gray-200" />
        <div className="mt-2 h-4 w-32 rounded bg-gray-100" />
      </div>
    );
  }

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          'shell-card block p-5 transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-2 active:translate-y-0 lg:p-6',
          className,
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={cn('shell-card p-5 lg:p-6', className)}>
      {content}
    </div>
  );
}
