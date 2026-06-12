'use client';

import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { LearningWorkspace } from '../../../../components/learning/learning-workspace';
import { PageHeader } from '../../../../components/ui/page-header';

export default function LearningSessionsPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Learning Sessions"
        description="Launch, pause, resume, end, and open school-only smart-board and computer-lab sessions."
      />
      <LearningWorkspace initialTab="sessions" />
    </DashboardPageShell>
  );
}
