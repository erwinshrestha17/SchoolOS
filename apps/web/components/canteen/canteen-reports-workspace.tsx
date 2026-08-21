"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Package } from "lucide-react";
import { getNepalSchoolDay } from "@schoolos/core";
import { canteenApi } from "../../lib/canteen-api";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { LoadingState } from "../ui/loading-state";
import { WorkSurface } from "../ui/work-surface";

const today = getNepalSchoolDay().gregorianDate;
const moneyFormatter = new Intl.NumberFormat("en-NP", {
  style: "currency",
  currency: "NPR",
  maximumFractionDigits: 0,
});

export function CanteenReportsWorkspace() {
  const [reportDate, setReportDate] = useState(today);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const mealCountQuery = useQuery({
    queryKey: ["canteen-meal-count", reportDate],
    queryFn: () => canteenApi.getDailyMealCountReport({ date: reportDate }),
  });
  const itemSalesQuery = useQuery({
    queryKey: ["canteen-item-sales", reportFrom, reportTo],
    queryFn: () =>
      canteenApi.getItemWiseSalesReport({ from: reportFrom, to: reportTo }),
  });
  const spendingSummaryQuery = useQuery({
    queryKey: ["canteen-spending-summary", reportFrom, reportTo],
    queryFn: () =>
      canteenApi.getStudentSpendingSummary({
        from: reportFrom,
        to: reportTo,
      }),
  });
  const lowBalanceQuery = useQuery({
    queryKey: ["canteen-low-balance"],
    queryFn: () => canteenApi.getLowBalanceWallets(),
  });
  const stockLedgerQuery = useQuery({
    queryKey: ["canteen-stock-ledger", reportFrom, reportTo],
    queryFn: () =>
      canteenApi.getStockLedger({ from: reportFrom, to: reportTo }),
  });

  const dailyMealCsvMutation = useMutation({
    mutationFn: () =>
      canteenApi.downloadDailyMealCountCsv({ date: reportDate }),
    onSuccess: () => setNotice("Daily meal count CSV downloaded."),
  });
  const itemSalesCsvMutation = useMutation({
    mutationFn: () =>
      canteenApi.downloadItemWiseSalesCsv({
        from: reportFrom,
        to: reportTo,
      }),
    onSuccess: () => setNotice("Item-wise sales CSV downloaded."),
  });

  const firstError =
    mealCountQuery.error ||
    itemSalesQuery.error ||
    spendingSummaryQuery.error ||
    lowBalanceQuery.error ||
    stockLedgerQuery.error;
  const lowBalanceWallets = lowBalanceQuery.data ?? [];
  const stockLedgerRows = stockLedgerQuery.data ?? [];

  function retryReports() {
    void Promise.all([
      mealCountQuery.refetch(),
      itemSalesQuery.refetch(),
      spendingSummaryQuery.refetch(),
      lowBalanceQuery.refetch(),
      stockLedgerQuery.refetch(),
    ]);
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          <span>{notice}</span>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {firstError ? (
        <ErrorState
          title="Canteen reports could not be fully loaded"
          message="Retry the report requests. Available sections remain visible below."
          error={firstError}
          onRetry={retryReports}
          className="min-h-52"
        />
      ) : null}

      <WorkSurface
        title="Report filters"
        description="Review recorded totals and download CSV exports for the selected dates."
        variant="form"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <DateInput
            label="Daily meal date"
            value={reportDate}
            onChange={setReportDate}
          />
          <DateInput
            label="Report range from"
            value={reportFrom}
            onChange={setReportFrom}
          />
          <DateInput
            label="Report range to"
            value={reportTo}
            onChange={setReportTo}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            disabled={dailyMealCsvMutation.isPending}
            onClick={() => dailyMealCsvMutation.mutate()}
            data-testid="canteen-daily-meal-csv-export"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            {dailyMealCsvMutation.isPending
              ? "Exporting..."
              : "Export daily meal CSV"}
          </button>
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            disabled={itemSalesCsvMutation.isPending}
            onClick={() => itemSalesCsvMutation.mutate()}
            data-testid="canteen-item-sales-csv-export"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            {itemSalesCsvMutation.isPending
              ? "Exporting..."
              : "Export item sales CSV"}
          </button>
        </div>
        {dailyMealCsvMutation.error ? (
          <InlineError message={dailyMealCsvMutation.error.message} />
        ) : null}
        {itemSalesCsvMutation.error ? (
          <InlineError message={itemSalesCsvMutation.error.message} />
        ) : null}
      </WorkSurface>

      <div className="grid gap-6 xl:grid-cols-3">
        <ReportPanel
          title="Daily meal count"
          loading={mealCountQuery.isLoading}
          rows={(mealCountQuery.data ?? []).map(
            (row) => `${row.mealType} • ${row.status}: ${row._count._all}`,
          )}
        />
        <ReportPanel
          title="Item-wise sales"
          loading={itemSalesQuery.isLoading}
          rows={(itemSalesQuery.data ?? []).map(
            (row) =>
              `${row.itemName}: ${row._sum.quantity ?? 0} sold • ${money(row._sum.lineTotal ?? 0)}`,
          )}
        />
        <ReportPanel
          title="Student spending"
          loading={spendingSummaryQuery.isLoading}
          rows={(spendingSummaryQuery.data ?? []).map(
            (row) =>
              `${row.studentId.slice(0, 8)}: ${money(row._sum.totalAmount ?? 0)} • ${row._count._all} sales`,
          )}
        />
      </div>

      <WorkSurface
        title="Low-balance wallets"
        description="Students whose wallet balance is at or below their alert threshold."
        variant="queue"
      >
        {lowBalanceQuery.isLoading ? (
          <LoadingState label="Loading low-balance wallets..." />
        ) : lowBalanceWallets.length > 0 ? (
          <div className="space-y-3">
            {lowBalanceWallets.map((wallet) => (
              <div
                key={wallet.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
              >
                <p className="font-bold text-slate-900">
                  {studentLabel(wallet.student) || wallet.studentId}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Balance {money(wallet.balance)} • threshold{" "}
                  {money(wallet.lowBalanceThreshold)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No low-balance wallets"
            description="No student wallet is currently at or below its alert threshold."
          />
        )}
      </WorkSurface>

      <WorkSurface
        title="Stock ledger"
        description="Review recent stock movements for the selected dates."
        variant="table"
      >
        {stockLedgerQuery.isLoading ? (
          <LoadingState label="Loading stock ledger..." />
        ) : stockLedgerRows.length === 0 ? (
          <EmptyState
            title="No stock movement"
            description="No stock movement rows were recorded for the selected range."
          />
        ) : (
          <div className="space-y-2">
            {stockLedgerRows.slice(0, 10).map((row, index) => (
              <div
                key={
                  row.id ??
                  `${row.inventoryItemId}-${row.movementDate}-${index}`
                }
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Package
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 text-slate-500"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">
                      {row.inventoryItem?.name ??
                        row.inventoryItemId ??
                        "Stock item"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.type ?? "Movement"} -{" "}
                      {row.reason ?? row.referenceType ?? "No reason recorded"}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs font-semibold text-slate-500">
                  <p>
                    {Number(row.quantity ?? 0).toLocaleString()}{" "}
                    {row.inventoryItem?.unit ?? ""}
                  </p>
                  <p>
                    Balance {Number(row.balanceAfter ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkSurface>
    </div>
  );
}

function ReportPanel({
  title,
  loading,
  rows,
}: {
  title: string;
  loading: boolean;
  rows: string[];
}) {
  return (
    <WorkSurface
      title={title}
      description="School records for the selected filters."
      variant="monitoring"
    >
      {loading ? (
        <LoadingState label="Loading report..." />
      ) : rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <p
              key={row}
              className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              {row}
            </p>
          ))}
        </div>
      ) : (
        <EmptyState title="No data" description="No report rows returned." />
      )}
    </WorkSurface>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-control mt-1"
      />
    </label>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

function studentLabel(
  student?: {
    firstNameEn?: string;
    lastNameEn?: string;
    studentSystemId?: string;
  } | null,
) {
  if (!student) return "";
  return `${student.firstNameEn ?? ""} ${student.lastNameEn ?? ""} ${student.studentSystemId ? `(${student.studentSystemId})` : ""}`.trim();
}

function money(value: string | number | null | undefined) {
  return moneyFormatter.format(Number(value ?? 0));
}
