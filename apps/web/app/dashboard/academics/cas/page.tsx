'use client';

import { AcademicsWorkspace } from '@/components/academics/academics-workspace';
import { academicsWorkspaceTabs } from '@/components/academics/academics-tabs';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { PageHeader } from '@/components/ui/page-header';

export default function CasRecordsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="CAS Records"
        description="Track Continuous Assessment System (CAS) scores and behavioral metrics."
      />
      <ModuleTabs items={academicsWorkspaceTabs} accentColor="purple" variant="light" className="mb-6" />
      <AcademicsWorkspace initialSection="CAS Records" />
    </div>
  );
}
