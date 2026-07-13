"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Filter } from "lucide-react";
import { api } from "../../lib/api";
import { Select } from "../ui/select";
import { cn } from "../../lib/utils";
import { formatBsDate } from "@schoolos/core";

interface ReportFiltersProps {
  onFilterChange: (filters: {
    startDate?: string;
    endDate?: string;
    fiscalYearId?: string;
    fiscalPeriodId?: string;
    accountId?: string;
  }) => void;
}

export function ReportFilters({ onFilterChange }: ReportFiltersProps) {
  const fiscalYearsQuery = useQuery({
    queryKey: ["fiscal-years"],
    queryFn: () => api.listFiscalYears(),
  });
  const accountsQuery = useQuery({
    queryKey: ["chart-accounts", "report-filters"],
    queryFn: () => api.listChartAccounts(),
  });

  const activeYear = (fiscalYearsQuery.data ?? []).find(
    (y) => y.status === "OPEN",
  );
  const [selectedYearId, setSelectedYearId] = useState<string>("");

  useEffect(() => {
    if (activeYear && !selectedYearId) {
      setSelectedYearId(activeYear.id);
      onFilterChange({ fiscalYearId: activeYear.id });
    }
  }, [activeYear, selectedYearId, onFilterChange]);

  const selectedYear = (fiscalYearsQuery.data ?? []).find(
    (y) => y.id === selectedYearId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Filter size={14} />
          </div>
          <span className="text-xs font-black text-slate-900 uppercase tracking-widest">
            Report Filters
          </span>
        </div>

        {selectedYear && (
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                selectedYear.status === "OPEN"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-slate-100 text-slate-600 border border-slate-200",
              )}
            >
              <div
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  selectedYear.status === "OPEN"
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-slate-400",
                )}
              />
              {selectedYear.status} YEAR
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase">
              {formatBsDate(selectedYear.startDate)} -{" "}
              {formatBsDate(selectedYear.endDate)}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="space-y-1.5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight ml-1">
            Fiscal Year
          </p>
          <Select
            value={selectedYearId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedYearId(val);
              onFilterChange({ fiscalYearId: val, fiscalPeriodId: undefined });
            }}
            className="h-11 w-full rounded-xl border-slate-200 text-xs font-bold shadow-sm"
          >
            <option value="">All Fiscal Years</option>
            {(fiscalYearsQuery.data ?? []).map((year) => (
              <option key={year.id} value={year.id}>
                {year.name} {year.status === "OPEN" ? " (Active)" : ""}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight ml-1">
            Ledger Account
          </p>
          <Select
            defaultValue=""
            onChange={(e) =>
              onFilterChange({ accountId: e.target.value || undefined })
            }
            className="h-11 w-full rounded-xl border-slate-200 text-xs font-bold shadow-sm"
          >
            <option value="">All mapped accounts</option>
            {(accountsQuery.data ?? [])
              .filter((account) => account.isActive !== false)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
          </Select>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight ml-1">
            Custom Date Range
          </p>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Calendar
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="date"
                onChange={(e) => onFilterChange({ startDate: e.target.value })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 shadow-sm"
              />
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase shrink-0">
              to
            </span>
            <div className="relative flex-1">
              <Calendar
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="date"
                onChange={(e) => onFilterChange({ endDate: e.target.value })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
