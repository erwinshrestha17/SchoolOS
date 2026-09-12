'use client';

import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

type PageStateTone = 'info' | 'success' | 'warning' | 'danger' | 'permission' | 'loading';

type PageStateProps = {
  tone?: PageStateTone;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: ReactNode;
  className?: string;
  children?: ReactNode;
};

const toneStyles: Record<PageStateTone, string> = {
  info: 'border-info-100 bg-info-50 text-info-700',
  success: 'border-success-100 bg-success-50 text-success-700',
  warning: 'border-warning-100 bg-warning-50 text-warning-700',
  danger: 'border-danger-100 bg-danger-50 text-danger-700',
  permission: 'border-danger-100 bg-white text-slate-900',
  loading: 'border-slate-200 bg-white text-slate-900',
};

function StateIcon({ tone }: { tone: PageStateTone }) {
  if (tone === 'loading') {
    return <Loader2 className="h-6 w-6 animate-spin" />;
  }

  if (tone === 'success') {
    return <CheckCircle2 className="h-6 w-6" />;
  }

  if (tone === 'warning') {
    return <AlertTriangle className="h-6 w-6" />;
  }

  if (tone === 'danger') {
    return <AlertTriangle className="h-6 w-6" />;
  }

  if (tone === 'permission') {
    return <ShieldAlert className="h-6 w-6" />;
  }

  return <Info className="h-6 w-6" />;
}

export function PageState({
  tone = 'info',
  title,
  description,
  actionLabel,
  onAction,
  secondaryAction,
  className,
  children,
}: PageStateProps) {
  return (
    <div
      role={tone === 'danger' || tone === 'permission' ? 'alert' : 'status'}
      aria-live={tone === 'danger' || tone === 'permission' ? 'assertive' : 'polite'}
      aria-busy={tone === 'loading' || undefined}
      className={cn(
        'flex min-h-56 flex-col items-center justify-center rounded-xl border p-6 text-center sm:p-8',
        toneStyles[tone],
        className,
      )}
    >
      <div aria-hidden="true" className="mb-4 flex h-10 w-10 items-center justify-center">
        <StateIcon tone={tone} />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      )}
      {children && <div className="mt-5 w-full max-w-xl">{children}</div>}
      {(actionLabel && onAction) || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {actionLabel && onAction ? (
            <Button type="button" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
