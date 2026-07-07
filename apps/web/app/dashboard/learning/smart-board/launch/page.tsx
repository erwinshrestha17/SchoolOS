'use client';

import { DashboardPageShell } from '../../../../../components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '../../../../../components/dashboard/module-tabs';
import { learningWorkspaceTabs } from '../../../../../components/learning/learning-tabs';
import { LearningWorkspace } from '../../../../../components/learning/learning-workspace';
import { PageHeader } from '../../../../../components/ui/page-header';

export default function LearningSmartBoardLaunchPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Smart Board Launch"
        description="Open a live Learning session on the classroom board without exposing answer keys."
      />
      <div className="mb-6">
        <ModuleTabs items={learningWorkspaceTabs} accentColor="emerald" variant="light" />
      </div>
      <LearningWorkspace initialTab="board" />
    </DashboardPageShell>
  );
}
