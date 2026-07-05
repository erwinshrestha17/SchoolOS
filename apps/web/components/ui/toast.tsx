'use client';

import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastTone = 'success' | 'warning' | 'danger' | 'info';

type ToastProps = {
  title: string;
  description?: string;
  tone?: ToastTone;
  onDismiss?: () => void;
  className?: string;
  /** A single follow-up action, e.g. "Undo" for a just-completed reversible change. */
  action?: { label: string; onClick: () => void };
};

const toneClasses: Record<ToastTone, string> = {
  success: 'border-success-100 bg-success-50 text-success-900',
  warning: 'border-warning-100 bg-warning-50 text-warning-900',
  danger: 'border-danger-100 bg-danger-50 text-danger-900',
  info: 'border-info-100 bg-info-50 text-info-900',
};

const toneIcons = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertTriangle,
  info: Info,
};

export function Toast({
  title,
  description,
  tone = 'info',
  onDismiss,
  className,
  action,
}: ToastProps) {
  const Icon = toneIcons[tone];

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex max-w-md items-start gap-3 rounded-2xl border p-4 shadow-sm',
        toneClasses[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 shrink-0" size={18} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        {description ? <p className="mt-1 text-sm opacity-85">{description}</p> : null}
        {action ? (
          <button
            type="button"
            className="mt-2 text-sm font-bold underline underline-offset-2 opacity-90 transition hover:opacity-100"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg opacity-70 transition hover:bg-white/60 hover:opacity-100"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}
