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
    <div className={cn('bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden', className)}>
      {(title || description || headerAction) && (
        <div className="flex flex-col gap-3 border-b border-slate-100 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && (
              <h3 className="text-lg font-bold leading-tight text-slate-900">{title}</h3>
            )}
            {description && (
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">{description}</p>
            )}
          </div>
          {headerAction && (
            <div className="flex shrink-0 items-center gap-2">
              {headerAction}
            </div>
          )}
        </div>
      )}

      <div className={cn('flex-1', noPadding ? 'p-0' : 'p-6')}>
        {children}
      </div>

      {footer && (
        <div className="border-t border-slate-100 bg-slate-50/30 p-5">
          {footer}
        </div>
      )}
    </div>
  );
}
