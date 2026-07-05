'use client';

import { ExamsWorkspace } from '@/components/academics/exams/exams-workspace';
import { PageHeader } from '@/components/ui/page-header';

export default function AcademicExamsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Exams"
        description="Set up exam terms, assessment components, and academic evaluation rules."
      />
      <ExamsWorkspace />
    </div>
  );
}
