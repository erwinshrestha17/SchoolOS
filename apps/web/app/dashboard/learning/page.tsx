'use client';

import Link from 'next/link';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';
import { LearningWorkspace } from '../../../components/learning/learning-workspace';
import { PageHeader } from '../../../components/ui/page-header';

const learningTabs = [
  { label: 'Overview', href: '/dashboard/learning' },
  { label: 'Activities', href: '/dashboard/learning/activities' },
  { label: 'Builder', href: '/dashboard/learning/activities/new' },
  { label: 'Resources', href: '/dashboard/learning/resources' },
  { label: 'Sessions', href: '/dashboard/learning/sessions' },
  { label: 'Smart Board', href: '/dashboard/learning/smart-board/launch' },
  { label: 'Lab', href: '/dashboard/learning/lab' },
  { label: 'Progress', href: '/dashboard/learning/progress' },
];

export default function LearningPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Learning"
        description="Create teacher-led activities, launch school-only smart-board and computer-lab sessions, and review supportive progress."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/learning/activities/new"
              className="inline-flex h-10 items-center rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800"
            >
              New activity
            </Link>
            <Link
              href="/dashboard/learning/sessions"
              className="inline-flex h-10 items-center rounded-xl border border-emerald-100 bg-white px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-50"
            >
              Launch session
            </Link>
          </div>
        }
      />
      <div className="mb-6">
        <ModuleTabs items={learningTabs} accentColor="emerald" variant="light" />
      </div>
      <LearningWorkspace initialTab="overview" />
    </DashboardPageShell>
  );
}
