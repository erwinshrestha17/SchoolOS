'use client';

import { AcademicsWorkspace } from '@/components/academics/academics-workspace';
import { PageHeader } from '@/components/ui/page-header';

export default function AssessmentComponentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment Components"
        description="Define weights, subject-specific components, and pass marks for each exam term."
      />
      <AcademicsWorkspace initialSection="Exam Terms" />
    </div>
  );
}
