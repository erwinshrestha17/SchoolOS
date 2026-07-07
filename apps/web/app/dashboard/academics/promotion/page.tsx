'use client';

import { AcademicsWorkspace } from '@/components/academics/academics-workspace';
import { academicsWorkspaceTabs } from '@/components/academics/academics-tabs';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { PageHeader } from '@/components/ui/page-header';

export default function PromotionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotion Readiness"
        description="Review student eligibility and move students to the next academic year."
      />
      <ModuleTabs items={academicsWorkspaceTabs} accentColor="purple" variant="light" className="mb-6" />
      <AcademicsWorkspace initialSection="Promotion" />
    </div>
  );
}
