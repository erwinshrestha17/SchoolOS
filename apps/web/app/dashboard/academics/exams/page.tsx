'use client';

import { AcademicsSectionPage } from '@/components/academics/academics-section-page';
import { ExamsWorkspace } from '@/components/academics/exams/exams-workspace';

export default function AcademicExamsPage() {
  return (
    <AcademicsSectionPage
      title="Exams"
      description="Set up exam terms, assessment components, and academic evaluation rules."
      showTabs={false}
    >
      <ExamsWorkspace />
    </AcademicsSectionPage>
  );
}
