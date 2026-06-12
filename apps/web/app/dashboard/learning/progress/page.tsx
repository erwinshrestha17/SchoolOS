'use client';

import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { LearningWorkspace } from '../../../../components/learning/learning-workspace';
import { PageHeader } from '../../../../components/ui/page-header';

export default function LearningProgressPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Learning Progress"
        description="Review class and student progress with supportive labels only."
      />
      <LearningWorkspace initialTab="progress" />
    </DashboardPageShell>
  );
}
