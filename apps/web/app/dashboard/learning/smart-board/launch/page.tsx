'use client';

import { DashboardPageShell } from '../../../../../components/dashboard/dashboard-page-shell';
import { LearningWorkspace } from '../../../../../components/learning/learning-workspace';
import { PageHeader } from '../../../../../components/ui/page-header';

export default function LearningSmartBoardLaunchPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Smart Board Launch"
        description="Open a live Learning session on the classroom board without exposing answer keys."
      />
      <LearningWorkspace initialTab="board" />
    </DashboardPageShell>
  );
}
