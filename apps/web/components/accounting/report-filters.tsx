'use client';

import { useQuery } from '@tanstack/react-query';
import { Calendar, Filter } from 'lucide-react';
import { api } from '../../lib/api';
import { Select } from '../ui/select';

interface ReportFiltersProps {
  onFilterChange: (filters: {
    startDate?: string;
    endDate?: string;
    fiscalYearId?: string;
    fiscalPeriodId?: string;
  }) => void;
}

export function ReportFilters({ onFilterChange }: ReportFiltersProps) {
  const fiscalYearsQuery = useQuery({
    queryKey: ['fiscal-years'],
    queryFn: () => api.listFiscalYears(),
  });

  const activeYear = (fiscalYearsQuery.data ?? []).find(y => y.status === 'OPEN');

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Filter size={14} />
        </div>
        <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Report Filters</span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter ml-1">Fiscal Year</p>
          <Select
            defaultValue={activeYear?.id ?? ""}
            onChange={(e) => onFilterChange({ fiscalYearId: e.target.value, fiscalPeriodId: undefined })}
            className="h-10 min-w-[180px] rounded-xl border-slate-200 text-xs font-bold"
          >
            <option value="">All Fiscal Years</option>
            {(fiscalYearsQuery.data ?? []).map((year) => (
              <option key={year.id} value={year.id}>
                {year.name} ({year.status})
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter ml-1">Date Range</p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                onChange={(e) => onFilterChange({ startDate: e.target.value })}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
              />
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase">to</span>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                onChange={(e) => onFilterChange({ endDate: e.target.value })}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
