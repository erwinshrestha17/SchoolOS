'use client';

import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Filter } from 'lucide-react';

interface FilterBarProps {
  children?: ReactNode;
  searchSlot?: ReactNode;
  filterSlot?: ReactNode;
  actionSlot?: ReactNode;
  actions?: ReactNode; // support legacy actions prop
  className?: string;
  label?: string;
  description?: string;
  sticky?: boolean;
}

export function FilterBar({
  children,
  searchSlot,
  filterSlot,
  actionSlot,
  actions,
  className,
  label = 'Filters',
  description,
  sticky = false,
}: FilterBarProps) {
  const mergedActions = actionSlot || actions;

  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm',
        sticky && 'sticky top-6 z-10 backdrop-blur-md bg-white/95',
        className,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          {/* Header descriptor, only show if we have label and no children in that position */}
          {description && (
            <div className="flex items-start gap-3 lg:w-48 lg:shrink-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400">
                <Filter size={15} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 leading-none">
                  {label}
                </span>
                <p className="mt-0.5 text-xs text-slate-500 truncate">
                  {description}
                </p>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {searchSlot && <div className="w-full sm:w-64 shrink-0">{searchSlot}</div>}
            {filterSlot && <div className="flex flex-wrap items-center gap-2">{filterSlot}</div>}
            {children}
          </div>
        </div>

        {mergedActions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 justify-end w-full lg:w-auto">
            {mergedActions}
          </div>
        )}
      </div>
    </div>
  );
}
