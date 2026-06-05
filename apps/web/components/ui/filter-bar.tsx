'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Filter } from 'lucide-react';

interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
  label?: string;
  description?: string;
  actions?: React.ReactNode;
  sticky?: boolean;
}

export function FilterBar({
  children,
  className,
  label = 'Filters',
  description,
  actions,
  sticky,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-100 bg-slate-50/70 p-5 shadow-sm backdrop-blur-md',
        sticky && 'sticky top-20 z-10',
        className,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex items-start gap-3 lg:w-52 lg:shrink-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm">
              <Filter size={15} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                {label}
              </span>
              {description && (
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {description}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-end gap-3">{children}</div>
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
