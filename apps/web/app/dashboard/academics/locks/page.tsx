'use client';

import { AcademicsSectionPage } from '@/components/academics/academics-section-page';
import { AcademicsWorkspace } from '@/components/academics/academics-workspace';

export default function MarksLockPage() {
  return (
    <AcademicsSectionPage
      title="Marks Lock"
      description="Review and lock marks windows before publishing results."
    >
      <AcademicsWorkspace initialSection="Marks Lock" />
    </AcademicsSectionPage>
  );
}
