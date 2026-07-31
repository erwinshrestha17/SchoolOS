'use client';

import { AcademicsSectionPage } from '@/components/academics/academics-section-page';
import { AcademicsWorkspace } from '@/components/academics/academics-workspace';

export default function AssessmentComponentsPage() {
  return (
    <AcademicsSectionPage
      title="Assessment Components"
      description="Define how marks are grouped and weighted for each exam term."
    >
      <AcademicsWorkspace initialSection="Exam Terms" />
    </AcademicsSectionPage>
  );
}
