'use client';

import { MarksEntryWorkspace } from '@/components/academics/marks-entry/marks-entry-workspace';
import { PageHeader } from '@/components/ui/page-header';

export default function AcademicMarksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Marks Entry"
        description="Enter, validate, and review subject marks for exams and assessment components."
      />
      <MarksEntryWorkspace />
    </div>
  );
}
