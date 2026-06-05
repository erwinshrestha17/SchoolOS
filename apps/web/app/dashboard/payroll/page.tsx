'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import {
  Calculator,
  History,
  Wallet,
  FileText,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { StatCard } from '../../../components/ui/stat-card';
import { cn } from '../../../lib/utils';
import Link from 'next/link';

type PayrollSummary = {
  gross?: number;
  netPayable?: number;
};

const moneyFormatter = new Intl.NumberFormat('en-NP', {
  style: 'currency',
  currency: 'NPR',
  maximumFractionDigits: 0,
});

export default function PayrollDashboardPage() {
  const runsQuery = useQuery({ queryKey: ['payroll-runs'], queryFn: api.listPayrollRuns });
  const summaryQuery = useQuery({
    queryKey: ['payroll-summary'],
    queryFn: () => api.getPayrollReportSummary() as Promise<PayrollSummary>,
  });

  const pendingApprovalCount =
    runsQuery.data?.filter((run) =>
      ['GENERATED', 'UNDER_REVIEW', 'REVIEWED'].includes(run.status),
    ).length ?? 0;
  const latestRun = runsQuery.data?.[0] ?? null;
  const latestPostedRun = runsQuery.data?.find((run) =>
    ['POSTED', 'PAID'].includes(run.status),
  );
  const payrollRuns = runsQuery.data ?? [];
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
    {
      label: 'Paid',
      statuses: ['PAID'],
      description: 'Disbursement recorded',
    },
  ].map((step) => ({
    ...step,
    count: payrollRuns.filter((run) => step.statuses.includes(run.status)).length,
  }));

  const stats = [
    {
      title: "Gross Pay (Current)",
      value: moneyFormatter.format(summaryQuery.data?.gross ?? 0),
      icon: <TrendingUp className="h-5 w-5" />,
      loading: summaryQuery.isLoading,
      tone: 'neutral' as const,
      description: 'Selected payroll report scope',
    },
    {
      title: "Net Pay (Current)",
      value: moneyFormatter.format(summaryQuery.data?.netPayable ?? 0),
      icon: <Wallet className="h-5 w-5" />,
      loading: summaryQuery.isLoading,
      tone: 'info' as const,
      description: 'After deductions in report summary',
    },
    {
      title: "Pending Approval",
      value: pendingApprovalCount,
      icon: <AlertCircle className="h-5 w-5" />,
      loading: runsQuery.isLoading,
      href: "/dashboard/payroll/runs",
      tone: pendingApprovalCount > 0 ? 'warning' as const : 'success' as const,
      description: 'Generated, review, or reviewed runs',
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            loading={stat.loading}
            href={stat.href}
            tone={stat.tone}
            description={stat.description}
          />
        ))}
      </div>

      <section className="shell-card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Payroll workflow</h3>
            <p className="mt-1 text-sm text-slate-500">
              Draft to Approved to Posted to Paid counts are derived from current payroll run statuses.
            </p>
          </div>
          <Link href="/dashboard/payroll/runs" className="text-sm font-bold text-purple-700 hover:text-purple-800">
            Open Payroll Runs
          </Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {workflowSteps.map((step, index) => (
            <div key={step.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {index + 1}. {step.label}
                </span>
                <span className="rounded-lg bg-purple-50 px-2 py-1 text-xs font-bold tabular-nums text-purple-700">
                  {runsQuery.isLoading ? '...' : step.count}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-700">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">Payroll Operations</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Create Payroll Run', href: '/dashboard/payroll/runs', icon: History, color: 'text-emerald-500 bg-emerald-50' },
              { label: 'Salary Structures', href: '/dashboard/payroll/salary-structures', icon: Calculator, color: 'text-blue-500 bg-blue-50' },
              { label: 'Manage Payslips', href: '/dashboard/payroll/payslips', icon: FileText, color: 'text-indigo-500 bg-indigo-50' },
              { label: 'Payroll Reports', href: '/dashboard/payroll/reports', icon: BarChart3, color: 'text-amber-500 bg-amber-50' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
              >
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", item.color)}>
                  <item.icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900">{item.label}</p>
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
          <h3 className="text-xl font-bold mb-4">Posting Status</h3>
          <p className="text-slate-400 text-sm mb-6">Integration status with Accounting Ledger.</p>
          
          <div className="space-y-4">
            {[
              {
                label: 'Latest Run',
                status: latestRun?.status?.replaceAll('_', ' ') ?? 'No runs',
                statusColor: latestRun ? 'text-blue-400' : 'text-slate-400',
              },
              {
                label: 'Latest Posted Journal',
                status: latestPostedRun?.journalEntryId ? 'Linked' : 'Not posted',
                statusColor: latestPostedRun?.journalEntryId ? 'text-emerald-400' : 'text-amber-400',
              },
              {
                label: 'Runs Awaiting Approval',
                status: String(pendingApprovalCount),
                statusColor: pendingApprovalCount > 0 ? 'text-amber-400' : 'text-emerald-400',
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-slate-300 font-medium">{item.label}</span>
                <span className={cn("font-bold uppercase tracking-widest text-xs", item.statusColor)}>{item.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
