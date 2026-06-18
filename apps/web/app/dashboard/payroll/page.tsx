'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Calculator,
  FileText,
  History,
  Wallet,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { cn } from '../../../lib/utils';
import { ModuleHeader } from '../../../components/ui/module-header';
import { KpiCard, KpiGrid } from '../../../components/ui/kpi-card';
import { ModuleTabs } from '../../../components/dashboard/module-tabs';
import { LoadingState } from '../../../components/ui/loading-state';
import { ErrorState } from '../../../components/ui/error-state';
import { EmptyState } from '../../../components/ui/empty-state';

const moneyFormatter = new Intl.NumberFormat('en-NP', {
  style: 'currency',
  currency: 'NPR',
  maximumFractionDigits: 0,
});

const moduleTabs = [
  { href: '/dashboard/payroll/runs', label: 'Runs', icon: History },
  { href: '/dashboard/payroll/salary-structures', label: 'Salary Structures', icon: Calculator },
  { href: '/dashboard/payroll/payslips', label: 'Payslips', icon: FileText },
  { href: '/dashboard/payroll/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/hr/staff', label: 'Staff', icon: Wallet },
];

function formatMoney(value?: number | null) {
  if (value === undefined || value === null) return 'Unavailable';
  return moneyFormatter.format(value);
}

export default function PayrollDashboardPage() {
  const router = useRouter();
  const runsQuery = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: api.listPayrollRuns,
  });
  const summaryQuery = useQuery({
    queryKey: ['payroll-summary'],
    queryFn: () => api.getPayrollReportSummary(),
  });

  const payrollRuns = runsQuery.data ?? [];
  const latestRun = payrollRuns[0] ?? null;
  const latestPostedRun = payrollRuns.find((run) => run.status === 'POSTED');
  const workflowSteps = [
    {
      label: 'Draft',
      statuses: ['DRAFT', 'GENERATED', 'UNDER_REVIEW', 'REVIEWED'],
      description: 'Generated or under review',
    },
    {
      label: 'Approved',
      statuses: ['APPROVED'],
      description: 'Ready for posting',
    },
    {
      label: 'Posted',
      statuses: ['POSTED'],
      description: 'Accrued in accounting',
    },
  ].map((step) => ({
    ...step,
    count: payrollRuns.filter((run) => step.statuses.includes(run.status)).length,
  }));
  const awaitingAction = workflowSteps
    .filter((step) => step.label !== 'Posted')
    .reduce((total, step) => total + step.count, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ModuleHeader
        eyebrow="M7 Payroll"
        title="Payroll"
        description="Review payroll runs, approve them, post approved runs to accounting, and open protected payslips and statutory reports from backend-owned payroll data."
        primaryAction={
          <Link
            href="/dashboard/payroll/runs"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2 active:scale-[0.98]"
          >
            <History className="h-4 w-4" />
            Open Runs
          </Link>
        }
        moreActionItems={[
          {
            label: 'Salary Structures',
            icon: <Calculator className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/payroll/salary-structures'),
          },
          {
            label: 'Payslips',
            icon: <FileText className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/payroll/payslips'),
          },
          {
            label: 'Reports',
            icon: <BarChart3 className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/payroll/reports'),
          },
        ]}
      >
        <ModuleTabs items={moduleTabs} accentColor="purple" variant="light" />
      </ModuleHeader>

      <KpiGrid>
        <KpiCard
          title="Gross Pay"
          value={formatMoney(summaryQuery.data?.gross)}
          icon={<Wallet className="h-5 w-5" />}
          loading={summaryQuery.isLoading}
          tone="neutral"
          description="Official payroll report summary"
        />
        <KpiCard
          title="Deductions"
          value={formatMoney(summaryQuery.data?.deductions)}
          icon={<Calculator className="h-5 w-5" />}
          loading={summaryQuery.isLoading}
          tone="info"
          description="PF, TDS, and other deductions"
        />
        <KpiCard
          title="Net Payable"
          value={formatMoney(summaryQuery.data?.netPayable)}
          icon={<BadgeCheck className="h-5 w-5" />}
          loading={summaryQuery.isLoading}
          tone="success"
          description="Backend-calculated report total"
        />
        <KpiCard
          title="Approval Queue"
          value="Unavailable"
          icon={<AlertCircle className="h-5 w-5" />}
          tone="neutral"
          description="Needs workflow summary endpoint"
        />
      </KpiGrid>

      <section className="shell-card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Payroll Workflow</h2>
            <p className="mt-1 text-sm text-slate-500">
              Current loaded run statuses for review, approval, and accounting posting.
            </p>
          </div>
          <Link
            href="/dashboard/payroll/runs"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--primary-dark)] hover:text-slate-950"
          >
            Open Payroll Runs
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-5">
          {runsQuery.isLoading ? (
            <LoadingState variant="spinner" label="Loading payroll workflow..." />
          ) : runsQuery.isError ? (
            <ErrorState
              title="Payroll workflow unavailable"
              message="Payroll run statuses could not be loaded. Check your payroll permission and retry."
              onRetry={() => void runsQuery.refetch()}
            />
          ) : payrollRuns.length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {workflowSteps.map((step, index) => (
                <div
                  key={step.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {index + 1}. {step.label}
                    </span>
                    <span className="rounded-lg bg-white px-2 py-1 text-xs font-bold tabular-nums text-slate-700">
                      {step.count}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-700">{step.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No payroll runs"
              description="Create a payroll run from the runs workspace when payroll is ready for review."
              icon={<History className="h-7 w-7" />}
            />
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="shell-card p-6">
          <h2 className="text-lg font-black text-slate-950">Posting Status</h2>
          <p className="mt-1 text-sm text-slate-500">
            Posted runs are linked to accounting journals; salary disbursement remains outside this workspace.
          </p>

          <div className="mt-5 space-y-3">
            {[
              {
                label: 'Latest Run',
                status: latestRun?.status?.replaceAll('_', ' ') ?? 'No runs',
                tone: latestRun ? 'text-[var(--primary-dark)]' : 'text-slate-500',
              },
              {
                label: 'Latest Posted Journal',
                status: latestPostedRun?.journalEntryId ? 'Linked' : 'Not posted',
                tone: latestPostedRun?.journalEntryId ? 'text-success-700' : 'text-warning-700',
              },
              {
                label: 'Runs Awaiting Review or Posting',
                status: String(awaitingAction),
                tone: awaitingAction > 0 ? 'text-warning-700' : 'text-success-700',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <span className="text-sm font-medium text-slate-600">{item.label}</span>
                <span className={cn('text-xs font-bold uppercase tracking-wide', item.tone)}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="shell-card p-6">
          <h2 className="text-lg font-black text-slate-950">Reports and Protected Files</h2>
          <p className="mt-1 text-sm text-slate-500">
            Payslip PDFs and exports stay behind authenticated payroll helpers.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Payslips', href: '/dashboard/payroll/payslips', icon: FileText },
              { label: 'Payroll Reports', href: '/dashboard/payroll/reports', icon: BarChart3 },
              { label: 'Salary Structures', href: '/dashboard/payroll/salary-structures', icon: Calculator },
              { label: 'Staff Contracts', href: '/dashboard/hr/contracts', icon: Wallet },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                    <item.icon className="h-4 w-4" />
                  </span>
                  {item.label}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      {summaryQuery.isError ? (
        <ErrorState
          title="Payroll summary unavailable"
          message="Official payroll summary totals could not be loaded. Report totals remain unavailable until the backend returns them."
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : null}
    </div>
  );
}
