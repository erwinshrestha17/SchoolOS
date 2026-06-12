'use client';

import { DashboardPageShell } from '../../../../../components/dashboard/dashboard-page-shell';
import { LearningWorkspace } from '../../../../../components/learning/learning-workspace';
import { PageHeader } from '../../../../../components/ui/page-header';

export default function NewLearningActivityPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Teacher Activity Builder"
        description="Create a school-only Learning activity with questions, difficulty, language, and launch-ready mode."
      />
      <LearningWorkspace initialTab="builder" />
    </DashboardPageShell>
  );
}
