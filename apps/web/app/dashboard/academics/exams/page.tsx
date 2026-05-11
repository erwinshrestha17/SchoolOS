'use client';

import { AcademicsWorkspace } from '../../../../components/academics/academics-workspace';
import { PageHeader } from '../../../../components/ui/page-header';

export default function AcademicExamsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Exams"
        description="Set up exam terms, assessment components, and academic evaluation rules."
      />
      <AcademicsWorkspace initialSection="Exam Terms" />
    </div>
  );
}
