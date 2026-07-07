'use client';

import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '../../../../components/dashboard/module-tabs';
import { learningWorkspaceTabs } from '../../../../components/learning/learning-tabs';
import { LearningWorkspace } from '../../../../components/learning/learning-workspace';
import { PageHeader } from '../../../../components/ui/page-header';

export default function LearningLabPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Computer Lab"
        description="Open student join and individual attempt flows for launched Learning sessions."
      />
      <div className="mb-6">
        <ModuleTabs items={learningWorkspaceTabs} accentColor="emerald" variant="light" />
      </div>
      <LearningWorkspace initialTab="lab" />
    </DashboardPageShell>
  );
}
