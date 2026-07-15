'use client';

import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface DashboardPageShellProps {
  children: ReactNode;
  className?: string;
}

export function DashboardPageShell({ children, className }: DashboardPageShellProps) {
  return (
    <div className={cn("flex flex-col gap-8 animate-in fade-in duration-300", className)}>
      {children}
    </div>
  );
}
