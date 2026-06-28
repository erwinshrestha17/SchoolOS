'use client';

import type {
  PayslipRegenerationJobSummary,
  PayslipSummary,
} from '@schoolos/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiRequestError, api } from '../../lib/api';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import { useSession } from '../session-provider';

type PayslipRegenerationTarget = Pick<
  PayslipSummary,
  'id' | 'payrollRunId' | 'payslipNumber'
>;

export function PayslipList() {
  const { hasPermissions } = useSession();
  const [search, setSearch] = useState('');
  const [downloadingPayslip, setDownloadingPayslip] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [regenerationTarget, setRegenerationTarget] =
    useState<PayslipRegenerationTarget | null>(null);
  const [regenerationJob, setRegenerationJob] =
    useState<PayslipRegenerationJobSummary | null>(null);
  const [page, setPage] = useState(1);
  const limit = 10;
  const canRegeneratePayslips = hasPermissions([
    'payroll:payslip:generate',
  ]);
  const { data: payslipPage, isLoading, error } = useQuery({
    queryKey: ['payslips', page, limit, search],
    queryFn: () =>
      api.listPayslipsPage({
        page,
        limit,
        search: search.trim() || undefined,
      }),
  });
  const regenerationMutation = useMutation({
    mutationFn: (target: PayslipRegenerationTarget) =>
      api.queuePayslipRegeneration(target.payrollRunId, target.id),
    onSuccess: (job) => {
      setRegenerationJob(job);
      setDownloadError(null);
    },
  });
  const regenerationJobQuery = useQuery({
    queryKey: [
      'payslip-regeneration-job',
      regenerationJob?.payrollRunId,
      regenerationJob?.payslipId,
      regenerationJob?.jobId,
    ],
    queryFn: () =>
      api.getPayslipRegenerationJob(
        regenerationJob!.payrollRunId,
        regenerationJob!.payslipId,
        regenerationJob!.jobId,
      ),
    enabled: Boolean(regenerationJob?.jobId),
    refetchInterval: (query) => {
      const jobStatus =
        query.state.data?.status ?? regenerationJob?.status ?? null;
      return jobStatus === 'QUEUED' || jobStatus === 'PROCESSING'
        ? 2_000
        : false;
    },
  });

  const payslips = payslipPage?.items ?? [];
  const totalItems = payslipPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const currentRegenerationJob =
    regenerationJobQuery.data ?? regenerationJob;
  const regenerationInProgress =
    regenerationMutation.isPending ||
    currentRegenerationJob?.status === 'QUEUED' ||
    currentRegenerationJob?.status === 'PROCESSING';

  function isRegenerationPendingFor(payslipId: string) {
    return (
      (regenerationMutation.isPending && regenerationTarget?.id === payslipId) ||
      (currentRegenerationJob?.payslipId === payslipId &&
        (currentRegenerationJob.status === 'QUEUED' ||
          currentRegenerationJob.status === 'PROCESSING'))
    );
  }

  const moneyFormatter = new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0,
  });

  function queuePayslipRegeneration(target: PayslipRegenerationTarget) {
    setRegenerationTarget(target);
    setRegenerationJob(null);
    setDownloadError(null);
    regenerationMutation.mutate(target);
  }

  async function openPayslipPdf(payslip: PayslipRegenerationTarget) {
    setDownloadingPayslip(payslip.payslipNumber);
    setDownloadError(null);

    try {
      await api.openPayslipPdf(payslip.payslipNumber);
      setRegenerationTarget(null);
      setRegenerationJob(null);
    } catch (error) {
      if (error instanceof ApiRequestError && error.statusCode === 409) {
        setRegenerationTarget(payslip);
        setRegenerationJob(null);
        setDownloadError(
          'This protected payslip file is unavailable. Regenerate payslips before downloading.',
        );
      } else if (
        error instanceof ApiRequestError &&
        error.statusCode === 403
      ) {
        setDownloadError(
          'You do not have permission to download this payslip.',
        );
      } else {
        setRegenerationTarget(null);
        setDownloadError(
          'Could not download this protected payslip. Try again later.',
        );
      }
    } finally {
      setDownloadingPayslip(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search payslips by number or staff..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm transition-all focus:border-[var(--color-mod-hr-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-hr-border)]/50"
          />
        </div>
      </div>
      {downloadError ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
        >
          <p>{downloadError}</p>
          {regenerationTarget && canRegeneratePayslips ? (
            <button
              type="button"
              onClick={() => queuePayslipRegeneration(regenerationTarget)}
              disabled={regenerationInProgress}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {regenerationInProgress ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {regenerationInProgress
                ? 'Regeneration queued'
                : 'Queue payslip regeneration'}
            </button>
          ) : regenerationTarget ? (
            <p className="mt-2 text-xs text-rose-600">
              A payroll administrator with payslip generation permission must
              regenerate this file.
            </p>
          ) : null}
          {regenerationMutation.isError ? (
            <p className="mt-2 text-xs text-rose-600">
              Regeneration could not be queued. Try again.
            </p>
          ) : null}
        </div>
      ) : null}
      {currentRegenerationJob ? (
        <div
          role="status"
          className={
            currentRegenerationJob.status === 'SUCCEEDED'
              ? 'rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
              : currentRegenerationJob.status === 'FAILED' ||
                  regenerationJobQuery.isError
                ? 'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800'
                : 'rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 font-semibold">
              {currentRegenerationJob.status === 'SUCCEEDED' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <RefreshCw
                  className={
                    regenerationInProgress ? 'h-4 w-4 animate-spin' : 'h-4 w-4'
                  }
                />
              )}
              {regenerationJobQuery.isError
                ? 'Could not refresh regeneration status.'
                : currentRegenerationJob.status === 'QUEUED'
                  ? 'Payslip regeneration is queued.'
                  : currentRegenerationJob.status === 'PROCESSING'
                    ? 'Payslip regeneration is processing.'
                    : currentRegenerationJob.status === 'SUCCEEDED'
                      ? 'Payslip file regenerated. Download it again.'
                      : 'Payslip regeneration failed. Queue it again to retry.'}
            </span>
            {currentRegenerationJob.status === 'SUCCEEDED' &&
            regenerationTarget ? (
              <button
                type="button"
                onClick={() => void openPayslipPdf(regenerationTarget)}
                disabled={
                  downloadingPayslip === regenerationTarget.payslipNumber
                }
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                Download regenerated PDF
              </button>
            ) : currentRegenerationJob.status === 'FAILED' &&
              regenerationTarget &&
              canRegeneratePayslips ? (
              <button
                type="button"
                onClick={() => queuePayslipRegeneration(regenerationTarget)}
                disabled={regenerationMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-800 transition hover:bg-rose-100 disabled:opacity-60"
              >
                <RefreshCw className="h-4 w-4" />
                Retry regeneration
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 font-bold text-slate-600">Payslip #</th>
                <th className="px-6 py-4 font-bold text-slate-600">Staff</th>
                <th className="px-6 py-4 font-bold text-slate-600">Period</th>
                <th className="px-6 py-4 font-bold text-slate-600 text-right">Net Amount</th>
                <th className="px-6 py-4 font-bold text-slate-600 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-100 rounded" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-slate-100 rounded ml-auto" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-16 bg-slate-100 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-rose-500 font-medium">
                    Failed to load payslips. Please check your permissions.
                  </td>
                </tr>
              ) : payslips.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No payslips found.
                  </td>
                </tr>
              ) : (
                payslips.map((payslip) => (
                  <tr key={payslip.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[var(--color-mod-hr-text)]">
                      {payslip.payslipNumber}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{payslip.staff?.fullName}</p>
                      <p className="text-xs text-slate-500">{payslip.staff?.employeeId}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {payslip.periodMonth}/{payslip.periodYear}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900">
                      {moneyFormatter.format(Number(payslip.netAmount ?? 0))}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canRegeneratePayslips ? (
                          <button
                            type="button"
                            onClick={() => queuePayslipRegeneration(payslip)}
                            disabled={isRegenerationPendingFor(payslip.id)}
                            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-bold text-amber-800 transition-all hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isRegenerationPendingFor(payslip.id) ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <RefreshCw size={14} />
                            )}
                            {isRegenerationPendingFor(payslip.id)
                              ? 'Queued'
                              : 'Regenerate'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void openPayslipPdf(payslip)}
                          disabled={downloadingPayslip === payslip.payslipNumber}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 transition-all hover:bg-[var(--color-mod-hr-soft)] hover:text-[var(--color-mod-hr-text)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Download size={14} />
                          {downloadingPayslip === payslip.payslipNumber ? 'Downloading...' : 'Download PDF'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalItems > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <span className="text-xs font-bold text-slate-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalItems)} of {totalItems} payslips
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                aria-label="Previous payslip page"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                aria-label="Next payslip page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
