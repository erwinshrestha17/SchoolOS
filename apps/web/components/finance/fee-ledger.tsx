"use client";

import React, { useEffect, useState } from "react";
import {
  PaginatedDataTable,
  type PaginatedDataTableColumn,
  type PaginatedDataTableSort,
} from "@/components/schoolos/data/paginated-data-table";
import { Button } from "@/components/ui/primitives/button";
import { Eye, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReprintDialog } from "./reprint-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatBsDate } from "@schoolos/core";
import { Drawer } from "@/components/ui/drawer";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ErrorState } from "@/components/ui/error-state";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface Invoice {
  id: string;
  invoiceNumber: string;
  issuedAt?: string;
  dueDate: string;
  totalAmount: number;
  paidAmount?: number;
  outstandingAmount?: number;
  status: string;
  receiptId?: string | null;
  receiptNumber?: string | null;
  student?: {
    name: string;
    studentSystemId?: string;
  };
}

/**
 * sortBy is constrained to what ListInvoicesQueryDto actually accepts
 * (apps/api/src/finance/dto/list-finance-records.query.dto.ts) — do not add
 * a `sortable: true` column here without confirming the backend enum first.
 */
type InvoiceSortColumn = "invoiceNumber" | "dueDate" | "totalAmount";

interface FeeLedgerProps {
  invoices: Invoice[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  hasActiveFilters?: boolean;
  sort?: PaginatedDataTableSort | null;
  onSortChange?: (sort: PaginatedDataTableSort | null) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (value: string) => formatBsDate(value);

export function FeeLedger({
  invoices,
  isLoading,
  isError,
  onRetry,
  page,
  pageSize,
  totalItems,
  onPageChange,
  hasActiveFilters,
  sort,
  onSortChange,
}: FeeLedgerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedInvoiceId = searchParams.get("invoiceId");
  const [selectedReceipt, setSelectedReceipt] = useState<{
    id: string;
    number: string;
  } | null>(null);
  const invoiceDetailQuery = useQuery({
    queryKey: ["invoice-detail", selectedInvoiceId],
    queryFn: () => api.getInvoiceDetail(selectedInvoiceId!),
    enabled: Boolean(selectedInvoiceId),
  });

  const setSelectedInvoice = (invoiceId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (invoiceId) params.set("invoiceId", invoiceId);
    else params.delete("invoiceId");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (isLoading || !selectedInvoiceId) return;
    if (!invoices.some((invoice) => invoice.id === selectedInvoiceId)) {
      setSelectedInvoice(null);
    }
    // setSelectedInvoice is intentionally derived from current URL state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, isLoading, selectedInvoiceId]);

  const columns: PaginatedDataTableColumn<Invoice>[] = [
    {
      id: "invoiceNumber",
      header: "Invoice #",
      sortable: true,
      cell: (inv) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{inv.invoiceNumber}</span>
          <span className="text-[0.65rem] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
            {inv.issuedAt
              ? `Issued ${formatDate(inv.issuedAt)}`
              : "Issue date unavailable"}
          </span>
        </div>
      ),
    },
    {
      id: "student",
      header: "Student",
      cell: (inv) => (
        <div className="flex flex-col">
          <span className="text-sm font-bold text-slate-900">
            {inv.student?.name || "Student name not set"}
          </span>
          <span className="text-[0.6rem] text-slate-400 uppercase tracking-widest">
            {inv.student?.studentSystemId || "Student ID not set"}
          </span>
        </div>
      ),
    },
    {
      id: "dueDate",
      header: "Due Date",
      sortable: true,
      cell: (inv) => (
        <span
          className={cn(
            "text-xs font-bold",
            inv.status !== "PAID" && inv.status !== "VOID"
              ? "text-danger-600"
              : "text-slate-500",
          )}
        >
          {formatDate(inv.dueDate)}
        </span>
      ),
    },
    {
      id: "totalAmount",
      header: "Total",
      sortable: true,
      cell: (inv) => (
        <span className="font-black text-slate-900 text-sm">
          {formatCurrency(inv.totalAmount)}
        </span>
      ),
    },
    {
      id: "paidAmount",
      header: "Paid",
      cell: (inv) => (
        <span className="text-sm font-black text-emerald-600">
          {formatCurrency(inv.paidAmount ?? 0)}
        </span>
      ),
    },
    {
      id: "outstandingAmount",
      header: "Outstanding",
      align: "right",
      cell: (inv) => (
        <span className="block text-right text-sm font-bold text-slate-950 tabular-nums">
          {typeof inv.outstandingAmount === "number"
            ? formatCurrency(inv.outstandingAmount)
            : "Unavailable"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (inv) => <StatusBadge status={inv.status} className="h-6" />,
    },
  ];

  function renderRowActions(inv: Invoice) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-slate-600 hover:text-slate-950"
          onClick={() => setSelectedInvoice(inv.id)}
        >
          <Eye size={15} aria-hidden />
          View
        </Button>
        {inv.receiptNumber && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Print Receipt"
            aria-label="Print Receipt"
            onClick={() =>
              setSelectedReceipt({
                id: inv.receiptId!,
                number: inv.receiptNumber!,
              })
            }
          >
            <Printer size={16} />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PaginatedDataTable
        columns={columns}
        items={invoices}
        getRowId={(inv) => inv.id}
        status={isError ? "error" : isLoading ? "loading" : "ready"}
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={onPageChange}
        sort={sort}
        onSortChange={onSortChange}
        rowActions={renderRowActions}
        onRetry={onRetry}
        errorMessage="Billing history could not load. Your filters were preserved — retry to load the tenant-scoped invoice page."
        emptyTitle="No invoices yet"
        emptyDescription="Invoices will appear here once billing runs generate them."
        hasActiveFilters={hasActiveFilters}
        noResultsTitle="No matching invoices"
        noResultsDescription="Try a different search term or clear the status filter."
      />

      {selectedReceipt && (
        <ReprintDialog
          receiptId={selectedReceipt.id}
          receiptNumber={selectedReceipt.number}
          isOpen={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      <Drawer
        isOpen={Boolean(selectedInvoiceId)}
        onClose={() => setSelectedInvoice(null)}
        title={invoiceDetailQuery.data?.invoiceNumber ?? "Invoice detail"}
        description="Backend-owned invoice, payment, waiver, receipt, and handoff context."
        width="lg"
      >
        {invoiceDetailQuery.isLoading ? (
          <div className="space-y-3" aria-label="Loading invoice detail">
            <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : invoiceDetailQuery.isError ? (
          <ErrorState
            title="Invoice detail could not load"
            message="Close this panel or retry. No finance value has been calculated in the browser."
            onRetry={() => void invoiceDetailQuery.refetch()}
            className="min-h-64"
          />
        ) : invoiceDetailQuery.data ? (
          <InvoiceDetailContent detail={invoiceDetailQuery.data} />
        ) : null}
      </Drawer>
    </div>
  );
}

function InvoiceDetailContent({
  detail,
}: {
  detail: Awaited<ReturnType<typeof api.getInvoiceDetail>>;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-base font-semibold text-slate-950">{detail.student.name}</p>
        <p className="mt-1 text-sm text-slate-600">
          {detail.student.studentSystemId} · {detail.student.className}
          {detail.student.sectionName ? ` · ${detail.student.sectionName}` : ""}
        </p>
        {detail.student.guardianName ? (
          <p className="mt-2 text-xs text-slate-500">
            Guardian: {detail.student.guardianName}
            {detail.student.guardianPhone ? ` · ${detail.student.guardianPhone}` : ""}
          </p>
        ) : null}
      </section>

      <dl className="grid gap-3 sm:grid-cols-2">
        <InvoiceFact label="Status" value={detail.status} />
        <InvoiceFact label="Due date" value={formatDate(detail.dueDate)} />
        <InvoiceFact label="Total" value={formatCurrency(detail.totalAmount)} />
        <InvoiceFact label="Paid" value={formatCurrency(detail.paidAmount)} />
        <InvoiceFact label="Waived" value={formatCurrency(detail.totalWaivedAmount)} />
        <InvoiceFact label="Outstanding" value={formatCurrency(detail.outstandingAmount)} emphasized />
      </dl>

      <section>
        <h3 className="text-sm font-semibold text-slate-950">Invoice line items</h3>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          {detail.lines.map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-0">
              <div>
                <p className="text-sm font-semibold text-slate-900">{line.feeHeadName}</p>
                <p className="mt-0.5 text-xs text-slate-500">{line.periodLabel || line.description}</p>
              </div>
              <p className="text-sm font-semibold text-slate-950 tabular-nums">{formatCurrency(line.netAmount)}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-950">Payments and correction chain</h3>
        {detail.payments.length ? (
          <div className="mt-3 space-y-3">
            {detail.payments.map((payment) => (
              <div key={payment.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{payment.receipt?.receiptNumber ?? "Receipt pending"}</p>
                    <p className="mt-1 text-xs text-slate-500">{payment.method} · {formatDate(payment.paidAt)}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-950 tabular-nums">{formatCurrency(payment.netAmount)}</p>
                </div>
                {payment.refunds.length ? (
                  <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
                    {payment.refunds.map((refund) => (
                      <p key={refund.id}>{refund.refundNumber} · {formatCurrency(refund.amount)} · {refund.reason}</p>
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 text-xs text-slate-500">
                  Accounting handoff: {payment.journalEntryNumber ?? "Not available in current response"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">No payments are recorded for this invoice.</p>
        )}
      </section>

      {detail.waivers.length ? (
        <section>
          <h3 className="text-sm font-semibold text-slate-950">Waivers</h3>
          <div className="mt-3 space-y-2">
            {detail.waivers.map((waiver) => (
              <div key={waiver.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="flex justify-between gap-4"><span>{waiver.feeHeadName ?? "Invoice waiver"}</span><span className="font-semibold tabular-nums">{formatCurrency(waiver.amount)}</span></div>
                <p className="mt-1 text-xs text-slate-500">{waiver.reason}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function InvoiceFact({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${emphasized ? "border-[var(--color-mod-fees-border)] bg-[var(--color-mod-fees-bg)]" : "border-slate-200 bg-white"}`}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-950 tabular-nums">{value}</dd>
    </div>
  );
}
