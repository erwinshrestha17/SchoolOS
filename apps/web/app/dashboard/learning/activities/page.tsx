'use client';

import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '../../../../components/dashboard/module-tabs';
import { learningWorkspaceTabs } from '../../../../components/learning/learning-tabs';
import { LearningWorkspace } from '../../../../components/learning/learning-workspace';
import { PageHeader } from '../../../../components/ui/page-header';

export default function LearningActivitiesPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Learning Activities"
        description="Filter, edit, archive, and launch teacher activity builder records."
      />
      <div className="mb-6">
        <ModuleTabs items={learningWorkspaceTabs} accentColor="emerald" variant="light" />
      </div>
      <LearningWorkspace initialTab="activities" />
    </DashboardPageShell>
  );
}
