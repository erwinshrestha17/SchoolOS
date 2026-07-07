'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ClipboardList,
  FileText,
  GraduationCap,
  History,
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
import { KpiCard, KpiGrid } from '@/components/ui/kpi-card';
import { ModuleHeader } from '@/components/ui/module-header';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { SectionCard } from '@/components/ui/section-card';
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
    title: 'Retests and make-ups',
    description:
      'Review requests, schedule attempts, record scores, and apply an explicit result decision.',
    href: '/dashboard/academics/retakes',
    action: 'Open retest queue',
    icon: RotateCcw,
  },
  {
    title: 'Lock and review',
    description: 'Review permissioned lock or unlock requests before official result processing.',
    href: '/dashboard/academics/locks',
    action: 'Review locks',
    icon: Lock,
  },
  {
    title: 'Report cards',
    description: 'Generate and monitor job-backed report cards, corrections, history, and protected PDFs.',
    href: '/dashboard/academics/report-cards',
    action: 'Open report cards',
    icon: FileText,
  },
  {
    title: 'Promotion readiness',
    description: 'Review backend-calculated eligibility before making audited promotion decisions.',
    href: '/dashboard/academics/promotion',
    action: 'Review readiness',
    icon: GraduationCap,
  },
  {
    title: 'Publish results',
    description: 'Validate readiness and control published-result visibility for approved audiences.',
    href: '/dashboard/academics/publishing',
    action: 'Review publishing',
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
  const canManageReportCards =
    hasPermissions(['academics:manage_report_cards']) || canManageAcademics;

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
        title="Academics"
        description={`Manage exam terms, marks, CAS, report cards, and result publishing${session?.tenant.name ? ` for ${session.tenant.name}` : ''}. Official readiness remains backend-owned.`}
        primaryAction={
          canManageAcademics ? (
            <Link
              href="/dashboard/academics/exam-terms"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-academics-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-academics-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-academics-border)] focus:ring-offset-2"
            >
              <ClipboardList size={18} />
              Create Exam Term
            </Link>
          ) : canEnterMarks ? (
            <Link
              href="/dashboard/academics/marks"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-academics-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-academics-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-academics-border)] focus:ring-offset-2"
            >
              <PencilLine size={18} />
              Enter Marks
            </Link>
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
          ...(canManageReportCards
            ? [
                {
                  label: 'Report Card Jobs & History',
                  icon: <History size={16} />,
                  onClick: () => router.push('/dashboard/academics/report-cards'),
                },
                {
                  label: 'Publish Results',
                  icon: <Megaphone size={16} />,
                  onClick: () => router.push('/dashboard/academics/publishing'),
                },
              ]
            : []),
        ]}
      >
        <KpiGrid className="sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Marks Entry Open"
            loading={summaryQuery.isLoading}
            value={metricValue('marksOpen')}
            icon={<PencilLine size={20} />}
            tone={isPositive('marksOpen') ? 'warning' : 'neutral'}
            href="/dashboard/academics/marks"
            description="Unlocked mark entries across active terms."
          />
          <KpiCard
            title="Mark Lock Requests"
            loading={summaryQuery.isLoading}
            value={metricValue('pendingMarkLocks')}
            icon={<Lock size={20} />}
            tone={isPositive('pendingMarkLocks') ? 'warning' : 'neutral'}
            href="/dashboard/academics/marks"
            description="Lock requests awaiting review."
          />
          <KpiCard
            title="Report Cards Unpublished"
            loading={summaryQuery.isLoading}
            value={metricValue('reportCardPublishBlockers')}
            icon={<AlertTriangle size={20} />}
            tone={
              isPositive('reportCardPublishBlockers') ? 'warning' : 'neutral'
            }
            href="/dashboard/academics/report-cards"
            description="Current-term report cards not yet published."
          />
          <KpiCard
            title="Promotion Ready"
            loading={summaryQuery.isLoading}
            value={metricValue('promotionReady')}
            icon={<GraduationCap size={20} />}
            tone={isPositive('promotionReady') ? 'info' : 'neutral'}
            href="/dashboard/academics/promotion"
            description="Students with a backend-calculated ready decision."
          />
        </KpiGrid>
      </ModuleHeader>

      <div className="space-y-6">
        <ModuleTabs items={academicsWorkspaceTabs} accentColor="purple" variant="light" />

        <SectionCard
          title="Academic workflow"
          description="Move from setup to publishing through the existing tenant-scoped and permissioned M4 workspaces."
          noPadding
        >
          <div className="divide-y divide-slate-100">
            {workflowSections.map((section, index) => {
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Step {index + 1}
                      </span>
                      <h2 className="text-base font-bold text-slate-950">{section.title}</h2>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{section.description}</p>
                  </div>
                  <span className="hidden shrink-0 text-sm font-bold text-[var(--color-mod-academics-text)] sm:block">
                    {section.action}
                  </span>
                </Link>
              );
            })}
          </div>
        </SectionCard>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-600">
          <strong className="font-bold text-slate-900">Academic records remain backend-controlled.</strong>{' '}
          Marks locks, grading, dues-aware withholding, report-card generation, corrections, publishing, and protected PDF access keep their existing API and audit rules.
        </div>
      </div>
    </DashboardPageShell>
  );
}
