'use client';

import { DashboardPageShell } from '../../../../../components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '../../../../../components/dashboard/module-tabs';
import { learningWorkspaceTabs } from '../../../../../components/learning/learning-tabs';
import { LearningWorkspace } from '../../../../../components/learning/learning-workspace';
import { PageHeader } from '../../../../../components/ui/page-header';

export default function NewLearningActivityPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Teacher Activity Builder"
        description="Create a school-only Learning activity with questions, difficulty, language, and launch-ready mode."
      />
      <div className="mb-6">
        <ModuleTabs items={learningWorkspaceTabs} accentColor="emerald" variant="light" />
      </div>
      <LearningWorkspace initialTab="builder" />
    </DashboardPageShell>
  );
}
