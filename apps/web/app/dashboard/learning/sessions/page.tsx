'use client';

import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '../../../../components/dashboard/module-tabs';
import { learningWorkspaceTabs } from '../../../../components/learning/learning-tabs';
import { LearningWorkspace } from '../../../../components/learning/learning-workspace';
import { PageHeader } from '../../../../components/ui/page-header';

export default function LearningSessionsPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Learning Sessions"
        description="Launch, pause, resume, end, and open school-only smart-board and computer-lab sessions."
      />
      <div className="mb-6">
        <ModuleTabs items={learningWorkspaceTabs} accentColor="emerald" variant="light" />
      </div>
      <LearningWorkspace initialTab="sessions" />
    </DashboardPageShell>
  );
}
