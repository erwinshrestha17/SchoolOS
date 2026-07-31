'use client';

import { AcademicsSectionPage } from '@/components/academics/academics-section-page';
import { AcademicsWorkspace } from '@/components/academics/academics-workspace';

export default function ResultPublishingPage() {
  return (
    <AcademicsSectionPage
      title="Result Publishing"
      description="Publish approved results to guardians and staff with audit-safe controls."
    >
      <AcademicsWorkspace initialSection="Result Publishing" />
    </AcademicsSectionPage>
  );
}
