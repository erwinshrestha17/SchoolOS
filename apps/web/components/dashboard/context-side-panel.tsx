'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ContextSidePanelProps = {
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  footer?: ReactNode;
};

export function ContextSidePanel({
  title,
  children,
  onClose,
  className,
  footer,
}: ContextSidePanelProps) {
  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col border-l border-slate-200 bg-white',
        className,
      )}
      aria-label={title ?? 'Context panel'}
    >
      {(title || onClose) && (
        <div className="flex min-h-16 items-center justify-between border-b border-slate-100 px-5">
          <h2 className="text-sm font-bold text-slate-950">{title}</h2>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-200"
              aria-label="Close context panel"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      {footer ? (
        <div className="border-t border-slate-100 p-5">{footer}</div>
      ) : null}
    </aside>
  );
}
