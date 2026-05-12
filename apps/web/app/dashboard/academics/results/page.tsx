'use client';

import { ResultsPublishingWorkspace } from '@/components/academics/results/results-publishing-workspace';
import { PageHeader } from '@/components/ui/page-header';

export default function AcademicResultsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Result Publishing"
        description="Review readiness, publish results, unpublish safely, and notify families through approved channels."
      />
      <ResultsPublishingWorkspace />
    </div>
  );
}
