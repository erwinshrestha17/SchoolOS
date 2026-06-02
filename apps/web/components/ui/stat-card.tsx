'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '../../lib/utils';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
    isUp: boolean;
  };
  className?: string;
  loading?: boolean;
  href?: string;
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  className,
  loading = false,
  href,
}: StatCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {title}
        </p>
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary-100 bg-primary-50 text-primary-600">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2">
        <h3 className="break-words text-2xl font-black leading-tight text-slate-950">{value}</h3>
        {trend && (
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full',
                trend.isUp
                  ? 'bg-success-50 text-success-700'
                  : 'bg-danger-50 text-danger-700'
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
      </div>
    </>
  );

  if (loading) {
    return (
      <div className={cn('shell-card p-6 animate-pulse', className)}>
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
      <Link href={href} className={cn('shell-card block p-6 transition hover:-translate-y-0.5 active:translate-y-0', className)}>
        {content}
      </Link>
    );
  }

  return (
    <div className={cn('shell-card p-6', className)}>
      {content}
    </div>
  );
}
