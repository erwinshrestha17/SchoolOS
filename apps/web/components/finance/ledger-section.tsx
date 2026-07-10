"use client";

import React, { useState } from "react";
import { SectionCard } from "@/components/ui/section-card";
import { FeeLedger } from "./fee-ledger";
import { FilterBar } from "@/components/ui/filter-bar";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ReceiptVerificationPanel } from "./receipt-verification-panel";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ErrorState } from "@/components/ui/error-state";
import { SearchInput } from "@/components/ui/search-input";
import { ReprintDialog } from "./reprint-dialog";
import { useSession } from "@/components/session-provider";
import { formatBsDateTime } from "@schoolos/core";
import { StatusBadge } from "@/components/ui/status-badge";

export function LedgerSection({
  mode = "all",
}: {
  mode?: "all" | "invoices" | "receipts";
}) {
  const { hasPermissions } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("ledgerSearch") ?? "";
  const status = searchParams.get("ledgerStatus") ?? "";
  const page = Math.max(1, Number(searchParams.get("ledgerPage") ?? "1") || 1);
  const receiptSearch = searchParams.get("receiptSearch") ?? "";
  const receiptPage = Math.max(
    1,
    Number(searchParams.get("receiptPage") ?? "1") || 1,
  );
  const [selectedReceipt, setSelectedReceipt] = useState<{
    id: string;
    receiptNumber: string;
  } | null>(null);
  const invoicesQuery = useQuery({
    queryKey: ["invoices", "ledger", page, search, status],
    queryFn: () =>
      api.listInvoicesPage({
        page,
        limit: 25,
        search: search || undefined,
        status: status || undefined,
        sortBy: "issuedAt",
        sortDirection: "desc",
      }),
    enabled: mode !== "receipts",
  });
  const receiptsQuery = useQuery({
    queryKey: ["receipts", receiptPage, receiptSearch],
    queryFn: () =>
      api.listReceiptsPage({
        page: receiptPage,
        limit: 25,
        search: receiptSearch || undefined,
      }),
    enabled: mode !== "invoices",
  });
  const openReceiptMutation = useMutation({
    mutationFn: (receiptNumber: string) => api.openReceiptPdf(receiptNumber),
  });
  const updateFilters = (updates: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === 1) params.delete(key);
      else params.set(key, String(value));
    }
    if ("ledgerSearch" in updates || "ledgerStatus" in updates) {
      params.delete("ledgerPage");
    }
    if ("receiptSearch" in updates) params.delete("receiptPage");
    router.replace(`${pathname}?${params.toString()}`, {
      scroll: false,
    });
  };

  return (
    <div className="space-y-6">
      {mode === "receipts" ? (
        <nav aria-label="Receipt center sections" className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
          <a href="#receipt-history" className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Receipt history</a>
          <a href="#verify-receipt" className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Verify receipt</a>
          <a href="#receipt-history" className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Reprint audit</a>
        </nav>
      ) : null}

      {mode !== "invoices" ? <div id="verify-receipt"><ReceiptVerificationPanel /></div> : null}

      {mode !== "receipts" ? <FilterBar label="Invoice filters">
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
          <SearchInput
            label="Search billing history"
            placeholder="Search by invoice or student..."
            value={search}
            debounceMs={300}
            onChange={(value) => updateFilters({ ledgerSearch: value })}
          />
          <select
            value={status}
            onChange={(event) =>
              updateFilters({ ledgerStatus: event.target.value })
            }
            aria-label="Invoice status"
            className="h-11 w-full rounded-lg border-slate-200 bg-white px-4 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="ISSUED">Issued</option>
            <option value="VOID">Void</option>
          </select>
        </div>
      </FilterBar> : null}

      {mode !== "receipts" ? <SectionCard
        title="Billing History"
        description="Server-paginated invoices and their current backend status."
      >
        {invoicesQuery.isError ? (
          <ErrorState
            title="Billing history could not load"
            message="Your filters were preserved. Retry to load the tenant-scoped invoice page."
            onRetry={() => void invoicesQuery.refetch()}
          />
        ) : (
          <FeeLedger
            invoices={invoicesQuery.data?.items ?? []}
            isLoading={invoicesQuery.isLoading}
          />
        )}
        {invoicesQuery.data?.total ? (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
            <span>{invoicesQuery.data.total} invoices</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => updateFilters({ ledgerPage: page - 1 })}
                className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!invoicesQuery.data.hasNextPage}
                onClick={() => updateFilters({ ledgerPage: page + 1 })}
                className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </SectionCard> : null}

      {mode !== "invoices" ? <div id="receipt-history"><SectionCard
        title="Receipt History"
        description="Tenant-scoped protected receipts with server-side search and paging."
      >
        <SearchInput
          label="Search receipts"
          placeholder="Search receipt, invoice or student"
          value={receiptSearch}
          debounceMs={300}
          onChange={(value) => updateFilters({ receiptSearch: value })}
          className="mb-4"
        />
        {receiptsQuery.isLoading ? (
          <p className="py-8 text-center text-sm font-semibold text-slate-500">
            Loading protected receipts…
          </p>
        ) : receiptsQuery.isError ? (
          <ErrorState
            title="Receipt history could not load"
            message="No receipt state was changed. Retry with the current filters."
            onRetry={() => void receiptsQuery.refetch()}
          />
        ) : receiptsQuery.data?.items.length ? (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Receipt</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Issued</th>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {receiptsQuery.data.items.map((receipt) => (
                    <tr key={receipt.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3.5 font-semibold text-slate-950">{receipt.receiptNumber}</td>
                      <td className="px-4 py-3.5 text-slate-700">{receipt.student?.name ?? "Student unavailable"}</td>
                      <td className="px-4 py-3.5 text-slate-600">{receipt.invoiceNumber ?? "Unavailable"}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-950">
                        {typeof receipt.amount === "number"
                          ? new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(receipt.amount)
                          : "Unavailable"}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{receipt.method ?? "Unavailable"}</td>
                      <td className="px-4 py-3.5 text-slate-600">{formatBsDateTime(receipt.issuedAt)}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={receipt.fileStatus} /></td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={openReceiptMutation.isPending}
                            onClick={() => openReceiptMutation.mutate(receipt.receiptNumber)}
                            className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold disabled:opacity-40"
                          >
                            Open protected receipt
                          </button>
                          {hasPermissions(["receipts:manage"]) ? (
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt({ id: receipt.id, receiptNumber: receipt.receiptNumber })}
                              className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold"
                            >
                              Prepare reprint
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {openReceiptMutation.isError ? (
              <p className="rounded-xl border border-warning-100 bg-warning-50 p-3 text-xs font-bold text-warning-800">
                {openReceiptMutation.error instanceof Error
                  ? openReceiptMutation.error.message
                  : "The protected receipt is unavailable."}
              </p>
            ) : null}
            <div className="flex items-center justify-between pt-2 text-xs font-bold text-slate-500">
              <span>{receiptsQuery.data.total} receipts</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={receiptPage <= 1}
                  onClick={() =>
                    updateFilters({ receiptPage: receiptPage - 1 })
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!receiptsQuery.data.hasNextPage}
                  onClick={() =>
                    updateFilters({ receiptPage: receiptPage + 1 })
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm font-semibold text-slate-500">
            No receipts match the current filters.
          </p>
        )}
      </SectionCard></div> : null}

      {selectedReceipt ? (
        <ReprintDialog
          receiptId={selectedReceipt.id}
          receiptNumber={selectedReceipt.receiptNumber}
          isOpen
          onClose={() => setSelectedReceipt(null)}
        />
      ) : null}
    </div>
  );
}
