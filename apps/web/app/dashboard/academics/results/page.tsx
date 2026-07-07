'use client';

import { ResultsPublishingWorkspace } from '@/components/academics/results/results-publishing-workspace';
import { academicsWorkspaceTabs } from '@/components/academics/academics-tabs';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { PageHeader } from '@/components/ui/page-header';

export default function AcademicResultsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Result Preview"
        description="Review student grades, percentages, and readiness before final publishing."
      />
      <ModuleTabs items={academicsWorkspaceTabs} accentColor="purple" variant="light" className="mb-6" />
      <ResultsPublishingWorkspace />
    </div>
  );
}
