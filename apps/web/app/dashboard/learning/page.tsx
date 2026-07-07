'use client';

import Link from 'next/link';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';
import { learningWorkspaceTabs } from '../../../components/learning/learning-tabs';
import { LearningWorkspace } from '../../../components/learning/learning-workspace';
import { PageHeader } from '../../../components/ui/page-header';

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
        <ModuleTabs items={learningWorkspaceTabs} accentColor="emerald" variant="light" />
      </div>
      <LearningWorkspace initialTab="overview" />
    </DashboardPageShell>
  );
}
