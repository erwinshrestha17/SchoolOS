'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatBsDateTime } from '@schoolos/core';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Loader2, AlertTriangle, Lock, Unlock, RefreshCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FiscalYearCloseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalYear: any;
  mode: 'CLOSE' | 'REOPEN';
}

export function FiscalYearCloseDialog({ isOpen, onClose, fiscalYear, mode }: FiscalYearCloseDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError(null);
    }
  }, [isOpen, fiscalYear?.id, mode]);

  const readinessQuery = useQuery({
    queryKey: ['fiscal-year-close-readiness', fiscalYear?.id],
    queryFn: () => api.getFiscalYearCloseReadiness(fiscalYear.id),
    enabled: isOpen && mode === 'CLOSE' && Boolean(fiscalYear?.id),
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === 'CLOSE')
        return api.closeFiscalYear(fiscalYear.id, { reason: reason.trim() });
      return api.reopenFiscalYear(fiscalYear.id, { reason: reason.trim() });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fiscal-years'] });
      void queryClient.invalidateQueries({
        queryKey: ['fiscal-year-close-readiness', fiscalYear?.id],
      });
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || `Failed to ${mode.toLowerCase()} fiscal year`);
    },
  });

  const readiness = readinessQuery.data;
  const reasonTooShort = reason.trim().length < 5;
  const closeBlockedByReadiness =
    mode === 'CLOSE' &&
    (readinessQuery.isLoading ||
      readinessQuery.isError ||
      !readiness?.readyToClose);
  const confirmDisabled =
    reasonTooShort || closeBlockedByReadiness || mutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (confirmDisabled) return;
    mutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-4">
            {mode === 'CLOSE' ? <Lock size={24} /> : <Unlock size={24} />}
          </div>
          <DialogTitle className="text-center">
            {mode === 'CLOSE' ? 'Close Fiscal Year' : 'Reopen Fiscal Year'}
          </DialogTitle>
          <p className="text-center text-sm text-slate-500 mt-2">
            {mode === 'CLOSE' 
              ? `Are you sure you want to close ${fiscalYear?.name}? This will generate closing entries for all revenue and expense accounts and transfer net income to Retained Earnings.`
              : `Reopening ${fiscalYear?.name} will allow further postings. Please provide a reason for the audit trail.`}
          </p>
        </DialogHeader>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 border border-rose-100 p-4 text-sm font-medium text-rose-800 flex items-center gap-2">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {mode === 'CLOSE' && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Backend-owned close readiness
                </p>
                <button
                  type="button"
                  onClick={() => void readinessQuery.refetch()}
                  disabled={readinessQuery.isFetching}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  <RefreshCcw
                    size={12}
                    className={cn(readinessQuery.isFetching && 'animate-spin')}
                  />
                  Recompute
                </button>
              </div>

              {readinessQuery.isLoading && (
                <p className="text-xs font-semibold text-slate-500">
                  Running backend close-readiness checks...
                </p>
              )}
              {readinessQuery.isError && (
                <p className="text-xs font-semibold text-rose-700">
                  Readiness could not be checked. Confirm your fiscal permission and try again.
                </p>
              )}
              {readiness && (
                <div className="space-y-2">
                  <p
                    className={cn(
                      'text-xs font-bold',
                      readiness.readyToClose ? 'text-emerald-700' : 'text-rose-700',
                    )}
                  >
                    {readiness.readyToClose
                      ? 'No blocking issues. This fiscal year can be closed.'
                      : `${readiness.blockingIssueCount} blocking issue(s) must be resolved before closing.`}
                  </p>
                  {readiness.issues
                    .filter((issue) => issue.severity === 'BLOCKING')
                    .map((issue) => (
                      <p key={issue.code} className="text-xs text-rose-700">
                        {issue.safeMessage} ({issue.count})
                      </p>
                    ))}
                  {readiness.issues
                    .filter((issue) => issue.severity === 'WARNING')
                    .map((issue) => (
                      <p key={issue.code} className="text-xs text-amber-700">
                        Warning: {issue.safeMessage} ({issue.count})
                      </p>
                    ))}
                  <p className="text-[10px] text-slate-400">
                    Last calculated {formatBsDateTime(readiness.lastCalculatedAt)}. Posting-failure,
                    report-snapshot, export-job, fee-reconciliation, and warning-acknowledgement checks remain
                    explicitly unavailable in this release.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">
              {mode === 'CLOSE' ? 'Reason for closing' : 'Reason for reopening'}
            </label>
            <textarea
              className="w-full min-h-[100px] rounded-2xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-accounting-accent)]"
              placeholder={
                mode === 'CLOSE'
                  ? 'Describe why this fiscal year is being closed now...'
                  : 'Describe why this fiscal year needs to be reopened...'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={5}
            />
            {reason.trim().length > 0 && reasonTooShort && (
              <p className="text-[10px] font-bold uppercase text-rose-500">
                Enter at least 5 characters
              </p>
            )}
          </div>

          <DialogFooter className="pt-4 grid grid-cols-2 gap-2 sm:space-x-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={confirmDisabled}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-2 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50",
                mode === 'CLOSE' ? "bg-rose-600 hover:bg-rose-700" : "bg-[var(--color-mod-accounting-accent)] hover:bg-[var(--color-mod-accounting-text)]"
              )}
            >
              {mutation.isPending && <Loader2 size={16} className="animate-spin" />}
              {mode === 'CLOSE' ? 'Confirm Close' : 'Confirm Reopen'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
