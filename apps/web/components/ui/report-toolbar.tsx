'use client';

import { Surface } from '@/components/schoolos';
import type { ReactNode } from 'react';

type ReportToolbarProps = {
  title?: string;
  description?: string;
  filters?: ReactNode;
  actions?: ReactNode;
};

export function ReportToolbar({
  title = 'Report filters',
  description = 'Choose filters and export the official report data.',
  filters,
  actions,
}: ReportToolbarProps) {
  return (
    <Surface title={title} description={description} actions={actions}>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{filters}</div>
    </Surface>
  );
}
