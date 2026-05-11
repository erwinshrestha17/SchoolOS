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
  info: 'border-info-100 bg-info-50 text-info-800',
  success: 'border-success-100 bg-success-50 text-success-800',
  warning: 'border-warning-100 bg-warning-50 text-warning-800',
  danger: 'border-danger-100 bg-danger-50 text-danger-800',
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
      className={cn(
        'flex min-h-[280px] flex-col items-center justify-center rounded-[2rem] border p-8 text-center shadow-sm',
        toneStyles[tone],
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
        <StateIcon tone={tone} />
      </div>
      <h3 className="text-xl font-black tracking-tight text-slate-950">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      )}
      {children && <div className="mt-5 w-full max-w-xl">{children}</div>}
      {(actionLabel && onAction) || secondaryAction ? (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
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
