'use client';

import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '../../../../components/dashboard/module-tabs';
import { LearningWorkspace } from '../../../../components/learning/learning-workspace';
import { PageHeader } from '../../../../components/ui/page-header';

const learningTabs = [
  { label: 'Overview', href: '/dashboard/learning' },
  { label: 'Activities', href: '/dashboard/learning/activities' },
  { label: 'Builder', href: '/dashboard/learning/activities/new' },
  { label: 'Resources', href: '/dashboard/learning/resources' },
  { label: 'Sessions', href: '/dashboard/learning/sessions' },
  { label: 'Progress', href: '/dashboard/learning/progress' },
];

export default function LearningActivitiesPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Learning Activities"
        description="Filter, edit, archive, and launch teacher activity builder records."
      />
      <div className="mb-6">
        <ModuleTabs items={learningTabs} accentColor="emerald" variant="light" />
      </div>
      <LearningWorkspace initialTab="activities" />
    </DashboardPageShell>
  );
}
