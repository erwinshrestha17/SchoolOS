'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PayrollPreviewResult, PayrollRunSummary } from '@schoolos/core';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSession } from '../session-provider';
import { api } from '../../lib/api';

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
  notes?: string | null;
  approvedAt?: string | null;
  createdAt?: string | null;
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

function statusClasses(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'border-amber-200 bg-amber-100 text-amber-700';
    case 'REVIEWED':
      return 'border-blue-200 bg-blue-100 text-blue-700';
    case 'APPROVED':
      return 'border-success-200 bg-success-100 text-success-700';
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

function previewTotals(preview: PayrollPreviewResult[]) {
  return preview.reduce(
    (totals, row) => ({
      grossPay: totals.grossPay + row.grossPay,
      deductions: totals.deductions + row.deductions,
      netPay: totals.netPay + row.netPay,
    }),
    { grossPay: 0, deductions: 0, netPay: 0 },
  );
}

function getStaffName(line: PayrollLineView) {
  if (!line.staff) {
    return `Staff ${line.staffId?.slice(0, 8) ?? 'unknown'}`;
  }

  return `${line.staff.firstNameEn ?? ''} ${line.staff.lastNameEn ?? ''}`.trim() || 'Staff member';
}

export function PayrollRuns() {
  const queryClient = useQueryClient();
  const { hasPermissions } = useSession();
  const canManagePayroll = hasPermissions(['payroll:manage']);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [workingDays, setWorkingDays] = useState(30);
  const [showDraftWorkflow, setShowDraftWorkflow] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const runsQuery = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: api.listPayrollRuns,
  });

  const previewQuery = useQuery({
    queryKey: ['payroll-preview', year, month, workingDays],
    queryFn: () => api.getPayrollPreview({ year, month, workingDays }),
    enabled: showDraftWorkflow,
  });

  const runs = useMemo(
    () => (runsQuery.data ?? []).map(normalizeRun),
    [runsQuery.data],
  );

  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null;

  const createDraftMutation = useMutation({
    mutationFn: () =>
      api.createPayrollRun({
        periodMonth: month,
        periodYear: year,
        workingDays,
        notes:
          'Draft payroll run created from Payroll Runs preview. M9 posting and salary slips are deferred.',
      }),
    onSuccess: (run) => {
      const savedRun = normalizeRun(run);
      void queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      setSelectedRunId(savedRun.id);
      setShowDraftWorkflow(false);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approvePayrollRun(id),
    onSuccess: (run) => {
      const approvedRun = normalizeRun(run);
      void queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      setSelectedRunId(approvedRun.id);
    },
  });

  const previewRows = previewQuery.data ?? [];
  const totals = previewTotals(previewRows);
  const years = Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-white p-2 shadow-sm">
            <ShieldCheck className="text-amber-600" size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-900">Payroll Runs — Phase 2 approval boundary</p>
            <p className="text-xs leading-relaxed text-amber-800">
              This workspace can create draft payroll runs and approve them. Approval locks the payroll run, but it still does not post to accounting, does not post to M9 Accounting, create journal entries, generate salary slips, or disburse salaries. Salary slips are not generated yet.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowDraftWorkflow((value) => !value)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-primary-500/20 transition-colors hover:bg-primary-700"
        >
          <Plus size={18} />
          {showDraftWorkflow ? 'Hide Draft Workflow' : 'New Draft Run'}
        </button>
      </div>

      {showDraftWorkflow && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Create Draft from Preview</h3>
              <p className="text-xs text-gray-500">
                Preview the period first, then save the exact backend calculation as a DRAFT payroll run.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">
                Year
                <select
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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
                  onChange={(event) => setWorkingDays(Number(event.target.value))}
                  className="w-28 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </label>
              <button
                type="button"
                onClick={() => previewQuery.refetch()}
                disabled={previewQuery.isFetching}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {previewQuery.isFetching ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
                Preview
              </button>
              <button
                type="button"
                disabled={!canManagePayroll || previewRows.length === 0 || createDraftMutation.isPending}
                onClick={() => createDraftMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createDraftMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                Save as Draft
              </button>
            </div>
          </div>

          {!canManagePayroll && (
            <p className="rounded-xl bg-gray-50 px-4 py-3 text-xs font-medium text-gray-600">
              You can view payroll previews with payroll:read. Creating a draft requires payroll:manage.
            </p>
          )}

          {createDraftMutation.error && (
            <p className="rounded-xl bg-danger-50 px-4 py-3 text-xs font-semibold text-danger-700">
              {(createDraftMutation.error as Error).message}
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Preview Gross</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{formatMoney(totals.grossPay)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Preview Deductions</p>
              <p className="mt-1 text-xl font-bold text-danger-700">{formatMoney(totals.deductions)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Preview Net</p>
              <p className="mt-1 text-xl font-bold text-primary-700">{formatMoney(totals.netPay)}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Staff</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Gross</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Deductions</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-primary-600">Net Preview</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {previewQuery.isFetching ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td className="px-4 py-3"><div className="h-4 w-36 rounded bg-gray-100" /></td>
                      <td className="px-4 py-3"><div className="ml-auto h-4 w-20 rounded bg-gray-100" /></td>
                      <td className="px-4 py-3"><div className="ml-auto h-4 w-20 rounded bg-gray-100" /></td>
                      <td className="px-4 py-3"><div className="ml-auto h-4 w-20 rounded bg-gray-100" /></td>
                      <td className="px-4 py-3"><div className="mx-auto h-4 w-16 rounded bg-gray-100" /></td>
                    </tr>
                  ))
                ) : previewQuery.error ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-danger-600">
                      Failed to load payroll preview. Please check your permissions or try again.
                    </td>
                  </tr>
                ) : previewRows.length > 0 ? (
                  previewRows.map((row) => (
                    <tr key={row.staffId} className="transition-colors hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{row.fullName}</p>
                        <p className="font-mono text-[10px] text-gray-500">{row.employeeId}</p>
                        {row.warnings.length > 0 && (
                          <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-600">
                            <AlertTriangle size={11} /> {row.warnings.join(', ')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">{formatMoney(row.grossPay)}</td>
                      <td className="px-4 py-3 text-right font-mono text-danger-600">-{formatMoney(row.deductions)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-primary-700">{formatMoney(row.netPay)}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                        {row.presentDays + row.approvedPaidLeaveDays}/{row.workingDays}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
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
            <p className="text-xs text-gray-500">Draft, reviewed, and approved payroll runs. Posting is intentionally deferred.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Period</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Gross</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Deductions</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-primary-600">Net</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {runsQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 w-32 rounded bg-gray-100" /></td>
                      <td className="px-5 py-4"><div className="h-6 w-20 rounded-full bg-gray-100" /></td>
                      <td className="px-5 py-4"><div className="ml-auto h-4 w-20 rounded bg-gray-100" /></td>
                      <td className="px-5 py-4"><div className="ml-auto h-4 w-20 rounded bg-gray-100" /></td>
                      <td className="px-5 py-4"><div className="ml-auto h-4 w-20 rounded bg-gray-100" /></td>
                      <td className="px-5 py-4"><div className="ml-auto h-4 w-16 rounded bg-gray-100" /></td>
                    </tr>
                  ))
                ) : runsQuery.error ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-danger-600">
                      Failed to load payroll runs. Please check your permissions or connection.
                    </td>
                  </tr>
                ) : runs.length > 0 ? (
                  runs.map((run) => (
                    <tr key={run.id} className="transition-colors hover:bg-gray-50/60">
                      <td className="px-5 py-4">
                        <p className="font-bold text-gray-900">{formatPeriod(run.periodMonth, run.periodYear)}</p>
                        <p className="text-[10px] text-gray-500">{run.lines?.length ?? 0} staff lines</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusClasses(run.status)}`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-gray-700">{formatMoney(run.grossAmount)}</td>
                      <td className="px-5 py-4 text-right font-mono text-danger-600">-{formatMoney(run.deductionAmount)}</td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-primary-700">{formatMoney(run.netAmount)}</td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedRunId(run.id)}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700"
                        >
                          <Eye size={15} /> View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                      No payroll runs yet. Create the first draft run from a preview.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Run Detail</h3>
              <p className="text-xs text-gray-500">Line-level payroll breakdown and approval boundary.</p>
            </div>
            {selectedRun && (
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusClasses(selectedRun.status)}`}>
                {selectedRun.status}
              </span>
            )}
          </div>

          {selectedRun ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-gray-50/70 p-4">
                <p className="text-sm font-bold text-gray-900">{formatPeriod(selectedRun.periodMonth, selectedRun.periodYear)}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-gray-400">Gross</p>
                    <p className="font-bold text-gray-900">{formatMoney(selectedRun.grossAmount)}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-gray-400">Deduct</p>
                    <p className="font-bold text-danger-700">{formatMoney(selectedRun.deductionAmount)}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-gray-400">Net</p>
                    <p className="font-bold text-primary-700">{formatMoney(selectedRun.netAmount)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">
                <strong>Approval note:</strong> Approval locks the payroll run for payroll operations. It still does not post to M9 Accounting, create journal entries, generate salary slips, or disburse salaries.
              </div>

              {selectedRun.status === 'DRAFT' && (
                <button
                  type="button"
                  disabled={!canManagePayroll || approveMutation.isPending}
                  onClick={() => approveMutation.mutate(selectedRun.id)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-success-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {approveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Approve Payroll Run
                </button>
              )}

              {!canManagePayroll && selectedRun.status === 'DRAFT' && (
                <p className="rounded-xl bg-gray-50 px-4 py-3 text-xs font-medium text-gray-600">
                  Approval requires payroll:manage permission.
                </p>
              )}

              {approveMutation.error && (
                <p className="rounded-xl bg-danger-50 px-4 py-3 text-xs font-semibold text-danger-700">
                  {(approveMutation.error as Error).message}
                </p>
              )}

              <div className="space-y-2">
                {(selectedRun.lines ?? []).length > 0 ? (
                  (selectedRun.lines ?? []).map((line) => (
                    <div key={line.id ?? line.staffId} className="rounded-xl border border-gray-100 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{getStaffName(line)}</p>
                          <p className="font-mono text-[10px] text-gray-500">{line.staff?.employeeId ?? line.staffId}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${statusClasses(line.status ?? selectedRun.status)}`}>
                          {line.status ?? selectedRun.status}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="font-semibold uppercase tracking-wider text-gray-400">Gross</p>
                          <p className="font-bold text-gray-900">{formatMoney(line.grossSalary)}</p>
                        </div>
                        <div>
                          <p className="font-semibold uppercase tracking-wider text-gray-400">Net</p>
                          <p className="font-bold text-primary-700">{formatMoney(line.netSalary)}</p>
                        </div>
                        <div>
                          <p className="font-semibold uppercase tracking-wider text-gray-400">Days</p>
                          <p className="font-bold text-gray-900">{line.attendanceDays ?? 0}/{line.workingDays ?? 0}</p>
                        </div>
                      </div>
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
    </div>
  );
}
