'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Clock, ChevronRight, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/ui/loading-state';

export function DefaulterAgingSummary() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaultersQuery = useQuery({
    queryKey: ['defaulters'],
    queryFn: () => api.listDefaulters(),
  });

  const viewBucket = (bucketKey: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('defaulterAgingBucket', bucketKey);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    document
      .getElementById('defaulter-queue')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const exportMutation = useMutation({
    mutationFn: () =>
      api.downloadReport('defaulter-aging-report', {
        format: 'csv',
        filters: {},
      }),
  });

  if (defaultersQuery.isLoading) return <LoadingState variant="page" label="Analyzing aging buckets..." />;

  const segments = new Map(
    (defaultersQuery.data?.segments ?? []).map((segment) => [
      segment.agingBucket,
      segment,
    ]),
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const bucketData = [
    { label: '0-30 days', severity: 'Recent', key: '0-30', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: '31-60 days', severity: 'Follow-up', key: '31-60', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: '61-90 days', severity: 'High priority', key: '61-90', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: '90+ days', severity: 'Critical', key: '90+', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-100' },
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
          {exportMutation.isPending ? 'Exporting...' : 'Export Summary'}
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
                   <span className={cn("text-xs font-semibold", b.color)}>{b.severity}</span>
                </div>
              </div>
            </div>
            
            <p className="text-3xl font-black text-slate-900 tracking-tighter">
              {segments.get(b.key)?.count ?? 0}
            </p>
            <div className="flex items-center justify-between mt-1">
               <p className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-tight">Defaulters</p>
               <p className="text-xs font-black text-slate-700">{formatCurrency(segments.get(b.key)?.outstanding ?? 0)}</p>
            </div>
            
            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-50">
               <button
                 type="button"
                 onClick={() => viewBucket(b.key)}
                 className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors flex items-center gap-1"
               >
                 View List
                 <ChevronRight size={12} />
               </button>
               <span className={cn("text-xs font-semibold", b.color)}>{b.label}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
