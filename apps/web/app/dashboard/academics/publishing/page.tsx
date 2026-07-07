'use client';

import { AcademicsWorkspace } from '@/components/academics/academics-workspace';
import { academicsWorkspaceTabs } from '@/components/academics/academics-tabs';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { PageHeader } from '@/components/ui/page-header';

export default function PublishingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Result Publishing"
        description="Review readiness, publish results, and notify guardians through approved channels."
      />
      <ModuleTabs items={academicsWorkspaceTabs} accentColor="purple" variant="light" className="mb-6" />
      <AcademicsWorkspace initialSection="Result Publishing" />
    </div>
  );
}
