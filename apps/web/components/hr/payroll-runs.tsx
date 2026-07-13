'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PayrollPreviewResult, PayrollRunSummary } from '@schoolos/core';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Landmark,
  Loader2,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Ban,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSession } from '../session-provider';
import { api } from '../../lib/api';
import { JournalEntryDialog } from '../accounting/journal-entry-dialog';
import { cn } from '@/lib/utils';
import {
  PayrollActionDialog,
  PayrollActionType,
} from './payroll-action-dialog';

type PayrollLineView = {
  id?: string;
  staffId?: string;
  staff?: {
    id?: string;
    employeeId?: string;
    firstNameEn?: string;
    lastNameEn?: string;
  } | null;
  grossSalary?: number | string | null;
  allowances?: number | string | null;
  deductions?: number | string | null;
  netSalary?: number | string | null;
  attendanceDays?: number | null;
  workingDays?: number | null;
  status?: string | null;
};

type PayrollRunView = PayrollRunSummary & {
  id: string;
  periodMonth: number;
  periodYear: number;
  status: string;
  grossAmount?: number | string | null;
  deductionAmount?: number | string | null;
  netAmount?: number | string | null;
  approvedAt?: string | null;
  postedAt?: string | null;
  journalEntryId?: string | null;
  lines?: PayrollLineView[];
};

const moneyFormatter = new Intl.NumberFormat('en-NP', {
  style: 'currency',
  currency: 'NPR',
  maximumFractionDigits: 0,
});

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

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number | string | null | undefined) {
  return moneyFormatter.format(toNumber(value));
}

function formatPeriod(month: number, year: number) {
  return `${monthLabels[month - 1] ?? `Month ${month}`} ${year}`;
}

function payrollStageRank(status: string) {
  const stageRanks: Record<string, number> = {
    DRAFT: 0,
    GENERATED: 0,
    UNDER_REVIEW: 1,
    REVIEWED: 2,
    APPROVED: 3,
    POSTED: 4,
    PAID: 5,
  };

  return stageRanks[status] ?? -1;
}

function statusClasses(status: string) {
  switch (status) {
    case 'DRAFT':
    case 'GENERATED':
      return 'border-amber-200 bg-amber-100 text-amber-700';
    case 'REVIEWED':
    case 'UNDER_REVIEW':
      return 'border-[var(--color-mod-hr-border)] bg-[var(--color-mod-hr-soft)] text-[var(--color-mod-hr-text)]';
    case 'APPROVED':
      return 'border-success-200 bg-success-100 text-success-700';
    case 'POSTED':
      return 'border-purple-200 bg-purple-100 text-purple-700';
    case 'PAID':
      return 'border-emerald-200 bg-emerald-100 text-emerald-700';
    case 'VOID':
    case 'CANCELLED':
      return 'border-gray-200 bg-gray-100 text-gray-600';
    default:
      return 'border-gray-200 bg-gray-100 text-gray-700';
  }
}

function normalizeRun(run: PayrollRunSummary): PayrollRunView {
  return run as PayrollRunView;
}

function getStaffName(line: PayrollLineView) {
  if (!line.staff) {
    return `Staff ${line.staffId?.slice(0, 8) ?? 'unknown'}`;
  }

  return (
    `${line.staff.firstNameEn ?? ''} ${line.staff.lastNameEn ?? ''}`.trim() ||
    'Staff member'
  );
}

export function PayrollRuns() {
  const queryClient = useQueryClient();
  const { status, hasPermissions } = useSession();
  const canManagePayroll = hasPermissions(['payroll:manage']);
  const canReviewRun =
    hasPermissions(['payroll:run:review']) || canManagePayroll;
  const canApproveRun =
    hasPermissions(['payroll:run:approve']) || canManagePayroll;
  const canPostRun = hasPermissions(['payroll:run:post']) || canManagePayroll;
  const canReverseRun =
    hasPermissions(['payroll:run:reverse']) || canManagePayroll;

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [workingDays, setWorkingDays] = useState(30);
  const [showDraftWorkflow, setShowDraftWorkflow] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(
    null,
  );
  const [isJournalDialogOpen, setIsJournalDialogOpen] = useState(false);
  const [salarySlipError, setSalarySlipError] = useState<string | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [actionType, setActionType] =
    useState<PayrollActionType>('SUBMIT_REVIEW');
  const [page, setPage] = useState(1);
  const limit = 10;

  const runsQuery = useQuery({
    queryKey: ['payroll-runs', page, limit],
    queryFn: () => api.listPayrollRunsPage({ page, limit }),
    enabled: status === 'authenticated',
  });

  const previewQuery = useQuery({
    queryKey: ['payroll-preview', year, month, workingDays],
    queryFn: () => api.getPayrollPreview({ year, month, workingDays }),
    enabled: status === 'authenticated' && showDraftWorkflow,
  });

  const runs = useMemo(
    () => (runsQuery.data?.items ?? []).map(normalizeRun),
    [runsQuery.data],
  );

  const selectedRunKey = selectedRunId ?? runs[0]?.id ?? null;
  const selectedRunQuery = useQuery({
    queryKey: ['payroll-run-detail', selectedRunKey],
    queryFn: () => api.getPayrollRun(selectedRunKey!),
    enabled: status === 'authenticated' && Boolean(selectedRunKey),
  });
  const selectedRun = selectedRunQuery.data
    ? normalizeRun(selectedRunQuery.data)
    : (runs.find((run) => run.id === selectedRunKey) ?? null);
  const selectedRunActions = selectedRun?.allowedActions;
  const totalItems = runsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  const createDraftMutation = useMutation({
    mutationFn: () =>
      api.createPayrollRun({
        periodMonth: month,
        periodYear: year,
        workingDays,
        notes:
          'Draft payroll run created from Payroll Runs preview. M11 posting requires a separate approval-to-post action.',
      }),
    onSuccess: (run) => {
      const savedRun = normalizeRun(run);
      void queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      void queryClient.invalidateQueries({
        queryKey: ['payroll-dashboard-summary'],
      });
      setSelectedRunId(savedRun.id);
      setShowDraftWorkflow(false);
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => api.exportPayrollRegisterCsv(),
  });

  const salarySlipMutation = useMutation({
    mutationFn: (line: PayrollLineView) => {
      if (!selectedRun?.id || !line.id) {
        throw new Error('Payroll run line is missing.');
      }

      return api.openApprovedSalarySlipPdf(selectedRun.id, line.id);
    },
    onMutate: () => setSalarySlipError(null),
    onError: (error) => setSalarySlipError((error as Error).message),
  });

  const previewRows = previewQuery.data ?? [];
  const previewWarningCount = previewRows.reduce(
    (total, row) => total + row.warnings.length,
    0,
  );
  const years = Array.from(
    { length: 5 },
    (_, index) => currentYear - 2 + index,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-white p-2 shadow-sm">
            <ShieldCheck className="text-amber-600" size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-900">
              Payroll Runs — Phase 2 accounting boundary
            </p>
            <p className="text-xs leading-relaxed text-amber-800">
              Approval locks payroll calculations. Posting is a separate
              APPROVED-to-POSTED action that creates the M11 payroll accrual
              journal through the backend accounting posting boundary. It does
              not disburse salaries or pay staff, and posted runs remain
              immutable; reversal is a separate reasoned backend workflow.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportMutation.mutate()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-amber-800"
          >
            <Download size={18} />
            Export Register
          </button>
          <button
            type="button"
            onClick={() => setShowDraftWorkflow((value) => !value)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-mod-hr-accent)] px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--color-mod-hr-text)]"
          >
            <Plus size={18} />
            {showDraftWorkflow ? 'Hide Draft Workflow' : 'New Draft Run'}
          </button>
        </div>
      </div>

      {showDraftWorkflow && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Create Draft from Preview
              </h3>
              <p className="text-xs text-gray-500">
                Preview the period first, then save the exact backend
                calculation as a DRAFT payroll run.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">
                Year
                <select
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-hr-border)]/60"
                >
                  {years.map((yearOption) => (
                    <option key={yearOption} value={yearOption}>
                      {yearOption}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">
                Month
                <select
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-hr-border)]/60"
                >
                  {monthLabels.map((label, index) => (
                    <option key={label} value={index + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">
                Working Days
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={workingDays}
                  onChange={(event) =>
                    setWorkingDays(Number(event.target.value))
                  }
                  className="w-28 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-hr-border)]/60"
                />
              </label>
              <button
                type="button"
                onClick={() => previewQuery.refetch()}
                disabled={previewQuery.isFetching}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {previewQuery.isFetching ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Calculator size={16} />
                )}
                Preview
              </button>
              <button
                type="button"
                disabled={
                  !canManagePayroll ||
                  previewRows.length === 0 ||
                  createDraftMutation.isPending
                }
                onClick={() => createDraftMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-mod-hr-accent)] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[var(--color-mod-hr-text)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createDraftMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileText size={16} />
                )}
                Save as Draft
              </button>
            </div>
          </div>

          {!canManagePayroll && (
            <p className="rounded-xl bg-gray-50 px-4 py-3 text-xs font-medium text-gray-600">
              You can view payroll previews with payroll:read. Creating a draft
              requires payroll:manage.
            </p>
          )}

          {createDraftMutation.error && (
            <p className="rounded-xl bg-danger-50 px-4 py-3 text-xs font-semibold text-danger-700">
              {(createDraftMutation.error as Error).message}
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Preview Rows
              </p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                {previewRows.length}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Warnings
              </p>
              <p className="mt-1 text-xl font-bold text-danger-700">
                {previewWarningCount}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Authoritative Totals
              </p>
              <p className="mt-1 text-sm font-bold text-[var(--color-mod-hr-text)]">
                Saved on backend run creation
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Staff
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Gross
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Deductions
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-mod-hr-text)]">
                    Net Preview
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Days
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {previewQuery.isFetching ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td className="px-4 py-3">
                        <div className="h-4 w-36 rounded bg-gray-100" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="ml-auto h-4 w-20 rounded bg-gray-100" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="ml-auto h-4 w-20 rounded bg-gray-100" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="ml-auto h-4 w-20 rounded bg-gray-100" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="mx-auto h-4 w-16 rounded bg-gray-100" />
                      </td>
                    </tr>
                  ))
                ) : previewQuery.error ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-danger-600"
                    >
                      Failed to load payroll preview. Please check your
                      permissions or try again.
                    </td>
                  </tr>
                ) : previewRows.length > 0 ? (
                  previewRows.map((row) => (
                    <tr
                      key={row.staffId}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">
                          {row.fullName}
                        </p>
                        <p className="font-mono text-[10px] text-gray-500">
                          {row.employeeId}
                        </p>
                        {row.warnings.length > 0 && (
                          <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-600">
                            <AlertTriangle size={11} />{' '}
                            {row.warnings.join(', ')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatMoney(row.grossPay)}
                      </td>
                      <td className="px-4 py-3 text-right text-danger-600">
                        -{formatMoney(row.deductions)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--color-mod-hr-text)]">
                        {formatMoney(row.netPay)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                        {row.presentDays + row.approvedPaidLeaveDays}/
                        {row.workingDays}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-gray-500"
                    >
                      No preview rows yet. Choose a period and run Preview.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,480px)]">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <h3 className="text-lg font-bold text-gray-900">Payroll Runs</h3>
            <p className="text-xs text-gray-500">
              Draft, reviewed, approved, and posted payroll runs. Posting is a
              controlled M11 accrual action.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Period
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Gross
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Deductions
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-[var(--color-mod-hr-text)]">
                    Net
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {runsQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td className="px-5 py-4">
                        <div className="h-4 w-32 rounded bg-gray-100" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="h-6 w-20 rounded-full bg-gray-100" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="ml-auto h-4 w-20 rounded bg-gray-100" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="ml-auto h-4 w-20 rounded bg-gray-100" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="ml-auto h-4 w-20 rounded bg-gray-100" />
                      </td>
                      <td className="px-5 py-4">
                        <div className="ml-auto h-4 w-16 rounded bg-gray-100" />
                      </td>
                    </tr>
                  ))
                ) : runsQuery.error ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-danger-600"
                    >
                      Failed to load payroll runs. Please check your permissions
                      or connection.
                    </td>
                  </tr>
                ) : runs.length > 0 ? (
                  runs.map((run) => (
                    <tr
                      key={run.id}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-5 py-4">
                        <p className="font-bold text-gray-900">
                          {formatPeriod(run.periodMonth, run.periodYear)}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {run.lineCount ?? 0} staff lines
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusClasses(run.status)}`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-gray-700">
                        {formatMoney(run.grossAmount)}
                      </td>
                      <td className="px-5 py-4 text-right text-danger-600">
                        -{formatMoney(run.deductionAmount)}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-[var(--color-mod-hr-text)]">
                        {formatMoney(run.netAmount)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedRunId(run.id)}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-mod-hr-text)] hover:text-[var(--color-mod-hr-accent)]"
                        >
                          <Eye size={15} /> View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-gray-500"
                    >
                      No payroll runs yet. Create the first draft run from a
                      preview.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalItems > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
              <p className="text-xs font-semibold text-gray-500">
                Showing {(page - 1) * limit + 1} to{' '}
                {Math.min(page * limit, totalItems)} of {totalItems} runs
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={page >= totalPages}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Run Detail</h3>
              <p className="text-xs text-gray-500">
                Line-level payroll breakdown and approval/posting boundary.
              </p>
            </div>
            {selectedRun && (
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusClasses(selectedRun.status)}`}
              >
                {selectedRun.status}
              </span>
            )}
          </div>

          {selectedRunQuery.isLoading ? (
            <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              Loading payroll run details...
            </p>
          ) : selectedRunQuery.isError ? (
            <p className="rounded-xl bg-danger-50 px-4 py-8 text-center text-sm font-semibold text-danger-700">
              Payroll run details could not be loaded. Check your permission and
              retry.
            </p>
          ) : selectedRun ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-gray-50/70 p-4">
                <p className="text-sm font-bold text-gray-900">
                  {formatPeriod(
                    selectedRun.periodMonth,
                    selectedRun.periodYear,
                  )}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-gray-400">
                      Gross
                    </p>
                    <p className="font-bold text-gray-900">
                      {formatMoney(selectedRun.grossAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-gray-400">
                      Deduct
                    </p>
                    <p className="font-bold text-danger-700">
                      {formatMoney(selectedRun.deductionAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-gray-400">
                      Net
                    </p>
                    <p className="font-bold text-[var(--color-mod-hr-text)]">
                      {formatMoney(selectedRun.netAmount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Stepper */}
              <div className="flex items-center justify-between px-2 py-4">
                {[
                  { label: 'Draft', rank: 0 },
                  { label: 'Review', rank: 1 },
                  { label: 'Reviewed', rank: 2 },
                  { label: 'Approved', rank: 3 },
                  { label: 'Posted', rank: 4 },
                  { label: 'Paid', rank: 5 },
                ].map((step, idx, arr) => (
                  <div
                    key={step.label}
                    className="flex items-center flex-1 last:flex-none"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={cn(
                          'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black',
                          payrollStageRank(selectedRun.status) >= step.rank
                            ? 'bg-[var(--color-mod-hr-accent)] text-white'
                            : 'bg-slate-100 text-slate-400',
                        )}
                      >
                        {payrollStageRank(selectedRun.status) >= step.rank ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-[9px] font-black uppercase tracking-widest',
                          payrollStageRank(selectedRun.status) >= step.rank
                            ? 'text-slate-900'
                            : 'text-slate-400',
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div
                        className={cn(
                          'h-[2px] flex-1 mx-2 mb-4',
                          payrollStageRank(selectedRun.status) >=
                            arr[idx + 1].rank
                            ? 'bg-[var(--color-mod-hr-accent)]'
                            : 'bg-slate-100',
                        )}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-700 space-y-1">
                <p>
                  <strong>Payroll Status:</strong> {selectedRun.status}
                </p>
                {selectedRun.status === 'POSTED' && (
                  <p>
                    Accruals have been posted to M11 General Ledger. Salary
                    disbursement is handled outside this workspace.
                  </p>
                )}
                {selectedRun.status === 'PAID' && (
                  <p>
                    Payment status is read-only here; disbursement evidence
                    remains in audited accounting controls.
                  </p>
                )}
                {selectedRun.status === 'VOID' && (
                  <p className="text-red-600 font-semibold">
                    This run has been voided/reversed.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {selectedRunActions?.canSubmitReview && (
                  <button
                    type="button"
                    disabled={!canReviewRun}
                    onClick={() => {
                      setActionType('SUBMIT_REVIEW');
                      setIsActionDialogOpen(true);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-mod-hr-accent)] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[var(--color-mod-hr-text)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShieldAlert size={14} />
                    Submit for Review
                  </button>
                )}

                {(selectedRunActions?.canCompleteReview ||
                  selectedRunActions?.canApprove ||
                  selectedRunActions?.canReject) && (
                  <div className="flex flex-wrap gap-2">
                    {selectedRunActions.canCompleteReview && (
                      <button
                        type="button"
                        disabled={!canReviewRun}
                        onClick={() => {
                          setActionType('COMPLETE_REVIEW');
                          setIsActionDialogOpen(true);
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-mod-hr-accent)] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[var(--color-mod-hr-text)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ShieldCheck size={14} />
                        Complete Review
                      </button>
                    )}
                    {selectedRunActions.canReject && (
                      <button
                        type="button"
                        disabled={!canReviewRun}
                        onClick={() => {
                          setActionType('REJECT');
                          setIsActionDialogOpen(true);
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Ban size={14} />
                        Return for Correction
                      </button>
                    )}
                    {selectedRunActions.canApprove && (
                      <button
                        type="button"
                        disabled={!canApproveRun}
                        onClick={() => {
                          setActionType('APPROVE');
                          setIsActionDialogOpen(true);
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-success-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} />
                        Approve Run
                      </button>
                    )}
                  </div>
                )}

                {selectedRunActions?.canPost && (
                  <button
                    type="button"
                    disabled={!canPostRun}
                    onClick={() => {
                      setActionType('POST');
                      setIsActionDialogOpen(true);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Landmark size={15} />
                    Post to M11 Accounting
                  </button>
                )}

                {selectedRunActions?.canReverse && (
                  <button
                    type="button"
                    disabled={!canReverseRun}
                    onClick={() => {
                      setActionType('REVERSE');
                      setIsActionDialogOpen(true);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Ban size={15} />
                    Reverse Payroll
                  </button>
                )}

                {/* Actions for POSTED */}
                {selectedRun.status === 'POSTED' && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
                    Posted payroll runs stay locked in this workspace. Salary
                    disbursement and correction controls remain outside the
                    Phase 2 posting boundary.
                  </div>
                )}

                {/* Actions for PAID */}
                {selectedRun.status === 'PAID' && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
                    Paid payroll runs are read-only here. Correction workflows
                    must be handled through audited accounting controls.
                  </div>
                )}
              </div>

              {/* Export Specific Run Register button */}
              <button
                type="button"
                onClick={() => {
                  void api.exportPayrollRunRegisterCsv(selectedRun.id);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Download size={14} />
                Export Run Register (CSV)
              </button>

              {salarySlipError && (
                <p className="rounded-xl bg-danger-50 px-4 py-3 text-xs font-semibold text-danger-700">
                  {salarySlipError}
                </p>
              )}

              {selectedRun.status === 'POSTED' &&
                selectedRun.journalEntryId && (
                  <div className="rounded-xl bg-purple-50 px-4 py-3 flex items-center justify-between">
                    <p className="text-xs font-semibold text-purple-700">
                      Posted to M11 Accounting. Journal entry is recorded.
                    </p>
                    <button
                      className="h-7 px-3 border border-purple-200 text-purple-700 hover:bg-purple-100 rounded-full text-xs font-semibold transition-colors"
                      onClick={() => {
                        setSelectedJournalId(selectedRun.journalEntryId!);
                        setIsJournalDialogOpen(true);
                      }}
                    >
                      View Journal
                    </button>
                  </div>
                )}

              <div className="space-y-2">
                {(selectedRun.lines ?? []).length > 0 ? (
                  (selectedRun.lines ?? []).map((line) => (
                    <div
                      key={line.id ?? line.staffId}
                      className="rounded-xl border border-gray-100 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {getStaffName(line)}
                          </p>
                          <p className="font-mono text-[10px] text-gray-500">
                            {line.staff?.employeeId ?? line.staffId}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${statusClasses(line.status ?? selectedRun.status)}`}
                        >
                          {line.status ?? selectedRun.status}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="font-semibold uppercase tracking-wider text-gray-400">
                            Gross
                          </p>
                          <p className="font-bold text-gray-900">
                            {formatMoney(line.grossSalary)}
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold uppercase tracking-wider text-gray-400">
                            Net
                          </p>
                          <p className="font-bold text-[var(--color-mod-hr-text)]">
                            {formatMoney(line.netSalary)}
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold uppercase tracking-wider text-gray-400">
                            Days
                          </p>
                          <p className="font-bold text-gray-900">
                            {line.attendanceDays ?? 0}/{line.workingDays ?? 0}
                          </p>
                        </div>
                      </div>
                      {selectedRun.status === 'APPROVED' && line.id && (
                        <button
                          type="button"
                          disabled={salarySlipMutation.isPending}
                          onClick={() => salarySlipMutation.mutate(line)}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--color-mod-hr-border)] px-3 py-1.5 text-xs font-bold text-[var(--color-mod-hr-text)] transition-colors hover:bg-[var(--color-mod-hr-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {salarySlipMutation.isPending ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                          Download Salary Slip PDF
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                    No line details returned for this run yet.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              Select a payroll run to inspect details.
            </p>
          )}
        </div>
      </div>
      <JournalEntryDialog
        id={selectedJournalId}
        open={isJournalDialogOpen}
        onOpenChange={setIsJournalDialogOpen}
      />
      {isActionDialogOpen && selectedRun && (
        <PayrollActionDialog
          isOpen={isActionDialogOpen}
          onClose={() => setIsActionDialogOpen(false)}
          runId={selectedRun.id}
          periodText={formatPeriod(
            selectedRun.periodMonth,
            selectedRun.periodYear,
          )}
          actionType={actionType}
        />
      )}
    </div>
  );
}
