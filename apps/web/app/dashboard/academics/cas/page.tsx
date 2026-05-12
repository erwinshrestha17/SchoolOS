'use client';

import { AcademicsWorkspace } from '@/components/academics/academics-workspace';
import { PageHeader } from '@/components/ui/page-header';

export default function CasRecordsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="CAS Records"
        description="Track Continuous Assessment System (CAS) scores and behavioral metrics."
      />
      <AcademicsWorkspace initialSection="CAS Records" />
    </div>
  );
}
