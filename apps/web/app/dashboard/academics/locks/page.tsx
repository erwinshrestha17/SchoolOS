'use client';

import { AcademicsWorkspace } from '@/components/academics/academics-workspace';
import { PageHeader } from '@/components/ui/page-header';

export default function MarksLockPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Marks Lock & Review"
        description="Secure academic records to prevent modifications before result generation."
      />
      <AcademicsWorkspace initialSection="Marks Lock" />
    </div>
  );
}
