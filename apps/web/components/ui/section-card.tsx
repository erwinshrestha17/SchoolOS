'use client';

import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface SectionCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  headerAction?: ReactNode;
  footer?: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function SectionCard({
  title,
  description,
  children,
  headerAction,
  footer,
  className,
  noPadding = false,
}: SectionCardProps) {
  return (
    <div className={cn('shell-card flex flex-col', className)}>
      {(title || description || headerAction) && (
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between lg:p-6">
          <div className="min-w-0">
            {title && (
              <h3 className="text-xl font-bold leading-7 text-slate-950">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-1 max-w-3xl text-sm leading-[22px] text-slate-500">
                {description}
              </p>
            )}
          </div>
          {headerAction && (
            <div className="flex shrink-0 items-center gap-2">
              {headerAction}
            </div>
          )}
        </div>
      )}

      <div className={cn('flex-1', noPadding ? 'p-0' : 'p-5 lg:p-6')}>
        {children}
      </div>

      {footer && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 lg:p-5">
          {footer}
        </div>
      )}
    </div>
  );
}
