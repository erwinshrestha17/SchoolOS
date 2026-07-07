'use client';

import { academicsWorkspaceTabs } from '@/components/academics/academics-tabs';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { PageHeader } from '@/components/ui/page-header';
import { ReportCardsWorkspace } from '@/components/academics/report-cards/report-cards-workspace';

export default function AcademicReportCardsPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Report Cards"
        description="Generate, track, and manage student performance reports using backend-calculated data."
      />
      <ModuleTabs items={academicsWorkspaceTabs} accentColor="purple" variant="light" className="mb-6" />
      <ReportCardsWorkspace />
    </DashboardPageShell>
  );
}
