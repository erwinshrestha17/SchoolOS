"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";
import { Loader2, Send, Download, Check, AlertCircle } from "lucide-react";

export function DefaulterQueueTab() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const classId = searchParams.get("defaulterClassId") ?? "";
  const feeHeadId = searchParams.get("defaulterFeeHeadId") ?? "";
  const search = searchParams.get("defaulterSearch") ?? "";
  const page = Math.max(
    1,
    Number(searchParams.get("defaulterPage") ?? "1") || 1,
  );
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [reminderResult, setReminderResult] = useState<any | null>(null);

  // Queries
  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: api.listClasses,
  });

  const feeHeadsQuery = useQuery({
    queryKey: ["fee-heads"],
    queryFn: api.listFeeHeads,
  });

  const defaultersQuery = useQuery({
    queryKey: ["defaulters-queue", classId, feeHeadId, search, page],
    queryFn: () =>
      api.listDefaulters({
        classId: classId || null,
        feeHeadId: feeHeadId || null,
        search: search || null,
        page,
        limit: 25,
      }),
  });

  const updateFilters = (
    updates: Partial<
      Record<
        | "defaulterClassId"
        | "defaulterFeeHeadId"
        | "defaulterSearch"
        | "defaulterPage",
        string | number
      >
    >,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === 1) params.delete(key);
      else params.set(key, String(value));
    }
    if (!("defaulterPage" in updates)) params.delete("defaulterPage");
    router.replace(`/dashboard/finance?${params.toString()}`, {
      scroll: false,
    });
    setSelectedInvoiceIds([]);
  };

  // Mutation
  const reminderMutation = useMutation({
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["defaulters-queue"] });
      setReminderResult(data);
      setSelectedInvoiceIds([]);
      setTimeout(() => setReminderResult(null), 5000);
    },
    mutationFn: (body: any) => api.sendDefaulterReminders(body),
  });

  const onExportAgingCsv = async () => {
    setIsExporting(true);
    try {
      await api.downloadReport("defaulter-aging-report", {
        format: "csv",
        filters: {
          asOfDate: new Date().toISOString(),
          classId: classId || undefined,
          feeHeadId: feeHeadId || undefined,
        },
      });
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleToggleSelect = (invoiceId: string) => {
    setSelectedInvoiceIds((prev) =>
      prev.includes(invoiceId)
        ? prev.filter((id) => id !== invoiceId)
        : [...prev, invoiceId],
    );
  };

  const handleSelectAll = () => {
    const list = defaultersQuery.data?.items || [];
    if (selectedInvoiceIds.length === list.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(list.map((d) => d.invoiceId));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const defaulters = defaultersQuery.data?.items || [];

  return (
    <SectionCard
      title="Overdue Invoice Follow-up"
      description="Track outstanding bills, filter by class/fees, and dispatch notification reminders."
      headerAction={
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50"
            disabled={isExporting}
            onClick={onExportAgingCsv}
          >
            <Download size={14} />
            {isExporting ? "Exporting..." : "Export Aging CSV"}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Search
              </label>
              <input
                value={search}
                onChange={(event) =>
                  updateFilters({ defaulterSearch: event.target.value })
                }
                placeholder="Student or invoice"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Class
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[var(--color-mod-fees-accent)] focus:outline-none bg-white"
                value={classId}
                onChange={(e) => {
                  updateFilters({ defaulterClassId: e.target.value });
                }}
              >
                <option value="">All Classes</option>
                {classesQuery.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Fee Head
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[var(--color-mod-fees-accent)] focus:outline-none bg-white"
                value={feeHeadId}
                onChange={(e) => {
                  updateFilters({ defaulterFeeHeadId: e.target.value });
                }}
              >
                <option value="">All Fee Heads</option>
                {feeHeadsQuery.data?.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.code} · {h.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs disabled:opacity-50"
              onClick={handleSelectAll}
              disabled={defaulters.length === 0}
            >
              {selectedInvoiceIds.length === defaulters.length
                ? "Deselect All"
                : "Select All"}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-mod-fees-accent)] px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-[var(--color-mod-fees-text)] disabled:opacity-50 transition-all"
              disabled={
                selectedInvoiceIds.length === 0 || reminderMutation.isPending
              }
              onClick={() =>
                reminderMutation.mutate({
                  invoiceIds: selectedInvoiceIds,
                  channels: ["EMAIL", "SMS", "PUSH"],
                  message: "Fee payment reminder from SchoolOS.",
                })
              }
            >
              <Send size={12} />
              {reminderMutation.isPending ? "Sending..." : "Remind Selected"}
            </button>
          </div>
        </div>

        {reminderResult && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
            <Check size={14} />
            Reminders sent! Requested: {reminderResult.requested}, Dispatched:{" "}
            {reminderResult.reminded}.
          </div>
        )}

        {defaultersQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : defaulters.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-medium">
            No overdue invoices found for the current selection.
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {defaulters.map((item) => {
                const isChecked = selectedInvoiceIds.includes(item.invoiceId);
                return (
                  <div
                    key={item.invoiceId}
                    onClick={() => handleToggleSelect(item.invoiceId)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                      isChecked
                        ? "border-[var(--color-mod-fees-accent)] bg-[var(--color-mod-fees-bg)] shadow-sm shadow-[var(--color-mod-fees-border)]/20"
                        : "border-slate-100 bg-white hover:border-slate-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Controlled by outer click
                      className="h-4 w-4 rounded border-slate-300 text-[var(--color-mod-fees-accent)] focus:ring-[var(--color-mod-fees-accent)] mt-0.5"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          {item.studentName}
                        </span>
                        <Badge
                          variant="neutral"
                          className="text-[9px] font-black tracking-widest px-1.5 py-0"
                        >
                          {item.agingBucket}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          {item.invoiceNumber}
                        </span>
                        <span className="font-extrabold text-rose-600">
                          {formatCurrency(item.outstanding)}
                        </span>
                      </div>
                      {(item.reportCardBlocked || item.hallTicketBlocked) && (
                        <div className="flex gap-1.5 pt-1">
                          {item.reportCardBlocked && (
                            <Badge
                              variant="destructive"
                              className="text-[8px] font-black px-1.5 py-0"
                            >
                              Report Card Blocked
                            </Badge>
                          )}
                          {item.hallTicketBlocked && (
                            <Badge
                              variant="destructive"
                              className="text-[8px] font-black px-1.5 py-0"
                            >
                              Hall Ticket Blocked
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-between text-xs font-bold text-slate-500">
              <span>
                {Math.min(
                  (page - 1) * 25 + 1,
                  defaultersQuery.data?.total ?? 0,
                )}
                –{Math.min(page * 25, defaultersQuery.data?.total ?? 0)} of{" "}
                {defaultersQuery.data?.total ?? 0}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => updateFilters({ defaulterPage: page - 1 })}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!defaultersQuery.data?.hasNextPage}
                  onClick={() => updateFilters({ defaulterPage: page + 1 })}
                  className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}
