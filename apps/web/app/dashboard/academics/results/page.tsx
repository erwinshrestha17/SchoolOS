'use client';

import { AcademicsSectionPage } from '@/components/academics/academics-section-page';
import { ResultsPublishingWorkspace } from '@/components/academics/results/results-publishing-workspace';

export default function AcademicResultsPage() {
  return (
    <AcademicsSectionPage
      title="Result Preview"
      description="Review student grades, percentages, and readiness before final publishing."
    >
      <ResultsPublishingWorkspace />
    </AcademicsSectionPage>
  );
}
