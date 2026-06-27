"use client";

import React, { useState } from "react";
import { SectionCard } from "@/components/ui/section-card";
import { FeeLedger } from "./fee-ledger";
import { FilterBar } from "@/components/ui/filter-bar";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ReceiptVerificationPanel } from "./receipt-verification-panel";
import { useRouter, useSearchParams } from "next/navigation";
import { ErrorState } from "@/components/ui/error-state";
import { ReprintDialog } from "./reprint-dialog";
import { useSession } from "@/components/session-provider";

export function LedgerSection() {
  const { hasPermissions } = useSession();
  const router = useRouter();
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
  });
  const receiptsQuery = useQuery({
    queryKey: ["receipts", receiptPage, receiptSearch],
    queryFn: () =>
      api.listReceiptsPage({
        page: receiptPage,
        limit: 25,
        search: receiptSearch || undefined,
      }),
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
    router.replace(`/dashboard/finance?${params.toString()}`, {
      scroll: false,
    });
  };

  return (
    <div className="space-y-6">
      <ReceiptVerificationPanel />

      <FilterBar label="Ledger Filters">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <input
            type="text"
            placeholder="Search by invoice or student..."
            value={search}
            onChange={(event) =>
              updateFilters({ ledgerSearch: event.target.value })
            }
            className="w-full text-sm bg-white border-slate-200 rounded-xl px-4 py-2"
          />
          <select
            value={status}
            onChange={(event) =>
              updateFilters({ ledgerStatus: event.target.value })
            }
            className="w-full text-sm bg-white border-slate-200 rounded-xl px-4 py-2"
          >
            <option value="">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="ISSUED">Issued</option>
            <option value="VOID">Void</option>
          </select>
          <select className="w-full text-sm bg-white border-slate-200 rounded-xl px-4 py-2">
            <option value="">All Academic Years</option>
          </select>
        </div>
      </FilterBar>

      <SectionCard
        title="Billing History"
        description="Comprehensive list of all invoices and their current status."
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
      </SectionCard>

      <SectionCard
        title="Receipt History"
        description="Tenant-scoped protected receipts with server-side search and paging."
      >
        <input
          value={receiptSearch}
          onChange={(event) =>
            updateFilters({ receiptSearch: event.target.value })
          }
          placeholder="Search receipt, invoice or student"
          className="mb-4 h-11 w-full rounded-xl border border-slate-200 px-4 text-sm"
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
            {receiptsQuery.data.items.map((receipt) => (
              <div
                key={receipt.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {receipt.receiptNumber}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {receipt.student?.name ?? "Student"} ·{" "}
                    {receipt.invoiceNumber ?? "Invoice unavailable"}
                  </p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Protected file: {receipt.fileStatus}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={openReceiptMutation.isPending}
                    onClick={() =>
                      openReceiptMutation.mutate(receipt.receiptNumber)
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40"
                  >
                    Open protected receipt
                  </button>
                  {hasPermissions(["receipts:manage"]) ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedReceipt({
                          id: receipt.id,
                          receiptNumber: receipt.receiptNumber,
                        })
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"
                    >
                      Reprint
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
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
      </SectionCard>

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
