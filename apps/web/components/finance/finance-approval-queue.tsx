'use client';

import { Surface } from '@/components/schoolos';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FinanceApprovalRequestView } from '@schoolos/core';
import { formatBsDate } from '@schoolos/core';
import { AlertCircle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { useSession } from '@/components/session-provider';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { resourceAccess } from '@/lib/resource-authorization';

type PendingDecision =
  | {
      kind: 'REQUEST';
      requestType: 'REFUND' | 'REVERSAL';
      paymentId: string;
      amount?: string;
      reason: string;
    }
  | {
      kind: 'REVIEW';
      requestId: string;
      status: 'REVIEWED' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
      note: string;
    };

const money = (value: string) =>
  new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 2,
  }).format(Number(value));

export function FinanceApprovalQueue() {
  const { hasPermissions } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const page = Math.max(
    1,
    Number(searchParams.get('approvalPage') ?? '1') || 1,
  );
  const status = searchParams.get('approvalStatus') ?? '';
  const type = searchParams.get('approvalType') ?? '';
  const search = searchParams.get('approvalSearch') ?? '';
  const paymentSearch = searchParams.get('paymentSearch') ?? '';
  const canRequestRefund = hasPermissions(['payments:refund:request']);
  const canRequestReversal = hasPermissions(['payments:reverse:request']);
  const canRequest = canRequestRefund || canRequestReversal;
  const canReadQueue = canRequest || hasPermissions(['finance:approvals:read']);
  const [requestType, setRequestType] = useState<'REFUND' | 'REVERSAL'>(
    'REFUND',
  );
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [pendingDecision, setPendingDecision] =
    useState<PendingDecision | null>(null);
  const requestAttemptRef = useRef<{
    fingerprint: string;
    key: string;
  } | null>(null);

  const approvalQuery = useQuery({
    queryKey: ['finance-approval-requests', page, status, type, search],
    queryFn: () =>
      api.listFinanceApprovalRequests({
        page,
        limit: 25,
        status: status || undefined,
        type: (type || undefined) as 'REFUND' | 'REVERSAL' | undefined,
        search: search || undefined,
      }),
    enabled: canReadQueue,
  });
  const paymentsQuery = useQuery({
    queryKey: ['finance-payments', paymentSearch],
    queryFn: () =>
      api.listPaymentsPage({
        page: 1,
        limit: 25,
        search: paymentSearch || undefined,
        status: 'SUCCESS',
      }),
    enabled: canRequest,
  });

  const updateUrl = (updates: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === 1) params.delete(key);
      else params.set(key, String(value));
    }
    if (
      'approvalStatus' in updates ||
      'approvalType' in updates ||
      'approvalSearch' in updates
    ) {
      params.delete('approvalPage');
    }
    router.replace(`${pathname}?${params.toString()}`, {
      scroll: false,
    });
  };

  const decisionMutation = useMutation({
    mutationFn: async (decision: PendingDecision) => {
      if (decision.kind === 'REVIEW') {
        if (decision.status === 'EXECUTED')
          return api.executeFinanceApprovalRequest(decision.requestId);
        if (decision.status === 'REVIEWED')
          return api.reviewFinanceApprovalRequest(decision.requestId, {
            status: 'REVIEWED',
            reviewNote: decision.note || undefined,
          });
        return api.decideFinanceApprovalRequest(decision.requestId, {
          status: decision.status,
          reviewNote: decision.note || undefined,
        });
      }
      const fingerprint = JSON.stringify(decision);
      if (requestAttemptRef.current?.fingerprint !== fingerprint) {
        requestAttemptRef.current = {
          fingerprint,
          key: crypto.randomUUID(),
        };
      }
      if (decision.requestType === 'REFUND') {
        return api.requestPaymentRefund(decision.paymentId, {
          amount: decision.amount,
          reason: decision.reason,
          idempotencyKey: requestAttemptRef.current.key,
        });
      }
      return api.requestPaymentReversal(decision.paymentId, {
        reason: decision.reason,
        idempotencyKey: requestAttemptRef.current.key,
      });
    },
    onSuccess: () => {
      requestAttemptRef.current = null;
      setPendingDecision(null);
      setPaymentId('');
      setAmount('');
      setReason('');
      setReviewNote('');
      void queryClient.invalidateQueries({
        queryKey: ['finance-approval-requests'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['finance-dashboard-summary'],
      });
      void queryClient.invalidateQueries({ queryKey: ['finance-payments'] });
    },
  });

  const decisionTarget =
    pendingDecision?.kind === 'REQUEST'
      ? {
          type: pendingDecision.requestType,
          paymentId: pendingDecision.paymentId,
          amount:
            pendingDecision.amount ??
            paymentsQuery.data?.items.find(
              (payment) => payment.id === pendingDecision.paymentId,
            )?.amount ??
            null,
          reason: pendingDecision.reason,
        }
      : approvalQuery.data?.items.find(
          (request) => request.id === pendingDecision?.requestId,
        );

  return (
    <div className="space-y-8">
      {canRequest ? (
        <Surface
          title="Request a Refund or Reversal"
          description="Requests are reviewed by a different authorized user. Confirmed payments are never edited in place."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                Find confirmed payment
              </label>
              <input
                aria-label="Find confirmed payment"
                value={paymentSearch}
                onChange={(event) =>
                  updateUrl({ paymentSearch: event.target.value })
                }
                placeholder="Receipt, reference, student name or ID"
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm"
              />
              <select
                aria-label="Confirmed payment"
                value={paymentId}
                onChange={(event) => setPaymentId(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm"
              >
                <option value="">Select a payment</option>
                {paymentsQuery.data?.items.map((payment) => (
                  <option key={payment.id} value={payment.id}>
                    {payment.receiptNumber ?? payment.id} ·{' '}
                    {payment.student.name} · {money(payment.amount)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <select
                  aria-label="Correction type"
                  value={requestType}
                  onChange={(event) =>
                    setRequestType(event.target.value as 'REFUND' | 'REVERSAL')
                  }
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  {canRequestRefund ? (
                    <option value="REFUND">Refund</option>
                  ) : null}
                  {canRequestReversal ? (
                    <option value="REVERSAL">Full reversal</option>
                  ) : null}
                </select>
                <input
                  aria-label="Refund amount"
                  type="number"
                  min={0.01}
                  step="0.01"
                  disabled={requestType === 'REVERSAL'}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Refund amount"
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-50"
                />
              </div>
              <textarea
                aria-label="Correction reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Required correction reason"
                className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm"
              />
              <Button
                type="button"
                disabled={
                  !paymentId ||
                  (requestType === 'REFUND'
                    ? !canRequestRefund
                    : !canRequestReversal) ||
                  reason.trim().length < 5 ||
                  (requestType === 'REFUND' && (!amount || Number(amount) <= 0))
                }
                onClick={() =>
                  setPendingDecision({
                    kind: 'REQUEST',
                    requestType,
                    paymentId,
                    amount: requestType === 'REFUND' ? amount : undefined,
                    reason: reason.trim(),
                  })
                }
              >
                <ShieldAlert size={16} />
                Review request
              </Button>
            </div>
          </div>
        </Surface>
      ) : null}

      <Surface
        title="Refund and Reversal Approval Queue"
        description="Tenant-scoped request, review, execution, and status history."
      >
        {canReadQueue ? (
          <>
            <div className="mb-5 grid gap-3 md:grid-cols-3">
              <input
                aria-label="Search correction requests"
                value={search}
                onChange={(event) =>
                  updateUrl({ approvalSearch: event.target.value })
                }
                placeholder="Search reason, student or reference"
                className="h-11 rounded-xl border border-slate-200 px-4 text-sm"
              />
              <select
                aria-label="Correction request type"
                value={type}
                onChange={(event) =>
                  updateUrl({ approvalType: event.target.value })
                }
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm"
              >
                <option value="">All types</option>
                <option value="REFUND">Refund</option>
                <option value="REVERSAL">Reversal</option>
              </select>
              <select
                aria-label="Correction request status"
                value={status}
                onChange={(event) =>
                  updateUrl({ approvalStatus: event.target.value })
                }
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm"
              >
                <option value="">All statuses</option>
                {[
                  'PENDING',
                  'REVIEWED',
                  'APPROVED',
                  'PROCESSING',
                  'EXECUTED',
                  'REJECTED',
                  'FAILED',
                ].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            {approvalQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-slate-400" />
              </div>
            ) : approvalQuery.isError ? (
              <ErrorState
                title="Approval queue could not load"
                message="No correction was executed. Retry with the current filters preserved."
                onRetry={() => void approvalQuery.refetch()}
              />
            ) : approvalQuery.data?.items.length ? (
              <div className="space-y-4">
                {approvalQuery.data.items.map((request) => (
                  <ApprovalRequestCard
                    key={request.id}
                    request={request}
                    reviewNote={reviewNote}
                    setReviewNote={setReviewNote}
                    onDecision={(status) =>
                      setPendingDecision({
                        kind: 'REVIEW',
                        requestId: request.id,
                        status,
                        note: reviewNote.trim(),
                      })
                    }
                  />
                ))}
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>{approvalQuery.data.total} requests</span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => updateUrl({ approvalPage: page - 1 })}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!approvalQuery.data.hasNextPage}
                      onClick={() => updateUrl({ approvalPage: page + 1 })}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No correction requests"
                description="No refund or reversal request matches these filters."
              />
            )}
          </>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
            Correction request access is unavailable for this account.
          </div>
        )}
      </Surface>

      {decisionMutation.isError ? (
        <div
          className="flex items-center gap-3 rounded-xl border border-danger-100 bg-danger-50 p-4 text-sm font-bold text-danger-700"
          role="alert"
        >
          <AlertCircle size={18} />
          {decisionMutation.error instanceof Error
            ? decisionMutation.error.message
            : 'The finance correction was not changed.'}
        </div>
      ) : null}
      {decisionMutation.isSuccess ? (
        <div
          className="flex items-center gap-3 rounded-xl border border-success-100 bg-success-50 p-4 text-sm font-bold text-success-700"
          role="status"
        >
          <CheckCircle2 size={18} />
          The finance workflow was updated and the queue was refreshed.
        </div>
      ) : null}

      <Dialog
        open={Boolean(pendingDecision)}
        onOpenChange={(open: boolean) => {
          if (!open && !decisionMutation.isPending) setPendingDecision(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm financial correction</DialogTitle>
            <DialogDescription>
              {pendingDecision?.kind === 'REQUEST'
                ? 'Submit this correction for independent review and approval. Payment changes require a separate authorized execution.'
                : pendingDecision?.status === 'APPROVED'
                  ? 'Record independent approval. Payment and accounting records change only after a separate authorized execution.'
                  : pendingDecision?.status === 'REVIEWED'
                    ? 'Record review of the payment, amount and correction reason.'
                    : pendingDecision?.status === 'EXECUTED'
                      ? 'Execute the approved correction and accounting entry. Current authority, source records and fiscal period are checked again.'
                      : 'Reject this request with the recorded review note.'}
            </DialogDescription>
          </DialogHeader>
          {decisionTarget ? (
            <dl className="space-y-3 px-5 py-4 text-sm">
              <div>
                <dt className="font-semibold text-muted-foreground">Payment</dt>
                <dd className="break-words font-semibold">
                  {decisionTarget.paymentId}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-muted-foreground">
                  Correction
                </dt>
                <dd>
                  {decisionTarget.type === 'REFUND'
                    ? 'Refund'
                    : 'Full reversal'}
                  {decisionTarget.amount !== null
                    ? ` · ${money(decisionTarget.amount)}`
                    : ''}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-muted-foreground">Reason</dt>
                <dd className="break-words">{decisionTarget.reason}</dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={decisionMutation.isPending}
              onClick={() => setPendingDecision(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={
                pendingDecision?.kind === 'REVIEW' &&
                ['EXECUTED', 'REJECTED'].includes(pendingDecision.status)
                  ? 'destructive'
                  : 'default'
              }
              disabled={
                decisionMutation.isPending ||
                (pendingDecision?.kind === 'REVIEW' &&
                  pendingDecision.status === 'REJECTED' &&
                  !pendingDecision.note)
              }
              onClick={() => {
                if (pendingDecision) decisionMutation.mutate(pendingDecision);
              }}
            >
              {decisionMutation.isPending ? 'Processing…' : 'Confirm action'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApprovalRequestCard({
  request,
  reviewNote,
  setReviewNote,
  onDecision,
}: {
  request: FinanceApprovalRequestView;
  reviewNote: string;
  setReviewNote: (value: string) => void;
  onDecision: (
    status: 'REVIEWED' | 'APPROVED' | 'REJECTED' | 'EXECUTED',
  ) => void;
}) {
  // Phase 3A: actions come only from the canonical server projection; a
  // missing/old/non-ENABLED projection offers no decision controls.
  const access = resourceAccess(request.authorization);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">
            {request.type} · {request.paymentId}
          </p>
          <p className="mt-2 text-sm font-bold text-slate-900">
            {request.reason}
          </p>
          {request.amount !== null ? (
            <p className="mt-1 text-sm font-black text-slate-700">
              {money(request.amount)}
            </p>
          ) : null}
        </div>
        <StatusBadge status={request.status} />
      </div>
      {request.failureMessage ? (
        <p className="mt-3 rounded-xl bg-danger-50 p-3 text-xs font-semibold text-danger-700">
          {request.failureMessage}
        </p>
      ) : null}
      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
        {request.history.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start justify-between gap-4 text-xs text-slate-600"
          >
            <span>
              {entry.action}
              {entry.note ? ` · ${entry.note}` : ''}
            </span>
            <span className="shrink-0 font-semibold">
              {formatBsDate(entry.createdAt)}
            </span>
          </div>
        ))}
      </div>
      {access.can('REVIEW') ||
      access.can('APPROVE') ||
      access.can('EXECUTE') ||
      access.can('REJECT') ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <textarea
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            aria-label={`Review note for correction ${request.paymentId}`}
            placeholder="Review note (required for rejection)"
            className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {access.can('REVIEW') ? (
              <Button type="button" onClick={() => onDecision('REVIEWED')}>
                Complete review
              </Button>
            ) : null}
            {access.can('APPROVE') ? (
              <Button type="button" onClick={() => onDecision('APPROVED')}>
                Approve ({request.approvalCount}/{request.requiredApprovalCount}
                )
              </Button>
            ) : null}
            {access.can('EXECUTE') && request.status === 'APPROVED' ? (
              <Button type="button" onClick={() => onDecision('EXECUTED')}>
                Execute correction
              </Button>
            ) : null}
            {access.can('REJECT') ? (
              <Button
                type="button"
                variant="destructive"
                disabled={!reviewNote.trim()}
                onClick={() => onDecision('REJECTED')}
              >
                Reject
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
