"use client";

import React, { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Wallet,
  Search,
  CreditCard,
  Banknote,
  History,
  User,
  GraduationCap,
  MapPin,
  Phone,
  Receipt,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";
import { EmptyState } from "../ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import type {
  InvoiceDetailLine,
  InvoiceSummary,
  StudentCollectionContext,
} from "@schoolos/core";
import { formatBsDate } from "@schoolos/core";

interface CollectionCounterProps {
  onSearch: (query: string) => void;
  searchQuery?: string;
  invoices: InvoiceSummary[];
  onCollect: (
    invoiceId: string,
    amount: number,
    method: string,
    reference?: string,
    remarks?: string,
  ) => void;
  isLoading?: boolean;
  isSubmitting?: boolean;
  initialInvoiceId?: string | null;
  studentContext?: StudentCollectionContext["student"] | null;
  isStudentProfileSource?: boolean;
  onChangeStudent?: () => void;
  disableSearch?: boolean;
  page?: number;
  limit?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (value: string) => formatBsDate(value);

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank deposit",
  TRANSFER: "Online transfer",
  MOBILE: "Mobile wallet",
};

export function CollectionCounter({
  onSearch,
  searchQuery = "",
  invoices,
  onCollect,
  isLoading,
  isSubmitting,
  initialInvoiceId,
  studentContext,
  isStudentProfileSource,
  onChangeStudent,
  disableSearch,
  page = 1,
  limit = 25,
  total = 0,
  onPageChange,
}: CollectionCounterProps) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null,
  );
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Debounce the server-side invoice search so the counter does not fire a
  // request (and a URL update) on every keystroke.
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (searchInput === searchQuery) return;
    const timeoutId = window.setTimeout(() => onSearch(searchInput), 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput, searchQuery, onSearch]);

  const selectedInvoice = useMemo(
    () => invoices.find((inv) => inv.id === selectedInvoiceId) || null,
    [invoices, selectedInvoiceId],
  );

  const invoiceDetailQuery = useQuery({
    queryKey: ["invoice-detail", selectedInvoiceId],
    queryFn: () => api.getInvoiceDetail(selectedInvoiceId!),
    enabled: !!selectedInvoiceId,
  });

  const handleSelectInvoice = (inv: InvoiceSummary) => {
    setSelectedInvoiceId(inv.id);
    setAmount(0);
    setReference("");
    setRemarks("");
  };

  useEffect(() => {
    setSelectedInvoiceId(null);
    setAmount(0);
    setReference("");
    setRemarks("");
  }, [studentContext?.id]);

  useEffect(() => {
    if (!initialInvoiceId || selectedInvoiceId === initialInvoiceId) return;

    const linkedInvoice = invoices.find(
      (invoice) => invoice.id === initialInvoiceId,
    );

    if (!linkedInvoice) return;

    setSelectedInvoiceId(linkedInvoice.id);
    setAmount(0);
    setReference("");
    setRemarks("");
  }, [initialInvoiceId, invoices, selectedInvoiceId]);

  useEffect(() => {
    if (!studentContext) return;

    if (invoices.length === 1 && selectedInvoiceId !== invoices[0].id) {
      setSelectedInvoiceId(invoices[0].id);
      setAmount(0);
      setReference("");
      setRemarks("");
      return;
    }

    if (
      invoices.length !== 1 &&
      selectedInvoiceId &&
      !invoices.some((invoice) => invoice.id === selectedInvoiceId)
    ) {
      setSelectedInvoiceId(null);
      setAmount(0);
      setReference("");
      setRemarks("");
    }
  }, [invoices, selectedInvoiceId, studentContext]);

  useEffect(() => {
    if (!invoiceDetailQuery.data) return;
    setAmount(invoiceDetailQuery.data.outstandingAmount);
  }, [invoiceDetailQuery.data]);

  return (
    <div className="space-y-4">
      {isStudentProfileSource && studentContext ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-mod-fees-border)] bg-[var(--color-mod-fees-bg)] px-5 py-4 text-[var(--color-mod-fees-text)] shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-widest opacity-70">
              Student profile handoff
            </p>
            <p className="text-sm font-black">
              Collecting fees for: {studentContext.name} ·{" "}
              {studentContext.studentSystemId}
            </p>
          </div>
          {onChangeStudent ? (
            <button
              type="button"
              onClick={onChangeStudent}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--color-mod-fees-border)] bg-white px-4 text-xs font-black uppercase tracking-widest text-[var(--color-mod-fees-text)] shadow-sm transition hover:bg-slate-50"
            >
              Change student
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <SectionCard
          title={studentContext ? "Selected Student" : "Student Discovery"}
          description={
            studentContext
              ? "Outstanding invoices for this student only"
              : "Search by student name, student ID or invoice number"
          }
        >
          <div className="space-y-6">
            {studentContext ? (
              <StudentContextSummary
                student={studentContext}
                onChangeStudent={onChangeStudent}
              />
            ) : null}

            {!disableSearch ? (
              <div className="relative">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <Input
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                  }}
                  placeholder="Find student or invoice..."
                  className="pl-12 h-14 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all shadow-sm"
                />
              </div>
            ) : null}

            <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {invoices.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => handleSelectInvoice(inv)}
                  className={cn(
                    "group flex w-full items-start justify-between rounded-xl border p-4 transition-colors",
                    selectedInvoiceId === inv.id
                      ? "border-[var(--color-mod-fees-border)] bg-[var(--color-mod-fees-bg)] text-[var(--color-mod-fees-text)]"
                      : "bg-white border-slate-100 hover:border-[var(--color-mod-fees-border)] text-slate-900 hover:bg-[var(--color-mod-fees-bg)]",
                  )}
                >
                  <div className="flex gap-4">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                        selectedInvoiceId === inv.id
                          ? "bg-white text-[var(--color-mod-fees-accent)]"
                          : "bg-slate-50 text-slate-400 group-hover:bg-white",
                      )}
                    >
                      <User size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black truncate max-w-[160px] tracking-tight">
                        {studentContext?.name ||
                          inv.student?.name ||
                          "Student name not set"}
                      </p>
                      <p
                        className={cn(
                          "text-[0.65rem] font-bold uppercase tracking-widest mt-1",
                          selectedInvoiceId === inv.id
                            ? "text-[var(--color-mod-fees-text)]/70"
                            : "text-slate-500",
                        )}
                      >
                        {inv.invoiceNumber}
                      </p>
                      {typeof inv.outstandingAmount === "number" ? (
                        <p className="mt-2 text-xs font-black text-danger-600">
                          {formatCurrency(inv.outstandingAmount)} outstanding
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className="text-xs font-bold text-slate-500">
                      Open invoice
                    </p>
                    <StatusBadge status={inv.status} className="mt-2 h-5" />
                  </div>
                </button>
              ))}
              {isLoading && (
                <div className="py-12 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--color-mod-fees-accent)]" />
                </div>
              )}
              {invoices.length === 0 && !isLoading && !studentContext && (
                <EmptyState
                  title="No Records Found"
                  description="Try searching with a different student ID or name."
                  className="py-12"
                />
              )}
            </div>
            {!studentContext && total > 0 ? (
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
                <span>
                  {Math.min((page - 1) * limit + 1, total)}–
                  {Math.min(page * limit, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => onPageChange?.(page - 1)}
                    className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page * limit >= total}
                    onClick={() => onPageChange?.(page + 1)}
                    className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <div className="space-y-6">
          {selectedInvoice ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-700">
              {/* Student Quick Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard
                  icon={<GraduationCap size={18} />}
                  label="Student Detail"
                  value={
                    invoiceDetailQuery.data?.student.name ||
                    studentContext?.name ||
                    selectedInvoice.student?.name ||
                    "Student name not set"
                  }
                  sub={
                    invoiceDetailQuery.data?.student.studentSystemId ||
                    studentContext?.studentSystemId ||
                    "Student ID loading"
                  }
                />
                <SummaryCard
                  icon={<MapPin size={18} />}
                  label="Class / Section"
                  value={
                    invoiceDetailQuery.data?.student.className ||
                    "Class not set"
                  }
                  sub={
                    invoiceDetailQuery.data?.student.sectionName ||
                    "Section not set"
                  }
                />
                <SummaryCard
                  icon={<Phone size={18} />}
                  label="Primary Guardian"
                  value={
                    invoiceDetailQuery.data?.student.guardianName ||
                    "Guardian not recorded"
                  }
                  sub={
                    invoiceDetailQuery.data?.student.guardianPhone ||
                    "Guardian phone not recorded"
                  }
                />
              </div>

              {invoiceDetailQuery.isError ? (
                <div
                  className="flex items-center gap-3 rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm font-bold text-danger-700"
                  role="alert"
                >
                  <AlertCircle size={18} />
                  Invoice details could not load. Payment collection is disabled
                  until you retry or select the invoice again.
                </div>
              ) : null}

              <SectionCard
                title="Payment review"
                description="Review the selected invoice, enter the tender, then confirm one payment."
                headerAction={
                  <div className="flex items-center gap-2 rounded-xl bg-[var(--color-mod-fees-bg)] border border-[var(--color-mod-fees-border)] px-4 py-2 text-[0.65rem] font-black text-[var(--color-mod-fees-text)] uppercase tracking-widest">
                    <Receipt size={14} />
                    Invoice breakdown
                  </div>
                }
              >
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-4">
                    <StatItem
                      label="Total Billed"
                      value={
                        invoiceDetailQuery.data
                          ? formatCurrency(invoiceDetailQuery.data.totalAmount)
                          : "Loading"
                      }
                    />
                    <StatItem
                      label="Paid Amount"
                      value={
                        invoiceDetailQuery.data
                          ? formatCurrency(invoiceDetailQuery.data.paidAmount)
                          : "Loading"
                      }
                      color="text-emerald-600"
                    />
                    <StatItem
                      label="Current Balance"
                      value={
                        invoiceDetailQuery.data
                          ? formatCurrency(
                              invoiceDetailQuery.data.outstandingAmount,
                            )
                          : "Loading"
                      }
                      color="text-danger-600 font-black"
                    />
                    <StatItem
                      label="Due Date"
                      value={formatDate(selectedInvoice.dueDate)}
                    />
                  </div>

                  {/* Dues Breakdown (if available) */}
                  {invoiceDetailQuery.data && (
                    <div className="space-y-3">
                      <h5 className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Fee Breakdown
                      </h5>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {invoiceDetailQuery.data.lines?.map(
                          (item: InvoiceDetailLine) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3.5"
                            >
                              <span className="text-xs font-bold text-slate-700">
                                {item.feeHeadName || "Fee head not set"}
                              </span>
                              <span className="text-xs font-black text-slate-900">
                                {formatCurrency(item.netAmount)}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="ml-1 text-xs font-semibold text-slate-600">
                          Collection Amount
                        </label>
                        <div className="group flex h-16 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 transition focus-within:ring-2 focus-within:ring-[var(--color-mod-fees-accent)]">
                          <span className="shrink-0 text-sm font-black text-slate-400 transition-colors group-focus-within:text-[var(--color-mod-fees-accent)]">
                            NPR
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            // A scroll over a focused number input silently
                            // changes the value — unacceptable for money.
                            onWheel={(e) => e.currentTarget.blur()}
                            aria-label="Collection amount in NPR"
                            className="h-full w-full min-w-0 border-0 bg-transparent p-0 text-2xl font-bold text-slate-950 shadow-none outline-none focus:shadow-none focus:ring-0"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="ml-1 text-xs font-semibold text-slate-600">
                            Reference #
                          </label>
                          <Input
                            placeholder="e.g. Check/Bank Ref"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            className="h-12 rounded-xl border-slate-100 bg-slate-50/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="ml-1 text-xs font-semibold text-slate-600">
                            Remarks
                          </label>
                          <Input
                            placeholder="Note for ledger..."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="h-12 rounded-xl border-slate-100 bg-slate-50/50"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="ml-1 text-xs font-semibold text-slate-600">
                        Payment Method
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          {
                            id: "CASH",
                            icon: <Banknote size={18} />,
                            label: "Cash",
                          },
                          {
                            id: "BANK",
                            icon: <CreditCard size={18} />,
                            label: "Bank",
                          },
                          {
                            id: "TRANSFER",
                            icon: <History size={18} />,
                            label: "Transfer",
                          },
                          {
                            id: "MOBILE",
                            icon: <CreditCard size={18} />,
                            label: "Wallet",
                          },
                        ].map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setMethod(m.id)}
                            aria-pressed={method === m.id}
                            className={cn(
                              "flex min-h-11 items-center gap-2 rounded-lg border p-2.5 transition-colors",
                              method === m.id
                                ? "bg-[var(--color-mod-fees-bg)] border-[var(--color-mod-fees-border)] text-[var(--color-mod-fees-text)] shadow-sm"
                                : "bg-white border-slate-100 text-slate-600 hover:border-[var(--color-mod-fees-border)]",
                            )}
                          >
                            <div
                              className={cn(
                                "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center",
                                method === m.id ? "bg-white" : "bg-slate-50",
                              )}
                            >
                              {m.icon}
                            </div>
                            <span className="min-w-0 text-left text-xs font-bold leading-tight">
                              {m.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2 text-warning-800">
                      <AlertCircle size={16} />
                      <span className="max-w-md text-xs font-medium leading-5">
                        Confirmed payments require an authorized refund or reversal for any correction.
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setSelectedInvoiceId(null)}
                        className="min-h-11 px-4 text-sm font-semibold text-slate-600 hover:text-slate-950"
                      >
                        Reset selection
                      </button>
                      <button
                        onClick={() => setIsConfirmingPayment(true)}
                        disabled={
                          isSubmitting ||
                          invoiceDetailQuery.isLoading ||
                          !invoiceDetailQuery.data ||
                          amount <= 0 ||
                          amount > invoiceDetailQuery.data.outstandingAmount
                        }
                        className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg bg-[var(--color-mod-fees-accent)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-mod-fees-text)] disabled:opacity-50"
                      >
                        <CheckSquare size={20} />
                        {isSubmitting ? "Recording payment..." : "Review payment"}
                      </button>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : (
            <div className="flex min-h-[460px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <div className="h-24 w-24 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-300 mb-8 border border-slate-50">
                <Wallet size={48} />
              </div>
              <h4 className="text-2xl font-black text-slate-900 tracking-tight">
                Fee Collection Counter
              </h4>
              <p className="text-sm text-slate-500 mt-3 max-w-[320px] leading-relaxed">
                {studentContext && invoices.length > 1
                  ? "Choose an invoice to collect payment."
                  : studentContext && invoices.length === 0
                    ? "This student has no outstanding invoices."
                    : "Select an outstanding invoice from the search results to load student details and process payment."}
              </p>
              {studentContext && invoices.length === 0 && onChangeStudent ? (
                <button
                  type="button"
                  onClick={onChangeStudent}
                  className="mt-6 rounded-xl bg-[var(--color-mod-fees-accent)] px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-[var(--color-mod-fees-text)]"
                >
                  Change student
                </button>
              ) : null}

            </div>
          )}
        </div>
      </div>

      <Dialog open={isConfirmingPayment} onOpenChange={setIsConfirmingPayment}>
        <DialogContent className="w-full max-w-2xl rounded-2xl bg-white">
          <div className="shrink-0 px-5 pb-4 pt-5 sm:px-8 sm:pb-6 sm:pt-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-mod-fees-border)] bg-[var(--color-mod-fees-bg)] text-[var(--color-mod-fees-text)]">
                <ShieldCheck className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl leading-7 tracking-tight sm:text-2xl">
                  Review payment
                </DialogTitle>
                <DialogDescription className="mt-1.5 max-w-xl leading-6 text-slate-600">
                  Check the details below. SchoolOS will record one payment and
                  issue one receipt.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4 sm:px-8 sm:pb-8">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Student
                  </p>
                  <p className="mt-1 truncate text-base font-bold text-slate-950">
                    {invoiceDetailQuery.data?.student.name ||
                      studentContext?.name ||
                      selectedInvoice?.student?.name ||
                      "Student name not set"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-slate-600">
                  {invoiceDetailQuery.data?.student.studentSystemId ||
                    studentContext?.studentSystemId ||
                    "Student ID not set"}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2">
                <PaymentReviewItem
                  label="Invoice"
                  value={selectedInvoice?.invoiceNumber || "Not selected"}
                />
                <PaymentReviewItem
                  label="Payment method"
                  value={PAYMENT_METHOD_LABELS[method] || method}
                  className="border-t border-slate-200 sm:border-l sm:border-t-0"
                />
                <PaymentReviewItem
                  label="Amount to collect"
                  value={formatCurrency(amount)}
                  emphasized
                  className="border-t border-slate-200"
                />
                <PaymentReviewItem
                  label="Reference"
                  value={reference.trim() || "Not provided"}
                  className="border-t border-slate-200 sm:border-l"
                />
                <PaymentReviewItem
                  label="Outstanding before"
                  value={
                    invoiceDetailQuery.data
                      ? formatCurrency(invoiceDetailQuery.data.outstandingAmount)
                      : "Unavailable"
                  }
                  className="border-t border-slate-200"
                />
                <PaymentReviewItem
                  label="Balance after confirmation"
                  value="Available after backend confirmation"
                  className="border-t border-slate-200 sm:border-l"
                />
              </div>
            </div>

            <div
              className="flex items-start gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 text-warning-900 sm:py-3.5"
              aria-label="Payment correction notice"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p className="text-sm font-medium leading-5">
                This payment posts immediately. Any correction requires an
                authorized refund or reversal.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3.5 sm:px-8 sm:py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmingPayment(false)}
              className="min-w-0 flex-1 gap-2 rounded-xl border-slate-300 sm:flex-none"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to payment
            </Button>
            <Button
              type="button"
              disabled={!selectedInvoice || isSubmitting}
              onClick={() => {
                if (!selectedInvoice) return;
                setIsConfirmingPayment(false);
                onCollect(
                  selectedInvoice.id,
                  amount,
                  method,
                  reference,
                  remarks,
                );
              }}
              className="min-w-0 flex-1 gap-2 rounded-xl !bg-[var(--color-mod-fees-accent)] hover:!bg-[var(--color-mod-fees-text)] sm:flex-none"
            >
              <Receipt className="h-4 w-4" aria-hidden />
              Confirm and issue receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentReviewItem({
  label,
  value,
  className,
  emphasized = false,
}: {
  label: string;
  value: string;
  className?: string;
  emphasized?: boolean;
}) {
  return (
    <div className={cn("min-w-0 px-4 py-3.5 sm:px-5 sm:py-4", className)}>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 break-words text-sm font-bold text-slate-950",
          emphasized &&
            "text-xl tracking-tight text-[var(--color-mod-fees-text)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">
          {label}
        </p>
        <p className="text-sm font-black text-slate-900 truncate mt-0.5">
          {value}
        </p>
        {sub && (
          <p className="text-[0.65rem] font-bold text-slate-500 truncate">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  color = "text-slate-900",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[0.6rem] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
        {label}
      </span>
      <span className={cn("text-lg font-black tracking-tight", color)}>
        {value}
      </span>
    </div>
  );
}

function StudentContextSummary({
  student,
  onChangeStudent,
}: {
  student: StudentCollectionContext["student"];
  onChangeStudent?: () => void;
}) {
  const classSection = [student.className, student.sectionName]
    .filter(Boolean)
    .join(" / ");

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-900">
            {student.name}
          </p>
          <p className="mt-1 text-[0.65rem] font-black uppercase tracking-widest text-slate-500">
            {student.studentSystemId}
          </p>
        </div>
        {onChangeStudent ? (
          <button
            type="button"
            onClick={onChangeStudent}
            className="shrink-0 text-[0.65rem] font-black uppercase tracking-widest text-[var(--color-mod-fees-accent)] hover:text-[var(--color-mod-fees-text)]"
          >
            Change
          </button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 text-xs font-bold text-slate-600">
        <div className="flex items-center gap-2">
          <GraduationCap size={14} className="text-slate-400" />
          <span>{classSection || "Class not set"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone size={14} className="text-slate-400" />
          <span>
            {student.guardianName || "Guardian not recorded"}
            {student.guardianPhone ? ` · ${student.guardianPhone}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function CheckSquare({
  size,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="9 11 12 14 22 4"></polyline>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
    </svg>
  );
}
