'use client';

import { ReportCardsWorkspace } from '@/components/academics/report-cards/report-cards-workspace';
import { PageHeader } from '@/components/ui/page-header';

export default function AcademicReportCardsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Cards"
        description="Generate, track, and manage student performance reports using backend-calculated data."
      />
      <ReportCardsWorkspace />
    </div>
  );
}
