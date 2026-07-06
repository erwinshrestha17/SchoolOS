"use client";

import React, { useEffect, useRef, useState } from "react";
import { CollectionCounter } from "./collection-counter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CollectedPaymentResult } from "@/lib/api/finance";
import type { InvoiceSummary, StudentCollectionContext } from "@schoolos/core";
import { CheckCircle2, AlertCircle, Printer, X } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";

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
  amount: number;
  method: string;
  referenceNumber?: string;
  narration: string;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Payment could not be recorded. Please retry.";

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
  const queryClient = useQueryClient();
  const [lastReceipt, setLastReceipt] = useState<CollectedPaymentResult | null>(
    null,
  );
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
      });
    },
    onSuccess: (result) => {
      paymentAttemptRef.current = null;
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
                Payment collected successfully
              </p>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-success-700">
                {lastReceipt.disposition === "REPLAYED"
                  ? `Existing payment returned safely · Receipt #${lastReceipt.receiptNumber}`
                  : `Receipt #${lastReceipt.receiptNumber} confirmed`}
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
            <button
              onClick={handleOpenReceipt}
              className="flex items-center gap-2 rounded-xl border border-success-100 bg-white px-6 py-3 text-xs font-bold text-success-700 shadow-sm transition-all hover:bg-success-100 active:scale-95"
            >
              <Printer size={16} />
              Open Receipt
            </button>
            <button
              onClick={() => setLastReceipt(null)}
              className="p-3 text-success-400 transition-colors hover:text-success-600"
              aria-label="Dismiss receipt success message"
            >
              <X size={20} />
            </button>
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

      {paymentMutation.isError && (
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
    </div>
  );
}
