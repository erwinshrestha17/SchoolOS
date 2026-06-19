'use client';

import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type DataTableToolbarProps = {
  title?: string;
  description?: string;
  search?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function DataTableToolbar({
  title,
  description,
  search,
  actions,
  children,
  className,
}: DataTableToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {title ? (
          <h2 className="text-sm font-bold text-slate-950">{title}</h2>
        ) : null}
        {description ? (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        ) : null}
        {children}
      </div>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        {search ? <div className="min-w-0 sm:w-72">{search}</div> : null}
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
