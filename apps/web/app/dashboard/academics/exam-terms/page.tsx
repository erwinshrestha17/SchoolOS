'use client';

import { AcademicsWorkspace } from '@/components/academics/academics-workspace';
import { PageHeader } from '@/components/ui/page-header';

export default function ExamTermsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam Terms"
        description="Configure terminal and periodic exam boundaries for the current academic year."
      />
      <AcademicsWorkspace initialSection="Exam Terms" />
    </div>
  );
}
