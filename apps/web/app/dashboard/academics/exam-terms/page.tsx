'use client';

import { AcademicsWorkspace } from '@/components/academics/academics-workspace';
import { academicsWorkspaceTabs } from '@/components/academics/academics-tabs';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { PageHeader } from '@/components/ui/page-header';

export default function ExamTermsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam Terms"
        description="Configure terminal and periodic exam boundaries for the current academic year."
      />
      <ModuleTabs items={academicsWorkspaceTabs} accentColor="purple" variant="light" className="mb-6" />
      <AcademicsWorkspace initialSection="Exam Terms" />
    </div>
  );
}
