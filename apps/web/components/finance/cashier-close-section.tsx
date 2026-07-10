"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SectionCard } from "@/components/ui/section-card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ProtectedFileLink } from "@/components/ui/protected-file";
import {
  Wallet,
  CheckCircle2,
  AlertCircle,
  Banknote,
  CreditCard,
  History,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatBsDateTime, getNepalSchoolDay } from "@schoolos/core";
import { ErrorState } from "@/components/ui/error-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CashierCloseSection() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const closePage = Math.max(
    1,
    Number(searchParams.get("closePage") ?? "1") || 1,
  );
  const [remarks, setRemarks] = useState("");
  const [actualCashAmount, setActualCashAmount] = useState("");
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);
  const [closePdfError, setClosePdfError] = useState<string | null>(null);

  const schoolDay = getNepalSchoolDay();
  const openedAt = schoolDay.startUtc;
  const closedAt =
    new Date() < schoolDay.endExclusiveUtc
      ? new Date()
      : schoolDay.endExclusiveUtc;

  const previewQuery = useQuery({
    queryKey: ["cashier-close-preview"],
    queryFn: () =>
      api.previewCashierClose({
        openedAt: openedAt.toISOString(),
        closedAt: closedAt.toISOString(),
      }),
  });

  const closesQuery = useQuery({
    queryKey: ["cashier-closes", closePage],
    queryFn: () => api.listCashierClosesPage({ page: closePage, limit: 10 }),
  });

  const closeMutation = useMutation({
    mutationFn: (body: any) => api.finalizeCashierClose(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cashier-closes"] });
      void queryClient.invalidateQueries({
        queryKey: ["cashier-close-preview"],
      });
      setRemarks("");
      setActualCashAmount("");
      setIsConfirmingClose(false);
      void queryClient.invalidateQueries({
        queryKey: ["finance-dashboard-summary"],
      });
    },
  });

  if (previewQuery.isLoading)
    return (
      <LoadingState
        variant="page"
        label="Calculating daily collection totals..."
      />
    );
  if (previewQuery.isError) {
    return (
      <ErrorState
        title="Cashier close totals could not load"
        message="No close was recorded. Retry after checking your finance permission and connection."
        onRetry={() => void previewQuery.refetch()}
      />
    );
  }

  const preview = previewQuery.data;
  const latestCloseWithPdf = closeMutation.data?.closePdfFile
    ? closeMutation.data
    : closesQuery.data?.items.find((close) => close.closePdfFile);
  const updateClosePage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("closePage");
    else params.set("closePage", String(page));
    router.replace(`${pathname}?${params.toString()}`, {
      scroll: false,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const methodIcons: Record<string, any> = {
    CASH: <Banknote size={16} />,
    BANK: <CreditCard size={16} />,
    TRANSFER: <History size={16} />,
    MOBILE: <CreditCard size={16} />,
  };
  const closeDisabled =
    closeMutation.isPending ||
    (preview?.totalCollected || 0) === 0 ||
    remarks.trim().length < 5 ||
    ((preview?.expectedCashAmount ?? 0) > 0 &&
      (!actualCashAmount || Number(actualCashAmount) < 0));
  const expectedCashAmount = preview?.expectedCashAmount ?? 0;
  const countedCashAmount =
    actualCashAmount === "" ? null : Number(actualCashAmount);
  const hasVariance =
    countedCashAmount !== null &&
    Math.abs(countedCashAmount - expectedCashAmount) > 0.001;

  return (
    <div className="space-y-8 animate-fade-in">
      <ol className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4" aria-label="Cashier close steps">
        {[
          "Review backend totals",
          "Enter counted values",
          "Explain variance",
          "Confirm immutable close",
        ].map((label, index) => (
          <li key={label} className="flex min-h-14 items-center gap-3 bg-white px-4 text-sm font-semibold text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-mod-fees-bg)] text-xs font-bold text-[var(--color-mod-fees-text)]">
              {index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 md:grid-cols-3">
        <CollectionStat
          label="Total Collection"
          value={formatCurrency(
            preview?.netCollected ?? preview?.totalCollected ?? 0,
          )}
          sub={`${preview?.paymentCount ?? preview?.transactionCount ?? 0} Transactions`}
          icon={<Wallet size={20} />}
          color="emerald"
        />
        <CollectionStat
          label="Cash in Hand"
          value={formatCurrency(preview?.expectedCashAmount ?? 0)}
          sub="Physical Handover"
          icon={<Banknote size={20} />}
          color="primary"
        />
        <CollectionStat
          label="Bank / Digital"
          value="See breakdown"
          sub="Backend method totals below"
          icon={<CreditCard size={20} />}
          color="amber"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <SectionCard
          title="Daily Collection Summary"
          description={`${formatBsDateTime(openedAt)} to ${formatBsDateTime(closedAt)}`}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {preview?.byMethod?.map((m: any) => (
                <div
                  key={m.method}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:border-slate-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center">
                      {methodIcons[m.method] || <CreditCard size={16} />}
                    </div>
                    <div>
                      <p className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">
                        {m.method}
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {m.count} Payments
                      </p>
                    </div>
                  </div>
                  <p className="text-lg font-black text-slate-900 tracking-tighter">
                    {formatCurrency(m.amount)}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-[var(--color-mod-fees-bg)] border border-[var(--color-mod-fees-border)] p-6 text-[var(--color-mod-fees-text)]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[0.65rem] font-black text-[var(--color-mod-fees-text)] uppercase tracking-[0.2em]">
                  Collector Breakdown
                </p>
                <Badge
                  variant="phase2"
                  className="border-none bg-[var(--color-mod-fees-soft)] text-[var(--color-mod-fees-text)]"
                >
                  Active Counter
                </Badge>
              </div>
              <div className="space-y-4">
                {preview?.byUser?.map((u: any) => (
                  <div
                    key={u.userId}
                    className="flex items-center justify-between py-2 border-b border-[var(--color-mod-fees-border)] last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-[0.65rem] font-bold">
                        {u.userName?.slice(0, 2).toUpperCase() || "CO"}
                      </div>
                      <span className="text-sm font-bold">
                        {u.userName || "Collector not recorded"}
                      </span>
                    </div>
                    <span className="text-sm font-black text-[var(--color-mod-fees-accent)]">
                      {formatCurrency(u.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Counter Handover"
          description="Finalize today's collection and hand over to accounting."
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-1">
                Counted cash amount
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={actualCashAmount}
                onChange={(event) => setActualCashAmount(event.target.value)}
                onWheel={(event) => event.currentTarget.blur()}
                placeholder={`Expected ${expectedCashAmount.toFixed(2)}`}
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold"
              />
              {hasVariance ? (
                <p className="text-xs font-semibold text-warning-700">
                  Variance:{" "}
                  {formatCurrency(
                    (countedCashAmount ?? 0) - expectedCashAmount,
                  )}
                  . Explain it in the handover remarks.
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-1">
                Handover Remarks
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Required handover reason or cash variance note"
                className="min-h-[120px] w-full resize-none rounded-xl border-slate-100 bg-slate-50/50 p-4 text-sm font-medium transition-all focus:bg-white focus:ring-2 focus:ring-[var(--color-mod-fees-border)]"
              />
              <p className="text-[0.7rem] font-semibold text-slate-500">
                Required for the day-end audit trail.
              </p>
            </div>

            <div className="p-5 bg-warning-50 border border-warning-100 rounded-2xl flex gap-3 text-warning-800">
              <AlertCircle size={20} className="shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-tight">
                  Financial Safeguard
                </p>
                <p className="text-[0.7rem] font-medium leading-relaxed opacity-80">
                  Closing the cashier will lock all transactions within this
                  window. Ensure physical cash matches the total above.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsConfirmingClose(true)}
              disabled={closeDisabled}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-[var(--color-mod-fees-accent)] py-4 text-sm font-black text-white shadow-sm transition-all hover:bg-[var(--color-mod-fees-text)] active:scale-95 disabled:opacity-50"
            >
              {closeMutation.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <CheckCircle2 size={20} />
              )}
              Close Counter & Handover
            </button>

            {closeMutation.isError ? (
              <div
                className="flex items-start gap-2 rounded-xl border border-danger-100 bg-danger-50 p-3 text-xs font-bold text-danger-700"
                role="alert"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {closeMutation.error instanceof Error
                  ? closeMutation.error.message
                  : "The cashier close was not recorded. It may already be closed or require corrected inputs."}
              </div>
            ) : null}

            {closePdfError ? (
              <div className="flex items-center gap-2 rounded-2xl border border-danger-100 bg-danger-50 p-3 text-[0.7rem] font-bold text-danger-700">
                <AlertCircle size={14} />
                {closePdfError}
              </div>
            ) : null}

            {latestCloseWithPdf ? (
              <ProtectedFileLink
                fileAssetId={latestCloseWithPdf.closePdfFile?.fileAssetId}
                fileName={latestCloseWithPdf.closePdfFile?.fileName}
                action="preview"
                label="Open Close Report PDF"
                data-testid="finance-day-end-close-pdf-open"
                className="w-full justify-center py-3 text-[0.65rem] font-black uppercase tracking-widest text-slate-500 no-underline hover:text-slate-900"
                statusClassName="text-center"
                onSuccess={() => setClosePdfError(null)}
                onError={(message) => setClosePdfError(message)}
              />
            ) : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Finalized Cashier Closes"
        description="Backend-recorded immutable close sessions for this tenant."
      >
        {closesQuery.isLoading ? (
          <LoadingState label="Loading cashier close history..." />
        ) : closesQuery.isError ? (
          <ErrorState
            title="Cashier close history could not load"
            message="No close state was changed."
            onRetry={() => void closesQuery.refetch()}
          />
        ) : closesQuery.data?.items.length ? (
          <div className="space-y-3">
            {closesQuery.data.items.map((close) => (
              <div
                key={close.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {close.closeNumber}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {formatBsDateTime(close.openedAt)} to{" "}
                    {formatBsDateTime(close.closedAt)}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-black text-slate-900">
                    {formatCurrency(close.netCollected)}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    {close.paymentCount} payments · {close.refundCount} refunds
                  </p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 text-xs font-bold text-slate-500">
              <span>
                {Math.min(
                  (closePage - 1) * closesQuery.data.limit + 1,
                  closesQuery.data.total,
                )}
                –
                {Math.min(
                  closePage * closesQuery.data.limit,
                  closesQuery.data.total,
                )}{" "}
                of {closesQuery.data.total}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={closePage <= 1}
                  onClick={() => updateClosePage(closePage - 1)}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!closesQuery.data.hasNextPage}
                  onClick={() => updateClosePage(closePage + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm font-semibold text-slate-500">
            No finalized cashier closes were found.
          </p>
        )}
      </SectionCard>

      <Dialog open={isConfirmingClose} onOpenChange={setIsConfirmingClose}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm cashier close</DialogTitle>
            <DialogDescription>
              Finalize the backend reconciliation for this Nepal school-day
              window. A finalized close cannot be reopened or silently edited.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-xl border border-warning-100 bg-warning-50 p-4 text-sm text-warning-900">
            <p>Expected cash: {formatCurrency(expectedCashAmount)}</p>
            <p>
              Counted cash:{" "}
              {countedCashAmount === null
                ? "Not entered"
                : formatCurrency(countedCashAmount)}
            </p>
            <p>Net collection: {formatCurrency(preview?.netCollected ?? 0)}</p>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setIsConfirmingClose(false)}
              className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600"
            >
              Review again
            </button>
            <button
              type="button"
              disabled={closeDisabled}
              onClick={() =>
                closeMutation.mutate({
                  openedAt: openedAt.toISOString(),
                  closedAt: closedAt.toISOString(),
                  actualCashAmount: countedCashAmount,
                  varianceReason: hasVariance ? remarks.trim() : null,
                  notes: remarks.trim(),
                })
              }
              className="rounded-xl bg-[var(--color-mod-fees-accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Finalize immutable close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CollectionStat({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: "emerald" | "primary" | "amber";
}) {
  const colorMap = {
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    primary:
      "text-[var(--color-mod-fees-accent)] bg-[var(--color-mod-fees-bg)] border-[var(--color-mod-fees-border)]",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-5 rounded-xl border bg-white p-6 shadow-sm",
        colorMap[color],
      )}
    >
      <div
        className={cn(
          "h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner",
          colorMap[color].split(" ")[1],
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-[0.65rem] font-black uppercase tracking-widest opacity-60">
          {label}
        </p>
        <p className="text-2xl font-black tracking-tighter mt-0.5 text-slate-900">
          {value}
        </p>
        <p className="text-[0.65rem] font-bold text-slate-500 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
