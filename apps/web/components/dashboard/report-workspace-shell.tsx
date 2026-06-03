'use client';

import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface ReportWorkspaceShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  configPanel?: ReactNode;
  className?: string;
}

export function ReportWorkspaceShell({
  sidebar,
  children,
  configPanel,
  className,
}: ReportWorkspaceShellProps) {
  return (
    <div className={cn("grid gap-8 lg:grid-cols-[280px_1fr] items-start", className)}>
      <aside className="space-y-4 lg:sticky lg:top-8">
        {sidebar}
      </aside>
      <div className="space-y-8 min-w-0">
        {children}
        {configPanel && (
          <div className="animate-in fade-in duration-300">
            {configPanel}
          </div>
        )}
      </div>
    </div>
  );
}
