'use client';

import { useState } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

export type ErrorStateProps = {
  title?: string;
  message?: string;
  error?: Error | { message?: string; stack?: string } | string | null;
  onRetry?: () => void;
  retryLabel?: string;
  showReload?: boolean;
  className?: string;
};

function getErrorMessage(error: ErrorStateProps['error']) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return error.message ?? '';
}

function getErrorStack(error: ErrorStateProps['error']) {
  if (!error || typeof error === 'string') return '';
  return error.stack ?? error.message ?? '';
}

export function ErrorState({
  title = 'Could not load this school workspace',
  message,
  error,
  onRetry,
  retryLabel = 'Try again',
  showReload = false,
  className,
}: ErrorStateProps) {
  const [showDetails, setShowDetails] = useState(false);
  const isDev = process.env.NODE_ENV === 'development';
  const safeMessage =
    message ||
    getErrorMessage(error) ||
    'Please retry. If this keeps happening, contact your school administrator.';
  const details = getErrorStack(error);

  return (
    <div
      className={cn(
        'flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-danger-100 bg-danger-50 p-8 text-center',
        className,
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-danger-600 shadow-sm">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
        {safeMessage}
      </p>

      {isDev && details ? (
        <div className="mt-4 w-full max-w-xl text-left">
          <button
            type="button"
            onClick={() => setShowDetails((current) => !current)}
            className="text-xs font-bold text-slate-500 underline hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-soft)]"
          >
            {showDetails ? 'Hide technical details' : 'Show technical details'}
          </button>
          {showDetails ? (
            <pre className="mt-2 max-h-44 overflow-auto rounded-xl border border-danger-100 bg-danger-50 p-3 text-[11px] leading-5 text-danger-900">
              {details}
            </pre>
          ) : null}
        </div>
      ) : null}

      {(onRetry || showReload) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {onRetry ? (
            <Button type="button" onClick={onRetry} variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4" />
              {retryLabel}
            </Button>
          ) : null}
          {showReload ? (
            <Button
              type="button"
              onClick={() => window.location.reload()}
              size="sm"
            >
              Reload page
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
