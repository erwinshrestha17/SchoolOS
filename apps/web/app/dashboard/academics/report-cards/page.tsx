'use client';

import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { PageHeader } from '@/components/ui/page-header';
import { ReportCardsWorkspace } from '@/components/academics/report-cards/report-cards-workspace';

export default function AcademicReportCardsPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Report Cards"
        description="Generate, track, and manage student performance reports using backend-calculated data."
      />
      <ReportCardsWorkspace />
    </DashboardPageShell>
  );
}
