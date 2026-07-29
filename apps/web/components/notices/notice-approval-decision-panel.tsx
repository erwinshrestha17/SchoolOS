'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function NoticeApprovalDecisionPanel({
  noticeId,
  approvalRequestId,
}: {
  noticeId: string;
  approvalRequestId: string;
}) {
  const queryClient = useQueryClient();
  const [pendingDecision, setPendingDecision] = useState<
    'APPROVE' | 'REJECT' | null
  >(null);
  const [reason, setReason] = useState('');

  const decisionMutation = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REJECT') =>
      api.decideApprovalRequest(approvalRequestId, {
        decision,
        reason: reason.trim() || undefined,
      }),
    onSuccess: async () => {
      setPendingDecision(null);
      setReason('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notice-detail', noticeId] }),
        queryClient.invalidateQueries({ queryKey: ['notices'] }),
      ]);
    },
  });

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-amber-950">Approval decision</h2>
      <p className="mt-1 text-sm text-amber-900">
        This notice is waiting for an approver decision before it can be
        published.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPendingDecision('APPROVE')}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
        >
          <CheckCircle2 size={16} /> Approve
        </button>
        <button
          type="button"
          onClick={() => setPendingDecision('REJECT')}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-danger-300 bg-white px-4 py-2 text-sm font-semibold text-danger-700"
        >
          <XCircle size={16} /> Reject
        </button>
      </div>

      <ConfirmDialog
        isOpen={pendingDecision !== null}
        title={
          pendingDecision === 'APPROVE'
            ? 'Approve this notice?'
            : 'Reject this notice?'
        }
        description="Your decision is recorded in the approval workflow and updates the notice lifecycle."
        confirmLabel={pendingDecision === 'APPROVE' ? 'Approve' : 'Reject'}
        destructive={pendingDecision === 'REJECT'}
        isConfirming={decisionMutation.isPending}
        confirmDisabled={decisionMutation.isPending}
        onClose={() => {
          setPendingDecision(null);
          setReason('');
        }}
        onConfirm={() => {
          if (!pendingDecision) return;
          decisionMutation.mutate(pendingDecision);
        }}
      >
        <label className="mt-3 block text-sm font-medium text-gray-700">
          Reason (optional)
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm"
            rows={3}
            maxLength={500}
          />
        </label>
        {decisionMutation.isError ? (
          <p className="mt-2 text-sm text-danger-700">
            Could not record the approval decision. Try again or contact support.
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}
