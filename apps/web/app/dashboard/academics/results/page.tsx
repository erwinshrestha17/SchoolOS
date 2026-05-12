'use client';

import { ResultsPublishingWorkspace } from '@/components/academics/results/results-publishing-workspace';
import { PageHeader } from '@/components/ui/page-header';

export default function AcademicResultsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Result Preview"
        description="Review student grades, percentages, and readiness before final publishing."
      />
      <ResultsPublishingWorkspace />
    </div>
  );
}
