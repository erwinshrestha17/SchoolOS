'use client';

import { AcademicsWorkspace } from '../../../../components/academics/academics-workspace';
import { PageHeader } from '../../../../components/ui/page-header';

export default function AcademicPromotionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions"
        description="Review promotion readiness and move eligible students to the next academic class."
      />
      <AcademicsWorkspace initialSection="Promotion" />
    </div>
  );
}
