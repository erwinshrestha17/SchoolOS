'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface FilterBarProps {
  children?: ReactNode;
  searchSlot?: ReactNode;
  filterSlot?: ReactNode;
  actionSlot?: ReactNode;
  className?: string;
  label?: string;
  description?: string;
  actions?: ReactNode;
  sticky?: boolean;
}

export function FilterBar({
  children,
  searchSlot,
  filterSlot,
  actionSlot,
  className,
  label = 'Filters',
  description,
  actions,
  sticky,
}: FilterBarProps) {
  const mergedActions = actionSlot ?? actions;

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4',
        sticky && 'sticky top-20 z-10 bg-card/95 backdrop-blur-md',
        className,
      )}
      role="group"
      aria-label={label}
      data-schoolos-ui="filter-bar"
    >
      {description ? (
        <p className="mb-3 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center">
          {searchSlot ? (
            <div className="w-full md:min-w-64 md:flex-[1.5]">{searchSlot}</div>
          ) : null}
          {filterSlot ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {filterSlot}
            </div>
          ) : null}
          {children ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 [&_[data-slot=select-trigger]]:h-9 [&_input]:h-9">
              {children}
            </div>
          ) : null}
        </div>

        {mergedActions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            {mergedActions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
