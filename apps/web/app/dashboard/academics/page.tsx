'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ClipboardList,
  FileText,
  GraduationCap,
  Layers3,
  Lock,
  Megaphone,
  PencilLine,
  RotateCcw,
  Settings,
} from 'lucide-react';
import { useSession } from '@/components/session-provider';
import { academicsWorkspaceTabs } from '@/components/academics/academics-tabs';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { SummaryCard, SummaryGrid } from '@/components/ui/summary-card';
import { ModuleHeader } from '@/components/ui/module-header';
import { WorkspaceTabs } from '@/components/ui/module-tabs';
import { WorkSurface } from '@/components/ui/work-surface';
import { Button } from '@/components/ui/primitives/button';
import { api } from '@/lib/api';

const workflowSections = [
  {
    title: 'Exam setup',
    description: 'Configure exam terms, assessment components, and subject structures before marks entry.',
    href: '/dashboard/academics/exam-terms',
    action: 'Open exam setup',
    icon: Settings,
  },
  {
    title: 'Marks and CAS',
    description: 'Work inside assigned class, section, subject, term, and component scope.',
    href: '/dashboard/academics/marks',
    action: 'Enter marks',
    icon: PencilLine,
  },
  {
    title: 'Report cards',
    description: 'Generate and monitor job-backed report cards, corrections, history, and protected PDFs.',
    href: '/dashboard/academics/report-cards',
    action: 'Open report cards',
    icon: FileText,
  },
  {
    title: 'Results and publishing',
    description: 'Review calculated results before controlling visibility for approved audiences.',
    href: '/dashboard/academics/results',
    action: 'Review results',
    icon: Megaphone,
  },
];

export default function AcademicsOverviewPage() {
  const router = useRouter();
  const { hasPermissions, session } = useSession();
  const canManageAcademics = hasPermissions(['academics:manage']);
  const canEnterMarks =
    hasPermissions(['academics:enter_marks']) ||
    hasPermissions(['marks:manage']) ||
    canManageAcademics;
  const summaryQuery = useQuery({
    queryKey: ['operational-summary', 'academics'],
    queryFn: () => api.getModuleSummary('academics'),
  });
  const summary = summaryQuery.data;
  const isReady = summary?.status === 'ready' || summary?.status === 'empty';

  const metricValue = (key: string) => {
    if (!isReady) return 'Unavailable';
    const value = summary?.summary[key];
    return value === null || value === undefined ? 'Unavailable' : value;
  };
  const isPositive = (key: string) => Number(summary?.summary[key]) > 0;

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="Academics & Exams"
        title="Academics"
        description={`Manage exam terms, marks, CAS, report cards, and result publishing${session?.tenant.name ? ` for ${session.tenant.name}` : ''}. Official readiness remains backend-owned.`}
        primaryAction={
          canManageAcademics ? (
            <Button asChild>
              <Link href="/dashboard/academics/exam-terms">
                <ClipboardList data-icon="inline-start" />
                Create Exam Term
              </Link>
            </Button>
          ) : canEnterMarks ? (
            <Button asChild>
              <Link href="/dashboard/academics/marks">
                <PencilLine data-icon="inline-start" />
                Enter Marks
              </Link>
            </Button>
          ) : undefined
        }
        moreActionItems={[
          ...(canManageAcademics
            ? [
                {
                  label: 'Assessment Components',
                  icon: <Layers3 size={16} />,
                  onClick: () => router.push('/dashboard/academics/assessment-components'),
                },
                {
                  label: 'Retest Queue',
                  icon: <RotateCcw size={16} />,
                  onClick: () => router.push('/dashboard/academics/retakes'),
                },
                {
                  label: 'Marks Lock Review',
                  icon: <Lock size={16} />,
                  onClick: () => router.push('/dashboard/academics/locks'),
                },
                {
                  label: 'Promotion Readiness',
                  icon: <GraduationCap size={16} />,
                  onClick: () => router.push('/dashboard/academics/promotion'),
                },
              ]
            : []),
          ...(canEnterMarks && !canManageAcademics
            ? [
                {
                  label: 'Retest Queue',
                  icon: <RotateCcw size={16} />,
                  onClick: () => router.push('/dashboard/academics/retakes'),
                },
              ]
            : []),
        ]}
      >
        <SummaryGrid>
          <SummaryCard
            label="Marks Entry Open"
            loading={summaryQuery.isLoading}
            value={metricValue('marksOpen')}
            icon={<PencilLine size={20} />}
            tone={isPositive('marksOpen') ? 'warning' : 'module'}
            href="/dashboard/academics/marks"
            description="Unlocked mark entries across active terms."
          />
          <SummaryCard
            label="Mark Lock Requests"
            loading={summaryQuery.isLoading}
            value={metricValue('pendingMarkLocks')}
            icon={<Lock size={20} />}
            tone={isPositive('pendingMarkLocks') ? 'warning' : 'module'}
            href="/dashboard/academics/locks"
            description="Lock requests awaiting review."
          />
          <SummaryCard
            label="Report Cards Unpublished"
            loading={summaryQuery.isLoading}
            value={metricValue('reportCardPublishBlockers')}
            icon={<AlertTriangle size={20} />}
            tone={
              isPositive('reportCardPublishBlockers') ? 'warning' : 'module'
            }
            href="/dashboard/academics/report-cards"
            description="Current-term report cards not yet published."
          />
          <SummaryCard
            label="Promotion Ready"
            loading={summaryQuery.isLoading}
            value={metricValue('promotionReady')}
            icon={<GraduationCap size={20} />}
            tone={isPositive('promotionReady') ? 'info' : 'module'}
            href="/dashboard/academics/promotion"
            description="Students with a backend-calculated ready decision."
          />
        </SummaryGrid>
      </ModuleHeader>

      <div className="flex flex-col gap-6">
        <WorkspaceTabs items={academicsWorkspaceTabs} />

        <WorkSurface
          title="Core academic workspaces"
          description="Open the next focused job. Marks, locks, grading, promotion, publishing, and protected PDF access remain backend-controlled across tenant-scoped and permissioned M4 workspaces."
          flush
        >
          <div className="divide-y divide-slate-100">
            {workflowSections.map((section) => {
              const Icon = section.icon;
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  className="group flex items-start gap-4 p-5 transition hover:bg-[var(--color-mod-academics-bg)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-mod-academics-border)] sm:items-center lg:p-6"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-mod-academics-border)] bg-[var(--color-mod-academics-bg)] text-[var(--color-mod-academics-text)]">
                    <Icon size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold text-slate-950">{section.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{section.description}</p>
                  </div>
                  <span className="hidden shrink-0 text-sm font-bold text-[var(--color-mod-academics-text)] sm:block">
                    {section.action}
                  </span>
                </Link>
              );
            })}
          </div>
        </WorkSurface>

      </div>
    </DashboardPageShell>
  );
}
