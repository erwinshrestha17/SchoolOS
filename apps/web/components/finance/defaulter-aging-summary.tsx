'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Clock, ChevronRight, Download, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/ui/loading-state';

export function DefaulterAgingSummary() {
  const defaultersQuery = useQuery({
    queryKey: ['defaulters'],
    queryFn: () => api.listDefaulters(),
  });
  const exportMutation = useMutation({
    mutationFn: () =>
      api.downloadReport('defaulter-aging-report', {
        format: 'csv',
        filters: {},
      }),
  });

  if (defaultersQuery.isLoading) return <LoadingState variant="page" label="Analyzing aging buckets..." />;

  const defaulters = defaultersQuery.data || [];
  
  const buckets = {
    '1-30': { count: 0, amount: 0 },
    '31-60': { count: 0, amount: 0 },
    '61-90': { count: 0, amount: 0 },
    '90+': { count: 0, amount: 0 },
  };

  defaulters.forEach((d: any) => {
    const bucket = d.agingBucket as keyof typeof buckets;
    if (buckets[bucket] !== undefined) {
      buckets[bucket].count++;
      buckets[bucket].amount += d.outstanding;
    } else {
      buckets['90+'].count++;
      buckets['90+'].amount += d.outstanding;
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const bucketData = [
    { label: '1-30 Days', key: '1-30', color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: '31-60 Days', key: '31-60', color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: '61-90 Days', key: '61-90', color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: '90+ Days', key: '90+', color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' },
  ] as const;

  return (
    <section className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">Defaulter Aging</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Backend defaulter buckets for collection follow-up and guardian reminders.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate()}
          data-testid="finance-defaulter-aging-csv-export"
        >
          <Download size={14} />
          {exportMutation.isPending ? 'Exporting...' : 'Export Aging CSV'}
        </button>
      </div>

      {exportMutation.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {exportMutation.error.message}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-4">
        {bucketData.map((b) => (
          <div 
            key={b.label} 
            className={cn(
              "group relative p-6 bg-white rounded-2xl border transition-all duration-300 hover:shadow-md",
              b.border
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500", b.bg, b.color)}>
                <Clock size={20} />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">{b.label}</span>
                <div className="flex items-center gap-1 mt-1">
                   <TrendingUp size={10} className={b.color} />
                   <span className={cn("text-[0.65rem] font-bold", b.color)}>Critical</span>
                </div>
              </div>
            </div>
            
            <p className="text-3xl font-black text-slate-900 tracking-tighter">
              {buckets[b.key].count}
            </p>
            <div className="flex items-center justify-between mt-1">
               <p className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-tight">Defaulters</p>
               <p className="text-xs font-black text-slate-700">{formatCurrency(buckets[b.key].amount)}</p>
            </div>
            
            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-50">
               <button className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors flex items-center gap-1">
                 View List
                 <ChevronRight size={12} />
               </button>
               <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", b.color.replace('text', 'bg'))} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
