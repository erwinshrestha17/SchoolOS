'use client';

import type { ReactNode } from 'react';
import { Eye, FileLock2 } from 'lucide-react';
import { ProtectedFileButton } from '../ui/protected-file';
import { cn } from '../../lib/utils';

export type ProtectedPreviewCardProps = {
  title: string;
  description?: string;
  fileAssetId?: string | null;
  fileName?: string;
  actionLabel?: string;
  children?: ReactNode;
  className?: string;
};

export function ProtectedPreviewCard({
  title,
  description = 'This file is opened through authenticated protected access.',
  fileAssetId,
  fileName,
  actionLabel = 'Open secure preview',
  children,
  className,
}: ProtectedPreviewCardProps) {
  return (
    <section className={cn('rounded-2xl border border-slate-200 bg-white p-4', className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <FileLock2 className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-950">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
      <ProtectedFileButton
        fileAssetId={fileAssetId}
        fileName={fileName}
        className="mt-4 w-full"
        disabled={!fileAssetId}
      >
        <Eye className="h-4 w-4" />
        {actionLabel}
      </ProtectedFileButton>
    </section>
  );
}
