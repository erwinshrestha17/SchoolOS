'use client';

import { useQuery } from '@tanstack/react-query';
import { Lock, Unlock } from 'lucide-react';
import { api } from '../../lib/api';
import { SectionCard } from '../ui/section-card';
import { cn } from '../../lib/utils';
import { useState } from 'react';
import { FiscalPeriodActions } from './fiscal-period-actions';
import { FiscalYearCloseDialog } from './fiscal-year-close-dialog';

export function FiscalManagementView() {
  const [fyCloseOpen, setFyCloseOpen] = useState(false);
  const [fyMode, setFyMode] = useState<'CLOSE' | 'REOPEN'>('CLOSE');
  const [selectedFy, setSelectedFy] = useState<any>(null);

  const fiscalYearsQuery = useQuery({ 
    queryKey: ['fiscal-years'], 
    queryFn: () => api.listFiscalYears() 
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <SectionCard
        title="Fiscal Years & Periods"
        description="Manage accounting periods and fiscal year status for financial reporting."
      >
        <div className="grid gap-4">
          {(fiscalYearsQuery.data ?? []).map((year) => (
            <div key={year.id} className="rounded-[2rem] border border-slate-100 bg-slate-50/50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{year.name}</p>
                  <p className="text-sm text-slate-500">
                    {new Date(year.startDate).toLocaleDateString()} - {new Date(year.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider",
                    year.status === 'OPEN' ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                  )}>
                    {year.status}
                  </span>
                  {year.status === 'OPEN' ? (
                    <button
                      onClick={() => {
                        setSelectedFy(year);
                        setFyMode('CLOSE');
                        setFyCloseOpen(true);
                      }}
                      className="inline-flex h-8 items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      <Lock size={14} />
                      Close Year
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedFy(year);
                        setFyMode('REOPEN');
                        setFyCloseOpen(true);
                      }}
                      className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary-600 px-3 text-xs font-bold text-white hover:bg-primary-700"
                    >
                      <Unlock size={14} />
                      Reopen
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {(year.periods ?? []).map((period: any) => (
                  <div key={period.id} className="flex flex-col gap-1 rounded-2xl bg-white border border-slate-100 p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{period.label}</span>
                      <span className={cn(
                        "h-2 w-2 rounded-full",
                        period.status === 'OPEN' ? "bg-emerald-500" : period.status === 'LOCKED' ? "bg-amber-500" : "bg-slate-400"
                      )} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-bold text-slate-700">{period.status}</span>
                      <FiscalPeriodActions periodId={period.id} status={period.status} label={period.label} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <FiscalYearCloseDialog
        isOpen={fyCloseOpen}
        onClose={() => setFyCloseOpen(false)}
        fiscalYear={selectedFy}
        mode={fyMode}
      />
    </div>
  );
}
