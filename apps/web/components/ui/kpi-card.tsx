'use client';

import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { StatCard } from './stat-card';

export type KpiCardProps = Parameters<typeof StatCard>[0];

export function KpiCard(props: KpiCardProps) {
  return <StatCard {...props} />;
}

export function KpiGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-4 sm:grid-cols-2 xl:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
