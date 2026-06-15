'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from './button';
import { PageState } from './page-state';

export type ModuleLockedStateProps = {
  moduleName?: string;
  description?: string;
  featureKey?: string;
  planName?: string;
  onBack?: () => void;
  onRequestAccess?: () => void;
  requestAccessLabel?: string;
  secondaryAction?: ReactNode;
  className?: string;
};

export function ModuleLockedState({
  moduleName = 'This module',
  description,
  featureKey,
  planName,
  onBack,
  onRequestAccess,
  requestAccessLabel = 'Request access',
  secondaryAction,
  className,
}: ModuleLockedStateProps) {
  return (
    <PageState
      tone="warning"
      title={`${moduleName} is not enabled`}
      description={
        description ||
        'This workspace is protected by your school plan or module settings. No school data is shown until access is enabled.'
      }
      className={className}
      secondaryAction={
        <>
          {onBack ? (
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Go back
            </Button>
          ) : null}
          {onRequestAccess ? (
            <Button type="button" onClick={onRequestAccess}>
              <ShieldCheck className="h-4 w-4" />
              {requestAccessLabel}
            </Button>
          ) : null}
          {secondaryAction}
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-md border border-warning-100 bg-white px-3 py-1 text-xs font-bold text-warning-800">
          <LockKeyhole className="h-3.5 w-3.5" />
          Module locked
        </span>
        {planName ? (
          <span className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            Plan: <span className="text-slate-950">{planName}</span>
          </span>
        ) : null}
        {featureKey ? (
          <span className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            Feature: <span className="text-slate-950">{featureKey}</span>
          </span>
        ) : null}
      </div>
    </PageState>
  );
}
