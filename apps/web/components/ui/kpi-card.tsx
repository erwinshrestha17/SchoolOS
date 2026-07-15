'use client';

import {
  SummaryCard,
  SummaryGrid,
  type SummaryCardProps,
} from './summary-card';

/** @deprecated Use SummaryCard. Kept as a compatibility bridge while later modules migrate. */
export type KpiCardProps = Omit<SummaryCardProps, 'label'> & {
  title: string;
  trend?: {
    value: number;
    label: string;
    isUp: boolean;
  };
};

/** @deprecated Use SummaryCard. */
export function KpiCard({ title, trend: _trend, ...props }: KpiCardProps) {
  return <SummaryCard label={title} {...props} />;
}

/** @deprecated Use SummaryGrid. */
export const KpiGrid = SummaryGrid;
