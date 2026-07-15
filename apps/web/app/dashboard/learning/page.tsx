'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpenCheck, MonitorPlay } from 'lucide-react';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { WorkspaceTabs } from '../../../components/ui/module-tabs';
import { learningWorkspaceTabs } from '../../../components/learning/learning-tabs';
import { LearningWorkspace } from '../../../components/learning/learning-workspace';
import { ModuleHeader } from '../../../components/ui/module-header';

export default function LearningPage() {
  const router = useRouter();

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="M13 Learning Layer"
        title="Learning"
        description="Create teacher-led activities, launch school-only smart-board and computer-lab sessions, and review supportive progress."
        primaryAction={
          <Link
            href="/dashboard/learning/activities/new"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2"
          >
            <BookOpenCheck className="h-4 w-4" />
            New activity
          </Link>
        }
        moreActionItems={[
          {
            label: 'Open learning sessions',
            icon: <MonitorPlay className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/learning/sessions'),
          },
        ]}
      />
      <WorkspaceTabs items={learningWorkspaceTabs} />
      <LearningWorkspace initialTab="overview" />
    </DashboardPageShell>
  );
}
