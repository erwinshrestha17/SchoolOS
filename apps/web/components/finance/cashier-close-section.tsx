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
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatBsDateTime, getNepalSchoolDay } from "@schoolos/core";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/ui/permission-denied";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/components/session-provider";

export function CashierCloseSection() {
  const { hasPermissions } = useSession();
  const canClose = hasPermissions(["payments:close"]);
  const canManageDeposits = hasPermissions([
    "payments:close",
    "accounting:reconciliation:manage",
    "accounting:journals:post",
  ]);
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
  const [depositAccountId, setDepositAccountId] = useState("");
  const [depositReference, setDepositReference] = useState("");
  const [depositReason, setDepositReason] = useState("");
  const [depositIdempotencyKey, setDepositIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  const schoolDay = getNepalSchoolDay();
  const openedAt = schoolDay.startUtc;
  const closedAt =
    new Date() < schoolDay.endExclusiveUtc
      ? new Date()
      : schoolDay.endExclusiveUtc;

  const closesQuery = useQuery({
    queryKey: ["cashier-closes", closePage],
    queryFn: () => api.listCashierClosesPage({ page: closePage, limit: 10 }),
  });
  const depositAccountsQuery = useQuery({
    queryKey: ["chart-accounts", "cash-deposit"],
    queryFn: () => api.listChartAccounts(),
    enabled: canManageDeposits,
  });
  const depositsQuery = useQuery({
    queryKey: ["cash-deposits"],
    queryFn: () => api.listCashDeposits({ page: 1, limit: 25 }),
    enabled: canManageDeposits,
  });

  const activeSession = closesQuery.data?.items.find((close) =>
    ["OPEN", "COUNTED", "SUBMITTED", "APPROVED"].includes(close.status),
  );
  const sessionOpenedAt = activeSession
    ? new Date(activeSession.openedAt)
    : openedAt;

  const previewQuery = useQuery({
    queryKey: ["cashier-close-preview", sessionOpenedAt.toISOString()],
    queryFn: () =>
      api.previewCashierClose({
        openedAt: sessionOpenedAt.toISOString(),
        closedAt: closedAt.toISOString(),
      }),
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const reason = remarks.trim();
      if (!activeSession) {
        return api.openCashierClose({
          openedAt: openedAt.toISOString(),
          notes: reason || null,
        });
      }
      if (activeSession.status === "OPEN") {
        return api.countCashierClose(activeSession.id, {
          countedThroughAt: closedAt.toISOString(),
          actualCashAmount: Number(actualCashAmount).toFixed(2),
          varianceReason: hasVariance ? reason : null,
        });
      }
      if (activeSession.status === "COUNTED") {
        return api.submitCashierClose(activeSession.id, reason);
      }
      if (activeSession.status === "SUBMITTED") {
        return api.approveCashierClose(activeSession.id, reason);
      }
      return api.closeCashierClose(activeSession.id, reason);
    },
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
  const depositCandidate = closesQuery.data?.items.find(
    (close) => close.status === "CLOSED",
  );
  const currentDeposit = depositCandidate
    ? depositsQuery.data?.items.find(
        (deposit) => deposit.cashierCloseId === depositCandidate.id,
      )
    : undefined;
  const depositMutation = useMutation({
    mutationFn: async () => {
      if (!depositCandidate) {
        throw new Error("No closed cashier session is ready for deposit.");
      }
      if (!currentDeposit) {
        if (!depositAccountId) {
          throw new Error("Select the destination account for this deposit.");
        }
        return api.prepareCashDeposit({
          cashierCloseId: depositCandidate.id,
          accountId: depositAccountId,
          referenceNumber: depositReference.trim() || undefined,
          idempotencyKey: depositIdempotencyKey,
        });
      }
      if (currentDeposit.status === "DRAFT") {
        return api.submitCashDeposit(currentDeposit.id, depositReason.trim());
      }
      if (currentDeposit.status === "SUBMITTED") {
        return api.completeCashDeposit(currentDeposit.id, depositReason.trim());
      }
      return currentDeposit;
    },
    onSuccess: (deposit) => {
      void queryClient.invalidateQueries({ queryKey: ["cash-deposits"] });
      void queryClient.invalidateQueries({ queryKey: ["cashier-closes"] });
      if (deposit.status === "DEPOSITED") {
        setDepositAccountId("");
        setDepositReference("");
        setDepositIdempotencyKey(crypto.randomUUID());
      }
      setDepositReason("");
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

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
      maximumFractionDigits: 0,
    }).format(Number(amount));
  };

  const methodIcons: Record<string, React.ReactNode> = {
    CASH: <Banknote size={16} />,
    BANK: <CreditCard size={16} />,
    TRANSFER: <History size={16} />,
    MOBILE: <CreditCard size={16} />,
  };
  const depositAccounts =
    depositAccountsQuery.data?.filter(
      (account) =>
        account.type === "ASSET" &&
        account.isActive !== false &&
        account.code !== "1010",
    ) ?? [];
  const expectedCashAmount = Number(preview?.expectedCashAmount ?? 0);
  const countedCashAmount =
    actualCashAmount === "" ? null : Number(actualCashAmount);
  const hasVariance =
    countedCashAmount !== null &&
    Math.abs(countedCashAmount - expectedCashAmount) > 0.001;
  const requiresReason = Boolean(
    activeSession && activeSession.status !== "OPEN",
  );
  const closeDisabled =
    closeMutation.isPending ||
    (activeSession?.status === "OPEN" &&
      (countedCashAmount === null || countedCashAmount < 0)) ||
    (activeSession?.status === "OPEN" &&
      hasVariance &&
      remarks.trim().length < 5) ||
    (requiresReason && remarks.trim().length < 5);
  const lifecycleActionLabel = !activeSession
    ? "Open cashier session"
    : activeSession.status === "OPEN"
      ? "Record counted cash"
      : activeSession.status === "COUNTED"
        ? "Submit for approval"
        : activeSession.status === "SUBMITTED"
          ? "Approve cashier count"
          : "Close approved session";
  const depositActionLabel = !currentDeposit
    ? "Prepare deposit"
    : currentDeposit.status === "DRAFT"
      ? "Submit deposit"
      : currentDeposit.status === "SUBMITTED"
        ? "Confirm deposited and post"
        : "Deposit completed";
  const depositActionDisabled =
    depositMutation.isPending ||
    !depositCandidate ||
    (!currentDeposit && !depositAccountId) ||
    (Boolean(currentDeposit) &&
      currentDeposit?.status !== "DEPOSITED" &&
      depositReason.trim().length < 5) ||
    currentDeposit?.status === "DEPOSITED";

  return (
    <div className="space-y-8 animate-fade-in">
      <ol
        className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4"
        aria-label="Cashier close steps"
      >
        {["Open", "Count", "Submit", "Approve and close"].map(
          (label, index) => (
            <li
              key={label}
              className="flex min-h-14 items-center gap-3 bg-white px-4 text-sm font-semibold text-slate-700"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-mod-fees-bg)] text-xs font-bold text-[var(--color-mod-fees-text)]">
                {index + 1}
              </span>
              {label}
            </li>
          ),
        )}
      </ol>

      <div className="grid gap-6 md:grid-cols-3">
        <CollectionStat
          label="Total Collection"
          value={formatCurrency(preview?.netCollected ?? "0.00")}
          sub={`${preview?.paymentCount ?? 0} Transactions`}
          icon={<Wallet size={20} />}
          color="emerald"
        />
        <CollectionStat
          label="Cash in Hand"
          value={formatCurrency(preview?.expectedCashAmount ?? "0.00")}
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
              {preview?.byMethod?.map((m) => (
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
                {preview?.byUser?.map((u) => (
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
          description="Move the cashier session through count, submission, independent approval, and closure."
        >
          {!canClose ? (
            <PermissionDenied
              showNavigation={false}
              title="Cashier close is restricted"
              description="Your current role does not have the finance permission required to finalize a school-day cashier close."
            />
          ) : (
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
                      ((countedCashAmount ?? 0) - expectedCashAmount).toFixed(
                        2,
                      ),
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

              <Button
                type="button"
                onClick={() => setIsConfirmingClose(true)}
                disabled={closeDisabled}
                className="flex w-full items-center justify-center gap-3 rounded-xl py-4 text-sm font-black !bg-[var(--color-mod-fees-accent)] text-white shadow-sm hover:!bg-[var(--color-mod-fees-text)]"
              >
                {closeMutation.isPending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={20} />
                )}
                {lifecycleActionLabel}
              </Button>

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
          )}
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
                    {close.closedAt
                      ? formatBsDateTime(close.closedAt)
                      : "Session open"}
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={closePage <= 1}
                  onClick={() => updateClosePage(closePage - 1)}
                  className="rounded-lg px-3 py-2"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!closesQuery.data.hasNextPage}
                  onClick={() => updateClosePage(closePage + 1)}
                  className="rounded-lg px-3 py-2"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm font-semibold text-slate-500">
            No finalized cashier closes were found.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Deposit preparation"
        description="Keep cashier closure, physical deposit, M11 posting, and later bank reconciliation as separate recorded states."
      >
        {!canManageDeposits ? (
          <PermissionDenied
            showNavigation={false}
            title="Deposit preparation is restricted"
            description="A designated Accountant with cash-control and journal-posting permissions must prepare and complete deposits."
          />
        ) : depositsQuery.isLoading || depositAccountsQuery.isLoading ? (
          <LoadingState label="Loading deposit controls..." />
        ) : depositsQuery.isError || depositAccountsQuery.isError ? (
          <ErrorState
            title="Deposit controls could not load"
            message="No deposit state was changed. Retry after checking the accounting setup."
            onRetry={() => {
              void depositsQuery.refetch();
              void depositAccountsQuery.refetch();
            }}
          />
        ) : !depositCandidate ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
            No closed, undeposited cashier session is ready. Complete the
            independent cashier-close approval first.
          </div>
        ) : (
          <div className="space-y-5">
            <div
              className="grid gap-3 sm:grid-cols-4"
              aria-label="Cash deposit status"
            >
              {["Closed", "Prepared", "Submitted", "Deposited and posted"].map(
                (label, index) => {
                  const completedStep = currentDeposit
                    ? currentDeposit.status === "DEPOSITED"
                      ? 3
                      : currentDeposit.status === "SUBMITTED"
                        ? 2
                        : 1
                    : 0;
                  return (
                    <div
                      key={label}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-xs font-bold",
                        index <= completedStep
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-500",
                      )}
                    >
                      {label}
                    </div>
                  );
                },
              )}
            </div>

            <div className="grid gap-4 rounded-xl border border-slate-200 p-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Cashier close
                </p>
                <p className="mt-1 text-sm font-black text-slate-950">
                  {depositCandidate.closeNumber}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Counted cash:{" "}
                  {formatCurrency(
                    depositCandidate.actualCashAmount ??
                      depositCandidate.expectedCashAmount,
                  )}
                </p>
              </div>
              {currentDeposit ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Deposit record
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {currentDeposit.depositNumber}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {currentDeposit.accountCode} {currentDeposit.accountName} ·{" "}
                    {formatBsDateTime(currentDeposit.depositDate)}
                  </p>
                </div>
              ) : null}
            </div>

            {!currentDeposit ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-xs font-bold text-slate-600">
                  Destination account
                  <select
                    value={depositAccountId}
                    onChange={(event) =>
                      setDepositAccountId(event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  >
                    <option value="">Select bank or deposit account</option>
                    {depositAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} — {account.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-xs font-bold text-slate-600">
                  Bank reference (optional)
                  <input
                    value={depositReference}
                    onChange={(event) =>
                      setDepositReference(event.target.value)
                    }
                    maxLength={120}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
                    placeholder="Slip or bank reference"
                  />
                </label>
              </div>
            ) : currentDeposit.status !== "DEPOSITED" ? (
              <label className="space-y-2 text-xs font-bold text-slate-600">
                {currentDeposit.status === "DRAFT"
                  ? "Submission reason"
                  : "Deposit confirmation reason"}
                <textarea
                  value={depositReason}
                  onChange={(event) => setDepositReason(event.target.value)}
                  className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-900"
                  placeholder="Required for the financial audit trail"
                />
              </label>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <Landmark className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">Deposit completed</p>
                  <p className="mt-1 text-xs">
                    The cashier session is deposited and linked to journal{" "}
                    {currentDeposit.journalEntryId ?? "record unavailable"}.
                    Bank reconciliation remains a separate M11 step.
                  </p>
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={() => depositMutation.mutate()}
              disabled={depositActionDisabled}
              className="gap-2 rounded-xl"
            >
              {depositMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Landmark className="h-4 w-4" />
              )}
              {depositActionLabel}
            </Button>
            {depositMutation.isError ? (
              <p className="text-sm font-semibold text-danger-700" role="alert">
                {depositMutation.error instanceof Error
                  ? depositMutation.error.message
                  : "The deposit state was not changed."}
              </p>
            ) : null}
          </div>
        )}
      </SectionCard>

      <Dialog open={isConfirmingClose} onOpenChange={setIsConfirmingClose}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm cashier close action</DialogTitle>
            <DialogDescription>
              {lifecycleActionLabel} for this Nepal school-day window. Every
              transition is recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-xl border border-warning-100 bg-warning-50 p-4 text-sm text-warning-900">
            <p>
              Expected cash: {formatCurrency(expectedCashAmount.toFixed(2))}
            </p>
            <p>
              Counted cash:{" "}
              {countedCashAmount === null
                ? "Not entered"
                : formatCurrency(countedCashAmount.toFixed(2))}
            </p>
            <p>
              Net collection: {formatCurrency(preview?.netCollected ?? "0.00")}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsConfirmingClose(false)}
              className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600"
            >
              Review again
            </Button>
            <Button
              type="button"
              disabled={closeDisabled}
              onClick={() => closeMutation.mutate()}
              className="rounded-xl !bg-[var(--color-mod-fees-accent)] px-4 py-2 text-sm font-bold text-white hover:!bg-[var(--color-mod-fees-text)]"
            >
              {lifecycleActionLabel}
            </Button>
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
