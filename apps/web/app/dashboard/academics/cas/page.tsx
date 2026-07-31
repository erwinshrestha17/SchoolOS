'use client';

import { AcademicsSectionPage } from '@/components/academics/academics-section-page';
import { AcademicsWorkspace } from '@/components/academics/academics-workspace';

export default function CasPage() {
  return (
    <AcademicsSectionPage
      title="CAS Records"
      description="Track co-curricular activity and service records alongside academic marks."
    >
      <AcademicsWorkspace initialSection="CAS Records" />
    </AcademicsSectionPage>
  );
}
