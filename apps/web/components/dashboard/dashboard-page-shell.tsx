'use client';

import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface DashboardPageShellProps {
  children: ReactNode;
  className?: string;
}

export function DashboardPageShell({ children, className }: DashboardPageShellProps) {
  return (
    <div
      className={cn('flex flex-col gap-5 lg:gap-6', className)}
      data-schoolos-ui="dashboard-page-shell"
    >
      {children}
    </div>
  );
}
