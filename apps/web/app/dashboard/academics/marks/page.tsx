'use client';

import { AcademicsWorkspace } from '@/components/academics/academics-workspace';
import { PageHeader } from '@/components/ui/page-header';

export default function MarksEntryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Marks Entry"
        description="Record and review student scores for terminal and periodic assessments."
      />
      <AcademicsWorkspace initialSection="Marks Entry" />
    </div>
  );
}
