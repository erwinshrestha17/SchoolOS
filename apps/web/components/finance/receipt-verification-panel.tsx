"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  QrCode,
  Search,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ReceiptVerificationResult } from "@/lib/api/finance";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { formatBsDateTime } from "@schoolos/core";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 0,
  }).format(amount);

const formatDateTime = (value: string) => formatBsDateTime(value);

export function ReceiptVerificationPanel() {
  const [receiptNumber, setReceiptNumber] = useState("");
  const verifyMutation = useMutation({
    mutationFn: (value: string) => api.verifyReceipt(value),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = receiptNumber.trim();

    if (!value) return;

    verifyMutation.mutate(value);
  };

  return (
    <SectionCard
      title="Receipt QR Verification"
      description="Confirm receipt authenticity against tenant-scoped payment records."
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form onSubmit={submit} className="space-y-3">
          <label className="ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            Receipt number
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <QrCode
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                value={receiptNumber}
                onChange={(event) => setReceiptNumber(event.target.value)}
                placeholder="REC-2026-00001"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-bold text-slate-700 outline-none transition focus:border-[var(--color-mod-fees-accent)] focus:ring-2 focus:ring-[var(--color-mod-fees-accent)]/10"
              />
            </div>
            <Button
              type="submit"
              disabled={!receiptNumber.trim() || verifyMutation.isPending}
              className="h-11 rounded-xl bg-[var(--color-mod-fees-accent)] px-5 font-bold text-white hover:bg-[var(--color-mod-fees-text)]"
            >
              {verifyMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Search size={16} />
              )}
              Verify
            </Button>
          </div>
          {verifyMutation.isError && (
            <div className="flex items-start gap-2 rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-xs font-bold text-danger-600">
              <XCircle size={14} className="mt-0.5 shrink-0" />
              <span>
                {verifyMutation.error instanceof Error
                  ? verifyMutation.error.message
                  : "Receipt could not be verified."}
              </span>
            </div>
          )}
        </form>

        <VerificationResult result={verifyMutation.data} />
      </div>
    </SectionCard>
  );
}

function VerificationResult({
  result,
}: {
  result: ReceiptVerificationResult | undefined;
}) {
  if (!result) {
    return (
      <div className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
        <p className="max-w-sm text-xs font-semibold text-slate-500">
          Verified receipt details will appear here after lookup.
        </p>
      </div>
    );
  }

  const valid =
    result.status === "VALID" || result.status === "PARTIALLY_REFUNDED";

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        valid
          ? "border-success-100 bg-success-50/40"
          : "border-warning-100 bg-warning-50/50",
      )}
      data-testid="receipt-verification-result"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {valid ? (
            <CheckCircle2 size={18} className="text-success-600" />
          ) : (
            <AlertTriangle size={18} className="text-warning-600" />
          )}
          <div>
            <p className="text-sm font-black text-slate-900">
              {result.receipt.receiptNumber}
            </p>
            <p className="text-[11px] font-bold text-slate-500">
              Issued {formatDateTime(result.receipt.issuedAt)}
            </p>
          </div>
        </div>
        <StatusBadge status={result.status} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <VerificationField label="School" value={result.school.name} />
        <VerificationField
          label="Student"
          value={`${result.student.name} (${result.student.studentSystemId})`}
        />
        <VerificationField
          label="Invoice"
          value={result.invoice.invoiceNumber}
        />
        <VerificationField label="Method" value={result.payment.method} />
        <VerificationField
          label="Paid amount"
          value={formatCurrency(result.payment.amount)}
        />
        <VerificationField
          label="Net amount"
          value={formatCurrency(result.payment.netAmount)}
        />
      </div>

      {result.warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {result.warnings.map((warning) => (
            <div
              key={warning}
              className="rounded-xl border border-warning-100 bg-white/70 px-3 py-2 text-xs font-bold text-warning-700"
            >
              {warning}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VerificationField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/75 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-bold text-slate-700">{value}</p>
    </div>
  );
}
