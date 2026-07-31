'use client';

import { AcademicsSectionPage } from '@/components/academics/academics-section-page';
import { ReportCardsWorkspace } from '@/components/academics/report-cards/report-cards-workspace';

export default function AcademicReportCardsPage() {
  return (
    <AcademicsSectionPage
      title="Report Cards"
      description="Generate, track, and manage student performance reports using backend-calculated data."
    >
      <ReportCardsWorkspace />
    </AcademicsSectionPage>
  );
}
