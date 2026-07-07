'use client';

import { AcademicsWorkspace } from '@/components/academics/academics-workspace';
import { academicsWorkspaceTabs } from '@/components/academics/academics-tabs';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { PageHeader } from '@/components/ui/page-header';

export default function AssessmentComponentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment Components"
        description="Define weights, subject-specific components, and pass marks for each exam term."
      />
      <ModuleTabs items={academicsWorkspaceTabs} accentColor="purple" variant="light" className="mb-6" />
      <AcademicsWorkspace initialSection="Exam Terms" />
    </div>
  );
}
