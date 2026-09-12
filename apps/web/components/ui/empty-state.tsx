'use client';

import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-56 flex-col items-center justify-center rounded-xl border border-border bg-card p-6 sm:p-8 text-center',
        className
      )}
    >
      <div aria-hidden="true" className="mb-4 flex h-10 w-10 items-center justify-center text-muted-foreground">
        {icon ?? <Inbox size={24} />}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-5 flex max-w-full flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
