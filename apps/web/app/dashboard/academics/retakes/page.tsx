'use client';

import { AcademicsSectionPage } from '@/components/academics/academics-section-page';
import { AssessmentRetakesTab } from '@/components/academics/tabs/assessment-retakes-tab';

export default function AssessmentRetakesPage() {
  return (
    <AcademicsSectionPage
      title="Retests & Make-ups"
      description="Manage each approved assessment attempt from request through scheduling, score capture, and result application."
    >
      <AssessmentRetakesTab />
    </AcademicsSectionPage>
  );
}
