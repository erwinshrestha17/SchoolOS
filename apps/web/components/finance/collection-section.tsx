"use client";

import React, { useEffect, useRef, useState } from "react";
import { CollectionCounter } from "./collection-counter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { OfflineMutationError } from "@/lib/offline-policy";
import {
  authorityFenceFields,
  readSchoolAuthorityFence,
} from "@/lib/school-authority-discovery";
import {
  deleteOfflineModuleDraft,
  listOfflineModuleDrafts,
  upsertOfflineModuleDraft,
} from "@/lib/offline-module-drafts";
import type { CollectedPaymentResult } from "@/lib/api/finance";
import type { InvoiceSummary, StudentCollectionContext } from "@schoolos/core";
import { CheckCircle2, AlertCircle, Printer, X } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from '@/components/ui/button';
import { ErrorState } from "@/components/ui/error-state";
import { PermissionDenied } from '@/components/ui/permission-denied';

interface CollectionSectionProps {
  invoices: InvoiceSummary[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  initialInvoiceId?: string | null;
  studentCollectionContext?: StudentCollectionContext | null;
  hasStudentCollectionContextRequest?: boolean;
  isStudentProfileSource?: boolean;
  onChangeStudent?: () => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  page?: number;
  limit?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

type CollectionPaymentPayload = {
  invoiceId: string;
  amount: string;
  method: string;
  referenceNumber?: string;
  narration: string;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Payment could not be recorded. Please retry.";

const formatMoney = (amount: string) =>
  new Intl.NumberFormat("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));

export function CollectionSection({
  invoices,
  isLoading,
  isError,
  onRetry,
  initialInvoiceId,
  studentCollectionContext,
  hasStudentCollectionContextRequest,
  isStudentProfileSource,
  onChangeStudent,
  searchQuery = "",
  onSearchChange,
  page = 1,
  limit = 25,
  total = 0,
  onPageChange,
}: CollectionSectionProps) {
  const { hasPermissions, session } = useSession();
  const canCollect = hasPermissions(["payments:collect"]);
  const queryClient = useQueryClient();
  const [lastReceipt, setLastReceipt] = useState<CollectedPaymentResult | null>(
    null,
  );
  const [queuedIntent, setQueuedIntent] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const paymentAttemptRef = useRef<{ fingerprint: string; key: string } | null>(
    null,
  );
  const isStudentContextMode =
    Boolean(studentCollectionContext) ||
    Boolean(hasStudentCollectionContextRequest);

  const paymentMutation = useMutation({
    mutationFn: async (payload: CollectionPaymentPayload) => {
      const fingerprint = JSON.stringify(payload);
      if (paymentAttemptRef.current?.fingerprint !== fingerprint) {
        paymentAttemptRef.current = {
          fingerprint,
          key: crypto.randomUUID(),
        };
      }
      return api.collectPayment({
        ...payload,
        idempotencyKey: paymentAttemptRef.current.key,
        ...authorityFenceFields(readSchoolAuthorityFence()),
      });
    },
    onSuccess: (result) => {
      paymentAttemptRef.current = null;
      setQueuedIntent(null);
      setLastReceipt(result);
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (studentCollectionContext?.student.id) {
        void queryClient.invalidateQueries({
          queryKey: [
            "student-collection-context",
            studentCollectionContext.student.id,
          ],
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["receipts"] });
      void queryClient.invalidateQueries({ queryKey: ["ledger-entries"] });
      // Keep the header KPIs (collected today, receipts issued, close state)
      // honest right after a collection instead of waiting for a reload.
      void queryClient.invalidateQueries({
        queryKey: ["finance-dashboard-summary"],
      });
    },
    onError: async (error, payload) => {
      if (!(error instanceof OfflineMutationError)) {
        return;
      }
      if (!session?.tenant.id || !session.user.id || !paymentAttemptRef.current) {
        return;
      }
      await upsertOfflineModuleDraft({
        module: "fees",
        operationId: paymentAttemptRef.current.key,
        tenantId: session.tenant.id,
        userId: session.user.id,
        status: "queued",
        savedAt: new Date().toISOString(),
        payload: {
          ...payload,
          idempotencyKey: paymentAttemptRef.current.key,
        },
      });
      setQueuedIntent(
        "Payment intent queued. It is not collected, issued, or fiscally confirmed. Reconnect to submit this same intent.",
      );
    },
  });

  const receiptBannerRef = useRef<HTMLDivElement>(null);
  const paymentErrorRef = useRef<HTMLDivElement>(null);

  // The dashboard scrolls inside #dashboard-main, not the window, so bring
  // the payment outcome (receipt or failure) into view explicitly — the
  // cashier is otherwise left looking at the bottom of the form.
  useEffect(() => {
    if (!lastReceipt) return;
    receiptBannerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [lastReceipt]);

  useEffect(() => {
    if (!paymentMutation.isError) return;
    paymentErrorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [paymentMutation.isError]);

  useEffect(() => {
    const drain = async () => {
      if (
        typeof navigator === "undefined" ||
        navigator.onLine === false ||
        !session?.tenant.id ||
        !session.user.id
      ) {
        return;
      }
      const drafts = await listOfflineModuleDrafts("fees", {
        tenantId: session.tenant.id,
        userId: session.user.id,
      });
      for (const draft of drafts) {
        if (draft.status !== "queued") continue;
        try {
          await api.collectPayment(draft.payload);
          await deleteOfflineModuleDraft("fees", draft.operationId);
        } catch {
          // Keep queued; never treat a local intent as collected.
        }
      }
    };
    const handleOnline = () => {
      void drain();
    };
    window.addEventListener("online", handleOnline);
    void drain();
    return () => window.removeEventListener("online", handleOnline);
  }, [session?.tenant.id, session?.user.id]);

  const visibleInvoices = isStudentContextMode
    ? (studentCollectionContext?.invoices ?? [])
    : invoices;

  const handleOpenReceipt = async () => {
    if (!lastReceipt?.receiptNumber) return;
    setReceiptError(null);
    try {
      await api.openReceiptPdf(lastReceipt.receiptNumber);
    } catch (error) {
      setReceiptError(
        error instanceof Error
          ? error.message
          : "The protected receipt is temporarily unavailable.",
      );
    }
  };

  if (isError) {
    return (
      <ErrorState
        title="Fee invoices could not load"
        message="The collection counter is unavailable right now. No payment has been recorded."
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="space-y-8">
      {lastReceipt && (
        <div
          ref={receiptBannerRef}
          className="animate-in slide-in-from-top-4 flex items-center justify-between rounded-xl border border-success-100 bg-success-50 p-6 shadow-sm duration-500"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-500 text-white shadow-lg shadow-success-500/20">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight text-success-900">
                Payment collected
              </p>
              <p className="mt-0.5 text-sm font-semibold text-success-800 tabular-nums">
                {lastReceipt.disposition === "REPLAYED"
                  ? `Safely replayed · ${lastReceipt.receiptNumber ? `Receipt ${lastReceipt.receiptNumber}` : "Receipt pending"} · ${lastReceipt.method} · NPR ${formatMoney(lastReceipt.amount)}`
                  : `${lastReceipt.receiptNumber ? `Receipt ${lastReceipt.receiptNumber}` : "Receipt pending"} · ${lastReceipt.method} · NPR ${formatMoney(lastReceipt.amount)}`}
              </p>
              {lastReceipt.receiptFileStatus !== "AVAILABLE" ? (
                <p className="mt-1 text-xs font-semibold text-warning-700">
                  Payment succeeded. The protected PDF will be generated when
                  opened.
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenReceipt}
              className="flex items-center gap-2 rounded-xl border-success-100 bg-white px-6 py-3 text-xs font-bold text-success-700 shadow-sm hover:bg-success-100"
            >
              <Printer size={16} />
              Open protected receipt
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setLastReceipt(null)}
              className="text-success-400 hover:bg-success-100/50 hover:text-success-600"
              aria-label="Collect another payment"
            >
              <X size={20} />
            </Button>
          </div>
        </div>
      )}

      {receiptError ? (
        <div
          className="flex items-center gap-3 rounded-xl border border-warning-100 bg-warning-50 p-4 text-sm font-bold text-warning-800"
          role="alert"
        >
          <AlertCircle size={20} />
          {receiptError}
        </div>
      ) : null}

      {queuedIntent ? (
        <div
          role="status"
          className="flex items-center gap-4 rounded-xl border border-warning-100 bg-warning-50 p-6 text-sm font-semibold text-warning-900"
        >
          <AlertCircle size={24} className="text-warning-700" />
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-widest text-warning-800">
              Queued · pending connectivity
            </p>
            <p className="mt-1">{queuedIntent}</p>
          </div>
        </div>
      ) : null}

      {paymentMutation.isError &&
        !(paymentMutation.error instanceof OfflineMutationError) && (
        <div
          ref={paymentErrorRef}
          className="animate-fade-in flex items-center gap-4 rounded-xl border border-danger-100 bg-danger-50 p-6 text-sm font-bold text-danger-800"
        >
          <AlertCircle size={24} className="text-danger-500" />
          <div className="flex flex-col">
            <span className="text-[0.65rem] uppercase tracking-widest text-danger-600 mb-1">
              Payment Failed
            </span>
            {getErrorMessage(paymentMutation.error)}
          </div>
        </div>
      )}

      {!canCollect ? (
        <PermissionDenied
          showNavigation={false}
          title="Payment collection is restricted"
          description="Your current role does not have the finance permission required to record fee payments."
        />
      ) : (
        <CollectionCounter
          onSearch={onSearchChange ?? (() => undefined)}
          searchQuery={searchQuery}
          invoices={visibleInvoices}
          isLoading={isLoading}
          isSubmitting={paymentMutation.isPending}
          initialInvoiceId={initialInvoiceId}
          studentContext={studentCollectionContext?.student ?? null}
          isStudentProfileSource={isStudentProfileSource}
          onChangeStudent={onChangeStudent}
          disableSearch={isStudentContextMode}
          page={page}
          limit={limit}
          total={isStudentContextMode ? visibleInvoices.length : total}
          onPageChange={onPageChange}
          onCollect={(invoiceId, amount, method, reference, remarks) => {
            setLastReceipt(null);
            paymentMutation.mutate({
              invoiceId,
              amount,
              method,
              referenceNumber: reference || undefined,
              narration: remarks || `Counter collection via Finance Dashboard`,
            });
          }}
        />
      )}
    </div>
  );
}
