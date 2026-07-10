"use client";

import {
  formatBsDate,
  formatBsDateForInput,
  formatBsDateTime,
  toGregorianDateFromBs,
} from "@schoolos/core";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DefaulterAgingSummary } from "@/components/finance/defaulter-aging-summary";
import { DefaulterQueueTab } from "@/components/finance/defaulter-queue-tab";
import { DuesAnalysisSection } from "@/components/finance/dues-analysis-section";
import { LedgerSection } from "@/components/finance/ledger-section";
import { useSession } from "@/components/session-provider";
import { BsDateField } from "@/components/ui/bs-date-field";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";

type ReportKey =
  | "collections"
  | "dues"
  | "aging"
  | "payment-methods"
  | "cashier-closes"
  | "adjustments"
  | "receipts";

const formatCurrency = (amount: string | number) =>
  new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));

export function FinanceReportWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermissions } = useSession();
  const reportOptions = useMemo(
    () =>
      [
        {
          value: "collections" as const,
          label: "Collections",
          allowed: hasPermissions(["fees:manage"]),
        },
        {
          value: "dues" as const,
          label: "Dues",
          allowed: hasPermissions(["fees:manage"]),
        },
        {
          value: "aging" as const,
          label: "Defaulter aging",
          allowed: hasPermissions(["fees:manage"]),
        },
        {
          value: "payment-methods" as const,
          label: "Payment methods",
          allowed: hasPermissions(["fees:manage"]),
        },
        {
          value: "cashier-closes" as const,
          label: "Cashier closes",
          allowed: hasPermissions(["payments:close"]),
        },
        {
          value: "adjustments" as const,
          label: "Adjustments",
          allowed:
            hasPermissions(["payments:refund"]) ||
            hasPermissions(["payments:reverse"]),
        },
        {
          value: "receipts" as const,
          label: "Receipts",
          allowed: hasPermissions(["receipts:read"]),
        },
      ].filter((item) => item.allowed),
    [hasPermissions],
  );
  const requestedReport = searchParams.get("report") as ReportKey | null;
  const report = reportOptions.some((item) => item.value === requestedReport)
    ? requestedReport!
    : (reportOptions[0]?.value ?? "collections");

  const setReport = (value: ReportKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("report", value);
    params.delete("page");
    params.delete("search");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <label
              htmlFor="finance-report"
              className="text-sm font-semibold text-slate-900"
            >
              Report catalog
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Choose one permission-safe backend report. Filters and pagination
              stay in the URL.
            </p>
          </div>
          <select
            id="finance-report"
            value={report}
            onChange={(event) => setReport(event.target.value as ReportKey)}
            className="h-11 min-w-64 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-fees-accent)]"
          >
            {reportOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {report === "collections" ? (
        <CollectionReportPanel />
      ) : report === "dues" ? (
        <DuesAnalysisSection />
      ) : report === "aging" ? (
        <div className="space-y-6">
          <DefaulterAgingSummary />
          <DefaulterQueueTab />
        </div>
      ) : report === "payment-methods" ? (
        <PaymentMethodReportPanel />
      ) : report === "cashier-closes" ? (
        <CashierCloseReportPanel />
      ) : report === "adjustments" ? (
        <AdjustmentReportPanel />
      ) : (
        <LedgerSection mode="receipts" />
      )}
    </div>
  );
}

function CollectionReportPanel() {
  const { fromDate, toDate } = useReportPeriodParams();
  const reportQuery = useQuery({
    queryKey: ["finance-report", "collections", fromDate, toDate],
    queryFn: () =>
      api.getCollectionReport({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
  });

  if (reportQuery.isError) {
    return (
      <ErrorState
        title="Collections report could not load"
        message="No totals were calculated in the browser. Retry the backend report."
        onRetry={() => void reportQuery.refetch()}
      />
    );
  }
  if (reportQuery.isLoading || !reportQuery.data) {
    return <ReportLoading />;
  }

  const report = reportQuery.data;
  const summaries = [
    ["Billed", report.totalBilled],
    ["Gross collected", report.totalCollected],
    ["Refunded", report.totalRefunded],
    ["Net collected", report.netCollected],
    ["Outstanding", report.totalOutstanding],
    ["Waived", report.totalWaived],
  ] as const;

  return (
    <div className="space-y-6">
      <ReportPeriodFilter />
      <SectionCard
        title="Collections"
        description={`Backend totals generated ${formatBsDateTime(report.generatedAt)}${report.period ? ` · ${formatBsDate(report.period.fromDate)} to ${formatBsDate(report.period.toDate)}` : " · All recorded time"}`}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <p className="text-xs font-semibold text-slate-600">{label}</p>
              <p className="mt-2 text-xl font-bold text-slate-950 tabular-nums">
                {formatCurrency(value)}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <BreakdownTable
          title="Billed by class"
          rows={report.classWiseBreakdown.map((row) => ({
            label: row.className,
            amount: row.amount,
          }))}
        />
        <BreakdownTable
          title="Billed by fee head"
          rows={report.feeHeadWiseBreakdown.map((row) => ({
            label: row.feeHeadName,
            amount: row.amount,
          }))}
        />
      </div>
    </div>
  );
}

function PaymentMethodReportPanel() {
  const { fromDate, toDate } = useReportPeriodParams();
  const reportQuery = useQuery({
    queryKey: ["finance-report", "payment-methods", fromDate, toDate],
    queryFn: () =>
      api.getPaymentMethodReport({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
  });

  if (reportQuery.isError) {
    return (
      <ErrorState
        title="Payment-method report could not load"
        message="Backend method totals are unavailable. No browser reconciliation was attempted."
        onRetry={() => void reportQuery.refetch()}
      />
    );
  }
  if (reportQuery.isLoading || !reportQuery.data) return <ReportLoading />;

  return (
    <div className="space-y-6">
      <ReportPeriodFilter />
      <SectionCard
        title="Payment methods"
        description={`Gross, refund, and net totals grouped by the backend · As of ${formatBsDateTime(reportQuery.data.generatedAt)}`}
        noPadding
      >
        {reportQuery.data.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3 text-right">Payments</th>
                  <th className="px-5 py-3 text-right">Refunds</th>
                  <th className="px-5 py-3 text-right">Gross</th>
                  <th className="px-5 py-3 text-right">Refunded</th>
                  <th className="px-5 py-3 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {reportQuery.data.rows.map((row) => (
                  <tr key={row.method}>
                    <td className="px-5 py-3.5 font-semibold text-slate-950">
                      {friendlyMethod(row.method)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {row.paymentCount}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {row.refundCount}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {formatCurrency(row.grossAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {formatCurrency(row.refundedAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold">
                      {formatCurrency(row.netAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No payment-method activity"
            description="No successful payments or refunds matched this backend report period."
            className="m-5 min-h-52"
          />
        )}
      </SectionCard>
    </div>
  );
}

function CashierCloseReportPanel() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const reportQuery = useQuery({
    queryKey: ["finance-report", "cashier-closes", page],
    queryFn: () => api.listCashierClosesPage({ page, limit: 25 }),
  });
  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (reportQuery.isError) {
    return (
      <ErrorState
        title="Cashier-close report could not load"
        onRetry={() => void reportQuery.refetch()}
      />
    );
  }
  if (reportQuery.isLoading || !reportQuery.data) return <ReportLoading />;

  return (
    <SectionCard
      title="Cashier closes"
      description="Finalized immutable close records from the backend."
      noPadding
    >
      {reportQuery.data.items.length ? (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Close</th>
                  <th className="px-5 py-3">Closed</th>
                  <th className="px-5 py-3">Cashier</th>
                  <th className="px-5 py-3 text-right">Payments</th>
                  <th className="px-5 py-3 text-right">Net collection</th>
                  <th className="px-5 py-3 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {reportQuery.data.items.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3.5 font-semibold text-slate-950">
                      {row.closeNumber}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {formatBsDateTime(row.closedAt)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {row.collectorUser?.email ?? "All cashiers"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {row.paymentCount}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold">
                      {formatCurrency(row.netCollected)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {formatCurrency(row.varianceAmount ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ReportPagination
            page={page}
            hasNextPage={reportQuery.data.hasNextPage}
            onPageChange={setPage}
          />
        </div>
      ) : (
        <EmptyState
          title="No finalized cashier closes"
          description="No immutable close records are available for this tenant."
          className="m-5 min-h-52"
        />
      )}
    </SectionCard>
  );
}

function AdjustmentReportPanel() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const status = searchParams.get("status") ?? "";
  const reportQuery = useQuery({
    queryKey: ["finance-report", "adjustments", page, status],
    queryFn: () =>
      api.listFinanceApprovalRequests({
        page,
        limit: 25,
        status: status || undefined,
      }),
  });
  const updateUrl = (updates: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === 1) params.delete(key);
      else params.set(key, String(value));
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (reportQuery.isError) {
    return (
      <ErrorState
        title="Adjustment report could not load"
        onRetry={() => void reportQuery.refetch()}
      />
    );
  }
  if (reportQuery.isLoading || !reportQuery.data) return <ReportLoading />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end rounded-xl border border-slate-200 bg-white p-4">
        <label className="w-full sm:max-w-xs">
          <span className="text-xs font-semibold text-slate-600">Status</span>
          <select
            value={status}
            onChange={(event) =>
              updateUrl({ status: event.target.value || null, page: null })
            }
            className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="EXECUTED">Executed</option>
            <option value="REJECTED">Rejected</option>
            <option value="FAILED">Failed</option>
          </select>
        </label>
      </div>
      <SectionCard
        title="Adjustments"
        description="Refund and reversal requests with backend workflow status."
        noPadding
      >
        {reportQuery.data.items.length ? (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Requested</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {reportQuery.data.items.map((row) => (
                    <tr key={row.id}>
                      <td className="px-5 py-3.5 font-semibold text-slate-950">
                        {row.type}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {formatBsDateTime(row.createdAt)}
                      </td>
                      <td className="max-w-sm truncate px-5 py-3.5 text-slate-700">
                        {row.reason}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {row.amount == null ? "—" : formatCurrency(row.amount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ReportPagination
              page={page}
              hasNextPage={reportQuery.data.hasNextPage}
              onPageChange={(nextPage) => updateUrl({ page: nextPage })}
            />
          </div>
        ) : (
          <EmptyState
            title={
              status ? "No results for this status" : "No adjustment requests"
            }
            description="No backend adjustment requests matched the current filters."
            className="m-5 min-h-52"
          />
        )}
      </SectionCard>
    </div>
  );
}

function ReportPeriodFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { fromDate, toDate } = useReportPeriodParams();
  const [fromBs, setFromBs] = useState(
    fromDate ? formatBsDateForInput(fromDate) : "",
  );
  const [toBs, setToBs] = useState(toDate ? formatBsDateForInput(toDate) : "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFromBs(fromDate ? formatBsDateForInput(fromDate) : "");
    setToBs(toDate ? formatBsDateForInput(toDate) : "");
  }, [fromDate, toDate]);

  const runReport = () => {
    setError(null);
    if (Boolean(fromBs.trim()) !== Boolean(toBs.trim())) {
      setError("Enter both BS dates, or clear both for all recorded time.");
      return;
    }
    try {
      const params = new URLSearchParams(searchParams.toString());
      if (!fromBs.trim() && !toBs.trim()) {
        params.delete("fromDate");
        params.delete("toDate");
      } else {
        params.set("fromDate", toGregorianIso(fromBs));
        params.set("toDate", toGregorianIso(toBs));
      }
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } catch {
      setError("Enter valid BS dates in YYYY-MM-DD format.");
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <BsDateField
          label="From date (BS)"
          value={fromBs}
          onChange={setFromBs}
        />
        <BsDateField label="To date (BS)" value={toBs} onChange={setToBs} />
        <button
          type="button"
          onClick={runReport}
          className="min-h-11 rounded-lg bg-[var(--color-mod-fees-accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-mod-fees-text)]"
        >
          Run report
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}

function useReportPeriodParams() {
  const searchParams = useSearchParams();
  return {
    fromDate: searchParams.get("fromDate") ?? "",
    toDate: searchParams.get("toDate") ?? "",
  };
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; amount: string }>;
}) {
  return (
    <SectionCard title={title} noPadding>
      {rows.length ? (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm"
            >
              <span className="font-medium text-slate-700">{row.label}</span>
              <span className="font-semibold text-slate-950 tabular-nums">
                {formatCurrency(row.amount)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No breakdown available"
          description="No backend rows matched the report period."
          className="m-5 min-h-44"
        />
      )}
    </SectionCard>
  );
}

function ReportPagination({
  page,
  hasNextPage,
  onPageChange,
}: {
  page: number;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-600">
      <span>Page {page}</span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={!hasNextPage}
          onClick={() => onPageChange(page + 1)}
          className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function ReportLoading() {
  return (
    <div
      className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white"
      aria-label="Loading finance report"
    />
  );
}

function friendlyMethod(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function toGregorianIso(bsDate: string) {
  const gregorian = toGregorianDateFromBs(bsDate);
  return `${gregorian.year}-${String(gregorian.month).padStart(2, "0")}-${String(gregorian.day).padStart(2, "0")}`;
}
