'use client';

import { AssessmentRetakesTab } from '@/components/academics/tabs/assessment-retakes-tab';
import { academicsWorkspaceTabs } from '@/components/academics/academics-tabs';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { PageHeader } from '@/components/ui/page-header';

export default function AssessmentRetakesPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Retests & Make-ups"
        description="Manage each approved assessment attempt from request through scheduling, score capture, and result application."
      />
      <ModuleTabs items={academicsWorkspaceTabs} accentColor="purple" variant="light" className="mb-6" />
      <AssessmentRetakesTab />
    </DashboardPageShell>
  );
}
