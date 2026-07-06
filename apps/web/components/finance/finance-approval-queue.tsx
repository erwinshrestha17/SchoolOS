"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FinanceApprovalRequestView } from "@schoolos/core";
import { formatBsDate } from "@schoolos/core";
import { AlertCircle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";

type PendingDecision =
  | {
      kind: "REQUEST";
      requestType: "REFUND" | "REVERSAL";
      paymentId: string;
      amount?: number;
      reason: string;
    }
  | {
      kind: "REVIEW";
      requestId: string;
      status: "APPROVED" | "REJECTED";
      note: string;
    };

const money = (value: number) =>
  new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 2,
  }).format(value);

export function FinanceApprovalQueue() {
  const { hasPermissions } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const page = Math.max(
    1,
    Number(searchParams.get("approvalPage") ?? "1") || 1,
  );
  const status = searchParams.get("approvalStatus") ?? "";
  const type = searchParams.get("approvalType") ?? "";
  const search = searchParams.get("approvalSearch") ?? "";
  const paymentSearch = searchParams.get("paymentSearch") ?? "";
  const canRequest = hasPermissions(["payments:collect"]);
  const canApproveRefund = hasPermissions(["payments:refund"]);
  const canApproveReversal = hasPermissions(["payments:reverse"]);
  const [requestType, setRequestType] = useState<"REFUND" | "REVERSAL">(
    "REFUND",
  );
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [pendingDecision, setPendingDecision] =
    useState<PendingDecision | null>(null);
  const requestAttemptRef = useRef<{
    fingerprint: string;
    key: string;
  } | null>(null);

  const approvalQuery = useQuery({
    queryKey: ["finance-approval-requests", page, status, type, search],
    queryFn: () =>
      api.listFinanceApprovalRequests({
        page,
        limit: 25,
        status: status || undefined,
        type: (type || undefined) as "REFUND" | "REVERSAL" | undefined,
        search: search || undefined,
      }),
    enabled: canApproveRefund || canApproveReversal,
  });
  const paymentsQuery = useQuery({
    queryKey: ["finance-payments", paymentSearch],
    queryFn: () =>
      api.listPaymentsPage({
        page: 1,
        limit: 25,
        search: paymentSearch || undefined,
        status: "SUCCESS",
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
      "approvalStatus" in updates ||
      "approvalType" in updates ||
      "approvalSearch" in updates
    ) {
      params.delete("approvalPage");
    }
    router.replace(`/dashboard/finance?${params.toString()}`, {
      scroll: false,
    });
  };

  const decisionMutation = useMutation({
    mutationFn: async (decision: PendingDecision) => {
      if (decision.kind === "REVIEW") {
        return api.reviewFinanceApprovalRequest(decision.requestId, {
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
      if (decision.requestType === "REFUND") {
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
      setPaymentId("");
      setAmount("");
      setReason("");
      setReviewNote("");
      void queryClient.invalidateQueries({
        queryKey: ["finance-approval-requests"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["finance-dashboard-summary"],
      });
      void queryClient.invalidateQueries({ queryKey: ["finance-payments"] });
    },
  });

  return (
    <div className="space-y-8">
      {canRequest ? (
        <SectionCard
          title="Request a Refund or Reversal"
          description="Requests are reviewed by a different authorized user. Confirmed payments are never edited in place."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                Find confirmed payment
              </label>
              <input
                value={paymentSearch}
                onChange={(event) =>
                  updateUrl({ paymentSearch: event.target.value })
                }
                placeholder="Receipt, reference, student name or ID"
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm"
              />
              <select
                value={paymentId}
                onChange={(event) => setPaymentId(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm"
              >
                <option value="">Select a payment</option>
                {paymentsQuery.data?.items.map((payment) => (
                  <option key={payment.id} value={payment.id}>
                    {payment.receiptNumber ?? payment.id} ·{" "}
                    {payment.student.name} · {money(payment.amount)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={requestType}
                  onChange={(event) =>
                    setRequestType(event.target.value as "REFUND" | "REVERSAL")
                  }
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="REFUND">Refund</option>
                  <option value="REVERSAL">Full reversal</option>
                </select>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  disabled={requestType === "REVERSAL"}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Refund amount"
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-50"
                />
              </div>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Required correction reason"
                className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm"
              />
              <button
                type="button"
                disabled={
                  !paymentId ||
                  reason.trim().length < 5 ||
                  (requestType === "REFUND" && (!amount || Number(amount) <= 0))
                }
                onClick={() =>
                  setPendingDecision({
                    kind: "REQUEST",
                    requestType,
                    paymentId,
                    amount:
                      requestType === "REFUND" ? Number(amount) : undefined,
                    reason: reason.trim(),
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-mod-fees-accent)] px-4 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
              >
                <ShieldAlert size={16} />
                Review request
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Refund and Reversal Approval Queue"
        description="Tenant-scoped request, review, execution, and status history."
      >
        {canApproveRefund || canApproveReversal ? (
          <>
            <div className="mb-5 grid gap-3 md:grid-cols-3">
              <input
                value={search}
                onChange={(event) =>
                  updateUrl({ approvalSearch: event.target.value })
                }
                placeholder="Search reason, student or reference"
                className="h-11 rounded-xl border border-slate-200 px-4 text-sm"
              />
              <select
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
                value={status}
                onChange={(event) =>
                  updateUrl({ approvalStatus: event.target.value })
                }
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm"
              >
                <option value="">All statuses</option>
                {[
                  "PENDING",
                  "PROCESSING",
                  "EXECUTED",
                  "REJECTED",
                  "FAILED",
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
                    canApprove={
                      request.type === "REFUND"
                        ? canApproveRefund
                        : canApproveReversal
                    }
                    reviewNote={reviewNote}
                    setReviewNote={setReviewNote}
                    onDecision={(status) =>
                      setPendingDecision({
                        kind: "REVIEW",
                        requestId: request.id,
                        status,
                        note: reviewNote.trim(),
                      })
                    }
                  />
                ))}
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>{approvalQuery.data.total} requests</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => updateUrl({ approvalPage: page - 1 })}
                      className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={!approvalQuery.data.hasNextPage}
                      onClick={() => updateUrl({ approvalPage: page + 1 })}
                      className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
                    >
                      Next
                    </button>
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
            You can submit a correction request, but only an authorized approver
            can view and decide the approval queue.
          </div>
        )}
      </SectionCard>

      {decisionMutation.isError ? (
        <div
          className="flex items-center gap-3 rounded-xl border border-danger-100 bg-danger-50 p-4 text-sm font-bold text-danger-700"
          role="alert"
        >
          <AlertCircle size={18} />
          {decisionMutation.error instanceof Error
            ? decisionMutation.error.message
            : "The finance correction was not changed."}
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
            <DialogTitle>Confirm high-risk finance action</DialogTitle>
            <DialogDescription>
              {pendingDecision?.kind === "REQUEST"
                ? "Submit this correction for review. It will not change the confirmed payment until a different authorized user approves it."
                : pendingDecision?.status === "APPROVED"
                  ? "Approval immediately executes the idempotent correction and accounting entry."
                  : "Reject this request with the recorded review note."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              disabled={decisionMutation.isPending}
              onClick={() => setPendingDecision(null)}
              className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                decisionMutation.isPending ||
                (pendingDecision?.kind === "REVIEW" &&
                  pendingDecision.status === "REJECTED" &&
                  !pendingDecision.note)
              }
              onClick={() => {
                if (pendingDecision) decisionMutation.mutate(pendingDecision);
              }}
              className="rounded-xl bg-danger-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {decisionMutation.isPending ? "Processing…" : "Confirm action"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApprovalRequestCard({
  request,
  canApprove,
  reviewNote,
  setReviewNote,
  onDecision,
}: {
  request: FinanceApprovalRequestView;
  canApprove: boolean;
  reviewNote: string;
  setReviewNote: (value: string) => void;
  onDecision: (status: "APPROVED" | "REJECTED") => void;
}) {
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
              {entry.note ? ` · ${entry.note}` : ""}
            </span>
            <span className="shrink-0 font-semibold">
              {formatBsDate(entry.createdAt)}
            </span>
          </div>
        ))}
      </div>
      {canApprove && request.status === "PENDING" ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <textarea
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            placeholder="Review note (required for rejection)"
            className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm"
          />
          <div className="flex gap-2">
            <Button type="button" onClick={() => onDecision("APPROVED")}>
              Approve
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!reviewNote.trim()}
              onClick={() => onDecision("REJECTED")}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
