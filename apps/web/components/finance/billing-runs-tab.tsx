"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";
import {
  Loader2,
  Plus,
  Calendar,
  AlertTriangle,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatBsDateForInput,
  formatBsDateOnly,
  parseBsDateInput,
  toGregorianDateFromBs,
  toNepalLocalDateTime,
  zonedNepalDateTimeToUtc,
} from "@schoolos/core";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function BillingRunsTab() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const now = toNepalLocalDateTime(new Date());
  const todayBs = formatBsDateForInput(new Date());
  const billingPage = Math.max(
    1,
    Number(searchParams.get("billingPage") ?? "1") || 1,
  );
  const billingSearch = searchParams.get("billingSearch") ?? "";

  // Form State
  const [academicYearId, setAcademicYearId] = useState("");
  const [feePlanId, setFeePlanId] = useState("");
  const [runMonth, setRunMonth] = useState(now.month);
  const [runYear, setRunYear] = useState(now.year);
  const [dueDateBs, setDueDateBs] = useState(todayBs);

  // Confirmation Modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  // Queries
  const academicYearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: api.listAcademicYears,
  });

  const feePlansQuery = useQuery({
    queryKey: ["fee-plans"],
    queryFn: api.listFeePlans,
  });

  const billingRunsQuery = useQuery({
    queryKey: ["billing-runs", billingPage, billingSearch],
    queryFn: () =>
      api.listBillingRunsPage({
        page: billingPage,
        limit: 25,
        search: billingSearch || undefined,
      }),
  });

  const updateBillingUrl = (updates: { page?: number; search?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.page !== undefined) {
      if (updates.page <= 1) params.delete("billingPage");
      else params.set("billingPage", String(updates.page));
    }
    if (updates.search !== undefined) {
      const nextSearch = updates.search.trim();
      if (nextSearch) params.set("billingSearch", nextSearch);
      else params.delete("billingSearch");
      params.delete("billingPage");
    }
    router.replace(`${pathname}?${params.toString()}`, {
      scroll: false,
    });
  };

  // Mutation
  const billingRunMutation = useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-runs"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setConfirmOpen(false);
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 4000);
    },
    mutationFn: (body: any) => api.generateBillingRun(body),
  });

  const handleTriggerRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYearId) return;
    setConfirmOpen(true);
  };

  const confirmBillingRun = () => {
    const dueDate = zonedNepalDateTimeToUtc(
      toGregorianDateFromBs(parseBsDateInput(dueDateBs)),
    );
    billingRunMutation.mutate({
      academicYearId,
      feePlanId: feePlanId || null,
      runMonth,
      runYear,
      dueDate: dueDate.toISOString(),
    });
  };

  const selectedYearName =
    academicYearsQuery.data?.find((y) => y.id === academicYearId)?.name || "";
  const selectedPlanName = feePlanId
    ? feePlansQuery.data?.find((p) => p.id === feePlanId)?.name ||
      "Selected Plan"
    : "All Active Fee Plans";

  const getMonthName = (monthNum: number) => {
    return MONTH_NAMES[monthNum - 1] ?? `Month ${monthNum}`;
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Run Invoice Form */}
      <div className="space-y-8">
        <SectionCard
          title="Run Monthly Invoices"
          description="Trigger bulk student invoice generation from configured fee plans."
        >
          <form onSubmit={handleTriggerRun} className="space-y-4">
            {successMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700">
                <Check size={14} />
                Billing run started successfully! Invoices are generating.
              </div>
            )}
            {billingRunMutation.isError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700">
                <AlertCircle size={14} />
                {billingRunMutation.error.message ||
                  "Failed to start billing run."}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Academic Year
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--color-mod-fees-accent)] focus:outline-none bg-white"
                  value={academicYearId}
                  onChange={(e) => setAcademicYearId(e.target.value)}
                  required
                  disabled={billingRunMutation.isPending}
                >
                  <option value="">Select Academic Year</option>
                  {academicYearsQuery.data?.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.isCurrent ? "(Current)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Fee Plan Scope
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--color-mod-fees-accent)] focus:outline-none bg-white"
                  value={feePlanId}
                  onChange={(e) => setFeePlanId(e.target.value)}
                  disabled={billingRunMutation.isPending}
                >
                  <option value="">All Active Plans (Recommended)</option>
                  {feePlansQuery.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Billing Month
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--color-mod-fees-accent)] focus:outline-none"
                  value={runMonth}
                  onChange={(e) => setRunMonth(Number(e.target.value))}
                  required
                  disabled={billingRunMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Billing Year
                </label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--color-mod-fees-accent)] focus:outline-none"
                  value={runYear}
                  onChange={(e) => setRunYear(Number(e.target.value))}
                  required
                  disabled={billingRunMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Due Date (BS)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}-\d{2}-\d{2}"
                  placeholder="2083-03-13"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--color-mod-fees-accent)] focus:outline-none"
                  value={dueDateBs}
                  onChange={(e) => setDueDateBs(e.target.value)}
                  required
                  disabled={billingRunMutation.isPending}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--color-mod-fees-accent)] px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-[var(--color-mod-fees-text)] disabled:opacity-50 transition-all shadow-sm"
              disabled={billingRunMutation.isPending || !academicYearId}
            >
              {billingRunMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating Invoices...
                </>
              ) : (
                <>
                  <Calendar className="h-3.5 w-3.5" />
                  Trigger Billing Run
                </>
              )}
            </button>
          </form>
        </SectionCard>
      </div>

      {/* Billing Runs History */}
      <div className="space-y-8">
        <SectionCard title="Recent Billing Run Logs">
          <input
            value={billingSearch}
            onChange={(event) =>
              updateBillingUrl({ search: event.target.value })
            }
            placeholder="Search fee plan"
            className="mb-4 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
          />
          {billingRunsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : billingRunsQuery.isError ? (
            <div className="py-8 text-center text-sm font-medium text-rose-600">
              Billing run history could not be loaded.
            </div>
          ) : !billingRunsQuery.data?.items.length ? (
            <div className="py-8 text-center text-slate-400 text-sm font-medium">
              No historical billing runs found.
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-100 rounded-2xl bg-slate-50">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                      <th className="px-4 py-3">Billing Target</th>
                      <th className="px-4 py-3">Run Details</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Invoices Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {billingRunsQuery.data.items.map((run) => (
                      <tr
                        key={run.id}
                        className="hover:bg-slate-100/35 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">
                              {getMonthName(run.runMonth)} {run.runYear}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Backend run period
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <Badge
                              variant="neutral"
                              className="w-fit text-[9px] font-black px-1.5 py-0"
                            >
                              {run.academicYear?.name || "Year"}
                            </Badge>
                            {run.feePlan && (
                              <span className="text-[10px] text-slate-500 font-semibold">
                                Plan: {run.feePlan.code}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              run.status === "GENERATED"
                                ? "success"
                                : run.status === "DRAFT"
                                  ? "phase2"
                                  : "destructive"
                            }
                            className="text-[9px] font-black px-1.5 py-0"
                          >
                            {run.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-700">
                          {run.invoiceCount ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs font-bold text-slate-500">
                <span>
                  {Math.min(
                    (billingPage - 1) * billingRunsQuery.data.limit + 1,
                    billingRunsQuery.data.total,
                  )}
                  –
                  {Math.min(
                    billingPage * billingRunsQuery.data.limit,
                    billingRunsQuery.data.total,
                  )}{" "}
                  of {billingRunsQuery.data.total}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={billingPage <= 1}
                    onClick={() => updateBillingUrl({ page: billingPage - 1 })}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!billingRunsQuery.data.hasNextPage}
                    onClick={() => updateBillingUrl({ page: billingPage + 1 })}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <AlertTriangle className="text-amber-500" size={24} />
              Confirm Billing Run
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500">
              You are about to generate mass invoices for all enrolled students
              matching the configuration below.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 space-y-2 text-xs font-bold text-amber-800">
            <p>
              • Academic Year:{" "}
              <span className="text-slate-900 font-black">
                {selectedYearName}
              </span>
            </p>
            <p>
              • Plan Filter:{" "}
              <span className="text-slate-900 font-black">
                {selectedPlanName}
              </span>
            </p>
            <p>
              • Month / Year:{" "}
              <span className="text-slate-900 font-black">
                {getMonthName(runMonth)} {runYear}
              </span>
            </p>
            <p>
              • Invoices Due:{" "}
              <span className="text-slate-900 font-black">
                {formatBsDateOnly(parseBsDateInput(dueDateBs))}
              </span>
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setConfirmOpen(false)}
              disabled={billingRunMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl bg-[var(--color-mod-fees-accent)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--color-mod-fees-text)] disabled:opacity-50 flex items-center gap-2"
              onClick={confirmBillingRun}
              disabled={billingRunMutation.isPending}
            >
              {billingRunMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Invoices"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
