'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  Download,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useSession } from '../../../../components/session-provider';
import { api } from '../../../../lib/api';
import { cn } from '../../../../lib/utils';

type PayrollReportFilters = {
  payrollRunId?: string;
  month?: number;
  year?: number;
  department?: string;
  staffId?: string;
  status?: string;
};

type PayrollSummary = {
  runCount: number;
  staffCount: number;
  gross: number;
  deductions: number;
  netPayable: number;
  pf: number;
  tds: number;
};

type PayrollPfSummary = {
  staffCount: number;
  employeeContribution: number;
  employerContribution: number;
  totalContribution: number;
};

type PayrollTdsSummary = {
  staffCount: number;
  totalTds: number;
};

type PayrollComponentSummary = {
  staffCount: number;
  grossSalary: number;
  deductions: number;
  leaveDeductions: number;
  pfEmployee: number;
  pfEmployer: number;
  tds: number;
  netPayable: number;
};

type PayrollLeaveSummary = {
  staffCount: number;
  leaveDeductions: number;
  unpaidDays: number;
};

const monthLabels = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const statusOptions = [
  'DRAFT',
  'GENERATED',
  'UNDER_REVIEW',
  'REVIEWED',
  'APPROVED',
  'POSTED',
  'PAID',
  'CANCELLED',
  'VOID',
];

const moneyFormatter = new Intl.NumberFormat('en-NP', {
  style: 'currency',
  currency: 'NPR',
  maximumFractionDigits: 0,
});

export default function PayrollReportsPage() {
  const { status, hasPermissions } = useSession();
  const currentYear = new Date().getFullYear();
  const [filters, setFilters] = useState<PayrollReportFilters>({
    year: currentYear,
  });

  const canReadReports = hasPermissions(['payroll:reports:read']);
  const canExportReports = hasPermissions(['payroll:exports:create']);
  const queryFilters = useMemo(() => compactFilters(filters), [filters]);

  const runsQuery = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: api.listPayrollRuns,
    enabled: status === 'authenticated',
  });
  const summaryQuery = useQuery({
    queryKey: ['payroll-report-summary', queryFilters],
    queryFn: () => api.getPayrollReportSummary(queryFilters) as Promise<PayrollSummary>,
    enabled: status === 'authenticated' && canReadReports,
  });
  const pfQuery = useQuery({
    queryKey: ['payroll-report-pf', queryFilters],
    queryFn: () => api.getPayrollPfSummary(queryFilters) as Promise<PayrollPfSummary>,
    enabled: status === 'authenticated' && canReadReports,
  });
  const tdsQuery = useQuery({
    queryKey: ['payroll-report-tds', queryFilters],
    queryFn: () => api.getPayrollTdsSummary(queryFilters) as Promise<PayrollTdsSummary>,
    enabled: status === 'authenticated' && canReadReports,
  });
  const componentsQuery = useQuery({
    queryKey: ['payroll-report-components', queryFilters],
    queryFn: () =>
      api.getPayrollSalaryComponentSummary(queryFilters) as Promise<PayrollComponentSummary>,
    enabled: status === 'authenticated' && canReadReports,
  });
  const leaveQuery = useQuery({
    queryKey: ['payroll-report-leave', queryFilters],
    queryFn: () =>
      api.getPayrollLeaveDeductionSummary(queryFilters) as Promise<PayrollLeaveSummary>,
    enabled: status === 'authenticated' && canReadReports,
  });

  const exportMutation = useMutation({
    mutationFn: (kind: 'register' | 'pf' | 'tds') => {
      if (kind === 'pf') return api.exportPayrollPfCsv(queryFilters);
      if (kind === 'tds') return api.exportPayrollTdsCsv(queryFilters);
      return api.exportPayrollRegisterCsv(queryFilters);
    },
  });

  const postedRuns = useMemo(
    () =>
      (runsQuery.data ?? [])
        .filter((run) => run.status === 'POSTED' || run.status === 'PAID')
        .slice(0, 5),
    [runsQuery.data],
  );

  if (status === 'authenticated' && !canReadReports) {
    return (
      <PermissionState
        title="Payroll reports are restricted"
        description="Ask an administrator for payroll report permission before viewing salary totals, PF, TDS, or exports."
      />
    );
  }

  const reportCards = [
    {
      title: 'Payroll Register',
      description: 'Backend line-item payroll register for the selected period or run.',
      icon: FileSpreadsheet,
      value: formatMoney(summaryQuery.data?.netPayable ?? 0),
      meta: `${summaryQuery.data?.staffCount ?? 0} staff lines`,
      action: () => exportMutation.mutate('register'),
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      title: 'TDS Summary',
      description: 'Backend-calculated Tax Deducted at Source summary.',
      icon: ShieldCheck,
      value: formatMoney(tdsQuery.data?.totalTds ?? 0),
      meta: `${tdsQuery.data?.staffCount ?? 0} contributors`,
      action: () => exportMutation.mutate('tds'),
      color: 'text-amber-600 bg-amber-50',
    },
    {
      title: 'PF Contribution',
      description: 'Employee and employer Provident Fund contribution totals.',
      icon: TrendingUp,
      value: formatMoney(pfQuery.data?.totalContribution ?? 0),
      meta: `${pfQuery.data?.staffCount ?? 0} contributors`,
      action: () => exportMutation.mutate('pf'),
      color: 'text-blue-600 bg-blue-50',
    },
    {
      title: 'Leave Deductions',
      description: 'Unpaid leave impact from backend payroll lines.',
      icon: Wallet,
      value: formatMoney(leaveQuery.data?.leaveDeductions ?? 0),
      meta: `${leaveQuery.data?.unpaidDays ?? 0} unpaid days`,
      action: null,
      color: 'text-indigo-600 bg-indigo-50',
    },
  ];

  const isLoading =
    summaryQuery.isLoading ||
    pfQuery.isLoading ||
    tdsQuery.isLoading ||
    componentsQuery.isLoading ||
    leaveQuery.isLoading;
  const hasError =
    summaryQuery.isError ||
    pfQuery.isError ||
    tdsQuery.isError ||
    componentsQuery.isError ||
    leaveQuery.isError;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Payroll Reports</h2>
            <p className="text-sm text-slate-500">
              Totals come from payroll backend reports. Posted accounting remains controlled by M9.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <FilterSelect
              label="Run"
              value={filters.payrollRunId ?? ''}
              onChange={(value) => setFilters((prev) => ({ ...prev, payrollRunId: value || undefined }))}
            >
              <option value="">All runs</option>
              {(runsQuery.data ?? []).map((run) => (
                <option key={run.id} value={run.id}>
                  {monthLabels[run.periodMonth - 1]} {run.periodYear} - {run.status}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Month"
              value={filters.month ? String(filters.month) : ''}
              onChange={(value) => setFilters((prev) => ({ ...prev, month: value ? Number(value) : undefined }))}
            >
              <option value="">All months</option>
              {monthLabels.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </FilterSelect>
            <label className="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
              Year
              <input
                type="number"
                min={2000}
                max={2100}
                value={filters.year ?? ''}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    year: event.target.value ? Number(event.target.value) : undefined,
                  }))
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-700"
              />
            </label>
            <FilterSelect
              label="Status"
              value={filters.status ?? ''}
              onChange={(value) => setFilters((prev) => ({ ...prev, status: value || undefined }))}
            >
              <option value="">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll('_', ' ')}
                </option>
              ))}
            </FilterSelect>
            <label className="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
              Department
              <input
                value={filters.department ?? ''}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, department: event.target.value || undefined }))
                }
                placeholder="All"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-700"
              />
            </label>
          </div>
        </div>
      </section>

      {hasError && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle size={18} />
          <p>Payroll reports could not be loaded. Please check permissions or try again.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reportCards.map((report) => (
          <section key={report.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', report.color)}>
                <report.icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-900">{report.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{report.description}</p>
              </div>
            </div>
            <div className="mt-5">
              {isLoading ? (
                <div className="h-8 w-32 animate-pulse rounded bg-slate-100" />
              ) : (
                <p className="text-2xl font-black text-slate-900">{report.value}</p>
              )}
              <p className="mt-1 text-xs font-semibold text-slate-500">{report.meta}</p>
            </div>
            {report.action && (
              <button
                type="button"
                disabled={!canExportReports || exportMutation.isPending}
                onClick={report.action}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exportMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Export CSV
              </button>
            )}
          </section>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Backend Totals</h3>
            <p className="text-sm text-slate-500">
              Salary, deduction, PF, TDS, and net pay totals for the selected filters.
            </p>
          </div>
          <BarChart3 className="text-slate-300" size={22} />
        </div>
        {isLoading ? (
          <div className="grid gap-3 py-5 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-50" />
            ))}
          </div>
        ) : (summaryQuery.data?.staffCount ?? 0) === 0 ? (
          <EmptyState title="No payroll data found" description="No payroll lines match the selected filters." />
        ) : (
          <div className="grid gap-3 py-5 md:grid-cols-4">
            <Metric label="Gross Pay" value={formatMoney(componentsQuery.data?.grossSalary ?? 0)} />
            <Metric label="Total Deductions" value={formatMoney(componentsQuery.data?.deductions ?? 0)} />
            <Metric label="PF Total" value={formatMoney((componentsQuery.data?.pfEmployee ?? 0) + (componentsQuery.data?.pfEmployer ?? 0))} />
            <Metric label="Net Payable" value={formatMoney(componentsQuery.data?.netPayable ?? 0)} tone="strong" />
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-slate-950 p-6 text-white shadow-xl">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
          <div>
            <h3 className="text-xl font-bold">Accounting Posting Status</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Payroll posting is still a separate approved action. After posting, payroll cannot be edited directly. Use reversal/correction.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold">
                <ShieldCheck size={18} className="text-emerald-400" />
                M9 posting boundary
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold">
                <BarChart3 size={18} className="text-blue-400" />
                Backend report totals
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Posted Payroll Runs</h4>
            {runsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-12 animate-pulse rounded-xl bg-white/10" />
                ))}
              </div>
            ) : postedRuns.length === 0 ? (
              <p className="rounded-xl bg-white/5 p-4 text-sm text-slate-400">
                No posted payroll runs match the current data set.
              </p>
            ) : (
              <div className="space-y-2">
                {postedRuns.map((run) => (
                  <div key={run.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3">
                    <div>
                      <p className="text-sm font-bold">
                        {monthLabels[run.periodMonth - 1]} {run.periodYear}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Journal: {run.journalEntryId ?? 'Not linked'}
                      </p>
                    </div>
                    <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                      {run.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {exportMutation.error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {(exportMutation.error as Error).message}
        </p>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-700"
      >
        {children}
      </select>
    </label>
  );
}

function Metric({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: string;
  tone?: 'normal' | 'strong';
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn('mt-2 text-lg font-black', tone === 'strong' ? 'text-emerald-700' : 'text-slate-900')}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <p className="font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function PermissionState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <div className="flex items-start gap-3">
        <ShieldCheck className="text-amber-600" size={22} />
        <div>
          <h2 className="font-bold text-amber-950">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-amber-800">{description}</p>
        </div>
      </div>
    </div>
  );
}

function compactFilters(filters: PayrollReportFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  );
}

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}
