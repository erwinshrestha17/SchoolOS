'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, PauseCircle, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';
import { formatBsDateTime } from '@schoolos/core';
import { holdReasonValid } from '../../lib/payroll-run-view';

type HoldLine = {
  staffId?: string;
  staffName: string;
  employeeId?: string | null;
};

type Props = {
  runId: string;
  runStatus: string;
  lines: HoldLine[];
  canHold: boolean;
  canReleaseHold: boolean;
  canExportBankAdvice: boolean;
};

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-hr-border)]/60';

/**
 * Phase 7.9: payment holds and the generic bank payment advice for one run.
 * A hold withholds a single staff member's payment only — the run, its totals
 * and its accounting are unchanged. Every control is gated by the server's
 * authorization projection; the server re-checks (and enforces separation of
 * duties: the person who places a hold cannot release it).
 */
export function PayrollRunHoldsPanel({
  runId,
  runStatus,
  lines,
  canHold,
  canReleaseHold,
  canExportBankAdvice,
}: Props) {
  const queryClient = useQueryClient();
  const [staffId, setStaffId] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [releaseFor, setReleaseFor] = useState<string | null>(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [reExportReason, setReExportReason] = useState('');

  const holdsQuery = useQuery({
    queryKey: ['payroll-run-holds', runId],
    queryFn: () => api.listPayrollHolds(runId),
  });
  const adviceQuery = useQuery({
    queryKey: ['payroll-bank-advice', runId],
    queryFn: () => api.getPayrollBankAdviceStatus(runId),
    enabled: canExportBankAdvice,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ['payroll-run-holds', runId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['payroll-bank-advice', runId],
    });
    void queryClient.invalidateQueries({ queryKey: ['payroll-run-detail'] });
  };

  const createHold = useMutation({
    mutationFn: () =>
      api.createPayrollHold(runId, { staffId, reason: holdReason.trim() }),
    onSuccess: () => {
      setStaffId('');
      setHoldReason('');
      refresh();
    },
  });
  const releaseHold = useMutation({
    mutationFn: (holdId: string) =>
      api.releasePayrollHold(runId, holdId, releaseReason.trim()),
    onSuccess: () => {
      setReleaseFor(null);
      setReleaseReason('');
      refresh();
    },
  });
  const exportAdvice = useMutation({
    mutationFn: () =>
      api.exportPayrollBankAdvice(runId, reExportReason.trim() || undefined),
    onSuccess: () => {
      setReExportReason('');
      refresh();
    },
  });

  const holds = holdsQuery.data ?? [];
  const activeHoldStaff = new Set(
    holds
      .filter((hold) => hold.status === 'ACTIVE')
      .map((hold) => hold.staffId),
  );
  const holdableLines = lines.filter(
    (line) => line.staffId && !activeHoldStaff.has(line.staffId),
  );
  const advice = adviceQuery.data;
  const previousExports = advice?.exports.length ?? 0;
  const reExportNeeded = previousExports > 0;

  return (
    <section
      aria-label="Payment holds and bank advice"
      className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4"
    >
      <div>
        <h4 className="text-sm font-bold text-gray-900">
          Payment holds
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {runStatus}
          </span>
        </h4>
        <p className="text-xs text-gray-500">
          A hold withholds one person&apos;s payment only. The run, its totals
          and its accounting stay as approved. A run cannot be marked paid while
          a hold is active. The person who places a hold cannot release it.
        </p>
      </div>

      {holdsQuery.isLoading ? (
        <p className="text-xs text-gray-500">Loading holds…</p>
      ) : holdsQuery.isError ? (
        <p className="text-xs font-semibold text-danger-700">
          Holds could not be loaded.
        </p>
      ) : holds.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-3 py-3 text-xs text-gray-500">
          No holds on this run.
        </p>
      ) : (
        <ul className="space-y-2">
          {holds.map((hold) => (
            <li
              key={hold.id}
              className="rounded-xl border border-gray-100 p-3 text-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-gray-900">
                    {hold.staffName ?? 'Staff member'}
                    {hold.employeeId ? (
                      <span className="ml-2 text-[10px] text-gray-500">
                        {hold.employeeId}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-gray-600">{hold.reason}</p>
                  <p className="mt-1 text-[10px] text-gray-400">
                    Placed {formatBsDateTime(hold.createdAt)}
                    {hold.status === 'RELEASED' && hold.releasedAt
                      ? ` · released ${formatBsDateTime(hold.releasedAt)}${
                          hold.releaseReason ? ` — ${hold.releaseReason}` : ''
                        }`
                      : ''}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${
                    hold.status === 'ACTIVE'
                      ? 'border-amber-200 bg-amber-100 text-amber-700'
                      : 'border-gray-200 bg-gray-100 text-gray-600'
                  }`}
                >
                  {hold.status}
                </span>
              </div>
              {hold.status === 'ACTIVE' && canReleaseHold && (
                <div className="mt-3 space-y-2">
                  {releaseFor === hold.id ? (
                    <>
                      <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Release reason (required)
                        <textarea
                          value={releaseReason}
                          onChange={(event) =>
                            setReleaseReason(event.target.value)
                          }
                          maxLength={500}
                          rows={2}
                          className={inputClass}
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={
                            !holdReasonValid(releaseReason) ||
                            releaseHold.isPending
                          }
                          onClick={() => releaseHold.mutate(hold.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-mod-hr-accent)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {releaseHold.isPending ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <PlayCircle size={14} />
                          )}
                          Confirm release
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReleaseFor(null);
                            setReleaseReason('');
                          }}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReleaseFor(hold.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                    >
                      <PlayCircle size={14} /> Release hold
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {releaseHold.error && (
        <p role="alert" className="text-xs font-semibold text-danger-700">
          {(releaseHold.error as Error).message}
        </p>
      )}

      {canHold && (
        <div className="space-y-2 rounded-xl bg-gray-50 p-3">
          <p className="text-xs font-bold text-gray-700">Place a hold</p>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Staff
            <select
              value={staffId}
              onChange={(event) => setStaffId(event.target.value)}
              className={inputClass}
            >
              <option value="">Select a staff line…</option>
              {holdableLines.map((line) => (
                <option key={line.staffId} value={line.staffId}>
                  {line.staffName}
                  {line.employeeId ? ` (${line.employeeId})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Reason (required)
            <textarea
              value={holdReason}
              onChange={(event) => setHoldReason(event.target.value)}
              maxLength={500}
              rows={2}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            disabled={
              !staffId || !holdReasonValid(holdReason) || createHold.isPending
            }
            onClick={() => createHold.mutate()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {createHold.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <PauseCircle size={14} />
            )}
            Place hold
          </button>
          {createHold.error && (
            <p role="alert" className="text-xs font-semibold text-danger-700">
              {(createHold.error as Error).message}
            </p>
          )}
        </div>
      )}

      {canExportBankAdvice && (
        <div className="space-y-2 rounded-xl border border-gray-100 p-3">
          <p className="text-xs font-bold text-gray-700">Bank payment advice</p>
          <p className="text-xs text-gray-500">
            A generic CSV of bank-paid staff with a positive net, excluding any
            held line. It is not a bank-specific format. The file contains bank
            account details — handle it as confidential.
          </p>
          {advice && (
            <p className="text-xs text-gray-600">
              {advice.payableLineCount} line
              {advice.payableLineCount === 1 ? '' : 's'} to pay ·{' '}
              {advice.heldLineCount} held · {previousExports} previous export
              {previousExports === 1 ? '' : 's'}
            </p>
          )}
          {advice && advice.exports.length > 0 && (
            <ul className="space-y-1 text-[10px] text-gray-500">
              {advice.exports.map((entry) => (
                <li key={entry.id}>
                  #{entry.sequence} · {formatBsDateTime(entry.exportedAt)} ·{' '}
                  {entry.lineCount} lines ·{' '}
                  <span>{entry.contentSha256.slice(0, 12)}</span>
                  {entry.reExportReason ? ` · ${entry.reExportReason}` : ''}
                </li>
              ))}
            </ul>
          )}
          {reExportNeeded && (
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Re-export reason (required)
              <textarea
                value={reExportReason}
                onChange={(event) => setReExportReason(event.target.value)}
                maxLength={500}
                rows={2}
                className={inputClass}
              />
            </label>
          )}
          <button
            type="button"
            disabled={
              exportAdvice.isPending ||
              (reExportNeeded && !holdReasonValid(reExportReason))
            }
            onClick={() => exportAdvice.mutate()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-mod-hr-border)] px-3 py-1.5 text-xs font-bold text-[var(--color-mod-hr-text)] hover:bg-[var(--color-mod-hr-soft)] disabled:opacity-50"
          >
            {exportAdvice.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {reExportNeeded ? 'Export again' : 'Export bank advice (CSV)'}
          </button>
          {exportAdvice.error && (
            <p role="alert" className="text-xs font-semibold text-danger-700">
              {(exportAdvice.error as Error).message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
