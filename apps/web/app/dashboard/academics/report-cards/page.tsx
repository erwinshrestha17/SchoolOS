'use client';

import { AcademicsWorkspace } from '../../../../components/academics/academics-workspace';
import { PageHeader } from '../../../../components/ui/page-header';

export default function AcademicReportCardsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Cards"
        description="Generate, review, and manage student report cards from backend academic records."
      />
      <AcademicsWorkspace initialSection="Report Cards" />
    </div>
  );
}
