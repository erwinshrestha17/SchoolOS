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
    queryFn: api.listFiscalYears,
  });

  const handleYearChange = (yearId: string) => {
    onFilterChange({ fiscalYearId: yearId, fiscalPeriodId: undefined });
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Filter size={16} className="text-slate-400" />
        <span className="text-sm font-semibold text-slate-600">Filters:</span>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value=""
          onChange={(e) => handleYearChange(e.target.value)}
          className="h-9 min-w-[160px] rounded-xl border-slate-200 text-xs font-semibold"
        >
          <option value="">All Fiscal Years</option>
          {(fiscalYearsQuery.data ?? []).map((year) => (
            <option key={year.id} value={year.id}>
              {year.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="date"
            onChange={(e) => onFilterChange({ startDate: e.target.value })}
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-600 outline-none transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
          />
        </div>
        <span className="text-slate-400">to</span>
        <div className="relative">
          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="date"
            onChange={(e) => onFilterChange({ endDate: e.target.value })}
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-600 outline-none transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
          />
        </div>
      </div>
    </div>
  );
}
