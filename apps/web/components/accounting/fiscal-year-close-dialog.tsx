'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Lock, Unlock } from 'lucide-react';
import { resourceAccess } from '../../lib/resource-authorization';
import {
  allWarningsAcknowledged,
  closeRequestFromPreview,
  FiscalClosePreviewPanel,
} from './fiscal-close-preview-panel';

interface FiscalYearCloseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalYear: any;
  mode: 'CLOSE' | 'REOPEN';
}

export function FiscalYearCloseDialog({
  isOpen,
  onClose,
  fiscalYear,
  mode,
}: FiscalYearCloseDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reopenRequestId, setReopenRequestId] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError(null);
      setReopenRequestId(null);
      setAcknowledged(new Set());
    }
  }, [isOpen, fiscalYear?.id, mode]);

  // Phase 7.11d: the close is bound to this preview's fingerprint.
  const previewQuery = useQuery({
    queryKey: ['fiscal-year-close-preview', fiscalYear?.id],
    queryFn: () => api.getFiscalYearClosePreview(fiscalYear.id),
    enabled: isOpen && mode === 'CLOSE' && Boolean(fiscalYear?.id),
  });
  const preview = previewQuery.data;

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === 'CLOSE') {
        if (!preview) throw new Error('Open the close preview first.');
        await api.closeFiscalYear(
          fiscalYear.id,
          closeRequestFromPreview(preview, reason.trim(), acknowledged),
        );
        return null;
      }
      return api.reopenFiscalYear(fiscalYear.id, { reason: reason.trim() });
    },
    onSuccess: (result) => {
      if (result) {
        setReopenRequestId(result.id);
        void queryClient.invalidateQueries({
          queryKey: ['principal-approval-centre'],
        });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['fiscal-years'] });
      void queryClient.invalidateQueries({
        queryKey: ['fiscal-year-close-preview', fiscalYear?.id],
      });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || `Failed to ${mode.toLowerCase()} fiscal year`);
      // A stale or changed preview must be reviewed again.
      if (mode === 'CLOSE') {
        setAcknowledged(new Set());
        void previewQuery.refetch();
      }
    },
  });

  const minimumReasonLength = mode === 'REOPEN' ? 10 : 5;
  const reasonTooShort = reason.trim().length < minimumReasonLength;
  const closeBlockedByReadiness =
    mode === 'CLOSE' &&
    (previewQuery.isLoading ||
      previewQuery.isError ||
      !resourceAccess<'close', 'inventory'>(preview?.authorization).can(
        'close',
      ) ||
      !allWarningsAcknowledged(preview, acknowledged));
  const confirmDisabled =
    reasonTooShort ||
    closeBlockedByReadiness ||
    mutation.isPending ||
    Boolean(reopenRequestId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (confirmDisabled) return;
    mutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-4">
            {mode === 'CLOSE' ? <Lock size={24} /> : <Unlock size={24} />}
          </div>
          <DialogTitle className="text-center">
            {mode === 'CLOSE'
              ? 'Close Fiscal Year'
              : 'Request Fiscal Year Reopen'}
          </DialogTitle>
          <p className="text-center text-sm text-slate-500 mt-2">
            {mode === 'CLOSE'
              ? `Review what closing ${fiscalYear?.name} depends on and the exact closing entry it will post. Closing moves every open income and expense balance into retained earnings.`
              : `Request reopening ${fiscalYear?.name}. The year stays closed until an independent approver applies the request. Provide a reason for the audit trail.`}
          </p>
        </DialogHeader>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 border border-rose-100 p-4 text-sm font-medium text-rose-800 flex items-center gap-2">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {reopenRequestId && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            Reopen request submitted for independent approval. The fiscal year
            remains closed.
            <p className="mt-2">
              An authorized independent approver can review the request in
              Approval Centre.
            </p>
          </div>
        )}

        {!reopenRequestId && (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {mode === 'CLOSE' && (
              <FiscalClosePreviewPanel
                preview={preview}
                isLoading={previewQuery.isLoading}
                isError={previewQuery.isError}
                isFetching={previewQuery.isFetching}
                acknowledged={acknowledged}
                onAcknowledge={(code, checked) =>
                  setAcknowledged((current) => {
                    const next = new Set(current);
                    if (checked) next.add(code);
                    else next.delete(code);
                    return next;
                  })
                }
                onRecompute={() => {
                  setAcknowledged(new Set());
                  void previewQuery.refetch();
                }}
              />
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">
                {mode === 'CLOSE'
                  ? 'Reason for closing'
                  : 'Reason for reopening'}
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
                minLength={minimumReasonLength}
              />
              {reason.trim().length > 0 && reasonTooShort && (
                <p className="text-[10px] font-bold uppercase text-rose-500">
                  Enter at least {minimumReasonLength} characters
                </p>
              )}
            </div>

            <DialogFooter className="grid grid-cols-2 gap-2 pt-4 sm:space-x-0">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={mode === 'CLOSE' ? 'destructive' : 'default'}
                disabled={confirmDisabled}
                isLoading={mutation.isPending}
              >
                {mode === 'CLOSE' ? 'Confirm Close' : 'Submit Reopen Request'}
              </Button>
            </DialogFooter>
          </form>
        )}
        {reopenRequestId && (
          <DialogFooter>
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
