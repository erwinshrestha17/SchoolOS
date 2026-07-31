"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChartAccountSummary, FiscalYearSummary } from "@schoolos/core";
import { api } from "@/lib/api";
import { SectionCard } from "@/components/ui/section-card";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { PageState } from "@/components/ui/page-state";

type FiscalBudgetView = {
  id: string;
  name: string;
  status: string;
  fiscalYearId: string;
  lines: Array<{
    id: string;
    chartAccountId: string;
    amount: string;
    chartAccount: { code: string; name: string };
  }>;
};

export default function AccountingBudgetsPage() {
  const queryClient = useQueryClient();
  const [selectedYearId, setSelectedYearId] = useState("");
  const [budgetName, setBudgetName] = useState("Annual Budget");
  const [selectedBudgetId, setSelectedBudgetId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [lineAmount, setLineAmount] = useState("");
  const [approveReason, setApproveReason] = useState("Approved for pilot operations");

  const fiscalYearsQuery = useQuery({
    queryKey: ["fiscal-years"],
    queryFn: () => api.listFiscalYears(),
  });

  const accountsQuery = useQuery({
    queryKey: ["chart-accounts", "budget-entry"],
    queryFn: () => api.listChartAccounts(),
  });

  const budgetsQuery = useQuery({
    queryKey: ["fiscal-budgets", selectedYearId],
    queryFn: () => api.listFiscalBudgets(selectedYearId || undefined),
    enabled: Boolean(selectedYearId),
  });

  const budgets = (budgetsQuery.data as FiscalBudgetView[] | undefined) ?? [];
  const selectedBudget = budgets.find((budget) => budget.id === selectedBudgetId);

  const activeYear = useMemo(() => {
    const years = (fiscalYearsQuery.data ?? []) as FiscalYearSummary[];
    if (selectedYearId) {
      return years.find((year) => year.id === selectedYearId);
    }
    return years.find((year) => year.status === "OPEN") ?? years[0];
  }, [fiscalYearsQuery.data, selectedYearId]);

  useEffect(() => {
    if (!selectedYearId && activeYear?.id) {
      setSelectedYearId(activeYear.id);
    }
  }, [activeYear?.id, selectedYearId]);

  const createBudgetMutation = useMutation({
    mutationFn: () =>
      api.createFiscalBudget({
        fiscalYearId: selectedYearId,
        name: budgetName.trim(),
      }),
    onSuccess: (budget) => {
      const created = budget as FiscalBudgetView;
      setSelectedBudgetId(created.id);
      queryClient.invalidateQueries({ queryKey: ["fiscal-budgets"] });
    },
  });

  const upsertLineMutation = useMutation({
    mutationFn: () =>
      api.upsertFiscalBudgetLines(selectedBudgetId, {
        lines: [
          {
            chartAccountId: selectedAccountId,
            amount: lineAmount,
          },
        ],
      }),
    onSuccess: () => {
      setSelectedAccountId("");
      setLineAmount("");
      queryClient.invalidateQueries({ queryKey: ["fiscal-budgets"] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      api.approveFiscalBudget(selectedBudgetId, approveReason.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-budgets"] });
    },
  });

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Fiscal Budgets"
        description="Enter and approve an annual account-level budget for budget-vs-actual reporting."
      />

      <SectionCard title="Budget setup">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Fiscal year
            </label>
            <Select
              value={selectedYearId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                setSelectedYearId(e.target.value);
                setSelectedBudgetId("");
              }}
              className="w-full"
            >
              <option value="">Select fiscal year</option>
              {(fiscalYearsQuery.data ?? []).map((year: FiscalYearSummary) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Budget name
            </label>
            <input
              value={budgetName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setBudgetName(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            type="button"
            disabled={
              !selectedYearId ||
              !budgetName.trim() ||
              createBudgetMutation.isPending
            }
            onClick={() => createBudgetMutation.mutate()}
            className="rounded-xl bg-[var(--color-mod-accounting-accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {createBudgetMutation.isPending ? "Creating..." : "Create draft budget"}
          </button>
        </div>
      </SectionCard>

      {budgetsQuery.isLoading ? (
        <LoadingState label="Loading budgets..." />
      ) : budgets.length === 0 ? (
        <PageState
          tone="info"
          title="No budgets yet"
          description="Create a draft budget for the selected fiscal year."
        />
      ) : (
        <SectionCard title="Draft budget lines">
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <Select
              value={selectedBudgetId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setSelectedBudgetId(e.target.value)
              }
              className="w-full"
            >
              <option value="">Select budget</option>
              {budgets.map((budget) => (
                <option key={budget.id} value={budget.id}>
                  {budget.name} ({budget.status})
                </option>
              ))}
            </Select>
            {selectedBudget && (
              <p className="text-sm font-semibold text-slate-600">
                Status: {selectedBudget.status}
              </p>
            )}
          </div>

          {selectedBudget?.status === "DRAFT" && (
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <Select
                value={selectedAccountId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setSelectedAccountId(e.target.value)
                }
                className="w-full"
              >
                <option value="">Select account</option>
                {(accountsQuery.data ?? []).map((account: ChartAccountSummary) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </Select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Budget amount"
                value={lineAmount}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setLineAmount(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
              />
              <button
                type="button"
                disabled={
                  !selectedAccountId ||
                  !lineAmount ||
                  upsertLineMutation.isPending
                }
                onClick={() => upsertLineMutation.mutate()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                {upsertLineMutation.isPending ? "Saving..." : "Add / update line"}
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2 text-right">Budget amount</th>
                </tr>
              </thead>
              <tbody>
                {(selectedBudget?.lines ?? []).map((line) => (
                  <tr key={line.id} className="border-b border-slate-50">
                    <td className="px-3 py-2 font-semibold text-slate-700">
                      {line.chartAccount.code} - {line.chartAccount.name}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900">
                      {line.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedBudget?.status === "DRAFT" &&
            (selectedBudget.lines?.length ?? 0) > 0 && (
              <div className="mt-6 space-y-3">
                <textarea
                  value={approveReason}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setApproveReason(e.target.value)
                  }
                  className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Approval reason"
                />
                <button
                  type="button"
                  disabled={
                    approveReason.trim().length < 3 || approveMutation.isPending
                  }
                  onClick={() => approveMutation.mutate()}
                  className="rounded-xl bg-[var(--color-mod-accounting-accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  {approveMutation.isPending ? "Approving..." : "Approve budget"}
                </button>
              </div>
            )}
        </SectionCard>
      )}
    </div>
  );
}
