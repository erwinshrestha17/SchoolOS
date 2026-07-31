'use client';

import { AcademicsSectionPage } from '@/components/academics/academics-section-page';
import { AcademicsWorkspace } from '@/components/academics/academics-workspace';

export default function ExamTermsPage() {
  return (
    <AcademicsSectionPage
      title="Exam Terms"
      description="Configure terminal and periodic exam boundaries for the current academic year."
    >
      <AcademicsWorkspace initialSection="Exam Terms" />
    </AcademicsSectionPage>
  );
}
