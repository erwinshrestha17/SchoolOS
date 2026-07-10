"use client";

import { useQuery } from "@tanstack/react-query";
import { formatBsDate } from "@schoolos/core";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SearchInput } from "@/components/ui/search-input";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

export function StudentLedgerWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId");
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const transactionType = searchParams.get("transactionType") ?? "";
  const invoiceStatus = searchParams.get("invoiceStatus") ?? "";
  const sortDirection =
    searchParams.get("sortDirection") === "asc" ? "asc" : "desc";

  const searchQuery = useQuery({
    queryKey: ["ledger-students", search],
    queryFn: () => api.searchLedgerStudents(search),
    enabled: !studentId && search.trim().length >= 2,
  });
  const ledgerQuery = useQuery({
    queryKey: [
      "student-fee-ledger",
      studentId,
      page,
      transactionType,
      invoiceStatus,
      sortDirection,
    ],
    queryFn: () => {
      if (!studentId) throw new Error("Student context is unavailable.");
      return api.getStudentFeeLedgerPage(studentId, {
        page,
        limit: 25,
        transactionType: transactionType || undefined,
        invoiceStatus: invoiceStatus || undefined,
        sortDirection,
      });
    },
    enabled: Boolean(studentId),
  });

  const updateUrl = (updates: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === 1) params.delete(key);
      else params.set(key, String(value));
    });
    if ("search" in updates) params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  if (!studentId) {
    return (
      <SectionCard
        title="Find a student ledger"
        description="Use the purpose-limited finance search to find a student, then open the backend-owned ledger projection."
      >
        <div className="mx-auto max-w-4xl space-y-5">
          <SearchInput
            label="Student or invoice"
            placeholder="Search student name, student ID or invoice number"
            value={search}
            debounceMs={300}
            onChange={(value) => updateUrl({ search: value })}
          />

          {search.trim().length < 2 ? (
            <EmptyState
              title="Search for a student"
              description="Enter at least two characters. Search results stay server-filtered and tenant-scoped."
              icon={<Search className="h-7 w-7" />}
              className="min-h-56"
            />
          ) : searchQuery.isError ? (
            <ErrorState
              title="Student ledger search could not load"
              message="Your search was preserved. Retry to load the current server-filtered results."
              onRetry={() => void searchQuery.refetch()}
              className="min-h-56"
            />
          ) : searchQuery.isLoading ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-600">
              Searching student invoices…
            </p>
          ) : searchQuery.data?.items.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="divide-y divide-slate-100">
                {searchQuery.data.items.map((student) => {
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() =>
                        updateUrl({
                          studentId: student.id,
                          search: null,
                          page: null,
                        })
                      }
                      className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-mod-fees-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-950">
                          {student.name}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {student.studentSystemId} · {student.className}
                          {student.sectionName
                            ? ` · ${student.sectionName}`
                            : ""}
                          {` · ${student.invoiceCount} ${student.invoiceCount === 1 ? "invoice" : "invoices"}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-[var(--color-mod-fees-text)]">
                        Open ledger
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-600">
                Showing up to 20 tenant-scoped students with finance history
              </div>
            </div>
          ) : (
            <EmptyState
              title="No results for current search"
              description="Try another student name, student ID or invoice number."
              className="min-h-56"
            />
          )}
        </div>
      </SectionCard>
    );
  }

  if (ledgerQuery.isError) {
    return (
      <ErrorState
        title="Student ledger could not load"
        message="No balance has been calculated in the browser. Retry to load the backend ledger projection."
        onRetry={() => void ledgerQuery.refetch()}
      />
    );
  }

  if (ledgerQuery.isLoading || !ledgerQuery.data) {
    return (
      <div className="space-y-4" aria-label="Loading student ledger">
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  const ledger = ledgerQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-slate-950">
            {ledger.student.name}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {ledger.student.studentSystemId} · {ledger.student.className}
            {ledger.student.sectionName
              ? ` · ${ledger.student.sectionName}`
              : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => updateUrl({ studentId: null })}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Change student
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <LedgerSummary label="Total billed" value={ledger.totalInvoiced} />
        <LedgerSummary label="Paid" value={ledger.totalPaid} />
        <LedgerSummary label="Waived" value={ledger.totalWaived} />
        <LedgerSummary label="Refunded" value={ledger.totalRefunded} />
        <LedgerSummary
          label="Outstanding"
          value={ledger.outstandingBalance}
          emphasized
        />
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <label>
          <span className="text-xs font-semibold text-slate-600">
            Transaction type
          </span>
          <select
            value={transactionType}
            onChange={(event) =>
              updateUrl({
                transactionType: event.target.value || null,
                page: null,
              })
            }
            className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-fees-accent)]"
          >
            <option value="">All transactions</option>
            <option value="INVOICE">Invoices</option>
            <option value="PAYMENT">Payments</option>
            <option value="WAIVER">Waivers</option>
            <option value="REFUND">Refunds</option>
            <option value="REVERSAL">Reversals</option>
          </select>
        </label>
        <label>
          <span className="text-xs font-semibold text-slate-600">
            Invoice status
          </span>
          <select
            value={invoiceStatus}
            onChange={(event) =>
              updateUrl({
                invoiceStatus: event.target.value || null,
                page: null,
              })
            }
            className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-fees-accent)]"
          >
            <option value="">All invoice statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="PARTIAL">Partially paid</option>
            <option value="PAID">Paid</option>
            <option value="VOID">Void</option>
          </select>
        </label>
        <label>
          <span className="text-xs font-semibold text-slate-600">Order</span>
          <select
            value={sortDirection}
            onChange={(event) =>
              updateUrl({ sortDirection: event.target.value, page: null })
            }
            className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-fees-accent)]"
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>
      </div>

      <SectionCard
        title="Ledger activity"
        description="Chronological debit, credit, and running balance values from the backend ledger projection."
        noPadding
      >
        {ledger.rows.length ? (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Event / source</th>
                    <th className="px-5 py-3">Reference</th>
                    <th className="px-5 py-3 text-right">Debit</th>
                    <th className="px-5 py-3 text-right">Credit</th>
                    <th className="px-5 py-3 text-right">Running balance</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {ledger.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5 text-slate-600">
                        {formatBsDate(row.date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-slate-900">
                          {row.description}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {row.type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {row.reference}
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-900">
                        {row.debit ? formatCurrency(row.debit) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-900">
                        {row.credit ? formatCurrency(row.credit) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-950">
                        {formatCurrency(row.runningBalance)}
                      </td>
                      <td className="px-5 py-3.5">
                        {row.status ? <StatusBadge status={row.status} /> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-600">
              <span>
                {ledger.total} matching{" "}
                {ledger.total === 1 ? "entry" : "entries"} · As of{" "}
                {formatBsDate(ledger.generatedAt)}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={ledger.page <= 1}
                  onClick={() => updateUrl({ page: ledger.page - 1 })}
                  className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!ledger.hasNextPage}
                  onClick={() => updateUrl({ page: ledger.page + 1 })}
                  className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No ledger activity"
            description="This student does not have any backend ledger rows yet."
            className="m-5 min-h-52"
          />
        )}
      </SectionCard>

      <Link
        href="/dashboard/fees/collect"
        className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Open collection workspace
      </Link>
    </div>
  );
}

function LedgerSummary({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${emphasized ? "border-[var(--color-mod-fees-border)] bg-[var(--color-mod-fees-bg)]" : "border-slate-200 bg-white"}`}
    >
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-xl font-bold tracking-tight text-slate-950 tabular-nums">
        {formatCurrency(value)}
      </p>
    </div>
  );
}
