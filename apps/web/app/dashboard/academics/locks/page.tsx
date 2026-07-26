'use client';

import { AcademicsWorkspace } from '@/components/academics/academics-workspace';
import { academicsWorkspaceOverflowTabs, academicsWorkspaceTabs } from '@/components/academics/academics-tabs';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { PageHeader } from '@/components/ui/page-header';

export default function MarksLockPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Marks Lock & Review"
        description="Secure academic records to prevent modifications before result generation."
      />
      <ModuleTabs items={academicsWorkspaceTabs} overflowItems={academicsWorkspaceOverflowTabs} accentColor="purple" variant="light" className="mb-6" />
      <AcademicsWorkspace initialSection="Marks Lock" />
    </div>
  );
}
