'use client';

import type { ReactNode } from 'react';
import { SectionCard } from './section-card';

type ReportToolbarProps = {
  title?: string;
  description?: string;
  filters?: ReactNode;
  actions?: ReactNode;
};

export function ReportToolbar({
  title = 'Report filters',
  description = 'Choose filters and export from backend-generated report data.',
  filters,
  actions,
}: ReportToolbarProps) {
  return (
    <SectionCard
      title={title}
      description={description}
      headerAction={actions}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{filters}</div>
    </SectionCard>
  );
}
