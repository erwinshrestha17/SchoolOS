'use client';

import { AssessmentRetakesTab } from '@/components/academics/tabs/assessment-retakes-tab';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { PageHeader } from '@/components/ui/page-header';

export default function AssessmentRetakesPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Retests & Make-ups"
        description="Manage each approved assessment attempt from request through scheduling, score capture, and result application."
      />
      <AssessmentRetakesTab />
    </DashboardPageShell>
  );
}
