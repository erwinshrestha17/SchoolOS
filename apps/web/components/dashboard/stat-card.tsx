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
  description?: string;
  className?: string;
  loading?: boolean;
  href?: string;
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  description,
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-600">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-4">
        <h3 className="break-words text-3xl font-extrabold tracking-tight text-slate-900">{value}</h3>
        {trend && (
          <div className="mt-2 flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full',
                trend.isUp
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              )}
            >
              {trend.isUp ? (
                <ArrowUpRight size={12} className="stroke-[3px]" />
              ) : (
                <ArrowDownRight size={12} className="stroke-[3px]" />
              )}
              {trend.value}%
            </span>
            <span className="text-xs text-slate-400">{trend.label}</span>
          </div>
        )}
        {description && (
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{description}</p>
        )}
      </div>
    </>
  );

  const containerStyles = "bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm";

  if (loading) {
    return (
      <div className={cn(containerStyles, 'animate-pulse', className)}>
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-slate-100" />
          <div className="h-10 w-10 rounded-xl bg-slate-50" />
        </div>
        <div className="mt-6 h-8 w-16 rounded bg-slate-100" />
        <div className="mt-2 h-4 w-32 rounded bg-slate-50" />
      </div>
    );
  }

  if (href) {
    return (
      <Link href={href} className={cn(containerStyles, 'block transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-slate-300 active:scale-[0.99]', className)}>
        {content}
      </Link>
    );
  }

  return (
    <div className={cn(containerStyles, className)}>
      {content}
    </div>
  );
}
